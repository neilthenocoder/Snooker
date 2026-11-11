-- Round 112 (Rich: "I have a live result right now, but it's not showing in the scroller — is this because it's last week's?")
-- Run this once in Supabase → SQL Editor (schema.sql has the same change, for a fresh database).
--
-- A match counted as "live" for 5 hours from its date and time. A match from last week being played (or scored)
-- tonight was too old, so it never showed as live. Now each match also remembers when its scorecard was last
-- worked on (live_at): a match being scored right now is live, whatever its date.

alter table fixtures add column if not exists live_at timestamptz;

-- Saving a frame of a match that hasn't been submitted yet marks the match as being played now.
create or replace function public.frames_touch_fixture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update fixtures set live_at = now()
   where id = new.fixture_id and status in ('scheduled', 'in_progress');
  return new;
end $$;
drop trigger if exists frames_touch_fixture on frames;
create trigger frames_touch_fixture after insert or update on frames for each row execute function public.frames_touch_fixture();

-- Starting a match ("Save progress" for the first time) does the same.
create or replace function public.fixture_live_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'in_progress' and old.status is distinct from 'in_progress' then new.live_at := now(); end if;
  return new;
end $$;
drop trigger if exists fixture_live_at on fixtures;
create trigger fixture_live_at before update on fixtures for each row execute function public.fixture_live_at();
