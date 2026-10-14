-- ═══════════════════════════════════════════════════════════════
--  Versus live rooms: "draft now, play later" + turn alerts
--
--  versus_rooms  the latest state of each live room, so a coach can close
--                the app mid-draft and pick up where they left off hours
--                later, even if every phone left the room.
--  versus_push   Web Push subscriptions per room seat, so the coach whose
--                turn it is gets a ping with the app closed (optional —
--                needs the notify-turn edge function, see README).
--
--  Like the Realtime channel, the 6-character room code is the secret:
--  rooms are reachable only by exact code, through the RPCs below. Nobody
--  (anon or signed in) can list or touch the tables directly.
--
--  Rooms expire 14 days after their last move: the RPCs ignore older rows,
--  and versus_rooms_cleanup() deletes them (schedule it with pg_cron, below).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.versus_rooms (
	code text primary key check (code ~ '^[A-Z0-9]{6}$'),
	state jsonb not null,
	-- the live protocol's state version: only newer versions are accepted
	version int not null default 0,
	-- which coach seat (0 / 1) must act next; null = nobody in particular / both
	turn smallint check (turn in (0, 1)),
	updated_at timestamptz not null default now()
);

create table if not exists public.versus_push (
	code text not null check (code ~ '^[A-Z0-9]{6}$'),
	side smallint not null check (side in (0, 1)),
	endpoint text primary key,
	subscription jsonb not null,
	created_at timestamptz not null default now()
);
create index if not exists versus_push_code_side on public.versus_push (code, side);

-- RLS on with no policies = no direct access through the API
alter table public.versus_rooms enable row level security;
alter table public.versus_push enable row level security;
revoke all on public.versus_rooms from anon, authenticated;
revoke all on public.versus_push from anon, authenticated;

-- ─── rooms ──────────────────────────────────────────────────────

-- The room, or null for an unknown / expired code
create or replace function public.room_get(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
	select jsonb_build_object('state', r.state, 'version', r.version, 'turn', r.turn, 'updated_at', r.updated_at)
	from public.versus_rooms r
	where r.code = upper(p_code) and r.updated_at > now() - interval '14 days'
$$;

-- Save a room's state. Only a newer version replaces what's stored (an
-- expired row counts as empty). Returns true when it was saved.
create or replace function public.room_put(p_code text, p_state jsonb, p_version int, p_turn smallint default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
	n int;
begin
	if p_code is null or upper(p_code) !~ '^[A-Z0-9]{6}$' then
		raise exception 'bad room code';
	end if;
	if p_state is null or p_version is null or p_version < 0 then
		raise exception 'bad room state';
	end if;
	-- a game state is a few dozen KB; refuse anything far bigger
	if octet_length(p_state::text) > 1000000 then
		raise exception 'room state too large';
	end if;
	if p_turn is not null and p_turn not in (0, 1) then
		p_turn := null;
	end if;
	insert into public.versus_rooms as r (code, state, version, turn, updated_at)
	values (upper(p_code), p_state, p_version, p_turn, now())
	on conflict (code) do update
		set state = excluded.state, version = excluded.version, turn = excluded.turn, updated_at = now()
		where r.version < excluded.version or r.updated_at <= now() - interval '14 days';
	get diagnostics n = row_count;
	return n > 0;
end;
$$;

-- ─── push subscriptions ─────────────────────────────────────────

-- Ping this browser when it's `p_side`'s turn in room `p_code`. One
-- subscription follows one seat: subscribing again moves it.
create or replace function public.push_subscribe(p_code text, p_side smallint, p_subscription jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
	ep text := p_subscription ->> 'endpoint';
begin
	if p_code is null or upper(p_code) !~ '^[A-Z0-9]{6}$' then
		raise exception 'bad room code';
	end if;
	if p_side is null or p_side not in (0, 1) then
		raise exception 'bad seat';
	end if;
	if ep is null or ep !~ '^https://' or length(ep) > 1000 or octet_length(p_subscription::text) > 4000 then
		raise exception 'bad subscription';
	end if;
	insert into public.versus_push (code, side, endpoint, subscription, created_at)
	values (upper(p_code), p_side, ep, p_subscription, now())
	on conflict (endpoint) do update
		set code = excluded.code, side = excluded.side, subscription = excluded.subscription, created_at = now();
end;
$$;

-- Stop pinging this browser (turned off, or left the room)
create or replace function public.push_unsubscribe(p_endpoint text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
	delete from public.versus_push where endpoint = p_endpoint
$$;

revoke all on function public.room_get(text) from public;
revoke all on function public.room_put(text, jsonb, int, smallint) from public;
revoke all on function public.push_subscribe(text, smallint, jsonb) from public;
revoke all on function public.push_unsubscribe(text) from public;
grant execute on function public.room_get(text) to anon, authenticated;
grant execute on function public.room_put(text, jsonb, int, smallint) to anon, authenticated;
grant execute on function public.push_subscribe(text, smallint, jsonb) to anon, authenticated;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;

-- ─── expiry ─────────────────────────────────────────────────────

-- Delete rooms 14 days after their last move, and their push subscriptions.
-- Not exposed to the API. With pg_cron (Database → Extensions → pg_cron):
--   select cron.schedule('versus-rooms-cleanup', '17 4 * * *', 'select public.versus_rooms_cleanup()');
-- Without it nothing breaks: expired rooms are ignored and get overwritten.
create or replace function public.versus_rooms_cleanup()
returns void
language sql
volatile
security definer
set search_path = public
as $$
	delete from public.versus_rooms where updated_at < now() - interval '14 days';
	delete from public.versus_push p
	where p.created_at < now() - interval '14 days'
		and not exists (select 1 from public.versus_rooms r where r.code = p.code);
$$;
revoke all on function public.versus_rooms_cleanup() from public, anon, authenticated;
