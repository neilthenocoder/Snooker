-- ─────────────────────────────────────────────────────────────
--  St Blazey & District Snooker League — database schema
--  Run this whole file once in Supabase → SQL Editor → New query.
--  It is safe to re-run: it only creates things that don't exist
--  and replaces the security rules/functions.
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── tables ──────────────────────────────────────────────────────
create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_current boolean not null default false
);

create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  slug text not null unique,
  sort int not null default 1
);

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text,
  description text
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  league_id uuid references leagues on delete restrict,
  venue_id uuid references venues on delete set null,
  logo_url text
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  team_id uuid references teams on delete set null,
  position text not null default 'Player' check (position in ('Player', 'Team Captain', 'Vice Captain')),
  handicap int not null default 0,
  avatar_url text
);

create table if not exists fixtures (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons on delete cascade,
  league_id uuid not null references leagues on delete restrict,
  home_team_id uuid not null references teams on delete restrict,
  away_team_id uuid not null references teams on delete restrict,
  venue_id uuid references venues on delete set null,
  starts_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'submitted', 'approved', 'postponed')),
  notes text,
  check (home_team_id <> away_team_id)
);
create index if not exists fixtures_season_idx on fixtures (season_id, starts_at);

create table if not exists frames (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures on delete cascade,
  frame_no int not null check (frame_no between 1 and 25),
  home_player_id uuid references players on delete set null,
  away_player_id uuid references players on delete set null,
  home_points int check (home_points between 0 and 200),
  away_points int check (away_points between 0 and 200),
  unique (fixture_id, frame_no)
);

create table if not exists breaks (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures on delete cascade,
  frame_no int not null,
  player_id uuid not null references players on delete cascade,
  value int not null check (value between 1 and 155)
);
create index if not exists breaks_fixture_idx on breaks (fixture_id);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'General News',
  excerpt text,
  body text,
  image_url text,
  published_at date not null default current_date,
  is_published boolean not null default true
);

create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  body text,
  sort int not null default 1
);

create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  image_url text,
  sort int not null default 1
);

-- ── knockout competitions (cups, singles, doubles…) ─────────────
create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  season_id uuid references seasons on delete set null,
  kind text not null default 'Team' check (kind in ('Team', 'Singles', 'Doubles', 'Other')),
  info text,
  image_url text,
  sort int not null default 1
);

-- Who entered. Linking a team or player is optional (a plain name works too).
create table if not exists competition_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions on delete cascade,
  name text not null,
  team_id uuid references teams on delete set null,
  player_id uuid references players on delete set null,
  seed int not null default 0
);
-- Round 56 (Rich: "with the doubles competition, how do I pair up who is with who?"): a doubles pair is two players —
-- player_id and partner_id — so each of them gets the pair's results, and their own breaks.
alter table competition_entries add column if not exists partner_id uuid references players on delete set null;

-- One row per match slot in the draw. Round 1 stores who plays; later
-- rounds are filled automatically by the winners (see js/core/bracket.js).
create table if not exists competition_matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions on delete cascade,
  round int not null check (round >= 1),
  slot int not null check (slot >= 0),
  entry_a uuid references competition_entries on delete set null,
  entry_b uuid references competition_entries on delete set null,
  score_a int check (score_a >= 0),
  score_b int check (score_b >= 0),
  starts_at timestamptz,
  venue_id uuid references venues on delete set null,
  notes text,
  unique (competition_id, round, slot)
);

-- Columns added after the first release (safe to re-run).
alter table players add column if not exists birth_date date;
alter table articles add column if not exists competition_id uuid references competitions on delete set null;

-- v3: Rich's feedback ------------------------------------------------
-- Players: CueView interview answers (one JSON object, questions listed in js/core/cueview.js)
alter table players add column if not exists cueview jsonb not null default '{}'::jsonb;
alter table players add column if not exists cueview_featured boolean not null default false;
-- Scorecards: which player is playing as the team's extra (Ext) player in a frame
alter table frames add column if not exists home_ext boolean not null default false;
alter table frames add column if not exists away_ext boolean not null default false;
-- Scorecards: photo of the paper card
alter table fixtures add column if not exists scorecard_url text;
-- Weekly shield: its name and who holds it at the start of the season
alter table leagues add column if not exists shield_name text;
alter table leagues add column if not exists shield_team_id uuid references teams on delete set null;
-- News articles: second (circle) image, lead text, quote and weekly round-up sections
alter table articles add column if not exists circle_image_url text;
alter table articles add column if not exists lead text;
alter table articles add column if not exists quote_text text;
alter table articles add column if not exists quote_author text;
alter table articles add column if not exists league_id uuid references leagues on delete set null;
alter table articles add column if not exists week_ending date;
alter table articles add column if not exists show_breaks boolean not null default false;
alter table articles add column if not exists show_results boolean not null default false;
alter table articles add column if not exists show_standings boolean not null default false;
alter table articles add column if not exists featured boolean not null default true;
-- Round 20: who wrote it (captains, vice captains and officers with "Write news" can change only their own).
alter table articles add column if not exists created_by uuid;
alter table articles alter column created_by set default auth.uid();
-- Info pages and venues: picture galleries (lists of image links)
alter table pages add column if not exists gallery jsonb not null default '[]'::jsonb;
alter table venues add column if not exists phone text;
alter table venues add column if not exists email text;
alter table venues add column if not exists contact_name text;
alter table venues add column if not exists map_url text;
alter table venues add column if not exists quote text;
alter table venues add column if not exists image_url text;
alter table venues add column if not exists gallery jsonb not null default '[]'::jsonb;
-- Competitions: fixed bracket, or a fresh random draw every round
alter table competitions add column if not exists draw_mode text not null default 'bracket';
alter table competitions add column if not exists best_of int not null default 5;
alter table competition_matches add column if not exists status text not null default 'scheduled';

-- News categories (admin can add more)
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort int not null default 1
);
insert into categories (name, sort) values
  ('Match Reports', 1), ('Competitions', 2), ('League News', 3), ('League Meetings', 4), ('Cue View', 5)
on conflict (name) do nothing;

-- Image library: every uploaded picture, so it can be picked again later
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  path text,
  name text,
  created_at timestamptz not null default now()
);

-- Site settings: one row (logo, favicon, homepage options)
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  logo_url text,
  favicon_url text,
  hero_image_url text,
  hero_count int not null default 4,
  player_of_week_id uuid references players on delete set null,
  player_of_week_text text,
  player_of_week_show boolean not null default false,
  team_of_week_id uuid references teams on delete set null,
  team_of_week_text text,
  team_of_week_show boolean not null default false,
  cueviews_show boolean not null default true,
  shields_show boolean not null default true
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Frame-by-frame scorecards for competition matches (singles, doubles, teams).
-- Doubles use the *_2 columns for the second player on each side.
create table if not exists competition_frames (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references competition_matches on delete cascade,
  frame_no int not null check (frame_no between 1 and 35),
  a_player_id uuid references players on delete set null,
  a_player2_id uuid references players on delete set null,
  b_player_id uuid references players on delete set null,
  b_player2_id uuid references players on delete set null,
  a_points int check (a_points between 0 and 200),
  b_points int check (b_points between 0 and 200),
  unique (match_id, frame_no)
);
create table if not exists competition_breaks (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references competition_matches on delete cascade,
  frame_no int not null,
  player_id uuid not null references players on delete cascade,
  value int not null check (value between 1 and 155)
);

-- Website statistics: anonymous page views (no names, no IP addresses)
create table if not exists page_views (
  id bigint generated always as identity primary key,
  path text not null check (length(path) <= 200),
  referrer text check (length(referrer) <= 200),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  new_session boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on page_views (created_at);

-- v4: Rich's second round of feedback ---------------------------------
-- Player profiles: biography, career history, pictures and past teams
alter table players add column if not exists bio text;
alter table players add column if not exists career_history text;
alter table players add column if not exists past_teams text;
alter table players add column if not exists gallery jsonb not null default '[]'::jsonb;
-- News: tag the players an article is about (shown as "Player news" on their page)
alter table articles add column if not exists player_ids jsonb not null default '[]'::jsonb;
-- Footer: social links
alter table settings add column if not exists facebook_url text;
alter table settings add column if not exists x_url text;
alter table settings add column if not exists instagram_url text;
alter table settings add column if not exists youtube_url text;
-- A free-ball start makes 155 the highest possible break
alter table breaks drop constraint if exists breaks_value_check;
alter table breaks add constraint breaks_value_check check (value between 1 and 155);
alter table competition_breaks drop constraint if exists competition_breaks_value_check;
alter table competition_breaks add constraint competition_breaks_value_check check (value between 1 and 155);

-- Info pages: choose where each one appears. The footer pages are created
-- once, the first time this runs (edit their text under Admin → Info pages).
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'pages' and column_name = 'show_in_footer') then
    alter table pages add column show_in_footer boolean not null default false;
    alter table pages add column show_in_league boolean not null default true;
    insert into pages (title, slug, summary, body, sort, show_in_footer, show_in_league) values
      ('Privacy Policy', 'privacy-policy', 'How we look after your information', 'Placeholder — add your privacy policy under Admin → Info pages.', 90, true, false),
      ('Terms of Use', 'terms-of-use', 'The rules for using this website', 'Placeholder — add your terms of use under Admin → Info pages.', 91, true, false),
      ('Accessibility', 'accessibility', 'Making this website usable for everyone', 'Placeholder — add your accessibility statement under Admin → Info pages.', 92, true, false),
      ('About', 'about', 'Everything you need to know about our league', 'Placeholder — tell visitors about the league under Admin → Info pages.', 93, true, true),
      ('Contact Us', 'contact-us', 'How to get in touch', 'Placeholder — add contact details under Admin → Info pages.', 94, true, false)
    on conflict (slug) do nothing;
    update pages set show_in_footer = true where slug in ('privacy-policy', 'terms-of-use', 'accessibility', 'about', 'contact-us');
  end if;
end $$;

-- v5: Rich's third round of feedback ----------------------------------
-- Fixtures: when a match was postponed (set automatically), and a plain final
-- score for old results that have no frame-by-frame scorecard (CSV import).
alter table fixtures add column if not exists postponed_at timestamptz;
alter table fixtures add column if not exists home_score int check (home_score between 0 and 99);
alter table fixtures add column if not exists away_score int check (away_score between 0 and 99);
-- Players added by a captain wait for the admin to check them (handicap etc.)
alter table players add column if not exists needs_review boolean not null default false;
-- Teams from past seasons can be kept for the history without showing in this season's lists
alter table teams add column if not exists active boolean not null default true;
-- Emblems for leagues and venues (clubs)
alter table leagues add column if not exists logo_url text;
alter table venues add column if not exists logo_url text;
-- Competitions: which leagues may enter, a "play by" date for each round,
-- handicap starts on the scorecard, and plate competitions (linked to their main one)
alter table competitions add column if not exists league_ids jsonb not null default '[]'::jsonb;
alter table competitions add column if not exists round_deadlines jsonb not null default '{}'::jsonb;
alter table competitions add column if not exists handicap boolean not null default false;
alter table competitions add column if not exists parent_id uuid references competitions on delete set null;
-- News: a CueView interview with anyone (e.g. a professional player)
alter table articles add column if not exists cueview jsonb not null default '{}'::jsonb;
alter table articles add column if not exists cueview_name text;
alter table articles add column if not exists cueview_extra text;
alter table articles add column if not exists cueview_featured boolean not null default false;
-- Home page: the "NEW" feature box and what the Latest News box shows
alter table settings add column if not exists feature_show boolean not null default false;
alter table settings add column if not exists feature_label text default 'NEW';
alter table settings add column if not exists feature_text text;
alter table settings add column if not exists feature_url text;
alter table settings add column if not exists feature_bg text default '#0b84e0';
alter table settings add column if not exists latest_news_mode text not null default 'newest';
alter table settings add column if not exists latest_news_category text;
alter table settings add column if not exists latest_news_ids jsonb not null default '[]'::jsonb;
alter table settings add column if not exists latest_news_count int not null default 1;
-- Image library: categories. Existing pictures are filed once by where they were uploaded.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'media' and column_name = 'category') then
    alter table media add column category text not null default 'General';
    update media set category = case
      when path like 'players/%' then 'Players'
      when path like 'teams/%' or path like 'branding/%' then 'Emblems & logos'
      when path like 'news/%' then 'News'
      when path like 'venues/%' then 'Venues'
      when path like 'competitions/%' then 'Competitions'
      when path like 'sponsors/%' then 'Sponsors'
      when path like 'gallery/%' then 'Galleries'
      else 'General' end;
  end if;
end $$;

-- Record when a fixture is postponed (and forget it once it's rearranged).
create or replace function public.stamp_postponed() returns trigger
language plpgsql as $$
begin
  if new.status = 'postponed' then
    if tg_op = 'INSERT' or old.status is distinct from 'postponed' or new.postponed_at is null then
      new.postponed_at := coalesce(new.postponed_at, now());
    end if;
  else
    new.postponed_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists fixtures_stamp_postponed on fixtures;
create trigger fixtures_stamp_postponed before insert or update on fixtures
  for each row execute function public.stamp_postponed();

-- v6: Rich's fourth round of feedback ---------------------------------
-- Branding (Admin → Branding): loading-screen logo, colours, fonts and page layout.
-- An empty colour or font means "use the standard one".
alter table settings add column if not exists loading_logo_url text;
alter table settings add column if not exists color_primary text;
alter table settings add column if not exists color_home text;
alter table settings add column if not exists color_competitions text;
alter table settings add column if not exists color_fixtures text;
alter table settings add column if not exists color_league text;
alter table settings add column if not exists color_login text;
alter table settings add column if not exists color_background text;
alter table settings add column if not exists section_colors boolean not null default true;
alter table settings add column if not exists font_head text;
alter table settings add column if not exists font_body text;
alter table settings add column if not exists sidebar_layout text not null default 'right';
-- Competition entry forms: how to pay, and how long entrants have to do it
alter table settings add column if not exists bacs_details text;
alter table settings add column if not exists entry_pay_days int not null default 7;
alter table settings add column if not exists entry_intro text;
alter table competitions add column if not exists entries_open boolean not null default false;
alter table competitions add column if not exists entry_fee text;
alter table competitions add column if not exists entry_closes date;
-- Live draws: when the draw is due, and the record of a draw made live
-- ({ status, round, by, witness, started_at, finished_at, log: [{ entry_id, slot, side, at }] })
alter table competitions add column if not exists draw_at timestamptz;
alter table competitions add column if not exists draw_live jsonb;
-- Handicaps: last year's figure (for the up/down arrows)
alter table players add column if not exists last_handicap int;
-- Match night photos, added by the home captain; shown on the match page and the week's news report
alter table fixtures add column if not exists gallery jsonb not null default '[]'::jsonb;
alter table articles add column if not exists show_photos boolean not null default true;

-- Entries made on the website's entry form. They wait here until the competition
-- secretary confirms the entry fee has been paid; approving one adds the entrant
-- to the competition. Contact details are never public.
create table if not exists competition_signups (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions on delete cascade,
  player_id uuid references players on delete set null,
  partner_id uuid references players on delete set null,
  team_id uuid references teams on delete set null,
  name text not null,
  contact text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  pay_by timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  entry_id uuid references competition_entries on delete set null
);
create index if not exists competition_signups_comp_idx on competition_signups (competition_id, status);

-- Every change to a player's handicap, with who made it and why.
create table if not exists handicap_changes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players on delete cascade,
  old_handicap int,
  new_handicap int not null,
  note text,
  changed_by text,
  created_at timestamptz not null default now()
);
create index if not exists handicap_changes_player_idx on handicap_changes (player_id, created_at desc);

-- v7: Rich's fifth round of feedback ----------------------------------
-- Page layout per section: { "home": "auto" | "sidebar" | "full", "competitions": …, "fixtures": …, "league": …, "news": … }
alter table settings add column if not exists page_layouts jsonb not null default '{}'::jsonb;
-- The old single choice "side boxes underneath" becomes "full width" for every section.
update settings set page_layouts = '{"home":"full","competitions":"full","fixtures":"full","league":"full","news":"full"}'::jsonb, sidebar_layout = 'right'
  where sidebar_layout = 'below';
-- Fonts: a pasted Google Fonts embed link (its fonts are then offered for headings and body text).
alter table settings add column if not exists font_embed text;
-- Loading screen: on/off, and the shortest time it stays up when the site is first opened.
alter table settings add column if not exists loader_show boolean not null default true;
alter table settings add column if not exists loader_seconds numeric not null default 0;
-- News has its own menu button (and colour).
alter table settings add column if not exists color_news text;
-- The box at the top of the side column: latest results (or news, as before).
alter table settings add column if not exists side_box_mode text not null default 'results';
alter table settings add column if not exists side_box_title text;
alter table settings add column if not exists side_box_count int not null default 5;
alter table settings add column if not exists side_box_league uuid references leagues on delete set null;
-- Announcements ticker at the top of the home page.
alter table settings add column if not exists ticker_show boolean not null default true;
alter table settings add column if not exists ticker_speed text not null default 'normal';
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  url text,
  sort int not null default 1,
  is_active boolean not null default true,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);
-- Maintenance mode: visitors see a holding page; officers still see the site.
alter table settings add column if not exists maintenance_on boolean not null default false;
alter table settings add column if not exists maintenance_text text;
-- News page: how many columns each category's articles are shown in (its place on the page is "sort").
alter table categories add column if not exists columns int not null default 4;
-- Handicap competitions: total points in a match (handicap starts included). They decide a match that is level on frames.
alter table competition_matches add column if not exists points_a int;
alter table competition_matches add column if not exists points_b int;

-- Handicap doubles: a pair whose handicaps add up to less than zero starts a frame below zero, so a frame score can be negative.
alter table competition_frames drop constraint if exists competition_frames_a_points_check;
alter table competition_frames drop constraint if exists competition_frames_b_points_check;
alter table competition_frames add constraint competition_frames_a_points_check check (a_points between -200 and 300);
alter table competition_frames add constraint competition_frames_b_points_check check (b_points between -200 and 300);

