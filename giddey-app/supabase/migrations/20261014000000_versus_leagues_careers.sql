-- ═══════════════════════════════════════════════════════════════
--  Giddey Versus — cloud leagues and public career pages
--
--  leagues          3–12 coach names, format, invite code
--  league_members   which account plays as which name
--  league_games     every league game, as the app's own JSON
--  careers          an opt-in, public snapshot of one coach's career
--                   (record, titles, badges, rating) for a share link
--
--  Live two-phone drafts use Supabase Realtime broadcast channels and
--  need no tables.
-- ═══════════════════════════════════════════════════════════════

create table public.leagues (
	id uuid primary key default gen_random_uuid(),
	created_by uuid not null default auth.uid() references public.versus_profiles (id) on delete cascade,
	name text not null check (char_length(btrim(name)) between 1 and 32),
	names text[] not null check (cardinality(names) between 3 and 12),
	format jsonb not null,
	playoffs_early boolean not null default false,
	invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
	created_at timestamptz not null default now()
);

create table public.league_members (
	league_id uuid not null references public.leagues (id) on delete cascade,
	user_id uuid not null references public.versus_profiles (id) on delete cascade,
	name text not null,
	joined_at timestamptz not null default now(),
	primary key (league_id, user_id),
	unique (league_id, name)
);

create index league_members_user on public.league_members (user_id);

create table public.league_games (
	league_id uuid not null references public.leagues (id) on delete cascade,
	game_key text not null check (char_length(game_key) <= 80),
	played_at timestamptz not null,
	data jsonb not null check (pg_column_size(data) < 16384),
	created_by uuid default auth.uid() references public.versus_profiles (id) on delete set null,
	created_at timestamptz not null default now(),
	primary key (league_id, game_key)
);

create index league_games_played on public.league_games (league_id, played_at);

create table public.careers (
	user_id uuid primary key default auth.uid() references public.versus_profiles (id) on delete cascade,
	-- the share link: /versus/career#<slug>
	slug text not null unique default lower(substr(encode(gen_random_bytes(6), 'hex'), 1, 10)),
	data jsonb not null check (pg_column_size(data) < 32768),
	updated_at timestamptz not null default now()
);

-- ─── helpers ────────────────────────────────────────────────────

create function public.is_league_member(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
	select exists (select 1 from league_members where league_id = l and user_id = auth.uid());
$$;

-- the commissioner joins as the league name that matches their profile (else the first name)
create function public.add_league_creator() returns trigger
language plpgsql security definer set search_path = public as $$
declare
	mine text;
	pick text;
begin
	select name into mine from versus_profiles where id = new.created_by;
	select n into pick from unnest(new.names) n where lower(btrim(n)) = lower(btrim(mine)) limit 1;
	insert into league_members (league_id, user_id, name) values (new.id, new.created_by, coalesce(pick, new.names[1]));
	return new;
end;
$$;

create trigger on_league_created after insert on public.leagues
for each row execute function public.add_league_creator();

-- join a league with its code, as one of its (unclaimed) names
create function public.join_league(code text, as_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
	l leagues%rowtype;
	pick text;
begin
	if auth.uid() is null then
		raise exception 'sign in first';
	end if;
	select * into l from leagues where invite_code = upper(btrim(code));
	if l.id is null then
		raise exception 'invite code not found';
	end if;
	if exists (select 1 from league_members where league_id = l.id and user_id = auth.uid()) then
		return l.id;
	end if;
	select n into pick from unnest(l.names) n where lower(btrim(n)) = lower(btrim(as_name)) limit 1;
	if pick is null then
		raise exception 'that name isn''t in this league';
	end if;
	if exists (select 1 from league_members where league_id = l.id and lower(name) = lower(pick)) then
		raise exception 'someone already plays as %', pick;
	end if;
	insert into league_members (league_id, user_id, name) values (l.id, auth.uid(), pick);
	return l.id;
end;
$$;

revoke all on function public.join_league(text, text) from public, anon;
grant execute on function public.join_league(text, text) to authenticated;

-- names already claimed in a league (so the join screen can grey them out), by code
create function public.league_by_code(code text) returns table (id uuid, name text, names text[], claimed text[])
language sql stable security definer set search_path = public as $$
	select l.id, l.name, l.names, coalesce(array_agg(m.name) filter (where m.name is not null), '{}')
	from leagues l left join league_members m on m.league_id = l.id
	where l.invite_code = upper(btrim(code))
	group by l.id;
$$;

revoke all on function public.league_by_code(text) from public, anon;
grant execute on function public.league_by_code(text) to authenticated;

create trigger careers_touch before update on public.careers
for each row execute function public.touch_updated_at();

-- ─── row level security ─────────────────────────────────────────

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_games enable row level security;
alter table public.careers enable row level security;

create policy "members see the league" on public.leagues
	for select to authenticated using (public.is_league_member(id));
create policy "anyone signed in can start one" on public.leagues
	for insert to authenticated with check (created_by = auth.uid());
create policy "the commissioner runs it" on public.leagues
	for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "the commissioner can delete it" on public.leagues
	for delete to authenticated using (created_by = auth.uid());

create policy "members see who's in" on public.league_members
	for select to authenticated using (public.is_league_member(league_id));
create policy "leave a league" on public.league_members
	for delete to authenticated using (user_id = auth.uid());

create policy "members read league games" on public.league_games
	for select to authenticated using (public.is_league_member(league_id));
create policy "members log league games" on public.league_games
	for insert to authenticated with check (public.is_league_member(league_id) and created_by = auth.uid());

-- careers are public on purpose: publishing one is the opt-in
create policy "anyone can read a published career" on public.careers
	for select to anon, authenticated using (true);
create policy "publish your own" on public.careers
	for insert to authenticated with check (user_id = auth.uid());
create policy "update your own" on public.careers
	for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "unpublish your own" on public.careers
	for delete to authenticated using (user_id = auth.uid());

revoke update on public.leagues from authenticated;
grant update (name, names, format, playoffs_early) on public.leagues to authenticated;
revoke update on public.careers from authenticated;
grant update (data) on public.careers to authenticated;
