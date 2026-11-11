-- Round 111 (Rich's feedback 111): the welcome set-up for first-time visitors.
-- Run this once in Supabase → SQL Editor (schema.sql has the same change, for a fresh database).
--
-- People can now follow competitions as well as teams and players (My Snooker settings and the welcome set-up),
-- so My Snooker's saved choices keep a list of competitions too.
-- Nothing else in the database changes: the welcome set-up's settings are kept with the home page settings,
-- and the new logins people make themselves are ordinary Player logins (netlify/functions/signup.mjs).

create or replace function public.set_my_prefs(p_on boolean, p_prefs jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare p jsonb := coalesce(p_prefs, '{}'::jsonb); v_teams jsonb; v_players jsonb; v_cats jsonb; v_comps jsonb; v_place text; v_out jsonb;
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
  -- Round 111: competitions they follow (the welcome set-up and My Snooker settings) — only ones on the website, at most 20.
  select coalesce(jsonb_agg(x.id order by x.n), '[]'::jsonb) into v_comps from (
    select c.id, min(e.n) as n from jsonb_array_elements_text(case when jsonb_typeof(p->'comps') = 'array' then p->'comps' else '[]'::jsonb end) with ordinality e(v, n)
      join competitions c on c.id::text = e.v group by c.id order by 2 limit 20) x;
  v_place := case when p->>'place' in ('page', 'home', 'both') then p->>'place' else 'page' end;
  v_out := jsonb_build_object('place', v_place, 'teams', v_teams, 'players', v_players, 'cats', v_cats, 'comps', v_comps);
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

-- Officers who look after the newsletter can switch the home page's newsletter box on and off (the rest of the home page stays the Master Admin's).
create or replace function public.guard_home_layout() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- (the phone menu style, the welcome guide and — round 111 — the newsletter box are kept in home_sections too, but aren't the home page's layout)
  if ((new.home_sections - 'menu_style' - 'guide_on' - 'newsletter_box') is distinct from (old.home_sections - 'menu_style' - 'guide_on' - 'newsletter_box')
      or new.home_style is distinct from old.home_style
      or new.page_text is distinct from old.page_text)
     and auth.uid() is not null and not public.is_master() then
    raise exception 'Only the Master Admin can change the home page layout or the wording on the pages';
  end if;
  return new;
end;
$$;
drop trigger if exists settings_home_layout on settings;
create trigger settings_home_layout before update on settings for each row execute function public.guard_home_layout();
