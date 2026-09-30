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
  value int not null check (value between 1 and 147)
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

-- One row per login. Created by the admin dashboard (Netlify Function).
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  role text not null default 'captain' check (role in ('admin', 'captain', 'vice_captain')),
  team_id uuid references teams on delete set null
);

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
  update fixtures set status = new_status where id = fid;
end;
$$;

revoke all on function public.set_fixture_status(uuid, text) from public, anon;
grant execute on function public.set_fixture_status(uuid, text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.can_edit_fixture(uuid) to anon, authenticated;

-- ── row-level security ──────────────────────────────────────────
-- Everyone can READ league data. Only admins can WRITE it, except
-- frames and breaks, which captains can write for their own matches.
do $$
declare t text;
begin
  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','frames','breaks','articles','pages','sponsors','profiles'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "admin write" on %I', t);
  end loop;

  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','frames','breaks','pages','sponsors'] loop
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;

  foreach t in array array['seasons','leagues','venues','teams','players','fixtures','articles','pages','sponsors','profiles'] loop
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

-- ── live updates ────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table fixtures, frames, breaks;
exception when duplicate_object then null;
end $$;
