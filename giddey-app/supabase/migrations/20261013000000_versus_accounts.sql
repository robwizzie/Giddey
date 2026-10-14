-- ═══════════════════════════════════════════════════════════════
--  Giddey Versus — optional accounts
--
--  versus_profiles   one per signed-in user (display name, franchise guys)
--  rivalries         a head-to-head between two named seats; the creator
--                    holds seat 0, the opponent joins seat 1 with the invite
--                    code (until then seat 1 is just a name — a "guest")
--  rivalry_members   which accounts hold which seat
--  games             every logged game, stored as the app's own JSON
--
--  Row level security: you only ever see rivalries you're a member of,
--  their games, and the profiles of people you share a rivalry with.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── tables ─────────────────────────────────────────────────────

create table public.versus_profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	name text not null check (char_length(btrim(name)) between 1 and 12),
	favorites text[] not null default '{}' check (cardinality(favorites) <= 5),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.rivalries (
	id uuid primary key default gen_random_uuid(),
	created_by uuid not null default auth.uid() references public.versus_profiles (id) on delete cascade,
	-- the names games are logged under: seat 0 (creator) and seat 1 (opponent)
	name_a text not null check (char_length(btrim(name_a)) between 1 and 12),
	name_b text not null check (char_length(btrim(name_b)) between 1 and 12),
	invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
	-- "reset rivalry record": games played up to here are gone on every phone
	reset_at timestamptz,
	created_at timestamptz not null default now(),
	check (lower(btrim(name_a)) <> lower(btrim(name_b)))
);

create table public.rivalry_members (
	rivalry_id uuid not null references public.rivalries (id) on delete cascade,
	user_id uuid not null references public.versus_profiles (id) on delete cascade,
	seat smallint not null check (seat in (0, 1)),
	joined_at timestamptz not null default now(),
	primary key (rivalry_id, user_id),
	unique (rivalry_id, seat)
);

create index rivalry_members_user on public.rivalry_members (user_id);

create table public.games (
	rivalry_id uuid not null references public.rivalries (id) on delete cascade,
	-- "<timestamp>|<names sorted>", the same key the app de-dupes on
	game_key text not null check (char_length(game_key) <= 80),
	played_at timestamptz not null,
	data jsonb not null check (pg_column_size(data) < 16384),
	created_by uuid default auth.uid() references public.versus_profiles (id) on delete set null,
	created_at timestamptz not null default now(),
	primary key (rivalry_id, game_key)
);

create index games_rivalry_played on public.games (rivalry_id, played_at);

-- ─── helpers (security definer so policies don't recurse) ───────

create function public.is_member(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
	select exists (select 1 from rivalry_members where rivalry_id = r and user_id = auth.uid());
$$;

create function public.shares_rivalry(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
	select exists (
		select 1 from rivalry_members mine
		join rivalry_members theirs on theirs.rivalry_id = mine.rivalry_id
		where mine.user_id = auth.uid() and theirs.user_id = u
	);
$$;

-- a new sign-up gets a profile named from the sign-in metadata or email
create function public.versus_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	insert into versus_profiles (id, name)
	values (
		new.id,
		left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), nullif(split_part(new.email, '@', 1), ''), 'Coach'), 12)
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

create trigger versus_on_auth_user_created after insert on auth.users
for each row execute function public.versus_handle_new_user();

-- whoever creates a rivalry takes seat 0
create function public.add_rivalry_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
	insert into rivalry_members (rivalry_id, user_id, seat) values (new.id, new.created_by, 0);
	return new;
end;
$$;

create trigger on_rivalry_created after insert on public.rivalries
for each row execute function public.add_rivalry_creator();

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger versus_profiles_touch before update on public.versus_profiles
for each row execute function public.touch_updated_at();

-- join the open seat with an invite code; returns the rivalry id
create function public.join_rivalry(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
	r uuid;
	taken smallint[];
begin
	if auth.uid() is null then
		raise exception 'sign in first';
	end if;
	select id into r from rivalries where invite_code = upper(btrim(code));
	if r is null then
		raise exception 'invite code not found';
	end if;
	if exists (select 1 from rivalry_members where rivalry_id = r and user_id = auth.uid()) then
		return r;
	end if;
	select array_agg(seat) into taken from rivalry_members where rivalry_id = r;
	if taken @> array[0, 1]::smallint[] then
		raise exception 'this rivalry already has two coaches';
	end if;
	insert into rivalry_members (rivalry_id, user_id, seat)
	values (r, auth.uid(), case when 1 = any (coalesce(taken, '{}')) then 0 else 1 end);
	return r;
end;
$$;

revoke all on function public.join_rivalry(text) from public, anon;
grant execute on function public.join_rivalry(text) to authenticated;

-- ─── row level security ─────────────────────────────────────────

alter table public.versus_profiles enable row level security;
alter table public.rivalries enable row level security;
alter table public.rivalry_members enable row level security;
alter table public.games enable row level security;

create policy "see yourself and your opponents" on public.versus_profiles
	for select to authenticated using (id = auth.uid() or public.shares_rivalry(id));
create policy "create your own profile" on public.versus_profiles
	for insert to authenticated with check (id = auth.uid());
create policy "edit your own profile" on public.versus_profiles
	for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members see the rivalry" on public.rivalries
	for select to authenticated using (public.is_member(id));
create policy "anyone signed in can start one" on public.rivalries
	for insert to authenticated with check (created_by = auth.uid());
create policy "members can rename seats" on public.rivalries
	for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy "the creator can delete it" on public.rivalries
	for delete to authenticated using (created_by = auth.uid());

create policy "members see who's in" on public.rivalry_members
	for select to authenticated using (public.is_member(rivalry_id));
create policy "leave a rivalry" on public.rivalry_members
	for delete to authenticated using (user_id = auth.uid());

create policy "members read games" on public.games
	for select to authenticated using (public.is_member(rivalry_id));
create policy "members log games" on public.games
	for insert to authenticated with check (public.is_member(rivalry_id) and created_by = auth.uid());
create policy "members can reset the record" on public.games
	for delete to authenticated using (public.is_member(rivalry_id));

-- invite codes and creators are never editable
revoke update on public.rivalries from authenticated;
grant update (name_a, name_b, reset_at) on public.rivalries to authenticated;
revoke update on public.versus_profiles from authenticated;
grant update (name, favorites) on public.versus_profiles to authenticated;
