-- ─────────────────────────────────────────────────────────────
--  One-off (round 41): set this season's Team Handicap draw up as on Rich's sheet.
--  Run AFTER supabase/schema.sql (version 29), once, in Supabase → SQL Editor. Safe to run again.
--
--  Round 1 (played 20 October) stays as it is; Mevagissey A v Tregonissey C is marked postponed.
--  Round 2 — the preliminaries:      St Neot v Mevagissey C,  St Blazey B v Bethel A;
--            everyone else through:  Luxulyan A, St Blazey A, Pelynt, Gorran Haven, Bethel D,
--                                    and the winner of Mevagissey A v Tregonissey C.
--  Quarter-finals, Tuesday 8 December 2026, 7.30pm:
--     St Neot or Mevagissey C        v  Luxulyan A
--     St Blazey A                    v  Pelynt
--     Gorran Haven                   v  Bethel D
--     Mevagissey A or Tregonissey C  v  Bethel A or St Blazey B
--  Semi-finals and the final are left empty, to be drawn later.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  c uuid; n int;
  r1_meva uuid; r2 uuid[]; r3 uuid[];
  e_stneot uuid; e_mevc uuid; e_luxa uuid; e_sba uuid; e_pelynt uuid; e_gorran uuid; e_bethd uuid; e_sbb uuid; e_betha uuid;
  e_meva uuid; e_tregc uuid;
  -- 7.30pm on Tuesday 8 December 2026 (UK winter time = UTC)
  qf_at timestamptz := '2026-12-08 19:30:00+00';
begin
  select co.id into c from competitions co join seasons s on s.id = co.season_id
   where s.is_current and co.name = 'Team Handicap' limit 1;
  if c is null then raise exception 'This season''s Team Handicap competition was not found'; end if;

  select id into e_stneot from competition_entries where competition_id = c and name = 'St Neot';
  select id into e_mevc   from competition_entries where competition_id = c and name = 'Mevagissey C';
  select id into e_luxa   from competition_entries where competition_id = c and name = 'Luxulyan A';
  select id into e_sba    from competition_entries where competition_id = c and name = 'St Blazey A';
  select id into e_pelynt from competition_entries where competition_id = c and name = 'Pelynt';
  select id into e_gorran from competition_entries where competition_id = c and name = 'Gorran Haven';
  select id into e_bethd  from competition_entries where competition_id = c and name = 'Bethel D';
  select id into e_sbb    from competition_entries where competition_id = c and name = 'St Blazey B';
  select id into e_betha  from competition_entries where competition_id = c and name = 'Bethel A';
  select id into e_meva   from competition_entries where competition_id = c and name = 'Mevagissey A';
  select id into e_tregc  from competition_entries where competition_id = c and name = 'Tregonissey C';
  if e_stneot is null or e_mevc is null or e_luxa is null or e_sba is null or e_pelynt is null or e_gorran is null
     or e_bethd is null or e_sbb is null or e_betha is null or e_meva is null or e_tregc is null then
    raise exception 'One of the teams on the sheet is not entered in the Team Handicap — check the entrants first';
  end if;

  -- The round 1 match still to play.
  select id into r1_meva from competition_matches where competition_id = c and round = 1
     and ((entry_a = e_meva and entry_b = e_tregc) or (entry_a = e_tregc and entry_b = e_meva));
  if r1_meva is null then raise exception 'Round 1''s Mevagissey A v Tregonissey C was not found'; end if;
  update competition_matches set status = 'postponed' where id = r1_meva and score_a is null and walkover is null and status = 'scheduled';

  select array_agg(id order by slot) into r2 from competition_matches where competition_id = c and round = 2;
  select array_agg(id order by slot) into r3 from competition_matches where competition_id = c and round = 3;
  if coalesce(array_length(r2, 1), 0) <> 8 or coalesce(array_length(r3, 1), 0) <> 4 then
    raise exception 'Expected 8 round-2 and 4 quarter-final matches in the draw';
  end if;
  select count(*) into n from competition_matches where competition_id = c and round >= 2
     and (score_a is not null or walkover is not null or status in ('in_progress', 'completed'));
  if n > 0 then raise exception 'A match after round 1 already has a result — not changing anything'; end if;

  -- Clear rounds 2 and later (pairings, links and byes), then set them.
  update competition_matches set entry_a = null, entry_b = null, from_a = null, from_b = null, bye_a = false, bye_b = false
   where competition_id = c and round >= 2;

  -- Round 2: the two preliminaries, and byes for everyone else (in the order that gives the quarter-finals above).
  update competition_matches set entry_a = e_stneot, entry_b = e_mevc                       where id = r2[1];
  update competition_matches set entry_a = e_luxa,   bye_b = true                           where id = r2[2];
  update competition_matches set entry_a = e_sba,    bye_b = true                           where id = r2[3];
  update competition_matches set entry_a = e_pelynt, bye_b = true                           where id = r2[4];
  update competition_matches set entry_a = e_gorran, bye_b = true                           where id = r2[5];
  update competition_matches set entry_a = e_bethd,  bye_b = true                           where id = r2[6];
  update competition_matches set from_a = r1_meva,   bye_b = true                           where id = r2[7];
  update competition_matches set entry_a = e_sbb,    entry_b = e_betha                      where id = r2[8];

  -- Quarter-finals: the winners' places, the teams already through, and the date.
  update competition_matches set from_a = r2[1], entry_b = e_luxa,   starts_at = qf_at where id = r3[1];
  update competition_matches set entry_a = e_sba, entry_b = e_pelynt, starts_at = qf_at where id = r3[2];
  update competition_matches set entry_a = e_gorran, entry_b = e_bethd, starts_at = qf_at where id = r3[3];
  update competition_matches set from_a = r2[7], from_b = r2[8],    starts_at = qf_at where id = r3[4];

  -- The round deadline shown on the competition page.
  update competitions set round_deadlines = coalesce(round_deadlines, '{}'::jsonb) || '{"3": "2026-12-08"}'::jsonb where id = c;
  raise notice 'Team Handicap draw set up as on the sheet.';
end $$;
