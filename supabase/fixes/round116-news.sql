-- ─────────────────────────────────────────────────────────────
--  Round 116: NEWS — drafts, scheduling, hashtags and "keep in view" (Admin → News).
--   • publish_at   the date and time a Scheduled article goes on the website by itself (empty = no schedule)
--   • tags         its hashtags, as typed ("#VictoryLeague #Bethel")
--   • image_focus  which part of the main picture stays in view where it is cut to fit: center, top or bottom
--  A scheduled article is Published with a publish_at in the future. The rule below keeps it from everyone but the
--  league's officers (and its writer) until that moment — the database refuses to send it, so it cannot be read
--  early by typing its address or asking the database directly.
--  Run this once in Supabase → SQL Editor (it is also part of schema.sql). Safe to run again.
-- ─────────────────────────────────────────────────────────────
alter table articles add column if not exists publish_at timestamptz;
alter table articles add column if not exists tags text not null default '';
alter table articles add column if not exists image_focus text not null default 'center';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'articles_image_focus_check') then
    alter table articles add constraint articles_image_focus_check check (image_focus in ('center', 'top', 'bottom'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'articles_tags_length_check') then
    alter table articles add constraint articles_tags_length_check check (length(tags) <= 600);
  end if;
end $$;
create index if not exists articles_publish_at_idx on articles (publish_at) where publish_at is not null;
drop policy if exists "public read" on articles;
create policy "public read" on articles for select using (
  (is_published and (publish_at is null or publish_at <= now()))
  or public.can_manage('website')
  or (created_by = auth.uid() and public.can_manage('news')));

-- The website (round 116) expects database version 44.
create or replace function public.schema_version() returns int language sql immutable as $$ select 44 $$;
grant execute on function public.schema_version() to anon, authenticated;
