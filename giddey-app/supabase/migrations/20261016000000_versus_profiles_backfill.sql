-- ═══════════════════════════════════════════════════════════════
--  Giddey Versus — profiles for accounts that already existed
--
--  The sign-up trigger only creates a versus_profiles row for NEW
--  accounts. Anyone who signed up before the Versus migrations ran
--  (or through another app on the same project) has no profile, so
--  saving a name or creating a rivalry fails. This fills them in.
--  Safe to run more than once. The app also creates a missing
--  profile on sign-in, so this is a one-time catch-up.
-- ═══════════════════════════════════════════════════════════════

insert into public.versus_profiles (id, name)
select id,
       left(coalesce(nullif(btrim(raw_user_meta_data ->> 'name'), ''), nullif(split_part(email, '@', 1), ''), 'Coach'), 12)
  from auth.users
on conflict (id) do nothing;
