-- ─────────────────────────────────────────────────────────────
--  One-off (round 77, Rich): how many snooker tables each club has.
--  Run AFTER supabase/schema.sql (version 40), once, in Supabase → SQL Editor. Safe to run again.
--  (Change them later under Admin → League → Venues.)
-- ─────────────────────────────────────────────────────────────
update venues set tables = 2 where name ilike 'Tregonissey%';
update venues set tables = 2 where name ilike 'Bethel%';
update venues set tables = 2 where name ilike 'Pelynt%';
update venues set tables = 1 where name ilike 'Luxulyan%';
update venues set tables = 2 where name ilike 'Mevagissey%';
update venues set tables = 2 where name ilike 'St Blazey%';
update venues set tables = 2 where name ilike 'Bugle%';
update venues set tables = 2 where name ilike 'St Neot%';
update venues set tables = 1 where name ilike 'Gorran Haven%';
update venues set tables = 1 where name ilike 'Lerryn%';

-- Rich's layout: the live & upcoming strip as a dark band on the home page
-- (change it back under Admin → Site settings → "Live & upcoming strip").
update settings set strip_style = 'dark';

-- Check: every venue and its tables
select name, tables from venues order by name;
