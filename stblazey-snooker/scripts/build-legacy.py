#!/usr/bin/env python3
"""
Builds supabase/legacy/*.sql (one file per season) from real-data/legacy/ (written by scripts/extract-old-site.py).

The SQL adds the league's past seasons to the database — it never removes or changes what is already there:
  · every past season (2018-19 to 2025-26; 2020-21 had no league because of covid)
  · the teams and venues of those years that no longer play (as past teams)
  · every player who played in those years and isn't on today's list (as "Not playing")
  · every league match with its final score, the scorecards frame by frame and the breaks
  · the bye weeks
  · the cup competitions the old website has a bracket for (2023-24 onwards), round by round
  · this season (2026-27): the results the old website has that are still "Not updated yet" here
Run it once, after schema.sql and real-league.sql.
"""
import csv, json, os, re, collections

ROOT = os.path.join(os.path.dirname(__file__), "..")
DATA = os.path.join(ROOT, "real-data", "legacy")
PAST = ["2018-2019", "2019-2020", "2021-2022", "2022-2023", "2023-2024", "2024-2025", "2025-2026"]
CURRENT = "2026-2027"
LEAGUE_SLUG = {"Victory League": "victory-league", "Rees Memorial League": "rees-memorial-league"}
# Venue names on the old website → the venue on the new one (None = no venue).
VENUE = {"Gorran Haven Snoooker Club": "Gorran Haven Snooker Club", "Lostwithiel": "Lostwithiel Social Club",
         "Lostwithiel social club": "Lostwithiel Social Club", "No Club": None, "Bye": None, "Rees Bye": None, "": None}
# The competitions as the league runs them today (kind, handicap, best of) — keyed by the name on the old website.
COMP = {
    "Team Handicap": ("Team Handicap", "Team", True), "Rees League Singles": ("Rees Singles", "Singles", False),
    "Snooker Shoot Out": ("Shootout", "Singles", False), "Bill Toms": ("Bill Toms", "Singles", True),
    "Seniors": ("Seniors", "Singles", True), "Willie Thomas": ("Willie Thomas", "Singles", True),
    "Doubles": ("Doubles", "Doubles", False), "Singles": ("Singles", "Singles", False),
    "Handicap Doubles": ("Handicap Doubles", "Doubles", True), "Team Pairs": ("Team Pairs", "Doubles", False),
    "Gordon Boynton Trophy": ("GB Trophy", "Other", False),
}

def rows(path):
    return list(csv.DictReader(open(path))) if os.path.exists(path) else []
def q(v):
    if v is None or v == "": return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"
