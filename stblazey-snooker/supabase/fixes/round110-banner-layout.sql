-- Round 110: Site settings would not save ("new row for relation "settings" violates check constraint
-- "settings_hero_layout_check"") because the database only knew the old banner layouts.
-- Run once in Supabase → SQL Editor. Safe to run again.
alter table settings drop constraint if exists settings_hero_layout_check;
alter table settings add constraint settings_hero_layout_check
  check (hero_layout in ('side', 'big', 'text', 'white', 'auto', 'card', 'full', 'split'));