-- Roles & permissions: which parts of the dashboard each officer role may use.
-- Only the Master Admin can change this (Admin → Roles & permissions); the Master Admin always has everything.
-- Areas: matchnights, fixtures, league, handicaps, competitions, livescoring, website, settings, people.
-- (livescoring is not a part of the dashboard: it is the one area captains and vice captains can be given.)
create table if not exists role_permissions (
  role text primary key,
  areas text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into role_permissions (role, areas) values
  ('league_admin',          array['matchnights','fixtures','league','handicaps','competitions','website','settings','people']),
  ('competition_secretary', array['handicaps','competitions']),
  ('league_secretary',      array['league','handicaps']),
  ('committee_member',      array['website','settings']),
  ('president',             array['website','settings']),
  ('vice_chairman',         array['website','settings']),
  ('chairman',              array['website','settings'])
on conflict (role) do nothing;

-- Activity log: who added, changed or removed what (Master Admin only). Filled in by triggers further down.
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor text,
  action text not null,
  table_name text not null,
  row_id text,
  label text,
  changes jsonb
);
create index if not exists audit_log_at_idx on audit_log (at desc);

-- v8: Rich's sixth round of feedback ----------------------------------
-- Ticker speed: 1 (very slow) to 10 (fast). The old slow / normal / fast choice is carried over once.
alter table settings add column if not exists ticker_pace int not null default 3;
update settings set ticker_pace = case ticker_speed when 'slow' then 2 else 5 end, ticker_speed = 'normal' where ticker_speed in ('slow', 'fast');
-- Text sizes (Admin → Branding): { "body": 15, "h1": 38, "h2": 22, "h3": 20, "table": 14, "nav": 18, … } in pixels; missing = standard.
alter table settings add column if not exists text_sizes jsonb not null default '{}'::jsonb;
-- Confetti when a new highest break arrives: 'off', 'season' (a league's or competition's best of the season) or 'week' (best of the week too).
alter table settings add column if not exists celebrate_breaks text not null default 'season';
-- The home page feature box can also show the announcements, one after another.
alter table settings add column if not exists feature_announcements boolean not null default true;
-- More than one message in the feature box: 'scroll' across like the ticker, or 'rotate' (one at a time).
alter table settings add column if not exists feature_style text not null default 'scroll';
alter table announcements add column if not exists label text;
alter table announcements add column if not exists show_in_feature boolean not null default true;
-- Key dates box on the home page.
alter table settings add column if not exists key_dates_show boolean not null default true;
alter table settings add column if not exists key_dates_count int not null default 5;
create table if not exists key_dates (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date,
  title text not null,
  details text,
  url text,
  competition_id uuid references competitions on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Trophies: a picture for each league and competition (a transparent PNG or an SVG), shown wherever that league or competition is.
alter table leagues add column if not exists trophy_url text;
alter table competitions add column if not exists trophy_url text;
-- Presentation night: one row per trophy / award for a season, with its winner and runner-up.
create table if not exists awards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons on delete cascade,
  name text not null,
  sort int not null default 1,
  trophy_url text,
  league_id uuid references leagues on delete set null,
  competition_id uuid references competitions on delete set null,
  winner_name text,
  winner_player_id uuid references players on delete set null,
  winner_team_id uuid references teams on delete set null,
  winner_image_url text,
  runner_up_name text,
  runner_up_player_id uuid references players on delete set null,
  runner_up_team_id uuid references teams on delete set null,
  runner_up_image_url text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists awards_season_idx on awards (season_id, sort);
-- AGM and committee meetings.
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'Committee Meeting',
  held_on date not null,
  time_text text,
  title text,
  venue text,
  summary text,
  minutes text,
  document_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
-- Info pages can be shown on the Rules page (/rules), each as its own tab.
alter table pages add column if not exists show_in_rules boolean not null default false;
-- Sponsors have their own page (/sponsor/<slug>).
alter table sponsors add column if not exists slug text;
alter table sponsors add column if not exists about text;
alter table sponsors add column if not exists phone text;
alter table sponsors add column if not exists email text;
alter table sponsors add column if not exists address text;
alter table sponsors add column if not exists photo_url text;
-- Players: whether they are playing, and a memorial for those no longer with us.
alter table players add column if not exists status text not null default 'playing';
alter table players drop constraint if exists players_status_check;
alter table players add constraint players_status_check check (status in ('playing', 'not_playing', 'no_team', 'deceased'));
alter table players add column if not exists died_on date;
alter table players add column if not exists memorial text;
-- Short web addresses: /player/sam-bolitho, /match/2627-14, /cup-match/27 (the long ones still work).
alter table players add column if not exists slug text;
alter table fixtures add column if not exists code text;
create sequence if not exists competition_match_no_seq;
alter table competition_matches add column if not exists no bigint;
-- Whoever makes a draw needs to be able to take the next number.
grant usage, select on sequence public.competition_match_no_seq to authenticated;
alter table competition_matches alter column no set default nextval('competition_match_no_seq');
-- The results secretary is emailed once when a captain submits a card (netlify/functions/result-email.mjs).
alter table fixtures add column if not exists submitted_email_at timestamptz;
-- Who that email goes to. Kept apart from "settings" because that table is public and these are private addresses.
create table if not exists private_settings (
  id int primary key default 1 check (id = 1),
  results_email_on boolean not null default false,
  results_email_to text,
  updated_at timestamptz not null default now()
);
insert into private_settings (id) values (1) on conflict (id) do nothing;
-- Live scoreboard: a match scored ball by ball by an admin (finals night). "state" holds the frame being played.
create table if not exists live_matches (
  id uuid primary key default gen_random_uuid(),
  no bigint generated by default as identity,
  title text,
  competition_id uuid references competitions on delete set null,
  round_name text,
  player_a_id uuid references players on delete set null,
  player_b_id uuid references players on delete set null,
  name_a text,
  name_b text,
  best_of int not null default 9 check (best_of between 1 and 35),
  status text not null default 'setup' check (status in ('setup', 'live', 'finished')),
  frames_a int not null default 0,
  frames_b int not null default 0,
  state jsonb not null default '{}'::jsonb,
  venue text,
  starts_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_by text,
  updated_at timestamptz not null default now()
);
create unique index if not exists live_matches_no_key on live_matches (no);

-- Bye weeks. A league with an odd number of teams gives one team a free week on each match night.
-- A bye is not a match: no opponent, no scorecard, and it never counts in a table. It is only shown in fixture lists.
create table if not exists byes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons on delete cascade,
  league_id uuid references leagues on delete cascade,
  team_id uuid not null references teams on delete cascade,
  bye_on date not null,
  unique (season_id, team_id, bye_on)
);
create index if not exists byes_season_idx on byes (season_id, bye_on);

