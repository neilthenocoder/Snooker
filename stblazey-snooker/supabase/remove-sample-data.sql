-- ─────────────────────────────────────────────────────────────
--  Removes the SAMPLE data loaded by seed.sql — and anything you
--  created while testing that belongs to the sample season or teams
--  (fixtures, scorecards, breaks). Your own real data is untouched.
--
--  How it knows: every sample row has an id starting with
--  00000000-0000-4000-8000- (real rows get random ids).
--
--  Run in Supabase → SQL Editor. Safe to run more than once.
--
--  ⚠ Photos, emblems, bios and other details you added to SAMPLE players,
--    teams, venues or articles go with them: the rows are deleted, so the
--    links to their pictures are lost. (The picture files themselves stay
--    in Admin → Image library, so they can be picked again without
--    uploading.) Updating the website's code does NOT need this file —
--    only run it when you really want the sample league gone.
--
--  ⚠ Run this BEFORE you start entering real teams and fixtures.
--    Anything you add inside the sample season, sample leagues or
--    sample teams counts as sample data and will be removed too.
-- ─────────────────────────────────────────────────────────────
begin;

-- Fixtures in the sample seasons or involving a sample team
-- (their frames and breaks are removed automatically).
delete from fixtures
where id::text          like '00000000-0000-4000-8000-%'
   or season_id::text   like '00000000-0000-4000-8000-%'
   or league_id::text   like '00000000-0000-4000-8000-%'
   or home_team_id::text like '00000000-0000-4000-8000-%'
   or away_team_id::text like '00000000-0000-4000-8000-%';

-- Sample competitions (their entrants and draws go with them).
delete from competitions where id::text like '00000000-0000-4000-8000-%'
                            or season_id::text like '00000000-0000-4000-8000-%';

delete from breaks   where id::text like '00000000-0000-4000-8000-%';
delete from frames   where id::text like '00000000-0000-4000-8000-%';
delete from players  where id::text like '00000000-0000-4000-8000-%'
                        or team_id::text like '00000000-0000-4000-8000-%';
delete from teams    where id::text like '00000000-0000-4000-8000-%'
                        or league_id::text like '00000000-0000-4000-8000-%';
delete from venues   where id::text like '00000000-0000-4000-8000-%';
delete from leagues  where id::text like '00000000-0000-4000-8000-%';
delete from seasons  where id::text like '00000000-0000-4000-8000-%';
delete from articles where id::text like '00000000-0000-4000-8000-%';
delete from pages    where id::text like '00000000-0000-4000-8000-%';
delete from sponsors where id::text like '00000000-0000-4000-8000-%';
delete from media    where id::text like '00000000-0000-4000-8000-%';
delete from announcements where id::text like '00000000-0000-4000-8000-%';
delete from key_dates    where id::text like '00000000-0000-4000-8000-%';
delete from meetings     where id::text like '00000000-0000-4000-8000-%';
delete from awards       where id::text like '00000000-0000-4000-8000-%';
delete from live_matches where id::text like '00000000-0000-4000-8000-%';
-- Home page boxes that pointed at sample players/teams are emptied automatically.

commit;

-- Test captain logins you made are NOT deleted here (they're linked to
-- real email addresses). Remove them in the website: Admin → Logins → Delete.
