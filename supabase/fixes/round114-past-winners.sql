-- ─────────────────────────────────────────────────────────────
--  Round 114 (Rich: "a manual override for old results and old players", e.g. "X won the singles in
--  1980/81, 84/85"). PAST WINNERS: winners typed in by hand for seasons before the website, or for
--  anything the results can't show. Admin → Competitions → Past winners.
--  Shown in the Season archive & roll of honour, on the competition's page ("Previous winners") and
--  on the player's or team's page ("Honours"). It never changes any results, tables or rankings.
--  Run this once in Supabase → SQL Editor. Safe to run again.
-- ─────────────────────────────────────────────────────────────
create table if not exists past_winners (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions on delete set null,
  title text not null check (length(title) between 1 and 120),          -- the competition's name as it was then, e.g. "Singles"
  season text not null check (length(season) between 1 and 20),         -- "1980/81" or "1984"
  year_from int,                                                         -- 1980 — for putting them in order
  winner_name text not null check (length(winner_name) between 1 and 160),
  winner_player_id uuid references players on delete set null,
  winner_team_id uuid references teams on delete set null,
  runner_up_name text check (length(runner_up_name) <= 160),
  runner_up_player_id uuid references players on delete set null,
  runner_up_team_id uuid references teams on delete set null,
  notes text check (length(notes) <= 300),                               -- "Final 5–3", "Highest break 112"…
  created_at timestamptz not null default now()
);
create index if not exists past_winners_year on past_winners (year_from desc);
alter table past_winners enable row level security;
drop policy if exists "public read" on past_winners;
drop policy if exists "admin write" on past_winners;
create policy "public read" on past_winners for select using (true);
create policy "admin write" on past_winners for all using (public.can_manage('competitions')) with check (public.can_manage('competitions'));
