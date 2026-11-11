-- ─────────────────────────────────────────────────────────────
--  Round 118: IMAGE LIBRARY — details for each picture (Admin → Image library → Details):
--   a tidy name, a title, a description (the "alt text" search engines and screen readers read), a caption and keywords.
--  The pictures themselves stay private to whoever uploaded them (and the Master Admin), as before. The details of a
--  picture are handed to the public pages by media_meta(): only for the exact addresses a page asks about, and only
--  the title, description and caption — never who uploaded it.
--  Run this once in Supabase → SQL Editor (it is also part of schema.sql). Safe to run again.
-- ─────────────────────────────────────────────────────────────
alter table media add column if not exists title text not null default '';
alter table media add column if not exists alt_text text not null default '';
alter table media add column if not exists caption text not null default '';
alter table media add column if not exists keywords text not null default '';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'media_details_length_check') then
    alter table media add constraint media_details_length_check check (length(title) <= 200 and length(alt_text) <= 500 and length(caption) <= 500 and length(keywords) <= 300 and (name is null or length(name) <= 160));
  end if;
end $$;
create index if not exists media_url_idx on media (url);
create or replace function public.media_meta(p_urls text[])
returns table (url text, title text, alt_text text, caption text)
language sql stable security definer set search_path = public as $$
  select m.url, m.title, m.alt_text, m.caption from media m
  where m.url = any (p_urls[1:40]) and (m.title <> '' or m.alt_text <> '' or m.caption <> '');
$$;
revoke all on function public.media_meta(text[]) from public;
grant execute on function public.media_meta(text[]) to anon, authenticated;

-- The website (round 118) expects database version 46. (Run round116-news.sql and round117-team-headers.sql first if you have not yet.)
create or replace function public.schema_version() returns int language sql immutable as $$ select 46 $$;
grant execute on function public.schema_version() to anon, authenticated;
