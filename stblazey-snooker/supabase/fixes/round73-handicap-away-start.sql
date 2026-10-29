-- ─────────────────────────────────────────────────────────────
--  One-off (round 73, Rich): this season's Bill Toms and Willie Thomas are handicap competitions,
--  and the away player gets 5 extra points on top of the handicap start.
--  Run AFTER supabase/schema.sql (version 38), once, in Supabase → SQL Editor. Safe to run again.
--  (Next season, tick "Handicap competition" and set "Away player's extra start" under Admin → Competitions → Edit.)
-- ─────────────────────────────────────────────────────────────
update competitions co set handicap = true, away_start = 5
  from seasons s
 where s.id = co.season_id and s.is_current and co.name in ('Bill Toms', 'Willie Thomas');