-- "Sam Bolitho" → "sam-bolitho"
create or replace function public.slugify(t text) returns text
language sql immutable as $$
  -- Accents are flattened (Zoë → zoe) and apostrophes dropped (O'Brien → obrien); anything else becomes a dash.
  select trim(both '-' from regexp_replace(
    translate(regexp_replace(lower(coalesce(t, '')), '[''’`]', '', 'g'), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+', '-', 'g'));
$$;
-- …and "sam-bolitho-2" if someone already has that one.
create or replace function public.unique_slug(tbl text, base text, self uuid) returns text
language plpgsql as $$
declare s text := coalesce(nullif(public.slugify(base), ''), 'item'); candidate text; n int := 1; taken boolean;
begin
  candidate := s;
  loop
    execute format('select exists (select 1 from %I where slug = $1 and id is distinct from $2)', tbl) into taken using candidate, self;
    exit when not taken;
    n := n + 1;
    candidate := s || '-' || n;
  end loop;
  return candidate;
end;
$$;
-- Fills in an empty slug from the column named in the trigger (it never changes one that is already set, so links keep working).
create or replace function public.set_slug() returns trigger
language plpgsql as $$
begin
  if coalesce(new.slug, '') = '' then
    perform pg_advisory_xact_lock(hashtext('slug:' || tg_table_name));
    new.slug := public.unique_slug(tg_table_name, to_jsonb(new) ->> tg_argv[0], new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists players_set_slug on players;
create trigger players_set_slug before insert or update on players for each row execute function public.set_slug('full_name');
drop trigger if exists sponsors_set_slug on sponsors;
create trigger sponsors_set_slug before insert or update on sponsors for each row execute function public.set_slug('name');

-- "2026-2027" → "2627": the start of every match code in that season.
create or replace function public.season_code(sid uuid) returns text
language sql stable as $$
  select coalesce((select string_agg(right(r.m[1], 2), '' order by r.ord)
                   from regexp_matches((select name from seasons where id = sid), '(\d{4})', 'g') with ordinality as r(m, ord)), 's');
$$;
-- Each new fixture gets the next number of its season: 2627-01, 2627-02, …
create or replace function public.assign_fixture_code() returns trigger
language plpgsql as $$
declare prefix text; n int;
begin
  if coalesce(new.code, '') <> '' then return new; end if;
  prefix := public.season_code(new.season_id);
  perform pg_advisory_xact_lock(hashtext('fixture_code:' || prefix));
  select coalesce(max((regexp_match(code, '-(\d+)$'))[1]::int), 0) + 1 into n from fixtures where code like prefix || '-%';
  new.code := prefix || '-' || lpad(n::text, greatest(2, length(n::text)), '0');   -- 01 … 99, 100, 101 …
  return new;
end;
$$;
drop trigger if exists fixtures_assign_code on fixtures;
create trigger fixtures_assign_code before insert on fixtures for each row execute function public.assign_fixture_code();

-- A card that is sent back to the captain (submitted → in progress / scheduled) can be emailed again when it is re-submitted.
create or replace function public.reset_result_email() returns trigger
language plpgsql as $$
begin
  if old.status = 'submitted' and new.status in ('scheduled', 'in_progress') then new.submitted_email_at := null; end if;
  return new;
end;
$$;
drop trigger if exists fixtures_reset_result_email on fixtures;
create trigger fixtures_reset_result_email before update on fixtures for each row execute function public.reset_result_email();

-- One row per login. Created by the admin dashboard (Netlify Function).
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  role text not null default 'captain' check (role in ('admin', 'captain', 'vice_captain', 'player')),
  team_id uuid references teams on delete set null
);
-- v4: a login can be linked to a player, who can then edit their own profile.
-- 'player' logins can do that and nothing else.
alter table profiles add column if not exists player_id uuid references players on delete set null;
-- v5: league officers. Each role opens one part of the admin dashboard:
--   admin, league_admin ............ everything
--   competition_secretary .......... Competitions
--   league_secretary ............... League (leagues, teams, players, venues, seasons)
--   committee_member, president,
--   vice_chairman, chairman ........ Website (news, pages, images, sponsors, settings)
-- Officers who also play can be given captain / vice captain rights for their
-- team with team_role.
alter table profiles add column if not exists team_role text;
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in (
  'admin', 'league_admin', 'competition_secretary', 'league_secretary',
  'committee_member', 'president', 'vice_chairman', 'chairman',
  'captain', 'vice_captain', 'player'));
alter table profiles drop constraint if exists profiles_team_role_check;
alter table profiles add constraint profiles_team_role_check check (team_role is null or team_role in ('captain', 'vice_captain'));

-- ── permission helpers ──────────────────────────────────────────
-- "security definer" lets these read profiles without tripping over
-- the profiles table's own security rules.
-- The Master Admin: always allowed everything, and the only one who can change roles & permissions.
create or replace function public.is_master() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
-- (Kept for older code: "admin" now means the Master Admin. Everyone else goes by can_manage().)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_master();
$$;

-- May this login use one part of the admin dashboard?
-- The Master Admin: always. Everyone else: whatever the Master Admin has ticked for
-- their role under Admin → Roles & permissions (the role_permissions table).
create or replace function public.can_manage(area text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and (
    p.role = 'admin'
    or exists (select 1 from role_permissions rp where rp.role = p.role and can_manage.area = any(rp.areas))
  ));
$$;

-- Anyone with a part of the admin dashboard (they may upload pictures). Live scoring and Write news are not parts of
-- the dashboard: captains and vice captains can have them without becoming officers.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and (
    p.role = 'admin'
    or exists (select 1 from role_permissions rp where rp.role = p.role and cardinality(array_remove(array_remove(rp.areas, 'livescoring'), 'news')) > 0)
  ));
$$;

-- Captain or vice captain of this team (by role, or an officer given team rights).
create or replace function public.is_captain_of(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select team is not null and exists (select 1 from profiles where id = auth.uid() and team_id = team
    and (role in ('captain', 'vice_captain') or team_role in ('captain', 'vice_captain')));
$$;

-- Whoever looks after match nights: any fixture. Captains / vice captains:
-- their own team's fixtures, and only until the result is approved.
create or replace function public.can_edit_fixture(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage('matchnights') or exists (
    select 1 from fixtures f
    where f.id = fid
      and (public.is_captain_of(f.home_team_id) or public.is_captain_of(f.away_team_id))
      and f.status in ('scheduled', 'in_progress', 'submitted')
  );
$$;

-- The only way a captain can change a fixture: start it, submit it, or
-- postpone it before it has started.
create or replace function public.set_fixture_status(fid uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_fixture(fid) then
    raise exception 'You are not allowed to change this fixture';
  end if;
  if not public.can_manage('matchnights') then
    if new_status = 'postponed' then
      if (select status from fixtures where id = fid) <> 'scheduled' then
        raise exception 'Only a match that has not started can be postponed';
      end if;
    elsif new_status not in ('in_progress', 'submitted') then
      raise exception 'Only someone who looks after match nights can set a fixture to %', new_status;
    end if;
  end if;
  -- A result can't be submitted without a photo of the paper scorecard.
  if new_status = 'submitted' and not exists (select 1 from fixtures where id = fid and coalesce(scorecard_url, '') <> '') then
    raise exception 'Upload a photo of the paper scorecard before submitting the result';
  end if;
  update fixtures set status = new_status where id = fid;
  -- Frames of this match that were being scored ball by ball (live_matches.fixture_id): once the card is in,
  -- none of them is still "on the table".
  if new_status in ('submitted', 'approved', 'postponed') then
    delete from live_matches where fixture_id = fid and status = 'setup';
    update live_matches set status = 'finished', finished_at = coalesce(finished_at, now()) where fixture_id = fid and status = 'live';
  end if;
end;
$$;

-- A picture kept in this website's own picture store ("images" bucket), optionally in one folder of it.
-- Used to check the addresses that captains and players send in: they can only be pictures they have
-- uploaded here — never a link to somewhere else, and never anything that is not a plain https address.
create or replace function public.is_site_image(url text, folder text default null) returns boolean
language sql immutable as $$
  select url ~ ('^https://[A-Za-z0-9.-]+/storage/v1/object/public/images/' || coalesce(folder || '/', '') || '[A-Za-z0-9/_.-]+$') and length(url) <= 500;
$$;

-- Captains attach a photo of the paper scorecard.
create or replace function public.set_scorecard_photo(fid uuid, url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_fixture(fid) then
    raise exception 'You are not allowed to change this fixture';
  end if;
  -- Only a photo uploaded to this website (the scorecards folder), or nothing at all.
  if coalesce(url, '') <> '' and not public.is_site_image(url, 'scorecards') then
    raise exception 'That is not a scorecard photo uploaded on this website';
  end if;
  update fixtures set scorecard_url = nullif(url, '') where id = fid;
end;
$$;

-- Competition matches: admins and the competition secretary, or a captain
-- whose team (or player) is in the match, until the match is completed.
create or replace function public.can_edit_comp_match(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage('competitions') or exists (
    select 1
    from competition_matches m
    join competition_entries e on e.id in (m.entry_a, m.entry_b)
    left join players pl on pl.id = e.player_id
    left join players pl2 on pl2.id = e.partner_id
    where m.id = mid
      and m.status <> 'completed'
      and (public.is_captain_of(e.team_id) or public.is_captain_of(pl.team_id) or public.is_captain_of(pl2.team_id))
  );
$$;

-- Bracket draws: write a decided match's winner into its next-round match.
create or replace function public.advance_winner(mid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m competition_matches; mode text; w uuid;
begin
  select * into m from competition_matches where id = mid;
  select draw_mode into mode from competitions where id = m.competition_id;
  if mode = 'redraw' then return; end if;
  -- A walkover (round 37): the side given it goes through. Otherwise more frames wins; level on frames,
  -- the higher total points wins (handicap competitions).
  if m.walkover is null and (m.score_a is null or m.score_b is null) then return; end if;
  w := case when m.walkover = 'a' then m.entry_a when m.walkover = 'b' then m.entry_b
            when m.score_a > m.score_b then m.entry_a
            when m.score_b > m.score_a then m.entry_b
            when coalesce(m.points_a, 0) > coalesce(m.points_b, 0) then m.entry_a
            when coalesce(m.points_b, 0) > coalesce(m.points_a, 0) then m.entry_b end;
  if w is null then return; end if;
  -- A side set by hand to "Winner of …" or "Bye" (round 41) is left alone: comp_from_winner() looks after those.
  if m.slot % 2 = 0 then
    update competition_matches set entry_a = w where competition_id = m.competition_id and round = m.round + 1 and slot = m.slot / 2
      and from_a is null and not coalesce(bye_a, false);
  else
    update competition_matches set entry_b = w where competition_id = m.competition_id and round = m.round + 1 and slot = m.slot / 2
      and from_b is null and not coalesce(bye_b, false);
  end if;
end;
$$;
revoke all on function public.advance_winner(uuid) from public, anon, authenticated;

-- Recalculate a competition match's score from its frames, and start or finish it.
-- The total points of each side are kept too: in a handicap competition they decide
-- a match that finishes level on frames.
create or replace function public.sync_comp_match(mid uuid, finished boolean) returns void
language plpgsql security definer set search_path = public as $$
declare wa int; wb int; pa int; pb int; hc boolean;
begin
  if not public.can_edit_comp_match(mid) then
    raise exception 'You are not allowed to change this match';
  end if;
  select count(*) filter (where a_points > b_points), count(*) filter (where b_points > a_points),
         coalesce(sum(a_points), 0), coalesce(sum(b_points), 0)
    into wa, wb, pa, pb from competition_frames where match_id = mid;
  select coalesce(c.handicap, false) into hc from competitions c join competition_matches m on m.competition_id = c.id where m.id = mid;
  if finished and wa = wb and not (hc and pa <> pb) then
    if hc then raise exception 'A knockout match needs a winner — the frames and the total points are both level'; end if;
    raise exception 'A knockout match needs a winner — the frames are level';
  end if;
  update competition_matches
     set score_a = case when wa + wb > 0 then wa end,
         score_b = case when wa + wb > 0 then wb end,
         points_a = case when wa + wb > 0 then pa end,
         points_b = case when wa + wb > 0 then pb end,
         walkover = case when wa + wb > 0 then null else walkover end,
         status = case when finished then 'completed' when wa + wb > 0 then 'in_progress' else status end
   where id = mid;
  if finished then perform public.advance_winner(mid); end if;
end;
$$;

-- Captains can register a new player, but only for their own team. The player
-- is flagged for the admin to check (handicap, position…).
create or replace function public.add_player(p_name text, p_team uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; staff boolean := public.can_manage('league');
begin
  if not (staff or public.is_captain_of(p_team)) then
    raise exception 'You can only add players to your own team';
  end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 80 then
    raise exception 'Please enter the player''s name';
  end if;
  insert into players (full_name, team_id, needs_review) values (trim(p_name), p_team, not staff) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.add_player(text, uuid) from public, anon;
grant execute on function public.add_player(text, uuid) to authenticated;

-- A logged-in player (or captain) edits their OWN player profile. Only the
-- fields listed here can change: not their name, team, handicap or position.
create or replace function public.update_my_player(patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select player_id into pid from profiles where id = auth.uid();
  if pid is null then
    raise exception 'Your login is not linked to a player profile yet';
  end if;
  if octet_length(patch::text) > 60000 then
    raise exception 'That is too much text — please shorten it';
  end if;
  if patch ? 'gallery' and (jsonb_typeof(patch->'gallery') <> 'array' or jsonb_array_length(patch->'gallery') > 24) then
    raise exception 'A profile can have up to 24 pictures';
  end if;
  -- A photo or picture must be one uploaded to this website (or one already on the profile): never a link elsewhere.
  if patch ? 'avatar_url' and coalesce(patch->>'avatar_url', '') <> ''
     and not public.is_site_image(patch->>'avatar_url')
     and patch->>'avatar_url' is distinct from (select avatar_url from players where id = pid) then
    raise exception 'That photo was not uploaded on this website';
  end if;
  if patch ? 'gallery' and exists (
       select 1 from jsonb_array_elements(patch->'gallery') g
       where jsonb_typeof(g) <> 'string'
          or (not public.is_site_image(g #>> '{}') and not ((select gallery from players where id = pid) @> jsonb_build_array(g)))) then
    raise exception 'One of those pictures was not uploaded on this website';
  end if;
  if patch ? 'birth_date' and coalesce(patch->>'birth_date', '') <> '' and patch->>'birth_date' !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'That date could not be read';
  end if;
  update players set
    avatar_url     = case when patch ? 'avatar_url' then nullif(patch->>'avatar_url', '') else avatar_url end,
    birth_date     = case when patch ? 'birth_date' then nullif(patch->>'birth_date', '')::date else birth_date end,
    bio            = case when patch ? 'bio' then patch->>'bio' else bio end,
    career_history = case when patch ? 'career_history' then patch->>'career_history' else career_history end,
    past_teams     = case when patch ? 'past_teams' then patch->>'past_teams' else past_teams end,
    gallery        = case when patch ? 'gallery' then patch->'gallery' else gallery end,
    cueview        = case when patch ? 'cueview' and jsonb_typeof(patch->'cueview') = 'object' then patch->'cueview' else cueview end
  where id = pid;
end;
$$;
revoke all on function public.update_my_player(jsonb) from public, anon;
grant execute on function public.update_my_player(jsonb) to authenticated;

revoke all on function public.set_fixture_status(uuid, text) from public, anon;
revoke all on function public.set_scorecard_photo(uuid, text) from public, anon;
revoke all on function public.sync_comp_match(uuid, boolean) from public, anon;
grant execute on function public.set_scorecard_photo(uuid, text) to authenticated;
grant execute on function public.sync_comp_match(uuid, boolean) to authenticated;
grant execute on function public.can_edit_comp_match(uuid) to anon, authenticated;
grant execute on function public.set_fixture_status(uuid, text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_master() to anon, authenticated;
grant execute on function public.can_manage(text) to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_captain_of(uuid) to anon, authenticated;
grant execute on function public.can_edit_fixture(uuid) to anon, authenticated;

-- ── v6: handicaps ───────────────────────────────────────────────
-- Keep a record whenever a handicap changes (however it was changed).
create or replace function public.log_handicap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into handicap_changes (player_id, old_handicap, new_handicap, note, changed_by)
  values (new.id, old.handicap, new.handicap, nullif(current_setting('app.handicap_note', true), ''),
          (select coalesce(full_name, email) from profiles where id = auth.uid()));
  return new;
end;
$$;
drop trigger if exists players_log_handicap on players;
create trigger players_log_handicap after update of handicap on players
  for each row when (old.handicap is distinct from new.handicap) execute function public.log_handicap();

-- Anyone whose role has the "handicaps" permission (by default the league secretary AND
-- the competition secretary) can adjust a handicap without being able to change anything
-- else about the player.
create or replace function public.set_handicap(pid uuid, value int, note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage('handicaps') then
    raise exception 'Your login isn''t allowed to change handicaps';
  end if;
  if value is null or value < -200 or value > 200 then
    raise exception 'A handicap must be a whole number between -200 and 200';
  end if;
  perform set_config('app.handicap_note', coalesce(left(note, 200), ''), true);
  update players set handicap = value where id = pid;
end;
$$;

-- The yearly review: remember every player's handicap as "last year's", so
-- the website can show who has gone up or down since.
create or replace function public.start_handicap_review() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.can_manage('handicaps') then
    raise exception 'Your login isn''t allowed to start the handicap review';
  end if;
  update players set last_handicap = handicap where last_handicap is distinct from handicap;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.set_handicap(uuid, int, text) from public, anon;
revoke all on function public.start_handicap_review() from public, anon;
grant execute on function public.set_handicap(uuid, int, text) to authenticated;
grant execute on function public.start_handicap_review() to authenticated;

-- ── v6: match night photos ──────────────────────────────────────
-- The home team's captain or vice captain (or an admin) sets the photos for a match.
create or replace function public.set_match_photos(fid uuid, urls jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.can_manage('matchnights') or public.is_captain_of((select home_team_id from fixtures where id = fid))) then
    raise exception 'Only the home team''s captain or vice captain can add match night photos';
  end if;
  if jsonb_typeof(urls) <> 'array' or jsonb_array_length(urls) > 12 or octet_length(urls::text) > 8000 then
    raise exception 'A match can have up to 12 photos';
  end if;
  -- Only photos uploaded to this website (the matchnight folder), or ones already on the match.
  if exists (select 1 from jsonb_array_elements(urls) g
             where jsonb_typeof(g) <> 'string'
                or (not public.is_site_image(g #>> '{}', 'matchnight') and not ((select gallery from fixtures where id = fid) @> jsonb_build_array(g)))) then
    raise exception 'One of those photos was not uploaded on this website';
  end if;
  update fixtures set gallery = urls where id = fid;
end;
$$;
revoke all on function public.set_match_photos(uuid, jsonb) from public, anon;
grant execute on function public.set_match_photos(uuid, jsonb) to authenticated;

-- ── v6: competition entry forms ─────────────────────────────────
-- Anyone can enter (no login needed): pick a player and one or more
-- competitions. Each entry waits as "pending" until the fee is confirmed.
-- partners: { "<competition id>": "<partner's player id>" } for doubles.
create or replace function public.enter_competitions(p_player uuid, p_competitions uuid[], p_contact text default null, p_partners jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pl players; c competitions; partner players; team teams; league uuid;
  entry_name text; days int; made jsonb := '[]'::jsonb; cid uuid; new_row competition_signups;
begin
  select * into pl from players where id = p_player;
  if pl.id is null then raise exception 'Please choose your name from the list'; end if;
  if p_competitions is null or coalesce(array_length(p_competitions, 1), 0) = 0 then raise exception 'Choose at least one competition'; end if;
  if array_length(p_competitions, 1) > 20 then raise exception 'Too many competitions in one entry'; end if;
  select * into team from teams where id = pl.team_id;
  league := team.league_id;
  select entry_pay_days into days from settings where id = 1;

  foreach cid in array p_competitions loop
    select * into c from competitions where id = cid;
    if c.id is null or not c.entries_open or (c.entry_closes is not null and c.entry_closes < current_date) then
      raise exception 'Entries for % are closed', coalesce(c.name, 'that competition');
    end if;
    if jsonb_array_length(c.league_ids) > 0 and not (c.league_ids ? coalesce(league::text, '')) then
      raise exception '% is not open to players from your league', c.name;
    end if;
    partner := null;
    if c.kind = 'Team' then
      if team.id is null then raise exception 'You need to be in a team to enter %', c.name; end if;
      entry_name := team.name;
      if exists (select 1 from competition_signups where competition_id = cid and team_id = team.id and status in ('pending', 'approved'))
         or exists (select 1 from competition_entries where competition_id = cid and team_id = team.id) then
        raise exception '% are already entered in %', team.name, c.name;
      end if;
    else
      if c.kind = 'Doubles' then
        select * into partner from players where id = nullif(p_partners ->> cid::text, '')::uuid;
        if partner.id is null or partner.id = pl.id then raise exception 'Choose your partner for %', c.name; end if;
        entry_name := pl.full_name || ' & ' || partner.full_name;
      else
        entry_name := pl.full_name;
      end if;
      if exists (select 1 from competition_signups where competition_id = cid and status in ('pending', 'approved')
                   and (player_id in (pl.id, partner.id) or partner_id in (pl.id, partner.id)))
         or exists (select 1 from competition_entries where competition_id = cid and (player_id in (pl.id, partner.id) or partner_id in (pl.id, partner.id))) then
        raise exception '% already entered in %', case when c.kind = 'Doubles' then 'One of you is' else pl.full_name || ' is' end, c.name;
      end if;
    end if;
    insert into competition_signups (competition_id, player_id, partner_id, team_id, name, contact, pay_by)
    values (cid, pl.id, partner.id, case when c.kind = 'Team' then team.id end, entry_name, nullif(left(trim(coalesce(p_contact, '')), 200), ''),
            now() + make_interval(days => greatest(1, coalesce(days, 7))))
    returning * into new_row;
    made := made || jsonb_build_object('id', new_row.id, 'competition_id', cid, 'name', entry_name, 'fee', c.entry_fee, 'pay_by', new_row.pay_by);
  end loop;
  return made;
end;
$$;

-- Unpaid entries lapse once their pay-by date has passed.
create or replace function public.expire_signups() returns void
language sql security definer set search_path = public as $$
  update competition_signups set status = 'expired', decided_at = now() where status = 'pending' and pay_by < now();
$$;

-- Who has entered a competition through the form (names only — no contact details).
create or replace function public.signup_names(p_competition uuid) returns table (name text, status text, pay_by timestamptz)
language sql stable security definer set search_path = public as $$
  select name, case when status = 'pending' and pay_by < now() then 'expired' else status end, pay_by
  from competition_signups where competition_id = p_competition and status in ('pending', 'approved') order by created_at;
$$;

-- The competition secretary confirms payment (the entrant joins the competition) or removes the entry.
create or replace function public.decide_signup(sid uuid, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare su competition_signups; eid uuid;
begin
  if not public.can_manage('competitions') then
    raise exception 'Only the competition secretary can approve entries';
  end if;
  select * into su from competition_signups where id = sid;
  if su.id is null then raise exception 'That entry no longer exists'; end if;
  if approve then
    if su.entry_id is null then
      insert into competition_entries (competition_id, name, team_id, player_id, partner_id, seed)
      values (su.competition_id, su.name, su.team_id, case when su.team_id is null then su.player_id end, case when su.team_id is null then su.partner_id end,
              (select coalesce(max(seed), 0) + 1 from competition_entries where competition_id = su.competition_id))
      returning id into eid;
    end if;
    update competition_signups set status = 'approved', decided_at = now(), entry_id = coalesce(eid, entry_id) where id = sid;
  else
    if su.entry_id is not null then delete from competition_entries where id = su.entry_id; end if;
    update competition_signups set status = 'rejected', decided_at = now(), entry_id = null where id = sid;
  end if;
end;
$$;
revoke all on function public.decide_signup(uuid, boolean) from public, anon;
grant execute on function public.decide_signup(uuid, boolean) to authenticated;
grant execute on function public.enter_competitions(uuid, uuid[], text, jsonb) to anon, authenticated;
grant execute on function public.expire_signups() to anon, authenticated;
grant execute on function public.signup_names(uuid) to anon, authenticated;

-- ── row-level security ──────────────────────────────────────────
-- Everyone can READ league data. Admins can WRITE all of it; each officer
-- role can write its own part (see can_manage above). Captains can write
-- frames and breaks for their own matches.
do $$
declare t text; area text;
begin
  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','frames','breaks','articles','pages','sponsors','profiles','competitions','competition_entries','competition_matches','categories','media','settings','competition_frames','competition_breaks','page_views','announcements','role_permissions','audit_log','key_dates','awards','meetings','live_matches','private_settings','byes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "admin write" on %I', t);
  end loop;

  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','frames','breaks','pages','sponsors','competitions','competition_entries','competition_matches','categories','settings','competition_frames','competition_breaks','announcements','role_permissions','key_dates','awards','live_matches','byes'] loop
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;

  -- Each table belongs to one part of the dashboard; can_manage() says who may change it
  -- (the Master Admin, plus the roles ticked for that part under Admin → Roles & permissions).
  -- Fixtures: whoever looks after fixtures, or match nights (rearranging a postponed match).
  execute 'create policy "admin write" on fixtures for all using (public.can_manage(''fixtures'') or public.can_manage(''matchnights'')) with check (public.can_manage(''fixtures'') or public.can_manage(''matchnights''))';
  -- Bye weeks go with the fixture list.
  execute 'create policy "admin write" on byes for all using (public.can_manage(''fixtures'')) with check (public.can_manage(''fixtures''))';
  -- Logins are only ever written by the logins function (netlify/functions/admin-users.mjs), which makes its
  -- own checks. Directly, only the Master Admin may touch them — so nobody can promote themselves.
  execute 'create policy "admin write" on profiles for all using (public.is_master()) with check (public.is_master())';
  execute 'create policy "admin write" on role_permissions for all using (public.is_master()) with check (public.is_master())';
  foreach t in array array['seasons','leagues','venues','teams','players'] loop
    execute format('create policy "admin write" on %I for all using (public.can_manage(''league'')) with check (public.can_manage(''league''))', t);
  end loop;
  foreach t in array array['competitions','competition_entries','competition_matches','competition_frames','competition_breaks'] loop
    execute format('create policy "admin write" on %I for all using (public.can_manage(''competitions'')) with check (public.can_manage(''competitions''))', t);
  end loop;
  foreach t in array array['articles','pages','sponsors','categories','announcements'] loop
    execute format('create policy "admin write" on %I for all using (public.can_manage(''website'')) with check (public.can_manage(''website''))', t);
  end loop;
  -- Site settings, branding and the visitor statistics.
  foreach t in array array['settings','page_views'] loop
    execute format('create policy "admin write" on %I for all using (public.can_manage(''settings'')) with check (public.can_manage(''settings''))', t);
  end loop;
  -- Key dates and presentation-night awards: whoever looks after the website or the competitions.
  foreach t in array array['key_dates','awards'] loop
    execute format('create policy "admin write" on %I for all using (public.can_manage(''website'') or public.can_manage(''competitions'')) with check (public.can_manage(''website'') or public.can_manage(''competitions''))', t);
  end loop;
  -- Meetings: the website team; unpublished ones are hidden from the public.
  execute 'create policy "admin write" on meetings for all using (public.can_manage(''website'')) with check (public.can_manage(''website''))';
  execute 'create policy "public read" on meetings for select using (is_published or public.can_manage(''website''))';
  -- The live scoreboard: officers who have "Live scoring" under Admin → Roles & permissions. (Captains and vice captains
  -- given live scoring are not officers: they only reach the frames of their own team's matches — "captain write" below.)
  execute 'create policy "admin write" on live_matches for all using (public.can_manage(''livescoring'') and public.is_staff()) with check (public.can_manage(''livescoring'') and public.is_staff())';
  -- Who gets the result emails: private (settings & branding only).
  execute 'create policy "admin write" on private_settings for all using (public.can_manage(''settings'')) with check (public.can_manage(''settings''))';
  -- The activity log: read by the Master Admin only; written only by the triggers below.
  execute 'create policy "public read" on audit_log for select using (public.is_master())';
  -- The image library ("media"): each person's own pictures — see "Round 20" further down.
end $$;

-- Entry-form entries (with contact details) and the handicap log are for officers only.
-- The public reaches them through enter_competitions() and signup_names() above.
alter table competition_signups enable row level security;
alter table handicap_changes enable row level security;
drop policy if exists "admin write" on competition_signups;
drop policy if exists "staff read" on handicap_changes;
create policy "admin write" on competition_signups for all using (public.can_manage('competitions')) with check (public.can_manage('competitions'));
create policy "staff read" on handicap_changes for select using (public.can_manage('handicaps') or public.can_manage('league'));

-- Unpublished articles are hidden from the public.
-- (A news writer also sees their own drafts.)
create policy "public read" on articles for select using (is_published or public.can_manage('website') or (created_by = auth.uid() and public.can_manage('news')));

-- Logins: you can see your own profile; whoever manages logins sees everyone's. Emails are never public.
create policy "public read" on profiles for select using (id = auth.uid() or public.can_manage('people'));

-- Scorecards: captains (and admins) can add, change and remove frames/breaks for fixtures they may edit.
drop policy if exists "captain write" on frames;
drop policy if exists "captain write" on breaks;
create policy "captain write" on frames for all
  using (public.can_edit_fixture(fixture_id)) with check (public.can_edit_fixture(fixture_id));
create policy "captain write" on breaks for all
  using (public.can_edit_fixture(fixture_id)) with check (public.can_edit_fixture(fixture_id));

-- Competition scorecards: captains of a team in the match (and admins).
drop policy if exists "captain write" on competition_frames;
drop policy if exists "captain write" on competition_breaks;
create policy "captain write" on competition_frames for all
  using (public.can_edit_comp_match(match_id)) with check (public.can_edit_comp_match(match_id));
create policy "captain write" on competition_breaks for all
  using (public.can_edit_comp_match(match_id)) with check (public.can_edit_comp_match(match_id));

-- Statistics: anyone may record a page view; only the admin can read them.
drop policy if exists "anyone insert" on page_views;
create policy "anyone insert" on page_views for insert to anon, authenticated with check (true);

-- ── activity log ────────────────────────────────────────────────
-- Who did it: the logged-in person's name ("System" for the SQL editor and the logins function).
create or replace function public.audit_actor() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(nullif(full_name, ''), email) from profiles where id = auth.uid()), 'System');
$$;
-- A readable name for a row: "Bethel A v Bugle (22/09/2026)", a player's name, an article's title…
create or replace function public.audit_label(t text, j jsonb) returns text
language sql stable security definer set search_path = public as $$
  select left(coalesce(
    case when t = 'fixtures' then
      coalesce((select name from teams where id = nullif(j->>'home_team_id', '')::uuid), '?') || ' v ' ||
      coalesce((select name from teams where id = nullif(j->>'away_team_id', '')::uuid), '?') ||
      coalesce(' (' || to_char((j->>'starts_at')::timestamptz at time zone 'Europe/London', 'DD/MM/YYYY') || ')', '') end,
    case when t = 'byes' then
      coalesce((select name from teams where id = nullif(j->>'team_id', '')::uuid), '?') || ' bye week' ||
      coalesce(' (' || to_char((j->>'bye_on')::date, 'DD/MM/YYYY') || ')', '') end,
    case when t = 'settings' then 'Site settings' end,
    case when t = 'role_permissions' then j->>'role' end,
    case when t = 'meetings' then coalesce(nullif(j->>'title', ''), j->>'kind') || ' (' || to_char((j->>'held_on')::date, 'DD/MM/YYYY') || ')' end,
    nullif(j->>'name', ''), nullif(j->>'full_name', ''), nullif(j->>'title', ''), nullif(j->>'text', ''), j->>'id'), 140);
$$;
-- One line per changed or removed row, listing what changed.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; diff jsonb := '{}'::jsonb; k text;
begin
  if random() < 0.01 then delete from audit_log where at < now() - interval '1 year'; end if;
  o := to_jsonb(old);
  if tg_op = 'DELETE' then
    insert into audit_log (actor_id, actor, action, table_name, row_id, label)
    values (auth.uid(), public.audit_actor(), 'removed', tg_table_name, o->>'id', public.audit_label(tg_table_name, o));
    return old;
  end if;
  n := to_jsonb(new);
  for k in select key from jsonb_each(n) loop
    if (n->k) is distinct from (o->k) and k not in ('updated_at', 'postponed_at', 'code', 'slug', 'submitted_email_at', 'reminder_sent_at', 'result_at') then
      -- Short values are kept ("status: submitted → approved"); long ones (an article's text, a picture link) are just noted as changed.
      diff := diff || jsonb_build_object(k,
        case when length(coalesce((n->k)::text, '')) > 140 or length(coalesce((o->k)::text, '')) > 140
             then 'null'::jsonb else jsonb_build_array(o->k, n->k) end);
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    insert into audit_log (actor_id, actor, action, table_name, row_id, label, changes)
    values (auth.uid(), public.audit_actor(), 'changed', tg_table_name, n->>'id', public.audit_label(tg_table_name, n), diff);
  end if;
  return new;
end;
$$;
-- One line per "add" (a whole import or fixture list is one line: "Bethel A v Bugle… and 54 more").
create or replace function public.audit_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; names text; first_id text;
begin
  select count(*), string_agg(lbl, ', ') filter (where rn <= 3), min(id) filter (where rn = 1)
    into n, names, first_id
  from (select public.audit_label(tg_table_name, to_jsonb(a)) as lbl, to_jsonb(a)->>'id' as id, row_number() over () as rn from added a) s;
  if n = 0 then return null; end if;
  insert into audit_log (actor_id, actor, action, table_name, row_id, label, changes)
  values (auth.uid(), public.audit_actor(), 'added', tg_table_name, case when n = 1 then first_id end,
          case when n > 3 then names || ' and ' || (n - 3) || ' more' else names end,
          case when n > 1 then jsonb_build_object('count', n) end);
  return null;
end;
$$;
revoke all on function public.audit_row() from public, anon, authenticated;
revoke all on function public.audit_added() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','competitions','competition_entries','articles','pages','sponsors','categories','announcements','settings','role_permissions','key_dates','awards','meetings','byes'] loop
    execute format('drop trigger if exists audit_row on %I', t);
    execute format('drop trigger if exists audit_added on %I', t);
    execute format('create trigger audit_row after update or delete on %I for each row execute function public.audit_row()', t);
    execute format('create trigger audit_added after insert on %I referencing new table as added for each statement execute function public.audit_added()', t);
  end loop;
end $$;

-- ── v10: My Snooker, scoreboard → draw, merchandise, CueView form ──
-- My Snooker (/myteam): a logged-in person's own page about one team. They choose the team
-- (it need not be the team their login belongs to) and can switch the page off again.
alter table profiles add column if not exists my_team_id uuid references teams on delete set null;
alter table profiles add column if not exists my_snooker boolean not null default true;
create or replace function public.set_my_snooker(p_team uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  if p_team is not null and not exists (select 1 from teams where id = p_team) then
    raise exception 'That team is not on the website';
  end if;
  update profiles set my_team_id = p_team, my_snooker = coalesce(p_on, true) where id = auth.uid();
end;
$$;
revoke all on function public.set_my_snooker(uuid, boolean) from public, anon;
grant execute on function public.set_my_snooker(uuid, boolean) to authenticated;

-- Live scoreboard → the draw. A scoreboard match can be tied to a match in a competition's draw
-- (live_matches.comp_match_id). Each time a frame ends the draw is brought up to date from the
-- scoreboard, and when the match ends the result is final and the winner goes through — nobody
-- has to type the frames in again. If the scorer presses Undo after the last frame, the winner
-- is taken back out of the next round (as long as that round hasn't started).
alter table live_matches add column if not exists comp_match_id uuid references competition_matches on delete set null;
create or replace function public.scoreboard_to_draw(lid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare l live_matches; m competition_matches; nxt competition_matches; mode text; w uuid; frames jsonb; pa int; pb int;
begin
  if not (public.can_manage('competitions') or public.can_manage('matchnights')) then
    raise exception 'You are not allowed to change this match';
  end if;
  select * into l from live_matches where id = lid;
  if not found or l.comp_match_id is null then return 'none'; end if;
  select * into m from competition_matches where id = l.comp_match_id;
  if not found then return 'none'; end if;
  select draw_mode into mode from competitions where id = m.competition_id;

  -- The match had finished and is being re-opened: take its winner back out of the next round.
  if m.status = 'completed' and l.status <> 'finished' and coalesce(mode, 'bracket') <> 'redraw' then
    w := case when m.score_a > m.score_b then m.entry_a when m.score_b > m.score_a then m.entry_b end;
    select * into nxt from competition_matches where competition_id = m.competition_id and round = m.round + 1 and slot = m.slot / 2;
    if found and w is not null then
      if nxt.score_a is not null or nxt.status <> 'scheduled' then
        raise exception 'The next round of the draw has already started, so this result cannot be taken back from the scoreboard. Change it under Draws & results.';
      end if;
      if m.slot % 2 = 0 then update competition_matches set entry_a = null where id = nxt.id and entry_a = w;
      else update competition_matches set entry_b = null where id = nxt.id and entry_b = w; end if;
    end if;
  end if;

  -- The frames played so far, exactly as the scoreboard has them (and each player's best break of 30 or more in a frame).
  frames := case when jsonb_typeof(l.state->'frames') = 'array' then l.state->'frames' else '[]'::jsonb end;
  delete from competition_frames where match_id = m.id;
  delete from competition_breaks where match_id = m.id;
  insert into competition_frames (match_id, frame_no, a_player_id, b_player_id, a_points, b_points)
    select m.id, (f->>'no')::int, l.player_a_id, l.player_b_id,
           greatest(least(coalesce((f->>'a')::int, 0), 300), 0), greatest(least(coalesce((f->>'b')::int, 0), 300), 0)
    from jsonb_array_elements(frames) f;
  insert into competition_breaks (match_id, frame_no, player_id, value)
    select m.id, (f->>'no')::int, l.player_a_id, (f->>'high_a')::int from jsonb_array_elements(frames) f
     where l.player_a_id is not null and coalesce((f->>'high_a')::int, 0) between 30 and 155
    union all
    select m.id, (f->>'no')::int, l.player_b_id, (f->>'high_b')::int from jsonb_array_elements(frames) f
     where l.player_b_id is not null and coalesce((f->>'high_b')::int, 0) between 30 and 155;
  select coalesce(sum(a_points), 0), coalesce(sum(b_points), 0) into pa, pb from competition_frames where match_id = m.id;

  -- The score is the frames WON on the scoreboard (a conceded frame counts for whoever was given it).
  update competition_matches
     set score_a = case when coalesce(l.frames_a, 0) + coalesce(l.frames_b, 0) > 0 then l.frames_a end,
         score_b = case when coalesce(l.frames_a, 0) + coalesce(l.frames_b, 0) > 0 then l.frames_b end,
         points_a = case when coalesce(l.frames_a, 0) + coalesce(l.frames_b, 0) > 0 then pa end,
         points_b = case when coalesce(l.frames_a, 0) + coalesce(l.frames_b, 0) > 0 then pb end,
         walkover = null,
         status = case when l.status = 'finished' then 'completed' when l.status = 'live' then 'in_progress' else 'scheduled' end
   where id = m.id;
  if l.status = 'finished' then
    perform public.advance_winner(m.id);
    return 'finished';
  end if;
  return 'updated';
end;
$$;
revoke all on function public.scoreboard_to_draw(uuid) from public, anon;
grant execute on function public.scoreboard_to_draw(uuid) to authenticated;

-- Merchandise (/merchandise): what the league sells, with a price as you want it shown. Nothing is paid for on the website.
create table if not exists merchandise (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price text,
  description text,
  options text,
  image_url text,
  url text,
  sort int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table settings add column if not exists merch_intro text;
alter table settings add column if not exists merch_how text;
alter table merchandise enable row level security;
drop policy if exists "public read" on merchandise;
drop policy if exists "admin write" on merchandise;
create policy "public read" on merchandise for select using (is_active or public.can_manage('website'));
create policy "admin write" on merchandise for all using (public.can_manage('website')) with check (public.can_manage('website'));

-- CueViews sent in on the website's form (/cueview). They wait here until someone who looks after
-- the players checks them, picks whose profile they belong to and approves them. Never public.
create table if not exists cueview_submissions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players on delete set null,
  name text not null,
  team text,
  answers jsonb not null default '{}'::jsonb,
  bio text,
  contact text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table cueview_submissions enable row level security;
drop policy if exists "admin write" on cueview_submissions;
create policy "admin write" on cueview_submissions for all using (public.can_manage('league')) with check (public.can_manage('league'));
-- Anyone can send one in (like a paper form): this checks it is a sensible size and files it as "waiting".
create or replace function public.submit_cueview(p_player uuid, p_name text, p_team text, p_answers jsonb, p_bio text default null, p_contact text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; who text;
begin
  who := nullif(btrim(coalesce((select full_name from players where id = p_player), p_name, '')), '');
  if who is null then raise exception 'Please choose or type your name'; end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then raise exception 'The answers could not be read'; end if;
  if length(who) > 80 or octet_length(coalesce(p_answers, '{}'::jsonb)::text) > 12000 or length(coalesce(p_bio, '')) > 3000 or length(coalesce(p_contact, '')) > 200 then
    raise exception 'That is too much text — please shorten your answers';
  end if;
  if not exists (select 1 from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) a where btrim(a.value) <> '') and btrim(coalesce(p_bio, '')) = '' then
    raise exception 'Please answer at least one question';
  end if;
  if (select count(*) from cueview_submissions where status = 'pending') >= 300 then
    raise exception 'The form is busy at the moment — please try again later';
  end if;
  insert into cueview_submissions (player_id, name, team, answers, bio, contact)
  values (p_player, who, nullif(btrim(coalesce(p_team, '')), ''), coalesce(p_answers, '{}'::jsonb), nullif(btrim(coalesce(p_bio, '')), ''), nullif(btrim(coalesce(p_contact, '')), ''))
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.submit_cueview(uuid, text, text, jsonb, text, text) to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['merchandise'] loop
    execute format('drop trigger if exists audit_row on %I', t);
    execute format('drop trigger if exists audit_added on %I', t);
    execute format('create trigger audit_row after update or delete on %I for each row execute function public.audit_row()', t);
    execute format('create trigger audit_added after insert on %I referencing new table as added for each statement execute function public.audit_added()', t);
  end loop;
end $$;

-- The shields' real names (only where they still have the sample ones).
update leagues set shield_name = 'Victory League Runabout Shield' where slug = 'victory-league' and coalesce(shield_name, '') in ('', 'Victory Shield');
update leagues set shield_name = 'Rees Memorial League Runabout Shield' where slug = 'rees-memorial-league' and coalesce(shield_name, '') in ('', 'Rees Shield');

-- ── v11: My Snooker for everyone, news extras, more celebrations ─
-- My Snooker is now for every login (players, captains, officers). Each person chooses the teams and
-- players they follow, which sections they see, and where: on their own page (/myteam), on the home
-- page, or both. All of it is kept in profiles.my_prefs:
--   { "place": "page" | "home" | "both", "teams": [team ids], "players": [player ids],
--     "sections": ["next", "results", …] (left out = every section), "cats": [news categories] }
-- It changes what THEY see and nothing else: a login's dashboard rights are exactly as before.
alter table profiles add column if not exists my_prefs jsonb not null default '{}'::jsonb;
create or replace function public.set_my_prefs(p_on boolean, p_prefs jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare p jsonb := coalesce(p_prefs, '{}'::jsonb); v_teams jsonb; v_players jsonb; v_cats jsonb; v_place text; v_out jsonb;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  if jsonb_typeof(p) <> 'object' or octet_length(p::text) > 8000 then raise exception 'Those choices could not be saved'; end if;
  -- Only teams and players that are on the website, in the order chosen: at most 12 teams and 40 players.
  select coalesce(jsonb_agg(x.id order by x.n), '[]'::jsonb) into v_teams from (
    select t.id, min(e.n) as n from jsonb_array_elements_text(case when jsonb_typeof(p->'teams') = 'array' then p->'teams' else '[]'::jsonb end) with ordinality e(v, n)
      join teams t on t.id::text = e.v group by t.id order by 2 limit 12) x;
  select coalesce(jsonb_agg(x.id order by x.n), '[]'::jsonb) into v_players from (
    select pl.id, min(e.n) as n from jsonb_array_elements_text(case when jsonb_typeof(p->'players') = 'array' then p->'players' else '[]'::jsonb end) with ordinality e(v, n)
      join players pl on pl.id::text = e.v group by pl.id order by 2 limit 40) x;
  select coalesce(jsonb_agg(left(e.v, 80) order by e.n), '[]'::jsonb) into v_cats from (
    select v, n from jsonb_array_elements_text(case when jsonb_typeof(p->'cats') = 'array' then p->'cats' else '[]'::jsonb end) with ordinality e(v, n) limit 20) e;
  v_place := case when p->>'place' in ('page', 'home', 'both') then p->>'place' else 'page' end;
  v_out := jsonb_build_object('place', v_place, 'teams', v_teams, 'players', v_players, 'cats', v_cats);
  -- Sections: left out means "all of them"; otherwise the short names chosen (never more than 30).
  if jsonb_typeof(p->'sections') = 'array' then
    v_out := v_out || jsonb_build_object('sections', (select coalesce(jsonb_agg(e.v order by e.n), '[]'::jsonb)
      from (select v, n from jsonb_array_elements_text(p->'sections') with ordinality e(v, n) where v ~ '^[a-z_]{1,24}$' limit 30) e));
  end if;
  update profiles set my_snooker = coalesce(p_on, true), my_prefs = v_out,
         my_team_id = (select (v_teams->>0)::uuid where jsonb_array_length(v_teams) > 0)
   where id = auth.uid();
end;
$$;
revoke all on function public.set_my_prefs(boolean, jsonb) from public, anon;
grant execute on function public.set_my_prefs(boolean, jsonb) to authenticated;

-- News: who wrote it, a video, a place in "Featured news" at the top of the News page, and more than one category.
alter table articles add column if not exists author text;
alter table articles add column if not exists video_url text;
alter table articles add column if not exists hub_featured boolean not null default false;
alter table articles add column if not exists more_categories jsonb not null default '[]'::jsonb;
alter table settings add column if not exists news_author text;

-- Celebrations (confetti) for more than a highest break: new league leaders, a new leader of the
-- player rankings, and the winner of a competition. Each can be switched off under Site settings.
alter table settings add column if not exists celebrate_leaders boolean not null default true;
alter table settings add column if not exists celebrate_rankings boolean not null default true;
alter table settings add column if not exists celebrate_winners boolean not null default true;

-- The footer (Site settings → Footer): whose name is in the copyright line, the credit after it,
-- and the links of the bottom menu ("Privacy Policy | /page/privacy-policy", one per item, kept as a list).
alter table settings add column if not exists footer_copyright text;
alter table settings add column if not exists footer_credit_show boolean not null default true;
alter table settings add column if not exists footer_credit_text text;
alter table settings add column if not exists footer_credit_url text;
alter table settings add column if not exists footer_links text;

-- ── v12: Rich's tenth round of feedback ─────────────────────────
-- 1. League tables: how many teams go up from, and down from, each league (Admin → Leagues).
--    The first time this runs the rule of the day is filled in: two up and two down between the leagues.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'leagues' and column_name = 'promote_count') then
    alter table leagues add column promote_count int not null default 0 check (promote_count between 0 and 10);
    alter table leagues add column relegate_count int not null default 0 check (relegate_count between 0 and 10);
    if (select count(*) from leagues) > 1 then
      update leagues set relegate_count = 2 where sort < (select max(sort) from leagues);
      update leagues set promote_count = 2 where sort > (select min(sort) from leagues);
    end if;
  end if;
end $$;

-- 2. Notifications the league sends out itself: breaking news, important updates and offers
--    (Admin → Notifications). A news article can be ticked as breaking news too.
create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'update' check (kind in ('breaking', 'update', 'offer')),
  title text not null check (length(title) between 1 and 200),
  body text check (length(body) <= 1000),
  url text check (length(url) <= 500),
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists notices_created_idx on notices (created_at desc);
alter table articles add column if not exists breaking boolean not null default false;
alter table notices enable row level security;
drop policy if exists "public read" on notices;
drop policy if exists "admin write" on notices;
create policy "public read" on notices for select using (is_active or public.can_manage('website'));
create policy "admin write" on notices for all using (public.can_manage('website')) with check (public.can_manage('website'));

-- 3. Live scoreboard. "commentary" is the live text the scorer types ([{ id, at, frame, text }], newest last).
--    A league frame scored ball by ball by a captain is a row of its own, tied to its match (fixture_id, frame_no):
--    captains may write those rows for their own matches — exactly the matches whose scorecard they may edit.
alter table live_matches add column if not exists commentary jsonb not null default '[]'::jsonb;
alter table live_matches add column if not exists fixture_id uuid references fixtures on delete cascade;
alter table live_matches add column if not exists frame_no int;
alter table live_matches drop constraint if exists live_matches_frame_no_check;
alter table live_matches add constraint live_matches_frame_no_check check (frame_no is null or frame_no between 1 and 25);
alter table live_matches drop constraint if exists live_matches_size_check;
alter table live_matches add constraint live_matches_size_check
  check (octet_length(state::text) <= 200000 and octet_length(commentary::text) <= 60000 and jsonb_typeof(commentary) = 'array');
create unique index if not exists live_matches_fixture_frame_key on live_matches (fixture_id, frame_no) where fixture_id is not null;
drop policy if exists "captain write" on live_matches;
create policy "captain write" on live_matches for all
  using (fixture_id is not null and public.can_manage('livescoring') and public.can_edit_fixture(fixture_id))
  with check (fixture_id is not null and comp_match_id is null and competition_id is null and public.can_manage('livescoring') and public.can_edit_fixture(fixture_id));

-- 4. Manage team: the players a captain picks ahead of a match night. One row per match and team;
--    picks = [{ "player_id": …, "ext": false }, …] in frame order. It is kept apart from the scorecard so the
--    other team cannot see it early: only that team's captains (and whoever looks after match nights) can
--    read it — and, from the day of the match, the other team's captains, whose scorecard it then fills in.
--    Nobody writes this table directly: set_lineup() below is the only way in.
create table if not exists lineups (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures on delete cascade,
  team_id uuid not null references teams on delete cascade,
  picks jsonb not null default '[]'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (fixture_id, team_id)
);
alter table lineups enable row level security;
drop policy if exists "team read" on lineups;
create policy "team read" on lineups for select using (
  public.can_manage('matchnights') or public.is_captain_of(team_id)
  or exists (select 1 from fixtures f where f.id = lineups.fixture_id
               and (f.starts_at at time zone 'Europe/London')::date <= (now() at time zone 'Europe/London')::date
               and (public.is_captain_of(f.home_team_id) or public.is_captain_of(f.away_team_id))));

create or replace function public.set_lineup(fid uuid, p_picks jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare f fixtures; my_team uuid; picks jsonb;
begin
  select * into f from fixtures where id = fid;
  if not found then raise exception 'That match is not on the website'; end if;
  my_team := case when public.is_captain_of(f.home_team_id) then f.home_team_id
                  when public.is_captain_of(f.away_team_id) then f.away_team_id end;
  if my_team is null then raise exception 'You can only pick the team for your own matches'; end if;
  if f.status not in ('scheduled', 'in_progress') then raise exception 'This match has already been played'; end if;
  if jsonb_typeof(coalesce(p_picks, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_picks, '[]'::jsonb)) > 10 then
    raise exception 'A team sheet has up to 10 places';
  end if;
  -- Keep only what a team sheet is made of: a player, and whether they are playing as the extra player.
  select coalesce(jsonb_agg(jsonb_build_object('player_id', nullif(e.v->>'player_id', ''), 'ext', coalesce(e.v->>'ext', '') = 'true') order by e.n), '[]'::jsonb)
    into picks from jsonb_array_elements(coalesce(p_picks, '[]'::jsonb)) with ordinality e(v, n);
  if exists (select 1 from jsonb_array_elements(picks) x where x->>'player_id' is not null
             and not exists (select 1 from players p where p.id::text = x->>'player_id' and p.team_id = my_team)) then
    raise exception 'You can only pick players from your own team';
  end if;
  -- An empty sheet is simply taken away.
  if not exists (select 1 from jsonb_array_elements(picks) x where x->>'player_id' is not null) then
    delete from lineups where fixture_id = fid and team_id = my_team;
    return;
  end if;
  insert into lineups (fixture_id, team_id, picks, updated_by, updated_at)
  values (fid, my_team, picks, (select coalesce(nullif(full_name, ''), email) from profiles where id = auth.uid()), now())
  on conflict (fixture_id, team_id) do update set picks = excluded.picks, updated_by = excluded.updated_by, updated_at = now();
end;
$$;
revoke all on function public.set_lineup(uuid, jsonb) from public, anon;
grant execute on function public.set_lineup(uuid, jsonb) to authenticated;

-- A captain signs someone who is already on the website but has no team. Like a brand-new player
-- (add_player), they are flagged for the league to accept; "review_from" remembers where they came from,
-- so turning the request down puts them back to having no team instead of removing them.
alter table players add column if not exists review_from text;
create or replace function public.claim_player(p_player uuid, p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_captain_of(p_team) then
    raise exception 'You can only add players to your own team';
  end if;
  update players set team_id = p_team, status = 'playing', needs_review = true, review_from = 'no_team'
   where id = p_player and team_id is null and status <> 'deceased';
  if not found then
    raise exception 'That player already belongs to a team — ask the league secretary to move them';
  end if;
end;
$$;
revoke all on function public.claim_player(uuid, uuid) from public, anon;
grant execute on function public.claim_player(uuid, uuid) to authenticated;

-- The "Manage team" box on the home page: how many days before a match captains see it (0 = never).
alter table settings add column if not exists squad_box_days int not null default 3;

-- The activity log covers the notifications sent out as well.
do $$
declare t text;
begin
  foreach t in array array['notices'] loop
    execute format('drop trigger if exists audit_row on %I', t);
    execute format('drop trigger if exists audit_added on %I', t);
    execute format('create trigger audit_row after update or delete on %I for each row execute function public.audit_row()', t);
    execute format('create trigger audit_added after insert on %I referencing new table as added for each statement execute function public.audit_added()', t);
  end loop;
end $$;

-- ── v13: Rich's eleventh round of feedback ──────────────────────
-- A picture of each league's weekly shield (Admin → Leagues → Weekly shield). It is shown small beside
-- the holders on the home page and on the shield's own page; a gold shield is drawn until one is added.
alter table leagues add column if not exists shield_image_url text;

-- ── v14: Rich's thirteenth round of feedback ────────────────────
-- A small list of one-time steps already done, so that re-running this file never repeats them
-- (and never undoes a choice made since in the dashboard). Only this file writes to it.
create table if not exists schema_steps (step text primary key, done_at timestamptz not null default now());
alter table schema_steps enable row level security;

-- 1. Live scoring (ball by ball) is a permission of its own (Admin → Roles & permissions → Live scoring).
--    Captains and vice captains have a row too — empty, so they cannot score ball by ball unless it is ticked.
--    The first time this runs, every role that could use the live scoreboard before (competitions or match nights) keeps it.
insert into role_permissions (role, areas) values ('captain', '{}'), ('vice_captain', '{}') on conflict (role) do nothing;
do $$
begin
  if not exists (select 1 from schema_steps where step = 'v14 live scoring') then
    update role_permissions set areas = array_append(areas, 'livescoring')
     where ('competitions' = any(areas) or 'matchnights' = any(areas)) and not ('livescoring' = any(areas));
    insert into schema_steps (step) values ('v14 live scoring');
  end if;
end $$;

-- 2. Competition deadlines: the day the home player must have contacted their opponent, for each round
--    ({ "1": "2026-10-10", … }, beside round_deadlines), and a match switched round when they didn't.
alter table competitions add column if not exists round_contact jsonb not null default '{}'::jsonb;
alter table competition_matches add column if not exists home_switched boolean not null default false;
--    How long before a deadline the warnings start, and the rule an away player is told (Site settings → Competitions).
alter table settings add column if not exists comp_warn_days int not null default 14;
alter table settings add column if not exists comp_contact_rule text;

-- 3. Sharing on social media and the app icons (Admin → Site settings → Sharing, Admin → Branding → App icon).
--    The preview a link shows on Facebook, WhatsApp, X…: for the whole site, and for each news article.
alter table settings add column if not exists social_title text;
alter table settings add column if not exists social_description text;
alter table settings add column if not exists social_image_url text;
alter table articles add column if not exists social_image_url text;
alter table articles add column if not exists social_description text;
--    The icon on a phone's home screen / an installed app: { apple: 180px, i192, i512, maskable } (PNG links), and its background.
alter table settings add column if not exists app_icons jsonb not null default '{}'::jsonb;
alter table settings add column if not exists app_icon_bg text not null default '#000000';

-- ── Round 20 ─────────────────────────────────────────────────────
-- 1. Everyone's own pictures. Each picture in the image library belongs to the person who uploaded it: they see
--    their own, and only the Master Admin sees everybody's (Admin → Image library → "Whose pictures").
--    Pictures uploaded before this (no owner) are the Master Admin's. The files themselves stay public — a picture
--    in a news article has to be seen by everyone — but nobody else can list, rename or delete them.
alter table media add column if not exists owner_id uuid;
alter table media alter column owner_id set default auth.uid();
alter table media add column if not exists owner_name text;
create index if not exists media_owner_idx on media (owner_id);
drop policy if exists "own pictures read" on media;
drop policy if exists "own pictures add" on media;
drop policy if exists "own pictures change" on media;
drop policy if exists "own pictures delete" on media;
create policy "own pictures read" on media for select using (public.is_master() or (owner_id = auth.uid() and (public.is_staff() or public.can_manage('news'))));
create policy "own pictures add" on media for insert with check ((public.is_staff() or public.can_manage('news')) and (owner_id = auth.uid() or public.is_master()));
create policy "own pictures change" on media for update using (public.is_master() or (owner_id = auth.uid() and (public.is_staff() or public.can_manage('news'))))
  with check (public.is_master() or (owner_id = auth.uid() and (public.is_staff() or public.can_manage('news'))));
create policy "own pictures delete" on media for delete using (public.is_master() or (owner_id = auth.uid() and (public.is_staff() or public.can_manage('news'))));
-- 2. Emails (Admin → Emails): the Master Admin is copied on every submitted result; the captains and vice captains
--    of both teams get a copy of their own card; new competition entries are emailed to the competition secretary.
alter table private_settings add column if not exists results_copy_master boolean not null default true;
alter table private_settings add column if not exists results_copy_captains boolean not null default true;
alter table private_settings add column if not exists entries_email_on boolean not null default false;
alter table private_settings add column if not exists entries_email_to text;
alter table competition_signups add column if not exists emailed_at timestamptz;

-- 3. Writing news (Rich, round 20): captains, vice captains and every officer — not players or visitors.
--    A permission of its own, "Write news" (Admin → Roles & permissions), like live scoring: it is not a part of the
--    dashboard, so captains who have it stay captains. They write with "Write news step by step" (My area → Write news)
--    and can change only their own articles; officers with "News & website" still look after every article.
--    The first time this runs, every officer role gets it. Captains and vice captains don't (Rich changed his mind:
--    officers only for now — it can be ticked for them later in Admin → Roles & permissions).
do $$
begin
  if not exists (select 1 from schema_steps where step = 'v15 write news') then
    update role_permissions set areas = array_append(areas, 'news') where role not in ('captain', 'vice_captain') and not ('news' = any(areas));
    insert into schema_steps (step) values ('v15 write news');
  end if;
  -- The zip before this one gave it to captains and vice captains too: take that back, once.
  if not exists (select 1 from schema_steps where step = 'v15 news officers only') then
    update role_permissions set areas = array_remove(areas, 'news') where role in ('captain', 'vice_captain');
    insert into schema_steps (step) values ('v15 news officers only');
  end if;
end $$;
drop policy if exists "news writers add" on articles;
drop policy if exists "news writers change" on articles;
drop policy if exists "news writers delete" on articles;
create policy "news writers add" on articles for insert with check (public.can_manage('news') and created_by = auth.uid());
create policy "news writers change" on articles for update using (public.can_manage('news') and created_by = auth.uid()) with check (public.can_manage('news') and created_by = auth.uid());
create policy "news writers delete" on articles for delete using (public.can_manage('news') and created_by = auth.uid());
--    Someone who can only write news cannot make their article "breaking news" (a pop-up for everyone) or put it in the
--    News page's featured boxes, and an article always stays its writer's. The News & website officers can do all of it.
--    And (Rich, round 21) nothing goes live until the Master Admin approves it: an article anyone else publishes is kept
--    off the website and marked "waiting for approval" (Admin → Master Admin → News to approve). Changing an article that
--    is already live does not take it down.
alter table articles add column if not exists awaiting_approval boolean not null default false;
create index if not exists articles_awaiting_idx on articles (awaiting_approval) where awaiting_approval;
create or replace function public.guard_article() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_master() then
    if new.is_published then new.awaiting_approval := false; end if;
    return new;
  end if;
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.is_published := false; new.awaiting_approval := true;
  end if;
  if public.can_manage('website') then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid(); new.breaking := false; new.hub_featured := false;
  else
    new.created_by := old.created_by; new.breaking := old.breaking; new.hub_featured := old.hub_featured;
  end if;
  return new;
end $$;
drop trigger if exists guard_article on articles;
create trigger guard_article before insert or update on articles for each row execute function public.guard_article();

-- 4. "Try the whole site in Space Grotesk" (Rich, round 20): once, the fonts chosen under Admin → Branding go back to
--    the standard (Space Grotesk for headings and text). Another font can be chosen there again afterwards.
do $$
begin
  if not exists (select 1 from schema_steps where step = 'v15 space grotesk') then
    update settings set font_head = null, font_body = null where id = 1;
    insert into schema_steps (step) values ('v15 space grotesk');
  end if;
end $$;

-- ── v8: give existing rows their short web addresses ────────────
-- (Done down here, after the activity log has been told to ignore these columns.)
update players set slug = slug where coalesce(slug, '') = '';
update sponsors set slug = slug where coalesce(slug, '') = '';
create unique index if not exists players_slug_key on players (slug);
create unique index if not exists sponsors_slug_key on sponsors (slug);
with numbered as (
  select f.id, public.season_code(f.season_id) as prefix,
         row_number() over (partition by public.season_code(f.season_id) order by f.starts_at, f.id) as rn
  from fixtures f where coalesce(f.code, '') = ''),
top as (
  select public.season_code(season_id) as prefix, max((regexp_match(code, '-(\d+)$'))[1]::int) as n
  from fixtures where coalesce(code, '') <> '' group by 1)
update fixtures f set code = numbered.prefix || '-' || lpad((coalesce(top.n, 0) + numbered.rn)::text, greatest(2, length((coalesce(top.n, 0) + numbered.rn)::text)), '0')
  from numbered left join top on top.prefix = numbered.prefix where f.id = numbered.id;
create unique index if not exists fixtures_code_key on fixtures (code);
update competition_matches set no = nextval('competition_match_no_seq') where no is null;
create unique index if not exists competition_matches_no_key on competition_matches (no);

-- ── live updates ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['fixtures','frames','breaks','players','competition_matches','competition_frames','competition_breaks','competitions','live_matches','articles','notices'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ── image uploads (Supabase Storage) ────────────────────────────
-- A public "images" bucket: anyone can view pictures; admins and league
-- officers can upload or delete them. Max 5 MB; images, plus PDFs (meeting minutes).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images admin insert" on storage.objects;
drop policy if exists "images admin update" on storage.objects;
drop policy if exists "images admin delete" on storage.objects;
drop policy if exists "images own list" on storage.objects;
-- Captains may also upload photos of paper scorecards (scorecards/) and of the
-- match night (matchnight/), and anyone linked to a player profile may upload
-- their own photos (players/ only).
create policy "images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (public.is_staff()
    or ((name like 'scorecards/%' or name like 'matchnight/%') and exists (select 1 from public.profiles where id = auth.uid()
          and (role in ('captain', 'vice_captain') or team_role in ('captain', 'vice_captain'))))
    or (name like 'players/%' and exists (select 1 from public.profiles where id = auth.uid() and player_id is not null))
    or (name like 'news/%' and public.can_manage('news'))
    -- Round 22: anyone logged in may add the picture of their own marketplace advert (market/ only).
    or (name like 'market/%' and auth.uid() is not null)
    -- Round 23: pictures for a memory sent in for the Hall of Fame / history pages.
    or (name like 'memories/%' and auth.uid() is not null)
  ));
-- Listing files (needed to delete one): the Master Admin all of them, an officer their own. Viewing a picture by its
-- link needs nothing — the bucket is public.
create policy "images own list" on storage.objects for select to authenticated
  using (bucket_id = 'images' and (public.is_master() or ((public.is_staff() or public.can_manage('news')) and (owner = auth.uid() or owner_id = auth.uid()::text))));
-- Changing or deleting a file: the Master Admin, or the officer who uploaded it (round 20: everyone's own pictures).
create policy "images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'images' and (public.is_master() or ((public.is_staff() or public.can_manage('news')) and (owner = auth.uid() or owner_id = auth.uid()::text))));
create policy "images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (public.is_master() or ((public.is_staff() or public.can_manage('news')) and (owner = auth.uid() or owner_id = auth.uid()::text))));

-- ── Round 22 (Rich's feedback, 15 Oct) ──────────────────────────
-- 1. Newsletter: people sign up on the website (a pop-up, and a link in the footer); the league writes campaigns in
--    Admin → Newsletter and sends them through Resend (netlify/functions/newsletter.mjs). Every email has its own
--    unsubscribe link (/unsubscribe?t=…). Addresses are private: only "Newsletter" officers can read them.
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 3 and 254),
  name text check (length(name) <= 120),
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  token uuid not null default gen_random_uuid(),
  source text not null default 'website' check (length(source) <= 40),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create unique index if not exists newsletter_subscribers_email_key on newsletter_subscribers (lower(email));
create unique index if not exists newsletter_subscribers_token_key on newsletter_subscribers (token);
create table if not exists newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (length(subject) between 1 and 200),
  preheader text check (length(preheader) <= 200),
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array' and octet_length(blocks::text) <= 400000),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  sent_count int not null default 0,
  total_count int not null default 0,
  sent_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table settings add column if not exists newsletter_popup_on boolean not null default false;
alter table settings add column if not exists newsletter_title text;
alter table settings add column if not exists newsletter_text text;
alter table settings add column if not exists newsletter_delay int not null default 10;
alter table settings add column if not exists newsletter_footer_link boolean not null default true;

-- Sign up / unsubscribe: open to everyone, but only through these two functions (the table itself stays private).
create or replace function public.newsletter_subscribe(p_email text, p_name text default null) returns text
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 254 then raise exception 'Please type a whole email address, like name@example.com'; end if;
  insert into newsletter_subscribers (email, name, source) values (e, nullif(left(trim(coalesce(p_name, '')), 120), ''), 'website')
  on conflict ((lower(email))) do update set status = 'subscribed', unsubscribed_at = null,
    name = coalesce(nullif(left(trim(coalesce(p_name, '')), 120), ''), newsletter_subscribers.name);
  return 'ok';
end $$;
create or replace function public.newsletter_unsubscribe(p_token uuid) returns text
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  update newsletter_subscribers set status = 'unsubscribed', unsubscribed_at = coalesce(unsubscribed_at, now())
   where token = p_token returning email into who;
  return case when who is null then 'unknown' else regexp_replace(who, '^(.).*(@.*)$', '\1…\2') end;
end $$;
grant execute on function public.newsletter_subscribe(text, text) to anon, authenticated;
grant execute on function public.newsletter_unsubscribe(uuid) to anon, authenticated;

-- 2. Pop-up adverts on the home page (Admin → Website → Pop-up adverts): text, a picture and a link, or one whole picture.
create table if not exists popups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  kind text not null default 'content' check (kind in ('content', 'image')),
  heading text check (length(heading) <= 120),
  body text check (length(body) <= 1000),
  image_url text,
  link_url text check (length(link_url) <= 500),
  button_text text check (length(button_text) <= 40),
  is_active boolean not null default true,
  starts_on date,
  ends_on date,
  delay_seconds int not null default 2 check (delay_seconds between 0 and 120),
  frequency text not null default 'once' check (frequency in ('once', 'daily', 'every')),
  sort int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Snooker marketplace: anyone logged in can put up an advert; nothing shows until the league approves it.
create table if not exists market_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 60),
  sort int not null default 1
);
insert into market_categories (name, sort) values ('Cues', 1), ('Cases & accessories', 2), ('Tables', 3), ('Clothing', 4), ('Other', 5)
on conflict (name) do nothing;
create table if not exists market_ads (
  id uuid primary key default gen_random_uuid(),
  no bigint generated by default as identity,
  title text not null check (length(title) between 3 and 100),
  description text not null check (length(description) between 1 and 2000),
  image_url text,
  price numeric(10, 2) check (price is null or price between 0 and 100000),
  contact text not null check (length(contact) between 3 and 200),
  category_id uuid references market_categories on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sold')),
  reject_reason text check (length(reject_reason) <= 300),
  owner_id uuid default auth.uid(),
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text
);
create index if not exists market_ads_status_idx on market_ads (status);
alter table settings add column if not exists market_on boolean not null default true;
alter table settings add column if not exists market_intro text;
-- The seller can never approve their own advert: whatever they send, it waits for the league again
-- (except marking an approved advert "sold", or taking it back to "approved" from sold).
create or replace function public.guard_market_ad() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is null or public.can_manage('website') then
    if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
      new.approved_at := now();
      new.approved_by := coalesce((select full_name from profiles where id = auth.uid()), 'The league');
    end if;
    if tg_op = 'INSERT' and new.owner_name is null then new.owner_name := (select coalesce(full_name, email) from profiles where id = auth.uid()); end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid(); new.status := 'pending'; new.approved_at := null; new.approved_by := null; new.reject_reason := null;
    new.owner_name := (select coalesce(full_name, email) from profiles where id = auth.uid());
    return new;
  end if;
  new.owner_id := old.owner_id; new.owner_name := old.owner_name; new.approved_at := old.approved_at; new.approved_by := old.approved_by;
  if new.status in ('sold', 'approved') and old.status in ('approved', 'sold')
     and (new.title, new.description, coalesce(new.image_url, ''), coalesce(new.price, -1), new.contact, coalesce(new.category_id::text, ''))
       is not distinct from (old.title, old.description, coalesce(old.image_url, ''), coalesce(old.price, -1), old.contact, coalesce(old.category_id::text, '')) then
    return new;                                    -- only "sold" / "for sale again"
  end if;
  new.status := 'pending'; new.reject_reason := null;   -- anything else changed: the league looks at it again
  return new;
end $$;
drop trigger if exists guard_market_ad on market_ads;
create trigger guard_market_ad before insert or update on market_ads for each row execute function public.guard_market_ad();

-- 4. Comments on a match night: anyone logged in can join in; the league can hide or remove a comment.
create table if not exists match_comments (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures on delete cascade,
  comp_match_id uuid references competition_matches on delete cascade,
  author_id uuid default auth.uid(),
  author_name text,
  body text not null check (length(trim(body)) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (fixture_id is not null or comp_match_id is not null)
);
create index if not exists match_comments_fixture_idx on match_comments (fixture_id, created_at);
create index if not exists match_comments_comp_idx on match_comments (comp_match_id, created_at);
alter table settings add column if not exists comments_on boolean not null default true;
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'Please log in to comment'; end if;
    if not coalesce((select comments_on from settings where id = 1), true) then raise exception 'Comments are switched off'; end if;
    if exists (select 1 from match_comments where author_id = auth.uid() and created_at > now() - interval '10 seconds') then
      raise exception 'Please wait a few seconds before commenting again';
    end if;
    new.author_id := auth.uid(); new.hidden := false; new.created_at := now();
    new.author_name := (select coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)) from profiles p where p.id = auth.uid());
    return new;
  end if;
  -- Only the league can hide a comment; nothing else about it changes.
  if not public.can_manage('website') then raise exception 'Only the league can change a comment'; end if;
  new.body := old.body; new.author_id := old.author_id; new.author_name := old.author_name; new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists guard_comment on match_comments;
create trigger guard_comment before insert or update on match_comments for each row execute function public.guard_comment();

-- 5. SEO (Admin → Website → SEO): the site's title, language, description and preview are in settings; each page can
--    have its own (seo_pages, by its address). Read by the website and by netlify/edge-functions (social.js, seo-files.js).
alter table settings add column if not exists site_language text not null default 'en-GB';
create table if not exists seo_pages (
  path text primary key check (path ~ '^/[^\s]*$' and length(path) <= 200),
  title text check (length(title) <= 120),
  description text check (length(description) <= 300),
  image_url text,
  noindex boolean not null default false,
  hide_in_search boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 6. The menu bar (Admin → Website → Menu): the buttons, their order and colours, and the extra links in the phone menu.
--    Empty = the standard menu.
alter table settings add column if not exists menu_items jsonb;
alter table settings add column if not exists menu_more jsonb;

-- 7. Version history (Admin → Master Admin → Version history): the version number and changes of each update the
--    Master Admin has seen live. The list itself comes from Netlify (netlify/functions/site-versions.mjs).
create table if not exists site_versions (
  deploy_id text primary key check (length(deploy_id) <= 64),
  version text check (length(version) <= 40),
  changes text check (length(changes) <= 4000),
  published_by text check (length(published_by) <= 120),
  created_at timestamptz not null default now()
);

-- 8. Security (Admin → Master Admin → Security). Private: the Master Admin only. The website asks login_gate() what it
--    needs to know (is this the login page? does this role need two-step login?) — never the whole row.
create table if not exists security_settings (
  id int primary key default 1 check (id = 1),
  login_slug text check (login_slug is null or login_slug ~ '^[a-z0-9][a-z0-9-]{2,40}$'),
  hide_login_button boolean not null default false,
  login_access text not null default 'all' check (login_access in ('all', 'officers', 'master')),
  mfa_roles text[] not null default '{}',
  block_common_names boolean not null default true,
  common_names text not null default E'admin\nadministrator\nroot\ntest\nuser\nguest\ninfo\nwebmaster\nsupport\ndemo',
  max_attempts int not null default 5 check (max_attempts between 0 and 50),
  lockout_minutes int not null default 15 check (lockout_minutes between 1 and 1440),
  updated_at timestamptz not null default now()
);
insert into security_settings (id) values (1) on conflict (id) do nothing;
create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on login_attempts (email, ip, at desc);

-- Who is asking (behind Supabase's proxy): the address the request came from.
create or replace function public.request_ip() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
                  nullif(trim(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)), ''), 'unknown');
$$;
-- Is this login allowed to act right now? Two-step login: a role ticked under "Two-step login" must have used it in this
-- session (Supabase calls that "aal2"). Login access: while only officers (or only the Master Admin) may log in, nobody else's
-- login can change anything either.
create or replace function public.session_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (not (p.role = any(s.mfa_roles)) or coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2')
       and (s.login_access = 'all' or p.role = 'admin'
            or (s.login_access = 'officers' and p.role not in ('captain', 'vice_captain', 'player')))
    from profiles p cross join security_settings s where p.id = auth.uid() and s.id = 1), true);
$$;
create or replace function public.is_master() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin') and public.session_ok();
$$;
create or replace function public.can_manage(area text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and (
    p.role = 'admin'
    or exists (select 1 from role_permissions rp where rp.role = p.role and can_manage.area = any(rp.areas))
  )) and public.session_ok();
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and (
    p.role = 'admin'
    or exists (select 1 from role_permissions rp where rp.role = p.role and cardinality(array_remove(array_remove(rp.areas, 'livescoring'), 'news')) > 0)
  )) and public.session_ok();
$$;
create or replace function public.is_captain_of(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select team is not null and exists (select 1 from profiles where id = auth.uid() and team_id = team
    and (role in ('captain', 'vice_captain') or team_role in ('captain', 'vice_captain'))) and public.session_ok();
$$;
create or replace function public.login_gate(p_path text default '/login') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s security_settings; slug text;
begin
  select * into s from security_settings where id = 1;
  slug := coalesce(s.login_slug, '');
  return jsonb_build_object(
    'login', case when slug = '' then rtrim(coalesce(p_path, ''), '/') = '/login' else lower(trim(both '/' from coalesce(p_path, ''))) = slug end,
    'custom', slug <> '',
    'hide_button', slug <> '' and coalesce(s.hide_login_button, false),
    'access', coalesce(s.login_access, 'all'),
    'mfa_roles', to_jsonb(coalesce(s.mfa_roles, '{}'::text[])));
end $$;
-- Limit login attempts: after too many wrong passwords for one email address from one place, the login form waits.
-- (Supabase also limits sign-ins on its side: Authentication → Rate Limits.)
create or replace function public.login_wait(p_email text) returns int
language plpgsql security definer set search_path = public as $$
declare s security_settings; e text := lower(trim(coalesce(p_email, ''))); v_ip text := public.request_ip(); fails int; last_fail timestamptz; last_ok timestamptz;
begin
  select * into s from security_settings where id = 1;
  if coalesce(s.max_attempts, 0) <= 0 then return 0; end if;
  select max(at) into last_ok from login_attempts where email = e and login_attempts.ip = v_ip and ok;
  select count(*), max(at) into fails, last_fail from login_attempts
   where email = e and login_attempts.ip = v_ip and not ok and at > now() - make_interval(mins => s.lockout_minutes) and at > coalesce(last_ok, '-infinity');
  if fails >= s.max_attempts then return greatest(1, ceil(extract(epoch from (last_fail + make_interval(mins => s.lockout_minutes) - now())))::int); end if;
  return 0;
end $$;
create or replace function public.login_record(p_email text, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into login_attempts (email, ip, ok) values (left(lower(trim(coalesce(p_email, ''))), 254), public.request_ip(), coalesce(p_ok, false));
  if random() < 0.05 then delete from login_attempts where at < now() - interval '30 days'; end if;
end $$;
grant execute on function public.login_gate(text) to anon, authenticated;
grant execute on function public.login_wait(text) to anon, authenticated;
grant execute on function public.login_record(text, boolean) to anon, authenticated;

-- Row-level security for everything above.
do $$
declare t text;
begin
  foreach t in array array['newsletter_subscribers','newsletter_campaigns','popups','market_categories','market_ads','match_comments','seo_pages','site_versions','security_settings','login_attempts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('drop policy if exists "owner write" on %I', t);
    execute format('drop policy if exists "owner add" on %I', t);
    execute format('drop policy if exists "owner delete" on %I', t);
  end loop;
end $$;
create policy "admin write" on newsletter_subscribers for all using (public.can_manage('newsletter')) with check (public.can_manage('newsletter'));
create policy "admin write" on newsletter_campaigns for all using (public.can_manage('newsletter')) with check (public.can_manage('newsletter'));
create policy "public read" on popups for select using (is_active or public.can_manage('website'));
create policy "admin write" on popups for all using (public.can_manage('website')) with check (public.can_manage('website'));
create policy "public read" on market_categories for select using (true);
create policy "admin write" on market_categories for all using (public.can_manage('website')) with check (public.can_manage('website'));
create policy "public read" on market_ads for select using (status in ('approved', 'sold') or owner_id = auth.uid() or public.can_manage('website'));
create policy "owner add" on market_ads for insert with check (auth.uid() is not null and public.session_ok());
create policy "owner write" on market_ads for update using ((owner_id = auth.uid() and public.session_ok()) or public.can_manage('website'))
  with check ((owner_id = auth.uid() and public.session_ok()) or public.can_manage('website'));
create policy "owner delete" on market_ads for delete using ((owner_id = auth.uid() and public.session_ok()) or public.can_manage('website'));
create policy "public read" on match_comments for select using (not hidden or public.can_manage('website'));
create policy "owner add" on match_comments for insert with check (auth.uid() is not null and public.session_ok());
create policy "admin write" on match_comments for update using (public.can_manage('website')) with check (public.can_manage('website'));
create policy "owner delete" on match_comments for delete using (author_id = auth.uid() or public.can_manage('website'));
create policy "public read" on seo_pages for select using (true);
create policy "admin write" on seo_pages for all using (public.can_manage('settings')) with check (public.can_manage('settings'));
create policy "admin write" on site_versions for all using (public.is_master()) with check (public.is_master());
create policy "admin write" on security_settings for all using (public.is_master()) with check (public.is_master());
create policy "public read" on login_attempts for select using (public.is_master());

-- The Newsletter permission (Admin → Roles & permissions): the first time, every role that looks after the website gets it.
do $$
begin
  if not exists (select 1 from schema_steps where step = 'v16 newsletter') then
    update role_permissions set areas = array_append(areas, 'newsletter') where 'website' = any(areas) and not ('newsletter' = any(areas));
    insert into schema_steps (step) values ('v16 newsletter');
  end if;
end $$;

-- Live updates for the new comments and adverts.
do $$
declare t text;
begin
  foreach t in array array['match_comments','market_ads','popups'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ── Round 23 (Rich's feedback, 16 Oct) ──────────────────────────
-- 1. The home page banner's layout on big screens (Admin → Site settings → Home page banner):
--    'side' = headline with the picture beside it, 'big' = the article's picture across the whole banner, 'text' = headline only.
alter table settings add column if not exists hero_layout text not null default 'side';
alter table settings drop constraint if exists settings_hero_layout_check;
alter table settings add constraint settings_hero_layout_check check (hero_layout in ('side', 'big', 'text', 'white'));   -- 'white': round 28

-- 2. Paid adverts in the side column (Admin → Website → Side adverts), shown everywhere or only on chosen pages:
--    one venue, one team, one competition, one league, or a kind of page (presentation night, in memoriam…).
create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  image_url text,
  heading text check (length(heading) <= 120),
  body text check (length(body) <= 500),
  link_url text check (length(link_url) <= 500),
  button_text text check (length(button_text) <= 40),
  target text not null default 'all' check (target in ('all', 'page', 'venue', 'team', 'competition', 'league')),
  target_ref text check (length(target_ref) <= 200),
  sponsor_id uuid references sponsors on delete set null,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  sort int not null default 1,
  created_at timestamptz not null default now()
);

-- 3. Sponsorship packages (Gold / Silver / Bronze…) shown on /sponsorship; each sponsor can be on one.
create table if not exists sponsor_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  price text check (length(price) <= 60),
  period text check (length(period) <= 60),
  summary text check (length(summary) <= 400),
  benefits text check (length(benefits) <= 3000),
  colour text check (colour is null or colour ~ '^#[0-9a-fA-F]{6}$'),
  includes_advert boolean not null default true,
  sort int not null default 1,
  is_active boolean not null default true
);
alter table sponsors add column if not exists package_id uuid references sponsor_packages on delete set null;
alter table settings add column if not exists sponsorship_intro text;
alter table settings add column if not exists sponsorship_contact text;

-- 4. League downloads (/downloads): posters, rules for the club wall, entry forms… Logged-in people by default.
create table if not exists downloads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 160),
  description text check (length(description) <= 600),
  category text not null default 'General' check (length(category) <= 60),
  file_url text not null,
  members_only boolean not null default true,
  sort int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table settings add column if not exists downloads_intro text;

-- 5. In memoriam: a player's story (their history in the league) and pictures, beside the few words of tribute.
alter table players add column if not exists memorial_story text;
alter table players add column if not exists memorial_gallery jsonb not null default '[]'::jsonb;

-- 6. Hall of Fame and memories (/hall-of-fame, /hall-of-fame/submit): achievements past and present, and memories people
--    send in. A memory waits for the league (Admin → Website → Hall of Fame). The sender's contact details are kept apart
--    (hall_of_fame_contacts), so they are never public.
create table if not exists hall_of_fame (
  id uuid primary key default gen_random_uuid(),
  no bigint generated by default as identity,
  category text not null default 'Hall of Fame' check (length(category) between 1 and 60),
  title text not null check (length(title) between 1 and 160),
  subject text check (length(subject) <= 160),
  player_id uuid references players on delete set null,
  team_id uuid references teams on delete set null,
  year text check (length(year) <= 40),
  achievements text check (length(achievements) <= 3000),
  body text check (length(body) <= 20000),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  quote text check (length(quote) <= 600),
  quote_by text check (length(quote_by) <= 120),
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  featured boolean not null default false,
  submitted_by text check (length(submitted_by) <= 120),
  sort int not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists hall_of_fame_contacts (
  entry_id uuid primary key references hall_of_fame on delete cascade,
  contact text check (length(contact) <= 300)
);
alter table settings add column if not exists hof_intro text;
create or replace function public.submit_memory(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; imgs jsonb := coalesce(p->'images', '[]'::jsonb);
begin
  if length(trim(coalesce(p->>'title', ''))) < 3 then raise exception 'Please give it a title'; end if;
  if length(trim(coalesce(p->>'submitted_by', ''))) < 2 then raise exception 'Please type your name'; end if;
  if jsonb_typeof(imgs) <> 'array' or jsonb_array_length(imgs) > 12 then raise exception 'Twelve pictures at most, please'; end if;
  -- Only pictures uploaded on this website.
  if exists (select 1 from jsonb_array_elements_text(imgs) u where not public.is_site_image(u, 'memories')) then raise exception 'Pictures must be uploaded on this website'; end if;
  insert into hall_of_fame (category, title, subject, year, achievements, body, images, quote, quote_by, status, submitted_by)
  values (left(coalesce(nullif(trim(p->>'category'), ''), 'Memory'), 60), left(trim(p->>'title'), 160), left(nullif(trim(p->>'subject'), ''), 160),
    left(nullif(trim(p->>'year'), ''), 40), left(nullif(trim(p->>'achievements'), ''), 3000), left(nullif(trim(p->>'body'), ''), 20000), imgs,
    left(nullif(trim(p->>'quote'), ''), 600), left(nullif(trim(p->>'quote_by'), ''), 120), 'pending', left(trim(p->>'submitted_by'), 120))
  returning id into new_id;
  if nullif(trim(p->>'contact'), '') is not null then insert into hall_of_fame_contacts (entry_id, contact) values (new_id, left(trim(p->>'contact'), 300)); end if;
  return new_id;
end $$;
grant execute on function public.submit_memory(jsonb) to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['ads','sponsor_packages','downloads','hall_of_fame','hall_of_fame_contacts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "admin write" on %I', t);
  end loop;
end $$;
create policy "public read" on ads for select using (is_active or public.can_manage('website'));
create policy "admin write" on ads for all using (public.can_manage('website')) with check (public.can_manage('website'));
create policy "public read" on sponsor_packages for select using (is_active or public.can_manage('website'));
create policy "admin write" on sponsor_packages for all using (public.can_manage('website')) with check (public.can_manage('website'));
create policy "public read" on downloads for select using ((is_active and (not members_only or auth.uid() is not null)) or public.can_manage('website'));
create policy "admin write" on downloads for all using (public.can_manage('website')) with check (public.can_manage('website'));
create policy "public read" on hall_of_fame for select using (status = 'approved' or public.can_manage('website'));
create policy "admin write" on hall_of_fame for all using (public.can_manage('website')) with check (public.can_manage('website'));
create policy "admin write" on hall_of_fame_contacts for all using (public.can_manage('website')) with check (public.can_manage('website'));

-- ── Round 24 (Rich's feedback, 17 Oct) ──────────────────────────
-- The match night chat can be closed for one match by the league ("Close the chat for this match"),
-- as well as for the whole site (settings.comments_on).
alter table fixtures add column if not exists chat_off boolean not null default false;
alter table competition_matches add column if not exists chat_off boolean not null default false;
create or replace function public.set_chat_off(p_fixture uuid, p_comp_match uuid, p_off boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage('website') then raise exception 'Only the league can open or close a match chat'; end if;
  if p_fixture is not null then update fixtures set chat_off = coalesce(p_off, false) where id = p_fixture; end if;
  if p_comp_match is not null then update competition_matches set chat_off = coalesce(p_off, false) where id = p_comp_match; end if;
end $$;
grant execute on function public.set_chat_off(uuid, uuid, boolean) to authenticated;
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'Please log in to comment'; end if;
    if not coalesce((select comments_on from settings where id = 1), true) then raise exception 'Comments are switched off'; end if;
    if (new.fixture_id is not null and coalesce((select chat_off from fixtures where id = new.fixture_id), false))
       or (new.comp_match_id is not null and coalesce((select chat_off from competition_matches where id = new.comp_match_id), false)) then
      raise exception 'The league has closed the chat for this match';
    end if;
    if exists (select 1 from match_comments where author_id = auth.uid() and created_at > now() - interval '10 seconds') then
      raise exception 'Please wait a few seconds before commenting again';
    end if;
    new.author_id := auth.uid(); new.hidden := false; new.created_at := now();
    new.author_name := (select coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)) from profiles p where p.id = auth.uid());
    return new;
  end if;
  if not public.can_manage('website') then raise exception 'Only the league can change a comment'; end if;
  new.body := old.body; new.author_id := old.author_id; new.author_name := old.author_name; new.created_at := old.created_at;
  return new;
end $$;

-- ── Round 25: form guide extras ──────────────────────────────────
-- Player and team of the month (Admin → Look & settings → Site settings), beside the player and team of the week.
alter table settings add column if not exists player_of_month_id uuid references players on delete set null;
alter table settings add column if not exists player_of_month_text text;
alter table settings add column if not exists player_of_month_show boolean not null default false;
alter table settings add column if not exists team_of_month_id uuid references teams on delete set null;
alter table settings add column if not exists team_of_month_text text;
alter table settings add column if not exists team_of_month_show boolean not null default false;
-- The Form guide in a menu that has been changed in Admin → Menu (a menu never changed gets it anyway).
-- Added once, after "Our Players" when it is there; taking it out again in Admin → Menu keeps it out.
alter table settings add column if not exists form_menu_added boolean not null default false;
update settings s set
  menu_more = case
    when s.menu_more is null or jsonb_typeof(s.menu_more) <> 'array' then s.menu_more
    when exists (select 1 from jsonb_array_elements(s.menu_more) e where e->>'href' = '/form') then s.menu_more
    when exists (select 1 from jsonb_array_elements(s.menu_more) e where e->>'href' = '/players') then
      (select jsonb_agg(x order by n) from (
         select e as x, n * 2 as n from jsonb_array_elements(s.menu_more) with ordinality t(e, n)
         union all
         select '{"label":"Form guide","href":"/form"}'::jsonb, (select n * 2 + 1 from jsonb_array_elements(s.menu_more) with ordinality t(e, n) where e->>'href' = '/players' limit 1)
       ) z)
    else s.menu_more || '[{"label":"Form guide","href":"/form"}]'::jsonb end,
  form_menu_added = true
where s.id = 1 and not s.form_menu_added;

-- ── Round 27: real data — a handicap can be "not updated yet" ───
-- A player whose handicap the league hasn't set yet has none (the website shows "Not updated yet")
-- rather than a made-up 0. Scorecards and handicap competitions still count a missing handicap as 0.
alter table players alter column handicap drop not null;
alter table players alter column handicap drop default;
alter table handicap_changes alter column new_handicap drop not null;

-- ── Round 32: faster first page ──────────────────────────────────
-- News lists no longer download every article's whole text (with the old website's 528 articles in, that was well
-- over a megabyte on every page): they read this word count for "3 min read" instead.
alter table articles add column if not exists word_count int generated always as (
  coalesce(array_length(regexp_split_to_array(btrim(coalesce(excerpt, '') || ' ' || coalesce(lead, '') || ' ' || coalesce(body, '')), '\s+'), 1), 0)) stored;

-- ── Round 34: a competition's box shows the trophy or a full picture ──
alter table competitions add column if not exists card_style text;
alter table competitions drop constraint if exists competitions_card_style_check;
alter table competitions add constraint competitions_card_style_check check (card_style is null or card_style in ('', 'trophy', 'picture'));

-- ── Round 35: when a cup result went in ──────────────────────────
-- A result typed into Draws & results (or a match started on the cup scorecard) gets the time it happened, so the
-- home page's Live & upcoming strip and the Latest Results box can show it even when the match had no date (Rich:
-- "still no live results in the strip").
alter table competition_matches add column if not exists result_at timestamptz;
create or replace function public.stamp_comp_result() returns trigger language plpgsql as $$
begin
  if (new.score_a is distinct from old.score_a or new.score_b is distinct from old.score_b
      or new.walkover is distinct from old.walkover
      or (new.status is distinct from old.status and new.status in ('in_progress', 'completed'))) then
    new.result_at := case when new.score_a is null and new.score_b is null and new.status = 'scheduled' then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists competition_matches_stamp_result on competition_matches;
create trigger competition_matches_stamp_result before update on competition_matches for each row execute function public.stamp_comp_result();

-- ── Round 37: walkovers in competitions ──────────────────────────
-- Rich: "We need to add walkovers to comps." A match given to one side without being played: walkover is 'a' or 'b'
-- (the side that goes through), there is no score and no frames, and the match counts as completed. Set and
-- cleared with set_walkover() below (Draws & results, or the cup scorecard), which also moves the side into the
-- next round. Typing a score or scoring frames later clears it. Walkovers don't count towards anyone's form.
alter table competition_matches add column if not exists walkover text;
alter table competition_matches drop constraint if exists competition_matches_walkover_check;
alter table competition_matches add constraint competition_matches_walkover_check check (walkover is null or walkover in ('a', 'b'));

create or replace function public.set_walkover(mid uuid, side text) returns void
language plpgsql security definer set search_path = public as $$
declare m competition_matches; nxt competition_matches; mode text; w uuid; keep uuid;
begin
  if not public.can_manage('competitions') then
    raise exception 'Only the league admin or the competition secretary can give a walkover';
  end if;
  if side is not null and side not in ('a', 'b') then raise exception 'A walkover goes to side a or side b'; end if;
  select * into m from competition_matches where id = mid;
  if not found then raise exception 'That match no longer exists'; end if;
  if side is not null and (m.entry_a is null or m.entry_b is null) then
    raise exception 'Both sides need to be known before a walkover can be given (an empty side is a bye)';
  end if;
  if side is null and m.walkover is null then return; end if;   -- nothing to undo
  select draw_mode into mode from competitions where id = m.competition_id;

  -- Whoever this match had already sent through comes back out of the next round (unless that match has started).
  if m.status = 'completed' and coalesce(mode, 'bracket') <> 'redraw' then
    w := case when m.walkover = 'a' then m.entry_a when m.walkover = 'b' then m.entry_b
              when m.score_a > m.score_b then m.entry_a when m.score_b > m.score_a then m.entry_b
              when coalesce(m.points_a, 0) > coalesce(m.points_b, 0) then m.entry_a
              when coalesce(m.points_b, 0) > coalesce(m.points_a, 0) then m.entry_b end;
    keep := case side when 'a' then m.entry_a when 'b' then m.entry_b end;   -- the side going through now (none when undoing)
    select * into nxt from competition_matches where competition_id = m.competition_id and round = m.round + 1 and slot = m.slot / 2;
    if found and w is not null and w is distinct from keep then
      if nxt.score_a is not null or nxt.walkover is not null or nxt.status <> 'scheduled' then
        raise exception 'The next round has already been played, so this result can''t be changed any more';
      end if;
      if m.slot % 2 = 0 then update competition_matches set entry_a = null where id = nxt.id and entry_a = w;
      else update competition_matches set entry_b = null where id = nxt.id and entry_b = w; end if;
    end if;
  end if;

  if side is null then
    update competition_matches set walkover = null, status = 'scheduled' where id = mid and walkover is not null;
    return;
  end if;
  delete from competition_frames where match_id = mid;
  delete from competition_breaks where match_id = mid;
  update competition_matches set walkover = side, score_a = null, score_b = null, points_a = null, points_b = null, status = 'completed'
   where id = mid;
  perform public.advance_winner(mid);
end $$;
revoke all on function public.set_walkover(uuid, text) from public, anon;
grant execute on function public.set_walkover(uuid, text) to authenticated;

-- ── Round 38: postponed cup matches, the Live & upcoming strip ────
-- Cup matches can be postponed (status 'postponed' — the status column has no fixed list, so nothing to change).
-- The home page strip: how long results stay on it, and the colours of its labels (Site settings; empty = standard).
alter table settings add column if not exists strip_result_hours int not null default 48;
alter table settings add column if not exists strip_live_color text;
alter table settings add column if not exists strip_soon_color text;
alter table settings add column if not exists strip_done_color text;
alter table settings add column if not exists strip_pending_color text;

-- ── Round 39: Postponed and Walkover labels on the strip ──────────
alter table settings add column if not exists strip_postponed_color text;
alter table settings add column if not exists strip_walkover_color text;

-- ── Round 40: scorecard reminders ─────────────────────────────────
-- The morning after a match night, netlify/functions/scorecard-reminders.mjs emails the captains of matches with no
-- result yet (Site settings: reminders_on, reminders_both). reminder_sent_at: when that went (once per match);
-- cleared when the match gets a new date, so a rearranged match can be reminded about again.
alter table fixtures add column if not exists reminder_sent_at timestamptz;
alter table settings add column if not exists reminders_on boolean not null default true;
alter table settings add column if not exists reminders_both boolean not null default false;
create or replace function public.clear_reminder() returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at then new.reminder_sent_at := null; end if;
  return new;
end $$;
drop trigger if exists fixtures_clear_reminder on fixtures;
create trigger fixtures_clear_reminder before update on fixtures for each row execute function public.clear_reminder();

-- Season wrapped (/wrapped) in a menu that has been changed in Admin → Menu: added once after the Form guide
-- (or at the end); taking it out again in Admin → Menu keeps it out.
alter table settings add column if not exists wrapped_menu_added boolean not null default false;
update settings s set
  menu_more = case
    when s.menu_more is null or jsonb_typeof(s.menu_more) <> 'array' then s.menu_more
    when exists (select 1 from jsonb_array_elements(s.menu_more) e where e->>'href' = '/wrapped') then s.menu_more
    when exists (select 1 from jsonb_array_elements(s.menu_more) e where e->>'href' = '/form') then
      (select jsonb_agg(x order by n) from (
         select e as x, n * 2 as n from jsonb_array_elements(s.menu_more) with ordinality t(e, n)
         union all
         select '{"label":"Season wrapped","href":"/wrapped"}'::jsonb, (select n * 2 + 1 from jsonb_array_elements(s.menu_more) with ordinality t(e, n) where e->>'href' = '/form' limit 1)
       ) z)
    else s.menu_more || '[{"label":"Season wrapped","href":"/wrapped"}]'::jsonb end,
  wrapped_menu_added = true
where s.id = 1 and not s.wrapped_menu_added;

-- ── Round 41: draws made on paper, round by round ────────────────
-- Rich: "I have no idea what to do re adding these prelim results to the draw." A round drawn before the one
-- before it has finished has places like "St Neot or Mevagissey C". Each side of a match can now be:
--   a team / player (entry_a), a bye (bye_a), or "the winner of that match" (from_a = the other match's id).
-- The winner is written in by itself the moment that match is decided (a score, a walkover, or a bye, when the
-- match it comes from is a bye too), and taken out again if that result is removed — while the match it goes into
-- hasn't started. Works in both draw modes. Set in Admin → Draws & results → the pairing boxes.
alter table competition_matches add column if not exists from_a uuid references competition_matches on delete set null;
alter table competition_matches add column if not exists from_b uuid references competition_matches on delete set null;
alter table competition_matches add column if not exists bye_a boolean not null default false;
alter table competition_matches add column if not exists bye_b boolean not null default false;

-- Who has come through a match: a walkover, a bye (one side marked bye, the other known), or the result.
create or replace function public.comp_match_winner(m competition_matches) returns uuid language sql stable as $$
  select case
    when m.walkover = 'a' then m.entry_a
    when m.walkover = 'b' then m.entry_b
    when m.bye_b and m.entry_a is not null and m.entry_b is null then m.entry_a
    when m.bye_a and m.entry_b is not null and m.entry_a is null then m.entry_b
    when m.status <> 'completed' or m.score_a is null or m.score_b is null then null
    when m.score_a > m.score_b then m.entry_a
    when m.score_b > m.score_a then m.entry_b
    when coalesce(m.points_a, 0) > coalesce(m.points_b, 0) then m.entry_a
    when coalesce(m.points_b, 0) > coalesce(m.points_a, 0) then m.entry_b end;
$$;

-- After a match changes: fill (or empty) the "Winner of this match" places of the matches it leads to.
create or replace function public.comp_from_winner() returns trigger
language plpgsql security definer set search_path = public as $$
declare w uuid := public.comp_match_winner(new);
begin
  update competition_matches set entry_a = w
   where from_a = new.id and entry_a is distinct from w and score_a is null and walkover is null and status in ('scheduled', 'postponed');
  update competition_matches set entry_b = w
   where from_b = new.id and entry_b is distinct from w and score_b is null and walkover is null and status in ('scheduled', 'postponed');
  return null;
end $$;
drop trigger if exists competition_matches_from_winner on competition_matches;
create trigger competition_matches_from_winner after update on competition_matches for each row
  when (old.score_a is distinct from new.score_a or old.score_b is distinct from new.score_b or old.status is distinct from new.status
     or old.walkover is distinct from new.walkover or old.points_a is distinct from new.points_a or old.points_b is distinct from new.points_b
     or old.entry_a is distinct from new.entry_a or old.entry_b is distinct from new.entry_b
     or old.bye_a is distinct from new.bye_a or old.bye_b is distinct from new.bye_b)
  execute function public.comp_from_winner();

-- When a place is set to "Winner of …" (or changed), it is filled straight away if that match is already decided.
create or replace function public.comp_from_resolve() returns trigger
language plpgsql security definer set search_path = public as $$
declare src competition_matches;
begin
  if new.from_a is not null and (tg_op = 'INSERT' or new.from_a is distinct from old.from_a) then
    select * into src from competition_matches where id = new.from_a;
    new.entry_a := public.comp_match_winner(src); new.bye_a := false;
  elsif new.from_a is null and tg_op = 'UPDATE' and old.from_a is not null and new.entry_a is not distinct from old.entry_a then
    new.entry_a := null;
  end if;
  if new.from_b is not null and (tg_op = 'INSERT' or new.from_b is distinct from old.from_b) then
    select * into src from competition_matches where id = new.from_b;
    new.entry_b := public.comp_match_winner(src); new.bye_b := false;
  elsif new.from_b is null and tg_op = 'UPDATE' and old.from_b is not null and new.entry_b is not distinct from old.entry_b then
    new.entry_b := null;
  end if;
  if new.bye_a then new.entry_a := null; new.from_a := null; end if;
  if new.bye_b then new.entry_b := null; new.from_b := null; end if;
  return new;
end $$;
drop trigger if exists competition_matches_from_resolve on competition_matches;
create trigger competition_matches_from_resolve before insert or update on competition_matches for each row execute function public.comp_from_resolve();

-- ── the version of this file ─────────────────────────────────────
-- KEEP THIS AT THE VERY END. The website asks the database for this number (public/js/core/version.js holds
-- the one it expects). Because it is the last thing in the file, the database only reports the new number
-- when everything above it has run. If the website files are uploaded without this file being run, the admin
-- dashboard says "The database needs updating" at the top of every page.
-- When something is added to this file that the website needs: raise this number and the one in version.js.
-- ── Round 43: the look of the website ────────────────────────────
-- Rich: "too many colours … a little lighter". 'calm' (standard): white space, black and red, a quiet menu.
-- 'classic': the colourful menu and section colours from before. Admin → Branding → Look.
alter table settings add column if not exists site_look text not null default 'calm';

-- ── Round 45: the strip and the header, light or dark (Admin → Branding → Look) ──
alter table settings add column if not exists strip_style text not null default 'light';
alter table settings add column if not exists header_style text not null default 'black';

-- ── Round 46: a second logo for the light cream header (Admin → Branding → Logos) ──
alter table settings add column if not exists logo_light_url text;

-- ── Round 47: the standard home page (Site settings → Home page) ──
alter table settings add column if not exists home_style text not null default 'standard';
alter table settings add column if not exists home_sections jsonb not null default '{}'::jsonb;
alter table settings add column if not exists promo_mode text not null default 'auto';
alter table settings add column if not exists promo_title text;
alter table settings add column if not exists promo_text text;
alter table settings add column if not exists promo_button text;
alter table settings add column if not exists promo_url text;
alter table settings add column if not exists hero_bg text;
alter table settings add column if not exists strip_line text not null default 'none';

-- ── Round 55: Help & support requests (Rich: "a support function … a support ticket which certain roles get
--    based on a support enquiry dropdown category list") ──────────────────────────────────────────────────────
-- Anyone can send the league a request from /support (the Help page links to it): they pick a category, and the
-- request goes to the roles that category is given to (Admin → Support → Support categories, Master Admin only).
-- The Master Admin sees every request. The sender gets a reference (#1001) and a private link (/support/<token>)
-- where they read the league's replies and answer back; logged-in senders also see their requests on /support.
-- Officers can add private notes the sender never sees. Everything is changed through the functions below.
create table if not exists support_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  description text check (length(description) <= 300),
  roles text[] not null default '{}',
  sort int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into support_categories (name, description, roles, sort)
select * from (values
  ('Scorecards & results', 'A result or scorecard that looks wrong, or trouble entering one', array['league_admin','league_secretary'], 1),
  ('Fixtures & rearranging a match', 'Dates, venues, postponements and rearranged matches', array['league_admin','league_secretary'], 2),
  ('Handicaps', 'A question about a player''s handicap', array['league_admin','league_secretary','competition_secretary'], 3),
  ('Competitions & entries', 'Entering a competition, draws, deadlines and cup matches', array['league_admin','competition_secretary'], 4),
  ('Players, teams & registration', 'Joining the league, signing or moving a player, team details', array['league_admin','league_secretary'], 5),
  ('My login & account', 'Logging in, passwords and your account', array['league_admin'], 6),
  ('Website problem or idea', 'Something not working on the website, or an idea to make it better', array['league_admin'], 7),
  ('Sponsorship & advertising', 'Sponsoring the league or advertising on the website', array['chairman','committee_member'], 8),
  ('Something else', 'Anything else for the league', array['league_admin','chairman'], 9)
) v(name, description, roles, sort)
where not exists (select 1 from support_categories);

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  no int generated by default as identity (start with 1001) unique,
  token uuid not null default gen_random_uuid() unique,
  category_id uuid references support_categories on delete set null,
  category text not null check (length(category) <= 80),
  subject text not null check (length(subject) between 3 and 160),
  name text not null check (length(name) between 2 and 120),
  email text not null check (length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id uuid references auth.users on delete set null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting', 'resolved')),
  assigned_to uuid references profiles on delete set null,
  last_from text not null default 'sender' check (last_from in ('sender', 'league')),
  page_url text check (length(page_url) <= 500),
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user on support_tickets (user_id);

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets on delete cascade,
  author_id uuid references auth.users on delete set null,
  author_name text check (length(author_name) <= 120),
  from_league boolean not null default false,
  internal boolean not null default false,
  body text not null check (length(body) between 1 and 5000),
  image_url text check (length(image_url) <= 500),
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket on support_messages (ticket_id);

-- Does this login look after requests in this category? (The Master Admin: all of them. A request whose category has
-- been removed: whoever looks after Site settings.)
create or replace function public.handles_support(cat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and (
    p.role = 'admin'
    or exists (select 1 from support_categories c where c.id = cat and p.role = any(c.roles))
    or (cat is null and exists (select 1 from role_permissions rp where rp.role = p.role and 'settings' = any(rp.areas)))
  )) and public.session_ok();
$$;
-- Does this login look after any requests at all (the Support inbox in the dashboard)?
create or replace function public.handles_any_support() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and (
    p.role = 'admin' or exists (select 1 from support_categories c where c.is_active and p.role = any(c.roles))
  )) and public.session_ok();
$$;

-- The officers who look after support requests (for "Looking after" in the inbox — officers can't read each other's logins).
create or replace function public.support_staff() returns table (id uuid, full_name text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(p.full_name, ''), p.email), p.role from profiles p
  where public.handles_any_support() and (p.role = 'admin' or exists (select 1 from support_categories c where c.is_active and p.role = any(c.roles)))
  order by 2;
$$;
grant execute on function public.support_staff() to authenticated;

-- Send a request (anyone). p: category_id, subject, message, name, email, page_url, image_url (logged in only), website (a trap
-- for robots: people never see that box, so anything in it means the request is quietly dropped).
create or replace function public.submit_support(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cat support_categories; t support_tickets; mid uuid; me profiles; em text; img text := nullif(trim(coalesce(p->>'image_url', '')), '');
begin
  -- Round 57 (Neil): only logged-in people can send a request. Their name and email come from their login.
  if auth.uid() is null then raise exception 'Please log in to contact the league'; end if;
  select * into me from profiles where id = auth.uid();
  em := lower(trim(coalesce(nullif(me.email, ''), (select email from auth.users where id = auth.uid()), p->>'email', '')));
  if nullif(trim(coalesce(p->>'website', '')), '') is not null then return jsonb_build_object('no', 0); end if;
  select * into cat from support_categories where id = nullif(p->>'category_id', '')::uuid and is_active;
  if cat.id is null then raise exception 'Please choose what your request is about'; end if;
  if length(trim(coalesce(p->>'subject', ''))) < 3 then raise exception 'Please say in a few words what it is about'; end if;
  if length(trim(coalesce(p->>'message', ''))) < 5 then raise exception 'Please tell us a little more'; end if;
  if length(trim(coalesce(nullif(me.full_name, ''), p->>'name', ''))) < 2 then raise exception 'Please type your name'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please type your email address, so the league can answer you'; end if;
  if img is not null and (auth.uid() is null or not public.is_site_image(img, 'support')) then raise exception 'Pictures must be uploaded on this website'; end if;
  -- Five requests an hour from one email address or login is plenty.
  if (select count(*) from support_tickets where created_at > now() - interval '1 hour' and (email = em or (auth.uid() is not null and user_id = auth.uid()))) >= 5 then
    raise exception 'You have sent several requests in the last hour — please wait for the league to answer';
  end if;
  insert into support_tickets (category_id, category, subject, name, email, user_id, page_url)
  values (cat.id, cat.name, left(trim(p->>'subject'), 160), left(trim(coalesce(nullif(me.full_name, ''), p->>'name')), 120), em, auth.uid(), left(nullif(trim(coalesce(p->>'page_url', '')), ''), 500))
  returning * into t;
  insert into support_messages (ticket_id, author_id, author_name, body, image_url)
  values (t.id, auth.uid(), t.name, left(trim(p->>'message'), 5000), img) returning id into mid;
  return jsonb_build_object('id', t.id, 'no', t.no, 'token', t.token, 'message_id', mid);
end $$;
grant execute on function public.submit_support(jsonb) to anon, authenticated;

-- A request and its conversation (the sender's own view — no private notes). Round 57: the sender has to be logged
-- in as themselves (or be an officer who looks after it); the link alone isn't enough.
create or replace function public.support_thread(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ticket', jsonb_build_object('id', t.id, 'no', t.no, 'subject', t.subject, 'category', t.category, 'status', t.status, 'name', t.name,
      'created_at', t.created_at, 'updated_at', t.updated_at),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from_league', m.from_league, 'author_name', case when m.from_league then split_part(coalesce(m.author_name, 'The league'), ' ', 1) else m.author_name end,
      'body', m.body, 'image_url', m.image_url, 'created_at', m.created_at) order by m.created_at) from support_messages m where m.ticket_id = t.id and not m.internal), '[]'::jsonb))
  from support_tickets t where t.token = p_token and auth.uid() is not null and (t.user_id = auth.uid() or public.handles_support(t.category_id));
$$;
grant execute on function public.support_thread(uuid) to anon, authenticated;

-- Add to the conversation. An officer who looks after the request answers it (or adds a private note, p_internal) and
-- can set its status at the same time; the sender (logged in, or with the private link) answers back, which opens it again.
create or replace function public.support_reply(p_ticket uuid, p_token uuid default null, p_body text default '', p_internal boolean default false,
  p_status text default null, p_image text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare t support_tickets; me profiles; staff boolean; new_id uuid; img text := nullif(trim(coalesce(p_image, '')), '');
begin
  if auth.uid() is null then raise exception 'Please log in to reply'; end if;
  select * into t from support_tickets where (p_ticket is not null and id = p_ticket) or (p_token is not null and token = p_token) limit 1;
  if t.id is null then raise exception 'Request not found'; end if;
  if length(trim(coalesce(p_body, ''))) < 1 then raise exception 'Please type your message'; end if;
  if img is not null and (auth.uid() is null or not public.is_site_image(img, 'support')) then raise exception 'Pictures must be uploaded on this website'; end if;
  select * into me from profiles where id = auth.uid();
  staff := public.handles_support(t.category_id);
  if staff then
    insert into support_messages (ticket_id, author_id, author_name, from_league, internal, body, image_url)
    values (t.id, auth.uid(), coalesce(nullif(me.full_name, ''), 'The league'), true, coalesce(p_internal, false), left(trim(p_body), 5000), img) returning id into new_id;
    update support_tickets set
      status = case when p_status in ('new', 'in_progress', 'waiting', 'resolved') then p_status when coalesce(p_internal, false) then (case when status = 'new' then 'in_progress' else status end) else 'waiting' end,
      last_from = case when coalesce(p_internal, false) then last_from else 'league' end,
      assigned_to = coalesce(assigned_to, auth.uid()), updated_at = now()
    where id = t.id;
  elsif t.user_id = auth.uid() then
    insert into support_messages (ticket_id, author_id, author_name, body, image_url)
    values (t.id, auth.uid(), t.name, left(trim(p_body), 5000), img) returning id into new_id;
    update support_tickets set status = case when status = 'new' then 'new' else 'in_progress' end, last_from = 'sender', updated_at = now() where id = t.id;
  else
    raise exception 'This isn''t your request';
  end if;
  return new_id;
end $$;
grant execute on function public.support_reply(uuid, uuid, text, boolean, text, text) to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['support_categories','support_tickets','support_messages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "support read" on %I', t);
    execute format('drop policy if exists "support write" on %I', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('drop policy if exists "master delete" on %I', t);
  end loop;
end $$;
create policy "public read" on support_categories for select using (is_active or public.handles_any_support());
create policy "admin write" on support_categories for all using (public.is_master()) with check (public.is_master());
-- Requests: the officers who look after that category, and the sender (logged in) their own. Officers can change the
-- status, the category and who is looking after it; only the Master Admin can delete one.
create policy "support read" on support_tickets for select using (public.handles_support(category_id) or (auth.uid() is not null and user_id = auth.uid()));
create policy "support write" on support_tickets for update using (public.handles_support(category_id)) with check (public.handles_any_support());
create policy "master delete" on support_tickets for delete using (public.is_master());
create policy "support read" on support_messages for select using (exists (select 1 from support_tickets t where t.id = ticket_id
  and (public.handles_support(t.category_id) or (auth.uid() is not null and t.user_id = auth.uid() and not internal))));
create policy "master delete" on support_messages for delete using (public.is_master());

-- Live updates: a new request (or answer) appears in the inbox, and the league's reply pops up for the sender.
do $$
declare t text;
begin
  foreach t in array array['support_tickets','support_messages'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Support emails can be switched off (Admin → Emails → Support request emails).
alter table private_settings add column if not exists support_email_on boolean not null default true;

-- A screenshot with a request (logged in only): pictures go in support/.
drop policy if exists "images admin insert" on storage.objects;
create policy "images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (public.is_staff()
    or ((name like 'scorecards/%' or name like 'matchnight/%') and exists (select 1 from public.profiles where id = auth.uid()
          and (role in ('captain', 'vice_captain') or team_role in ('captain', 'vice_captain'))))
    or (name like 'players/%' and exists (select 1 from public.profiles where id = auth.uid() and player_id is not null))
    or (name like 'news/%' and public.can_manage('news'))
    or (name like 'market/%' and auth.uid() is not null)
    or (name like 'memories/%' and auth.uid() is not null)
    or (name like 'support/%' and auth.uid() is not null)
  ));

-- ── Round 56: doubles pairs ──────────────────────────────────────
-- Pairs that came in on the entry form before partner_id existed: fill it in from their entry.
update competition_entries e set partner_id = s.partner_id
  from competition_signups s where s.entry_id = e.id and e.partner_id is null and s.partner_id is not null and e.team_id is null;

-- ── Round 57 (Neil: "no one can do anything to the website without being logged in") ──
-- Everything that sends something to the league needs a login: support requests, competition entries, CueViews and
-- Hall of Fame memories. (Still open to everyone: reading the website, logging in, the newsletter sign-up/unsubscribe
-- link, and the anonymous page-view counter.)
do $$
declare f text;
begin
  foreach f in array array['public.submit_support(jsonb)', 'public.support_thread(uuid)', 'public.support_reply(uuid, uuid, text, boolean, text, text)',
    'public.support_staff()', 'public.enter_competitions(uuid, uuid[], text, jsonb)', 'public.submit_memory(jsonb)',
    'public.submit_cueview(uuid, text, text, jsonb, text, text)', 'public.set_chat_off(uuid, uuid, boolean)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ── Round 72 (Rich: "competitions, we don't have seeds — but other leagues might") ──
-- Seeds are off unless a competition is ticked as seeded (Admin → Competitions → Edit). Without seeds the draw is
-- always random, and the Seed column and "Seeded draw" button are hidden.
alter table competitions add column if not exists seeded boolean not null default false;

-- ── Round 73 (Rich's feedback 70.7) ──────────────────────────────
-- Competitions: a photo of the paper scorecard, as for league matches (anyone who can score the match can add it).
alter table competition_matches add column if not exists scorecard_url text;
create or replace function public.set_comp_scorecard_photo(mid uuid, url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_comp_match(mid) then
    raise exception 'You are not allowed to change this match';
  end if;
  if coalesce(url, '') <> '' and not public.is_site_image(url, 'scorecards') then
    raise exception 'That is not a scorecard photo uploaded on this website';
  end if;
  update competition_matches set scorecard_url = nullif(url, '') where id = mid;
end;
$$;
revoke all on function public.set_comp_scorecard_photo(uuid, text) from public, anon;
grant execute on function public.set_comp_scorecard_photo(uuid, text) to authenticated;

-- Handicap competitions where the away player gets extra points on top of the handicap start
-- (Bill Toms and Willie Thomas: 5). Set under Admin → Competitions → Edit.
alter table competitions add column if not exists away_start int not null default 0;

-- The site's own settings: the loading screen on every page, or only when the website is first opened.
alter table settings add column if not exists loader_every_page boolean not null default false;

-- The Triple Crown (Rich): which three competitions make it up — chosen in Site settings → Players.
alter table settings add column if not exists triple_crown text not null default '';

create or replace function public.schema_version() returns int language sql immutable as $$ select 38 $$;
grant execute on function public.schema_version() to anon, authenticated;

-- Tell the website's data service about the new tables, columns and functions straight away.
notify pgrst, 'reload schema';
