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
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin', 'captain', 'vice_captain', 'player'));

-- ── permission helpers ──────────────────────────────────────────
-- "security definer" lets these read profiles without tripping over
-- the profiles table's own security rules.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Admins: any fixture. Captains / vice captains: their own team's
-- fixtures, and only until the result is approved.
create or replace function public.can_edit_fixture(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from fixtures f join profiles p on p.id = auth.uid()
    where f.id = fid
      and p.role in ('captain', 'vice_captain')
      and p.team_id in (f.home_team_id, f.away_team_id)
      and f.status in ('scheduled', 'in_progress', 'submitted')
  );
$$;

-- The only way a captain can change a fixture: start it or submit it.
create or replace function public.set_fixture_status(fid uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_fixture(fid) then
    raise exception 'You are not allowed to change this fixture';
  end if;
  if not public.is_admin() and new_status not in ('in_progress', 'submitted') then
    raise exception 'Only the league admin can set a fixture to %', new_status;
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

-- Competition matches: admins, or a captain whose team (or player) is in the match,
-- until the match is completed.
create or replace function public.can_edit_comp_match(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from competition_matches m
    join profiles p on p.id = auth.uid() and p.role in ('captain', 'vice_captain')
    join competition_entries e on e.id in (m.entry_a, m.entry_b)
    left join players pl on pl.id = e.player_id
    where m.id = mid
      and m.status <> 'completed'
      and p.team_id is not null
      and p.team_id in (e.team_id, pl.team_id)
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

-- Captains can register a new player, but only for their own team.
create or replace function public.add_player(p_name text, p_team uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not (public.is_admin() or exists (
    select 1 from profiles where id = auth.uid() and role in ('captain', 'vice_captain') and team_id = p_team)) then
    raise exception 'You can only add players to your own team';
  end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 80 then
    raise exception 'Please enter the player''s name';
  end if;
  insert into players (full_name, team_id) values (trim(p_name), p_team) returning id into new_id;
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
grant execute on function public.can_edit_fixture(uuid) to anon, authenticated;

-- ── row-level security ──────────────────────────────────────────
-- Everyone can READ league data. Only admins can WRITE it, except
-- frames and breaks, which captains can write for their own matches.
do $$
declare t text;
begin
  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','frames','breaks','articles','pages','sponsors','profiles','competitions','competition_entries','competition_matches','categories','media','settings','competition_frames','competition_breaks','page_views'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "admin write" on %I', t);
  end loop;

  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','frames','breaks','pages','sponsors','competitions','competition_entries','competition_matches','categories','media','settings','competition_frames','competition_breaks'] loop
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;

  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','articles','pages','sponsors','profiles','competitions','competition_entries','competition_matches','categories','media','settings','competition_frames','competition_breaks','page_views'] loop
    execute format('create policy "admin write" on %I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Unpublished articles are hidden from the public.
create policy "public read" on articles for select using (is_published or public.is_admin());

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
  foreach t in array array['fixtures','frames','breaks','players','competition_matches','competition_frames','competition_breaks'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ── image uploads (Supabase Storage) ────────────────────────────
-- A public "images" bucket: anyone can view pictures, only admins can
-- upload or delete them. Max 5 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images admin insert" on storage.objects;
drop policy if exists "images admin update" on storage.objects;
drop policy if exists "images admin delete" on storage.objects;
-- Captains may also upload photos of paper scorecards (into scorecards/ only),
-- and anyone linked to a player profile may upload their own photos (players/ only).
create policy "images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (public.is_admin()
    or (name like 'scorecards/%' and exists (select 1 from public.profiles where id = auth.uid() and role in ('captain', 'vice_captain')))
    or (name like 'players/%' and exists (select 1 from public.profiles where id = auth.uid() and player_id is not null))
  ));
create policy "images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'images' and public.is_admin());
create policy "images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and public.is_admin());
