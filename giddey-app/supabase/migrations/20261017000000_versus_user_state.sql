-- ═══════════════════════════════════════════════════════════════
--  Giddey Versus — your account follows you between devices
--
--  versus_user_state   one row per signed-in user: the series in progress
--                      (settings included) and the full game log from the
--                      last device that changed anything. Every device you
--                      sign in on merges the games and offers to pick up
--                      the series where you left off.
--
--  Only you can read or write your own row.
-- ═══════════════════════════════════════════════════════════════

create table public.versus_user_state (
	user_id uuid primary key default auth.uid() references public.versus_profiles (id) on delete cascade,
	-- the app's own VersusState (the night in progress, with its settings)
	state jsonb,
	-- the device's whole rivalry log (every pair it has played), merged by game key
	games jsonb not null default '[]'::jsonb,
	-- when that device last changed something (its own clock, ms)
	changed_at bigint not null default 0,
	-- "iPhone", "Mac"… for the "pick up where you left off" prompt
	device text check (char_length(device) <= 40),
	updated_at timestamptz not null default now(),
	check (pg_column_size(state) < 1000000),
	check (pg_column_size(games) < 4000000)
);

alter table public.versus_user_state enable row level security;

create policy "read your own state" on public.versus_user_state
	for select to authenticated using (user_id = auth.uid());
create policy "save your own state" on public.versus_user_state
	for insert to authenticated with check (user_id = auth.uid());
create policy "update your own state" on public.versus_user_state
	for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete your own state" on public.versus_user_state
	for delete to authenticated using (user_id = auth.uid());

revoke all on public.versus_user_state from anon;

create trigger versus_user_state_touch before update on public.versus_user_state
for each row execute function public.touch_updated_at();
