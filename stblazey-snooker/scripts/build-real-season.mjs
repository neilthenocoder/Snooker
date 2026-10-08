// Builds supabase/real-season-2026-27.sql from the files in real-data/2026-27/.
// Run with:  npm run real-season      (only needed if you change one of those files)
//
// The SQL it writes takes the sample league out of the database and puts the real
// 2026-27 season in: players (with their CueViews), every fixture, the bye weeks,
// and every scorecard played so far. Teams, venues and leagues are kept (so their
// emblems stay) and only brought up to date.
import { readFileSync, writeFileSync } from "node:fs";

const DATA = new URL("../real-data/2026-27/", import.meta.url);
const read = (name) => readFileSync(new URL(name, DATA), "utf8").replace(/^﻿/, "");

/** CSV text → [{ heading: value }] (quoted cells and commas inside quotes are understood). */
function csv(name) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const text = read(name).replace(/\r\n?/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const SEASON = "2026-2027";
const LEAGUES = [
  { name: "Victory League", short: "Victory", slug: "victory-league", sort: 1 },
  { name: "Rees Memorial League", short: "Rees", slug: "rees-memorial-league", sort: 2 },
];
const leagueSlug = (name) => LEAGUES.find((l) => l.name === name)?.slug ?? fail(`Unknown league "${name}"`);
const slugify = (t) => t.toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function fail(message) { throw new Error(message); }

// ── read the files ────────────────────────────────────────────
const teams = csv("teams.csv").map((t) => ({ name: t.Team, league: leagueSlug(t.League), venue: t.Venue }));
const venueNames = [...new Set(teams.map((t) => t.venue))];
const venueInfo = Object.fromEntries(csv("venues.csv").map((v) => [v.Venue, v]));
const cueviews = JSON.parse(read("cueviews.json"));
const handicap = (text) => (/^-?\d+$/.test(text) ? Number(text) : 0);       // no handicap on record → 0

const players = [
  ...csv("players.csv").map((p) => ({ name: p.Name, team: p.Team, position: p.Position, handicap: handicap(p.Handicap), status: "playing" })),
  ...csv("players-without-a-team.csv").map((p) => ({ name: p.Name, team: null, position: "Player", handicap: handicap(p.Handicap), status: "no_team" })),
].map((p) => {
  const { bio = null, ...answers } = cueviews[p.name] ?? {};
  return { ...p, cueview: answers, bio };
});
const teamNames = new Set(teams.map((t) => t.name));
const playerNames = new Set();
for (const p of players) {
  if (playerNames.has(p.name.toLowerCase())) fail(`"${p.name}" is in the player files twice`);
  playerNames.add(p.name.toLowerCase());
  if (p.team && !teamNames.has(p.team)) fail(`${p.name}: no team called "${p.team}"`);
}
for (const name of Object.keys(cueviews)) if (!playerNames.has(name.toLowerCase())) fail(`cueviews.json: no player called "${name}"`);

/** "22/09/2026" → "2026-09-22" */
const isoDay = (uk) => { const [d, m, y] = uk.split("/"); return `${y}-${m}-${d}`; };
const fixtures = csv("fixtures.csv")
  .map((f, i) => ({ i, league: leagueSlug(f.League), day: isoDay(f.Date), time: f.Time || "19:30", home: f.Home, away: f.Away, venue: f.Venue, score: f.Score, status: f.Status.toLowerCase() }))
  // Match numbers run in date order, Victory League first, then as the old website listed them.
  .sort((a, b) => a.day.localeCompare(b.day) || LEAGUES.findIndex((l) => l.slug === a.league) - LEAGUES.findIndex((l) => l.slug === b.league) || a.i - b.i)
  .map((f, n) => ({ ...f, code: `2627-${String(n + 1).padStart(2, "0")}` }));
const fixtureKey = (day, home, away) => `${day}|${home}|${away}`;
const fixtureBy = new Map(fixtures.map((f) => [fixtureKey(f.day, f.home, f.away), f]));
for (const f of fixtures) for (const t of [f.home, f.away]) if (!teamNames.has(t)) fail(`Fixture ${f.home} v ${f.away}: no team called "${t}"`);

// The old website wrote the extra player as "Ben Rothwell (Ext)" (a named player's second frame)
// or just "Extra Player" (nobody named).
function who(raw) {
  const m = raw.match(/^(.*?)\s*\(ext\)$/i);
  if (m) return { name: m[1].trim(), ext: true };
  if (/^extra player(\s*\d+)?$/i.test(raw)) return { name: null, ext: true };
  return { name: raw, ext: false };
}
const frames = [], breaks = [];
for (const r of csv("frames.csv")) {
  const fx = fixtureBy.get(fixtureKey(isoDay(r.Date), r.Home, r.Away)) ?? fail(`frames.csv: no fixture ${r.Home} v ${r.Away} on ${r.Date}`);
  const home = who(r["Home player"]), away = who(r["Away player"]);
  for (const p of [home, away]) if (p.name && !playerNames.has(p.name.toLowerCase())) fail(`frames.csv: no player called "${p.name}"`);
  const no = Number(r.Frame);
  frames.push({ code: fx.code, no, home, away, hp: Number(r["Home points"]), ap: Number(r["Away points"]) });
  for (const [side, cell] of [[home, r["Home breaks"]], [away, r["Away breaks"]]])
    for (const value of cell.match(/\d+/g) ?? []) breaks.push({ code: fx.code, no, name: side.name ?? fail("A break needs a named player"), value: Number(value) });
}
// A played fixture's score must be what its frames add up to.
for (const f of fixtures.filter((x) => x.score)) {
  const mine = frames.filter((r) => r.code === f.code);
  const got = `${mine.filter((r) => r.hp > r.ap).length}-${mine.filter((r) => r.ap > r.hp).length}`;
  if (got !== f.score) fail(`${f.home} v ${f.away} (${f.day}): fixtures.csv says ${f.score}, the frames make it ${got}`);
}
const byes = csv("byes.csv").map((b) => ({ league: leagueSlug(b.League), team: teamNames.has(b.Team) ? b.Team : fail(`byes.csv: no team called "${b.Team}"`), day: isoDay(b.Date) }));

// The eleven knockout competitions of 2026-27 and the notes on each one's page on the old website.
// (The draws themselves are not brought across: they are made in Admin → Draws & results.)
const CONTACT_OCT = "Home player to contact by 16th October. Games to be played by 6th November.";
const CONTACT_DEC = "Home player to contact by 30th October. Games to be played by 30th December.";
const AWAY_5 = " Away player receives 5 extra points.";
const competitions = [
  { name: "Team Handicap", kind: "Team", handicap: true, info: "To be played on Tuesday 20th October." },
  { name: "Rees Singles", kind: "Singles", handicap: false, rees: true, info: CONTACT_DEC },
  { name: "Shootout", kind: "Singles", handicap: false, best_of: 1, info: null },
  { name: "Bill Toms", kind: "Singles", handicap: true, info: CONTACT_OCT + AWAY_5 },
  { name: "Seniors", kind: "Singles", handicap: true, info: CONTACT_OCT + AWAY_5 },
  { name: "Willie Thomas", kind: "Singles", handicap: true, info: CONTACT_DEC + AWAY_5 },
  { name: "Doubles", kind: "Doubles", handicap: false, info: CONTACT_DEC },
  { name: "Singles", kind: "Singles", handicap: false, info: CONTACT_OCT },
  { name: "Handicap Doubles", kind: "Doubles", handicap: true, info: CONTACT_DEC },
  { name: "Team Pairs", kind: "Doubles", handicap: false, info: null },
  { name: "GB Trophy", kind: "Other", handicap: false, info: null },
];

// ── write the SQL ─────────────────────────────────────────────
const q = (v) => (v === null || v === undefined ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v)
  : typeof v === "object" ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`);
const values = (rows) => rows.map((r) => `  (${r.map(q).join(", ")})`).join(",\n");
const SAMPLE = "'00000000-0000-4000-8000-%'";
// Text the sample league came with (nothing here was ever true): only removed where it is still exactly this.
const SAMPLE_VENUE_TEXT = [
  "Friendly working men's club with a full size match table.", "Village institute hosting league snooker every week of the season.",
  "Harbour-side social club with two match tables.", "Community social club welcoming visiting teams.",
  "Clubhouse snooker room at the football ground.", "Moorland village club with a single match table.",
  "Long-standing league venue with three tables.", "Placeholder venue — edit in the admin dashboard.",
];

const played = fixtures.filter((f) => f.score).length;
const sql = `-- ─────────────────────────────────────────────────────────────
--  THE REAL 2026-27 SEASON
--  Takes the sample league out and puts the real one in.
--  Generated by scripts/build-real-season.mjs from real-data/2026-27/.
--
--  How to run it (once):
--    1. Supabase → SQL Editor → run all of supabase/schema.sql   (it adds the bye-weeks table)
--    2. New query → paste this whole file → Run
--
--  What it REMOVES
--    · every fixture, scorecard and break in the database (all of them are sample or test results)
--    · every sample player
--    · every season except ${SEASON}
--    · the sample competition draws and results, and test matches on the live scoreboard
--
--  What it KEEPS
--    · the teams, venues and leagues, with the emblems and pictures you have added
--      (only their details are brought up to date)
--    · players you added yourself, logins, news, pages, sponsors, the image library, settings and branding
--
--  What it ADDS
--    · ${players.filter((p) => p.team).length} players in their ${teams.length} teams, and ${players.filter((p) => !p.team).length} players the old website lists without a team
--    · the CueView answers of the ${Object.keys(cueviews).length} players who have any
--    · all ${fixtures.length} league fixtures and the ${byes.length} bye weeks
--    · the ${played} matches played so far, frame by frame (${frames.length} frames, ${breaks.length} breaks)
--    · the ${competitions.length} competitions of ${SEASON}, without their draws
--
--  It is all one transaction: if anything goes wrong, nothing is changed.
--  Running it a second time puts the season back exactly as it is in the files —
--  so DON'T run it again once captains have started entering results on the website.
-- ─────────────────────────────────────────────────────────────
begin;

do $$ begin
  if to_regclass('public.byes') is null then
    raise exception 'Run supabase/schema.sql first (it adds the bye-weeks table), then run this file again.';
  end if;
end $$;

-- ── 1. the sample and test data comes out ─────────────────────
delete from live_matches;
delete from competition_signups;
delete from competition_matches;   -- their frames and breaks go with them
delete from competition_entries;
delete from byes;
delete from fixtures;              -- every league match; frames and breaks go with them
delete from players where id::text like ${SAMPLE};
-- The home page's "player of the week" and "team of the week" were sample ones.
update settings set player_of_week_show = false, player_of_week_text = null where player_of_week_id is null;
update settings set team_of_week_show = false, team_of_week_id = null, team_of_week_text = null
  where team_of_week_text = 'A five-frame whitewash in their first home match.';

-- ── 2. one season: ${SEASON} ────────────────────────────────
insert into seasons (name, is_current) select ${q(SEASON)}, true where not exists (select 1 from seasons where name = ${q(SEASON)});
update seasons set is_current = (name = ${q(SEASON)}) where is_current is distinct from (name = ${q(SEASON)});
update competitions set season_id = (select id from seasons where name = ${q(SEASON)});
delete from seasons where name <> ${q(SEASON)};

-- ── 3. leagues, venues and teams: kept, and brought up to date ─
create temp table _leagues (name text, short_name text, slug text, sort int) on commit drop;
insert into _leagues values
${values(LEAGUES.map((l) => [l.name, l.short, l.slug, l.sort]))};
insert into leagues (name, short_name, slug, sort)
  select r.name, r.short_name, r.slug, r.sort from _leagues r where not exists (select 1 from leagues l where l.slug = r.slug);
-- Who held each shield when the season started was sample data too: set it under Admin → Leagues.
update leagues set shield_team_id = null where id::text like ${SAMPLE};

-- Two venues had stand-in names in the sample league.
update venues set name = 'Gorran Haven Snooker Club', slug = 'gorran-haven-snooker-club'
  where name = 'Gorran Haven Club' and not exists (select 1 from venues where name = 'Gorran Haven Snooker Club');
update venues set name = 'Lerryn Community Centre', slug = 'lerryn-community-centre'
  where name = 'Lerryn Memorial Hall' and not exists (select 1 from venues where name = 'Lerryn Community Centre');
create temp table _venues (name text, slug text, address text) on commit drop;
insert into _venues values
${values(venueNames.map((n) => [n, slugify(n), venueInfo[n]?.Address || null]))};
insert into venues (name, slug)
  select r.name, r.slug from _venues r where not exists (select 1 from venues v where lower(v.name) = lower(r.name));
-- The sample addresses and descriptions were made up: they go (anything you have typed in yourself stays).
update venues set address = null where address like '%Placeholder Road%';
update venues set description = null where description in (${SAMPLE_VENUE_TEXT.map(q).join(", ")});
update venues v set address = r.address from _venues r where lower(v.name) = lower(r.name) and r.address is not null and nullif(v.address, '') is null;
update venues set description = 'Opening times: Monday to Thursday 7pm–11pm, Friday 7pm–midnight, Saturday midday–midnight, Sunday midday–10.30pm.'
  where name = 'Bugle Working Mens Club' and nullif(description, '') is null;

create temp table _teams (name text, league_slug text, venue text) on commit drop;
insert into _teams values
${values(teams.map((t) => [t.name, t.league, t.venue]))};
insert into teams (name, slug, league_id, venue_id)
  select r.name, public.slugify(r.name), l.id, v.id from _teams r
  join leagues l on l.slug = r.league_slug join venues v on lower(v.name) = lower(r.venue)
  where not exists (select 1 from teams t where lower(t.name) = lower(r.name));
update teams t set league_id = l.id, venue_id = v.id, active = true from _teams r
  join leagues l on l.slug = r.league_slug join venues v on lower(v.name) = lower(r.venue)
  where lower(t.name) = lower(r.name) and (t.league_id is distinct from l.id or t.venue_id is distinct from v.id or t.active is not true);

-- ── 4. the players ────────────────────────────────────────────
-- "team" is empty for the players the old website lists without a team: they come in as
-- "No team at the moment" (still on the Handicaps page and in entry forms, in no squad).
-- A handicap of 0 with no handicap on the old site is listed in NOTES-from-the-old-site.md.
create temp table _players (full_name text, team text, position text, handicap int, status text, cueview jsonb, bio text) on commit drop;
insert into _players values
${values(players.map((p) => [p.name, p.team, p.position, p.handicap, p.status, p.cueview, p.bio]))};
-- Anyone already there under the same name (added by hand) is kept and brought up to date;
-- their own CueView and bio are left alone if they have any.
update players p set team_id = t.id, position = r.position, handicap = r.handicap, status = r.status,
    cueview = case when p.cueview = '{}'::jsonb then r.cueview else p.cueview end, bio = coalesce(nullif(p.bio, ''), r.bio), needs_review = false
  from _players r left join teams t on lower(t.name) = lower(r.team)
  where lower(p.full_name) = lower(r.full_name);
insert into players (full_name, team_id, position, handicap, status, cueview, bio)
  select r.full_name, t.id, r.position, r.handicap, r.status, r.cueview, r.bio
  from _players r left join teams t on lower(t.name) = lower(r.team)
  where not exists (select 1 from players p where lower(p.full_name) = lower(r.full_name))
  order by r.full_name;

-- ── 5. the fixtures ───────────────────────────────────────────
create temp table _fixtures (code text, league_slug text, day date, kick_off time, home text, away text, venue text, status text) on commit drop;
insert into _fixtures values
${values(fixtures.map((f) => [f.code, f.league, f.day, f.time, f.home, f.away, f.venue, f.status]))};
insert into fixtures (season_id, league_id, home_team_id, away_team_id, venue_id, starts_at, status, code)
  select s.id, l.id, h.id, a.id, v.id, (r.day + r.kick_off) at time zone 'Europe/London', r.status, r.code
  from _fixtures r
  join seasons s on s.name = ${q(SEASON)} join leagues l on l.slug = r.league_slug
  join teams h on lower(h.name) = lower(r.home) join teams a on lower(a.name) = lower(r.away)
  left join venues v on lower(v.name) = lower(r.venue)
  order by r.code;

-- Bye weeks (the Rees Memorial League has nine teams, so one sits out each match night).
create temp table _byes (league_slug text, team text, day date) on commit drop;
insert into _byes values
${values(byes.map((b) => [b.league, b.team, b.day]))};
insert into byes (season_id, league_id, team_id, bye_on)
  select s.id, l.id, t.id, r.day from _byes r
  join seasons s on s.name = ${q(SEASON)} join leagues l on l.slug = r.league_slug join teams t on lower(t.name) = lower(r.team);

-- ── 6. the scorecards played so far ───────────────────────────
-- A player with ext = true played that frame as the team's extra player; no name = an unnamed stand-in.
create temp table _frames (code text, frame_no int, home_player text, home_ext boolean, home_points int, away_player text, away_ext boolean, away_points int) on commit drop;
insert into _frames values
${values(frames.map((r) => [r.code, r.no, r.home.name, r.home.ext, r.hp, r.away.name, r.away.ext, r.ap]))};
insert into frames (fixture_id, frame_no, home_player_id, away_player_id, home_points, away_points, home_ext, away_ext)
  select f.id, r.frame_no, hp.id, ap.id, r.home_points, r.away_points, r.home_ext, r.away_ext
  from _frames r join fixtures f on f.code = r.code
  left join players hp on lower(hp.full_name) = lower(r.home_player)
  left join players ap on lower(ap.full_name) = lower(r.away_player);

create temp table _breaks (code text, frame_no int, player text, value int) on commit drop;
insert into _breaks values
${values(breaks.map((b) => [b.code, b.no, b.name, b.value]))};
insert into breaks (fixture_id, frame_no, player_id, value)
  select f.id, r.frame_no, p.id, r.value from _breaks r join fixtures f on f.code = r.code join players p on lower(p.full_name) = lower(r.player);

-- ── 7. the competitions of ${SEASON} (no draws yet) ───────────
create temp table _competitions (name text, kind text, handicap boolean, best_of int, rees_only boolean, info text, sort int) on commit drop;
insert into _competitions values
${values(competitions.map((c, i) => [c.name, c.kind, c.handicap, c.best_of ?? 5, !!c.rees, c.info, i + 1]))};
-- Sample competitions the league doesn't run (the sample plate, for one) go.
delete from competitions c where c.id::text like ${SAMPLE} and not exists (select 1 from _competitions r where lower(r.name) = lower(c.name));
-- The ones already there keep their pictures, trophies and entry-form settings; the sample draw record,
-- notes and round dates they came with are replaced.
update competitions c set kind = r.kind, handicap = r.handicap, best_of = r.best_of, sort = r.sort, draw_live = null,
    league_ids = case when r.rees_only then (select jsonb_build_array(id) from leagues where slug = 'rees-memorial-league') else '[]'::jsonb end,
    info = case when c.info is null or c.info like '%Placeholder text%' then r.info else c.info end,
    round_deadlines = case when c.id::text like ${SAMPLE} then '{}'::jsonb else c.round_deadlines end
  from _competitions r where lower(c.name) = lower(r.name);
insert into competitions (name, slug, season_id, kind, handicap, best_of, info, sort, league_ids)
  select r.name, public.slugify(r.name), (select id from seasons where name = ${q(SEASON)}), r.kind, r.handicap, r.best_of, r.info, r.sort,
    case when r.rees_only then (select jsonb_build_array(id) from leagues where slug = 'rees-memorial-league') else '[]'::jsonb end
  from _competitions r where not exists (select 1 from competitions c where lower(c.name) = lower(r.name));

-- ── 8. check it all arrived, or change nothing ────────────────
do $$
declare n int;
begin
  select count(*) into n from fixtures;
  if n <> ${fixtures.length} then raise exception 'Expected ${fixtures.length} fixtures, found %. Nothing has been changed.', n; end if;
  select count(*) into n from frames;
  if n <> ${frames.length} then raise exception 'Expected ${frames.length} frames, found % (is a player in the database twice under the same name?). Nothing has been changed.', n; end if;
  select count(*) into n from breaks;
  if n <> ${breaks.length} then raise exception 'Expected ${breaks.length} breaks, found %. Nothing has been changed.', n; end if;
  select count(*) into n from byes;
  if n <> ${byes.length} then raise exception 'Expected ${byes.length} bye weeks, found %. Nothing has been changed.', n; end if;
  select count(*) into n from _frames r
    where (r.home_player is not null and not exists (select 1 from players p where lower(p.full_name) = lower(r.home_player)))
       or (r.away_player is not null and not exists (select 1 from players p where lower(p.full_name) = lower(r.away_player)));
  if n <> 0 then raise exception '% frames name a player who is not in the players list. Nothing has been changed.', n; end if;
  select count(*) into n from _players r where not exists (select 1 from players p where lower(p.full_name) = lower(r.full_name));
  if n <> 0 then raise exception '% players did not arrive. Nothing has been changed.', n; end if;
  select count(*) into n from players p join teams t on t.id = p.team_id where p.status = 'playing';
  raise notice 'Done: % players in teams, % fixtures, % frames, % breaks, % bye weeks.', n,
    (select count(*) from fixtures), (select count(*) from frames), (select count(*) from breaks), (select count(*) from byes);
end $$;

commit;
`;

writeFileSync(new URL("../supabase/real-season-2026-27.sql", import.meta.url), sql);
console.log(`Wrote supabase/real-season-2026-27.sql: ${teams.length} teams, ${players.length} players (${players.filter((p) => p.team).length} in teams), ` +
  `${fixtures.length} fixtures (${played} played), ${frames.length} frames, ${breaks.length} breaks, ${byes.length} byes, ${competitions.length} competitions.`);
