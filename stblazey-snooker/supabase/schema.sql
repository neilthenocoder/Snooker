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
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'league_admin'));
$$;

-- Which part of the admin dashboard a login may change:
-- 'league', 'competitions' or 'website'. Admins may change everything.
create or replace function public.can_manage(area text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and (
    role in ('admin', 'league_admin')
    or (area = 'competitions' and role = 'competition_secretary')
    or (area = 'league' and role = 'league_secretary')
    or (area = 'website' and role in ('committee_member', 'president', 'vice_chairman', 'chairman'))
  ));
$$;

-- Anyone with a part of the admin dashboard (they may upload pictures).
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage('league') or public.can_manage('competitions') or public.can_manage('website');
$$;

-- Captain or vice captain of this team (by role, or an officer given team rights).
create or replace function public.is_captain_of(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select team is not null and exists (select 1 from profiles where id = auth.uid() and team_id = team
    and (role in ('captain', 'vice_captain') or team_role in ('captain', 'vice_captain')));
$$;

-- Admins: any fixture. Captains / vice captains: their own team's
-- fixtures, and only until the result is approved.
create or replace function public.can_edit_fixture(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
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
  if not public.is_admin() then
    if new_status = 'postponed' then
      if (select status from fixtures where id = fid) <> 'scheduled' then
        raise exception 'Only a match that has not started can be postponed';
      end if;
    elsif new_status not in ('in_progress', 'submitted') then
      raise exception 'Only the league admin can set a fixture to %', new_status;
    end if;
  end if;
  -- A result can't be submitted without a photo of the paper scorecard.
  if new_status = 'submitted' and not exists (select 1 from fixtures where id = fid and coalesce(scorecard_url, '') <> '') then
    raise exception 'Upload a photo of the paper scorecard before submitting the result';
  end if;
  update fixtures set status = new_status where id = fid;
end;
$$;

-- Captains attach a photo of the paper scorecard.
create or replace function public.set_scorecard_photo(fid uuid, url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_fixture(fid) then
    raise exception 'You are not allowed to change this fixture';
  end if;
  update fixtures set scorecard_url = url where id = fid;
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
    where m.id = mid
      and m.status <> 'completed'
      and (public.is_captain_of(e.team_id) or public.is_captain_of(pl.team_id))
  );
$$;

-- Bracket draws: write a decided match's winner into its next-round match.
create or replace function public.advance_winner(mid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m competition_matches; mode text; w uuid;
begin
  select * into m from competition_matches where id = mid;
  select draw_mode into mode from competitions where id = m.competition_id;
  if mode = 'redraw' or m.score_a is null or m.score_b is null or m.score_a = m.score_b then return; end if;
  w := case when m.score_a > m.score_b then m.entry_a else m.entry_b end;
  if w is null then return; end if;
  if m.slot % 2 = 0 then
    update competition_matches set entry_a = w where competition_id = m.competition_id and round = m.round + 1 and slot = m.slot / 2;
  else
    update competition_matches set entry_b = w where competition_id = m.competition_id and round = m.round + 1 and slot = m.slot / 2;
  end if;
end;
$$;
revoke all on function public.advance_winner(uuid) from public, anon, authenticated;

-- Recalculate a competition match's score from its frames, and start or finish it.
create or replace function public.sync_comp_match(mid uuid, finished boolean) returns void
language plpgsql security definer set search_path = public as $$
declare wa int; wb int;
begin
  if not public.can_edit_comp_match(mid) then
    raise exception 'You are not allowed to change this match';
  end if;
  select count(*) filter (where a_points > b_points), count(*) filter (where b_points > a_points)
    into wa, wb from competition_frames where match_id = mid;
  if finished and wa = wb then
    raise exception 'A knockout match needs a winner — the frames are level';
  end if;
  update competition_matches
     set score_a = case when wa + wb > 0 then wa end,
         score_b = case when wa + wb > 0 then wb end,
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

-- The league secretary AND the competition secretary can adjust a handicap
-- without being able to change anything else about the player.
create or replace function public.set_handicap(pid uuid, value int, note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.can_manage('league') or public.can_manage('competitions')) then
    raise exception 'Only the league or competition secretary can change a handicap';
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
  if not (public.can_manage('league') or public.can_manage('competitions')) then
    raise exception 'Only the league or competition secretary can start the handicap review';
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
  if not (public.is_admin() or public.is_captain_of((select home_team_id from fixtures where id = fid))) then
    raise exception 'Only the home team''s captain or vice captain can add match night photos';
  end if;
  if jsonb_typeof(urls) <> 'array' or jsonb_array_length(urls) > 12 or octet_length(urls::text) > 8000 then
    raise exception 'A match can have up to 12 photos';
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
         or exists (select 1 from competition_entries where competition_id = cid and player_id in (pl.id, partner.id)) then
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
      insert into competition_entries (competition_id, name, team_id, player_id, seed)
      values (su.competition_id, su.name, su.team_id, case when su.team_id is null then su.player_id end,
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
  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','frames','breaks','articles','pages','sponsors','profiles','competitions','competition_entries','competition_matches','categories','media','settings','competition_frames','competition_breaks','page_views'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "admin write" on %I', t);
  end loop;

  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','frames','breaks','pages','sponsors','competitions','competition_entries','competition_matches','categories','media','settings','competition_frames','competition_breaks'] loop
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;

  -- Fixtures and logins: admins only.
  foreach t in array array['fixtures','profiles'] loop
    execute format('create policy "admin write" on %I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  -- Everything else: admins, plus the officer role for that part of the dashboard.
  foreach t in array array['seasons','leagues','venues','teams','players'] loop
    execute format('create policy "admin write" on %I for all using (public.can_manage(''league'')) with check (public.can_manage(''league''))', t);
  end loop;
  foreach t in array array['competitions','competition_entries','competition_matches','competition_frames','competition_breaks'] loop
    execute format('create policy "admin write" on %I for all using (public.can_manage(''competitions'')) with check (public.can_manage(''competitions''))', t);
  end loop;
  foreach t in array array['articles','pages','sponsors','categories','settings','page_views'] loop
    execute format('create policy "admin write" on %I for all using (public.can_manage(''website'')) with check (public.can_manage(''website''))', t);
  end loop;
  -- The image library is shared by everyone who can upload pictures.
  execute 'create policy "admin write" on media for all using (public.is_staff()) with check (public.is_staff())';
end $$;

-- Entry-form entries (with contact details) and the handicap log are for officers only.
-- The public reaches them through enter_competitions() and signup_names() above.
alter table competition_signups enable row level security;
alter table handicap_changes enable row level security;
drop policy if exists "admin write" on competition_signups;
drop policy if exists "staff read" on handicap_changes;
create policy "admin write" on competition_signups for all using (public.can_manage('competitions')) with check (public.can_manage('competitions'));
create policy "staff read" on handicap_changes for select using (public.can_manage('league') or public.can_manage('competitions'));

-- Unpublished articles are hidden from the public.
create policy "public read" on articles for select using (is_published or public.can_manage('website'));

-- Logins: you can see your own profile; admins see everyone's. Emails are never public.
create policy "public read" on profiles for select using (id = auth.uid() or public.is_admin());

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

-- ── live updates ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['fixtures','frames','breaks','players','competition_matches','competition_frames','competition_breaks','competitions'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ── image uploads (Supabase Storage) ────────────────────────────
-- A public "images" bucket: anyone can view pictures; admins and league
-- officers can upload or delete them. Max 5 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images admin insert" on storage.objects;
drop policy if exists "images admin update" on storage.objects;
drop policy if exists "images admin delete" on storage.objects;
-- Captains may also upload photos of paper scorecards (scorecards/) and of the
-- match night (matchnight/), and anyone linked to a player profile may upload
-- their own photos (players/ only).
create policy "images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (public.is_staff()
    or ((name like 'scorecards/%' or name like 'matchnight/%') and exists (select 1 from public.profiles where id = auth.uid()
          and (role in ('captain', 'vice_captain') or team_role in ('captain', 'vice_captain'))))
    or (name like 'players/%' and exists (select 1 from public.profiles where id = auth.uid() and player_id is not null))
  ));
create policy "images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'images' and public.is_staff());
create policy "images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and public.is_staff());