def values(rs): return ",\n".join("  (" + ", ".join(q(x) for x in r) + ")" for r in rs)
def slugify(t): return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", re.sub(r"['’`]", "", t.lower())))
def venue(name):
    return VENUE.get(name, name) if name in VENUE else name

notes = []
fixtures, frames, breaks, byes, teams_seen = [], [], [], [], {}
player_names = set()
for season in PAST + [CURRENT]:
    d = os.path.join(DATA, season)
    fx = rows(os.path.join(d, "fixtures.csv"))
    if season == CURRENT: fx = [f for f in fx if f["Score"]]           # only results, to fill in what's missing
    for f in fx:
        fixtures.append((season, LEAGUE_SLUG[f["League"]], f["Date"], f["Time"] or "19:30", f["Home"], f["Away"], venue(f["Venue"]),
                         int(f["Score"].split("-")[0]) if f["Score"] else None, int(f["Score"].split("-")[1]) if f["Score"] else None))
        for t in (f["Home"], f["Away"]): teams_seen[t] = (f["League"], season)
    keyset = {(f["Date"], f["Home"], f["Away"]) for f in fx}
    for r in rows(os.path.join(d, "frames.csv")):
        if (r["Date"], r["Home"], r["Away"]) not in keyset: continue
        hp, ap = int(r["Home points"]), int(r["Away points"])
        frames.append((season, r["Date"], r["Home"], r["Away"], int(r["Frame"]), r["Home player"] or None, r["Home ext"] == "1", hp,
                       r["Away player"] or None, r["Away ext"] == "1", ap))
        for side, who, pts, cell in (("home", r["Home player"], hp, r["Home breaks"]), ("away", r["Away player"], ap, r["Away breaks"])):
            if who: player_names.add(who)
            for v in map(int, cell.split()):
                if not who: continue
                if v > pts:
                    notes.append(f"{season}: {r['Date']} {r['Home']} v {r['Away']} frame {r['Frame']} — {who}'s break of {v} is more than his frame score ({pts}): left out.")
                    continue
                breaks.append((season, r["Date"], r["Home"], r["Away"], int(r["Frame"]), who, v))
    if season != CURRENT:
        for b in rows(os.path.join(d, "byes.csv")):
            byes.append((season, LEAGUE_SLUG[b["League"]], b["Team"], b["Date"]))
            teams_seen.setdefault(b["Team"], (b["League"], season))

# ── cup brackets of the past seasons
competitions, entries, cmatches = [], [], []
for season in PAST:
    for c in json.load(open(os.path.join(DATA, season, "competitions.json"))):
        title = c["title"]
        base = re.sub(r"\s*(\d{4}(-\d{4})?)(\s*-\s*Preliminary)?$", "", title).strip()
        prelim = "Preliminary" in title
        if base not in COMP:
            notes.append(f"{season}: competition “{title}” isn't one the league runs today — left out."); continue
        name, kind, handicap = COMP[base]
        if prelim: name += " – Preliminary"
        shootout = base == "Snooker Shoot Out"
        slug = slugify(f"{name} {season}")
        competitions.append((slug, name, season, kind, handicap, 1 if shootout else 5, len(competitions) + 1))
        seen = {}
        for m in c["matches"]:
            for side in ("a", "b"):
                e = m[side]
                if e and e["old_id"] not in seen:
                    seen[e["old_id"]] = f"{slug}#{len(seen) + 1}"
                    entries.append((slug, seen[e["old_id"]], e["name"], e["kind"]))
                    if e["kind"] == "player": player_names.add(e["name"])
        for m in c["matches"]:
            sa, sb, pa, pb = m["score_a"], m["score_b"], m["points_a"], m["points_b"]
            if shootout and sa is not None and sb is not None and (sa > 1 or sb > 1):
                pa, pb = sa, sb; sa, sb = (1, 0) if pa > pb else (0, 1) if pb > pa else (None, None)
            done = sa is not None and sb is not None and (sa or sb) and m["a"] and m["b"]
            if done and sa == sb and (pa is None or pb is None or pa == pb):
                notes.append(f"{season}: “{title}” round {m['round']}: {m['a']['name']} v {m['b']['name']} level at {sa}-{sb} with no points to decide it — the score is kept, the next round shows who went through.")
            cmatches.append((slug, m["round"], m["slot"], seen.get((m["a"] or {}).get("old_id")), seen.get((m["b"] or {}).get("old_id")),
                             sa if done else None, sb if done else None, pa if done else None, pb if done else None,
                             "completed" if done else "scheduled", m["starts_at"]))

# Teams that no longer play: the league they last played in.
team_rows = sorted((t, LEAGUE_SLUG[l]) for t, (l, s) in teams_seen.items())
venues = sorted({f[6] for f in fixtures if f[6]})
seasons = PAST


# ── the SQL, split into small files (one per season), so each pastes easily into Supabase's SQL editor ──
HEAD = lambda title, what: f"""-- ─────────────────────────────────────────────────────────────
--  THE LEAGUE'S PAST SEASONS — {title}
--  Generated by scripts/build-legacy.py from real-data/legacy/ (read from Rich's export of the old
--  WordPress database, 19 October 2026). Run the files in supabase/legacy/ in order, each once:
--  Supabase → SQL Editor → New query → paste the whole file → Run. Wait for "Success" before the next.
--  schema.sql (database version 20) and real-league.sql must have been run first.
--
{what}
--  Only adds — nothing already on the website is removed or changed. One transaction: if a check
--  fails, nothing is changed. Running it again does nothing.
-- ─────────────────────────────────────────────────────────────
begin;

do $$ begin
  if (select public.schema_version()) < 20 then raise exception 'Run supabase/schema.sql first (database version 20).'; end if;
  if not exists (select 1 from seasons where name = {q(CURRENT)}) then raise exception 'Load supabase/real-league.sql first.'; end if;
end $$;
"""
SETUP = HEAD("1. seasons, teams, venues and players", f"""--  Adds the {len(seasons)} past seasons ({", ".join(seasons)}; 2020-21 had no league: covid),
--  the teams and venues of those years that no longer play, and the {len(player_names)} players of those years
--  (anyone not on today's list comes in as "Not playing").""") + f"""
insert into seasons (name, is_current)
  select r.name, false from (values
{values([(s_,) for s_ in seasons])}) r(name) where not exists (select 1 from seasons s where s.name = r.name);

create temp table _venues (name text) on commit drop;
insert into _venues values
{values([(v,) for v in venues])};
insert into venues (name, slug)
  select r.name, public.slugify(r.name) from _venues r where not exists (select 1 from venues v where lower(v.name) = lower(r.name));

-- Teams that no longer play come in as past teams (kept for the history, in no list for this season).
create temp table _teams (name text, league_slug text) on commit drop;
insert into _teams values
{values(team_rows)};
insert into teams (name, slug, league_id, active)
  select r.name, public.slugify(r.name), l.id, false from _teams r join leagues l on l.slug = r.league_slug
  where not exists (select 1 from teams t where lower(t.name) = lower(r.name));

create temp table _people (full_name text) on commit drop;
insert into _people values
{values(sorted((p_,) for p_ in player_names))};
insert into players (full_name, team_id, position, handicap, status)
  select r.full_name, null, 'Player', null, 'not_playing' from _people r
  where not exists (select 1 from players p where lower(p.full_name) = lower(r.full_name))
  order by r.full_name;

do $$ begin
  raise notice 'Done: % seasons, % teams, % players. Now run the next file.', (select count(*) from seasons), (select count(*) from teams), (select count(*) from players);
end $$;
commit;
"""

def season_sql(season, catchup=False):
    fx = [f for f in fixtures if f[0] == season]
    fr = [f for f in frames if f[0] == season]
    br = [b for b in breaks if b[0] == season]
    by = [b for b in byes if b[0] == season]
    cs = [c for c in competitions if c[2] == season]
    slugs = {c[0] for c in cs}
    en = [e for e in entries if e[0] in slugs]
    cm = [m for m in cmatches if m[0] in slugs]
    what = (f"--  This season ({season}): the {len(fx)} results the old website has, for the matches that are still\n"
            f"--  \"Not updated yet\" here (a match that already has a result on the new website is left alone).") if catchup else (
            f"--  {season}: {len(fx)} league matches with their final scores, {len(fr)} frames, {len(br)} breaks, {len(by)} bye weeks"
            + (f",\n--  and {len(cs)} cup competitions round by round ({sum(1 for m in cm if m[9] == 'completed')} results)." if cs else "."))
    out = HEAD(f"{'this season' if catchup else season}", what)
    out += f"""
do $$ begin
  if not exists (select 1 from seasons where name = {q(season)}) then raise exception 'Run the first file (01-seasons-teams-players.sql) first.'; end if;
  {'' if catchup else f"if exists (select 1 from fixtures f join seasons s on s.id = f.season_id where s.name = {q(season)}) then raise exception '{season} is already in: nothing to do.'; end if;"}
end $$;

create temp table _fixtures (season text, league_slug text, day date, kick_off time, home text, away text, venue text, home_score int, away_score int) on commit drop;
insert into _fixtures values
{values(fx)};
"""
    if catchup:
        out += f"""-- Only the matches still waiting for their result here.
create temp table _fx on commit drop as
  select f.id, r.season, r.day, r.home, r.away, r.home_score, r.away_score from _fixtures r
  join seasons s on s.name = r.season join teams h on lower(h.name) = lower(r.home) join teams a on lower(a.name) = lower(r.away)
  join fixtures f on f.season_id = s.id and f.home_team_id = h.id and f.away_team_id = a.id
    and (f.starts_at at time zone 'Europe/London')::date = r.day
  where f.status = 'scheduled' and not exists (select 1 from frames x where x.fixture_id = f.id);
update fixtures f set status = 'approved', home_score = c.home_score, away_score = c.away_score from _fx c where f.id = c.id;
"""
    else:
        out += f"""insert into fixtures (season_id, league_id, home_team_id, away_team_id, venue_id, starts_at, status, home_score, away_score)
  select s.id, l.id, h.id, a.id, v.id, (r.day + r.kick_off) at time zone 'Europe/London', 'approved', r.home_score, r.away_score
  from _fixtures r join seasons s on s.name = r.season join leagues l on l.slug = r.league_slug
  join teams h on lower(h.name) = lower(r.home) join teams a on lower(a.name) = lower(r.away)
  left join venues v on lower(v.name) = lower(r.venue)
  order by r.day, r.league_slug, r.home;
create temp table _fx on commit drop as
  select f.id, s.name as season, (f.starts_at at time zone 'Europe/London')::date as day, h.name as home, a.name as away
  from fixtures f join seasons s on s.id = f.season_id join teams h on h.id = f.home_team_id join teams a on a.id = f.away_team_id
  where s.name = {q(season)};
"""
    out += f"""
create temp table _frames (season text, day date, home text, away text, frame_no int, home_player text, home_ext boolean, home_points int, away_player text, away_ext boolean, away_points int) on commit drop;
""" + (f"insert into _frames values\n{values(fr)};\n" if fr else "") + f"""insert into frames (fixture_id, frame_no, home_player_id, away_player_id, home_points, away_points, home_ext, away_ext)
  select x.id, r.frame_no, hp.id, ap.id, r.home_points, r.away_points, r.home_ext, r.away_ext
  from _frames r join _fx x on x.season = r.season and x.day = r.day and lower(x.home) = lower(r.home) and lower(x.away) = lower(r.away)
  left join lateral (select id from players p where lower(p.full_name) = lower(r.home_player) order by (p.status = 'playing') desc limit 1) hp on true
  left join lateral (select id from players p where lower(p.full_name) = lower(r.away_player) order by (p.status = 'playing') desc limit 1) ap on true;

create temp table _breaks (season text, day date, home text, away text, frame_no int, player text, value int) on commit drop;
""" + (f"insert into _breaks values\n{values(br)};\n" if br else "") + f"""insert into breaks (fixture_id, frame_no, player_id, value)
  select x.id, r.frame_no, p.id, r.value
  from _breaks r join _fx x on x.season = r.season and x.day = r.day and lower(x.home) = lower(r.home) and lower(x.away) = lower(r.away)
  join lateral (select id from players p where lower(p.full_name) = lower(r.player) order by (p.status = 'playing') desc limit 1) p on true;
"""
    if by:
        out += f"""
create temp table _byes (season text, league_slug text, team text, day date) on commit drop;
insert into _byes values
{values(by)};
insert into byes (season_id, league_id, team_id, bye_on)
  select s.id, l.id, t.id, r.day from _byes r join seasons s on s.name = r.season join leagues l on l.slug = r.league_slug
  join teams t on lower(t.name) = lower(r.team);
"""
    if cs:
        out += f"""
-- The cup competitions: every round as the old website had it, so the brackets look exactly as they did.
create temp table _comps (slug text, name text, season text, kind text, handicap boolean, best_of int, sort int) on commit drop;
insert into _comps values
{values(cs)};
insert into competitions (name, slug, season_id, kind, handicap, best_of, sort)
  select r.name, r.slug, s.id, r.kind, r.handicap, r.best_of, r.sort from _comps r join seasons s on s.name = r.season
  where not exists (select 1 from competitions c where c.slug = r.slug);
create temp table _entries (comp_slug text, ref text, name text, kind text) on commit drop;
insert into _entries values
{values(en)};
create temp table _entry_ids (ref text, id uuid) on commit drop;
with made as (
  insert into competition_entries (competition_id, name, team_id, player_id, seed)
  select c.id, r.name,
    case when r.kind = 'team' then (select id from teams t where lower(t.name) = lower(r.name) limit 1) end,
    case when r.kind = 'player' then (select id from players p where lower(p.full_name) = lower(r.name) order by (p.status = 'playing') desc limit 1) end,
    split_part(r.ref, '#', 2)::int
  from _entries r join competitions c on c.slug = r.comp_slug
  returning id, competition_id, seed)
insert into _entry_ids select c.slug || '#' || m.seed, m.id from made m join competitions c on c.id = m.competition_id;
create temp table _cmatches (comp_slug text, round int, slot int, ref_a text, ref_b text, score_a int, score_b int, points_a int, points_b int, status text, starts_at text) on commit drop;
insert into _cmatches values
{values(cm)};
insert into competition_matches (competition_id, round, slot, entry_a, entry_b, score_a, score_b, points_a, points_b, status, starts_at)
  select c.id, r.round, r.slot, ea.id, eb.id, r.score_a, r.score_b, r.points_a, r.points_b, r.status,
    case when r.starts_at is not null and r.starts_at not like '0000%' then (r.starts_at::timestamp at time zone 'Europe/London') end
  from _cmatches r join competitions c on c.slug = r.comp_slug
  left join _entry_ids ea on ea.ref = r.ref_a left join _entry_ids eb on eb.ref = r.ref_b;
"""
    out += f"""
do $$
declare n int; want int;
begin
  {'' if catchup else f"select count(*) into n from fixtures f join seasons s on s.id = f.season_id where s.name = {q(season)};" + chr(10) + f"  if n <> {len(fx)} then raise exception 'Expected {len(fx)} matches, found %. Nothing has been changed.', n; end if;"}
  select count(*) into n from frames fr join _fx x on x.id = fr.fixture_id;
  select count(*) into want from _frames r join _fx x on x.season = r.season and x.day = r.day and lower(x.home) = lower(r.home) and lower(x.away) = lower(r.away);
  if n <> want then raise exception 'Not every frame found its match (% of %). Nothing has been changed.', n, want; end if;
  raise notice 'Done: {'this season: % results filled in' if catchup else season + ': % matches'}, % frames, % breaks.', (select count(*) from _fx), n, (select count(*) from breaks b join _fx x on x.id = b.fixture_id);
end $$;
commit;
"""
    return out

folder = os.path.join(ROOT, "supabase", "legacy")
os.makedirs(folder, exist_ok=True)
for f in os.listdir(folder): os.remove(os.path.join(folder, f))
open(os.path.join(folder, "01-seasons-teams-players.sql"), "w").write(SETUP)
for n, season in enumerate(seasons, 2):
    open(os.path.join(folder, f"{n:02d}-{season}.sql"), "w").write(season_sql(season))
open(os.path.join(folder, f"{len(seasons) + 2:02d}-this-season-results.sql"), "w").write(season_sql(CURRENT, catchup=True))
if notes:
    with open(os.path.join(DATA, "NOTES.md"), "a") as f:
        f.write("\n## Found while building the SQL\n\n" + "".join(f"- {n}\n" for n in notes))
print(f"Wrote supabase/legacy/ ({len(seasons) + 2} files): {len(fixtures)} matches, {len(frames)} frames, {len(breaks)} breaks, {len(byes)} byes, "
      f"{len(competitions)} competitions, {len(entries)} entries, {len(cmatches)} cup matches, {len(player_names)} player names, {len(team_rows)} teams; {len(notes)} notes")
