-- ─────────────────────────────────────────────────────────────
--  Round 117: a team's own header block (Admin → Teams → Header background) — the coloured block at the top of the
--  team's page and its players' pages: a colour, a background picture or pattern (an SVG works best), and whether it
--  repeats as a faint pattern or fills the block. Empty = the one for every team (Site settings) or the plain red block.
--  Run this once in Supabase → SQL Editor (it is also part of schema.sql). Safe to run again.
-- ─────────────────────────────────────────────────────────────
alter table teams add column if not exists hero_color text;
alter table teams add column if not exists hero_bg_url text;
alter table teams add column if not exists hero_bg_fit text not null default 'pattern';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'teams_hero_color_check') then
    alter table teams add constraint teams_hero_color_check check (hero_color is null or hero_color = '' or hero_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teams_hero_bg_fit_check') then
    alter table teams add constraint teams_hero_bg_fit_check check (hero_bg_fit in ('pattern', 'cover'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teams_hero_bg_url_check') then
    alter table teams add constraint teams_hero_bg_url_check check (hero_bg_url is null or length(hero_bg_url) <= 500);
  end if;
end $$;

-- The website (round 117) expects database version 45. (Run supabase/fixes/round116-news.sql first if you have not yet.)
create or replace function public.schema_version() returns int language sql immutable as $$ select 45 $$;
grant execute on function public.schema_version() to anon, authenticated;
