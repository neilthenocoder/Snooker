-- ─────────────────────────────────────────────────────────────
--  Adds Richard Pearson as a player (the details he sent on 2 Oct 2026).
--  Run once in Supabase → SQL Editor, after schema.sql.
--  Safe to run again: it does nothing if he is already there.
--
--  • He is placed in the team whose web address is "tregonissey-a". If that
--    team doesn't exist yet he is added without a team — set it afterwards
--    under Admin → Players.
--  • Birthday: the form said 09/10/2023 with age 53, so 9 October 1972 is used.
--    Change it under Admin → Players if that's wrong.
--  • If Tregonissey A is still the SAMPLE team, remove-sample-data.sql will
--    remove him along with it — run this file again afterwards.
--  • To let Rich edit this profile himself: Admin → Logins → edit his login →
--    "Player profile" → Richard Pearson.
-- ─────────────────────────────────────────────────────────────
insert into players (full_name, team_id, position, handicap, birth_date, bio, past_teams, cueview)
select 'Richard Pearson', (select id from teams where slug = 'tregonissey-a'), 'Player', 7, date '1972-10-09',
  'Blah blah h blah', 'Tregonissey A',
  jsonb_build_object(
    'hand', 'Left',
    'started', '16',
    'first_memory', 'TV',
    'highest_break', '118',
    'achievement', 'Wining every league in Cornwall',
    'ambition', 'To win the Cornwall county singles title',
    'memorable_match', 'Loads',
    'favourite_pro', 'Ronnie O’Sullivan - just the best',
    'commentator', 'Joe Perry',
    'famous_met', 'Ronnie',
    'bogey', 'Barrie McIntosh',
    'best_player', 'Me',
    'underrated', 'Me',
    'funniest', 'Ironing the cloth'
  )
where not exists (select 1 from players where full_name = 'Richard Pearson');
