// ─────────────────────────────────────────────────────────────
//  CSV IMPORT — reading spreadsheet files and working out what to
//  add. Pure functions only (no database, no HTML): the admin
//  screen in admin/import.js shows the plan and then saves it.
//
//  To add a column to an import, add one line to its `columns`
//  list below and use it in the matching plan function.
// ─────────────────────────────────────────────────────────────
import { slugify, londonISO } from "./schedule.js";
import { parseBreaks } from "./rules.js";
import { SITE } from "../config.js";

// ── reading a CSV file ─────────────────────────────────────────
/** Parse CSV text (commas, semicolons or tabs; quoted cells; Windows or Mac line endings). */
export function parseCsv(text) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const table = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); table.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); table.push(row); }
  const lines = table.filter((r) => r.some((x) => x.trim() !== ""));
  const headers = (lines.shift() ?? []).map((h) => h.trim());
  return { headers, rows: lines.map((r, i) => ({ line: i + 2, cells: Object.fromEntries(headers.map((h, j) => [h, (r[j] ?? "").trim()])) })) };
}

/** Rows → CSV text (used for the downloadable templates). */
export const toCsv = (rows) => rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\r\n");

// ── tidy-up helpers ────────────────────────────────────────────
export const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ");
const headerKey = (h) => norm(h).replace(/[^a-z0-9]/g, "");

/** "24/09/2019", "24-9-19", "2019-09-24" or "24 Sep 2019" → "2019-09-24" (UK day-first). */
export function parseDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (m) return iso(m[3].length === 2 ? `20${m[3]}` : m[3], m[2], m[1]);
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\.?,?\s+(\d{4})$/);
  const month = m && ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  return month ? iso(m[3], month, m[1]) : null;
}
function iso(y, m, d) {
  const [yy, mm, dd] = [Number(y), Number(m), Number(d)];
  const ok = mm >= 1 && mm <= 12 && dd >= 1 && dd <= new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  return ok ? `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : null;
}

/** "19:30", "7.30pm" or "7pm" → "19:30". */
export function parseTime(value) {
  const m = String(value ?? "").trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  return h < 24 && Number(m[2] ?? 0) < 60 ? `${String(h).padStart(2, "0")}:${m[2] ?? "00"}` : null;
}

/** "3-2", "3 - 2" or "3:2" → [3, 2]. */
export function parseScore(value) {
  const m = String(value ?? "").trim().match(/^(\d{1,2})\s*[-–:v]\s*(\d{1,2})$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
/**
 * The old website's way of writing the extra (Ext) player in a scorecard:
 * "Ben Rothwell (Ext)" is Ben Rothwell playing a second frame as the extra player;
 * "Extra Player" (or "Extra Player 2") is a stand-in nobody named. Returns { name, ext }.
 */
export function extraPlayer(raw) {
  const text = String(raw ?? "").trim();
  const m = text.match(/^(.*?)\s*\((?:ext|extra|extra player)\)$/i);
  if (m) return { name: m[1].trim(), ext: true };
  if (/^extra player(\s*\d+)?$/i.test(text)) return { name: "", ext: true };
  return { name: text, ext: false };
}
const wholeNumber = (v) => (/^[+-]?\d+$/.test(String(v).trim()) ? Number(v) : null);
const yes = (v) => /^(y|yes|true|1)$/i.test(String(v).trim());
const no = (v) => /^(n|no|false|0)$/i.test(String(v).trim());
const dayF = new Intl.DateTimeFormat("en-CA", { timeZone: SITE.timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
/** UK calendar day of a timestamp. */
const ukDay = (isoTime) => dayF.format(new Date(isoTime));

// ── what each import file looks like ───────────────────────────
// columns: [key, heading, required?, what to put in it, other headings that are also understood]
export const IMPORTS = {
  teams: {
    label: "Teams", hint: "Add the leagues first (Admin → Leagues). Venues that don't exist yet are created.",
    columns: [
      ["team", "Team", true, "Team name", ["name", "teamname"]],
      ["league", "League", true, "League name, exactly as in Admin → Leagues (or its short name)", ["leagues", "division"]],
      ["venue", "Venue", false, "Home venue (created if new)", ["home", "homevenue", "club"]],
      ["playing", "Playing", false, "No for a team from past seasons that no longer plays (default Yes)", ["active", "current"]],
    ],
    example: [["Bethel A", "Victory League", "Bethel Social Club", "Yes"], ["Old Town B", "Rees Memorial League", "Old Town Institute", "No"]],
  },
  players: {
    label: "Players", hint: "Import the teams first. A player who is already there (same name and team) is updated, not added twice.",
    columns: [
      ["name", "Name", true, "Player's full name", ["player", "fullname", "playername"]],
      ["team", "Team", false, "Their current team (leave empty for none)", ["teams", "currentteam", "club"]],
      ["position", "Position", false, "Player, Team Captain or Vice Captain (default Player)", ["positions", "role"]],
      ["handicap", "Handicap", false, "Whole number, e.g. 7 or -14 (default 0)", ["hcap", "hc"]],
      ["birthday", "Birthday", false, "Day first, e.g. 09/10/1972", ["dob", "dateofbirth", "birthdate"]],
    ],
    example: [["Sam Bolitho", "Bethel A", "Team Captain", "20", "09/10/1971"], ["Dave Polglase", "Bugle", "Player", "-5", ""]],
  },
  fixtures: {
    label: "Fixtures & results", hint: "For past seasons: one row per match with the final score. A new season is created if it isn't there yet; a team that no longer exists is created as a past team.",
    columns: [
      ["season", "Season", true, "e.g. 2019-2020", ["seasons", "year"]],
      ["league", "League", true, "League name, exactly as in Admin → Leagues", ["leagues", "division", "competition"]],
      ["date", "Date", true, "Day first, e.g. 24/09/2019", ["matchdate", "day"]],
      ["time", "Time", false, "e.g. 19:30 (default 19:30)", ["kickoff", "start"]],
      ["home", "Home", true, "Home team", ["hometeam"]],
      ["away", "Away", true, "Away team", ["awayteam", "visitors"]],
      ["venue", "Venue", false, "Leave empty to use the home team's venue", ["ground", "location"]],
      ["score", "Score", false, "Frames won, home first, e.g. 3-2 (or use the two columns below)", ["result", "results"]],
      ["home_score", "Home score", false, "Frames won by the home team", ["homeframes", "homeresult"]],
      ["away_score", "Away score", false, "Frames won by the away team", ["awayframes", "awayresult"]],
      ["status", "Status", false, "Approved, Scheduled or Postponed (default: Approved when there's a score)", ["state"]],
    ],
    example: [["2019-2020", "Victory League", "24/09/2019", "19:30", "Bethel A", "Bugle", "", "3-2", "", "", ""], ["2019-2020", "Victory League", "01/10/2019", "", "Bugle", "Pelynt", "", "", "1", "4", ""]],
  },
  frames: {
    label: "Full scorecards (frame by frame)", hint: "One row per frame. This is what gives players their history, rankings and breaks. The match is created if it isn't there yet (as long as the League column is filled in), and players who aren't there yet are created in that team.",
    columns: [
      ["season", "Season", true, "e.g. 2019-2020", ["seasons", "year"]],
      ["league", "League", false, "Needed only if the match hasn't been imported yet", ["leagues", "division"]],
      ["date", "Date", true, "Day first, e.g. 24/09/2019", ["matchdate", "day"]],
      ["home", "Home", true, "Home team", ["hometeam"]],
      ["away", "Away", true, "Away team", ["awayteam", "visitors"]],
      ["frame", "Frame", true, "1, 2, 3…", ["frameno", "framenumber", "no"]],
      ["home_player", "Home player", false, "Full name. “Name (Ext)” = that player as the extra player; “Extra Player” = an unnamed stand-in", ["homeplayername"]],
      ["home_points", "Home points", true, "Points scored in the frame", ["homepts", "homeframescore"]],
      ["away_player", "Away player", false, "Full name", ["awayplayername"]],
      ["away_points", "Away points", true, "Points scored in the frame", ["awaypts", "awayframescore"]],
      ["home_breaks", "Home breaks", false, "e.g. 34 or 34, 41", ["homebreak", "homebrks"]],
      ["away_breaks", "Away breaks", false, "e.g. 52", ["awaybreak", "awaybrks"]],
    ],
    example: [["2019-2020", "Victory League", "24/09/2019", "Bethel A", "Bugle", "1", "Sam Bolitho", "72", "Dave Polglase", "40", "34", ""],
      ["2019-2020", "Victory League", "24/09/2019", "Bethel A", "Bugle", "2", "Dan Couch", "31", "Jack Trewin", "66", "", "41, 30"]],
  },
};

/** Match a file's headings to an import's columns. Returns { get(row, key), missing: [heading], ignored: [heading] }. */
export function mapHeaders(headers, type) {
  const spec = IMPORTS[type];
  const found = new Map();
  for (const h of headers) {
    const k = headerKey(h);
    const col = spec.columns.find(([key, heading, , , aliases]) => [key, heading, ...aliases].some((x) => headerKey(x) === k));
    if (col && !found.has(col[0])) found.set(col[0], h);
  }
  return {
    get: (row, key) => (found.has(key) ? row.cells[found.get(key)] ?? "" : ""),
    has: (key) => found.has(key),
    missing: spec.columns.filter(([key, , required]) => required && !found.has(key)).map(([, heading]) => heading),
    ignored: headers.filter((h) => ![...found.values()].includes(h)),
  };
}

// ── working out the plan ───────────────────────────────────────
/**
 * Work out everything an import would do, without saving anything.
 *   data: { seasons, leagues, venues, teams, players, fixtures } — what's in the database now
 * Returns {
 *   rows:   [{ line, status: "add" | "update" | "skip" | "error", text, notes: [] }],
 *   add:    { seasons, venues, teams, players, fixtures, frames, breaks }   (new rows; ids that start "tmp:" are
 *            placeholders for rows created by this same import — admin/import.js swaps in the real ids),
 *   change: { players, fixtures }   (existing rows to update: { id, …fields }),
 *   clearBreaks: [fixture ids whose breaks are replaced by the file],
 *   problem: "text"   (when the file can't be used at all)
 * }
 */
export function planImport(type, csv, data) {
  const cols = mapHeaders(csv.headers, type);
  const plan = { rows: [], add: { seasons: [], venues: [], teams: [], players: [], fixtures: [], frames: [], breaks: [] }, change: { players: [], fixtures: [] }, clearBreaks: [] };
  if (cols.missing.length) return { ...plan, problem: `The file is missing ${cols.missing.length > 1 ? "these columns" : "this column"}: ${cols.missing.join(", ")}. Check the first line of the file against the template.` };
  if (!csv.rows.length) return { ...plan, problem: "The file has headings but no rows." };

  // Look-ups by name. New rows are added to them as we go, so later lines can use them.
  const index = (rows, names) => { const m = new Map(); for (const r of rows) for (const n of names(r)) if (n) m.set(norm(n), r); return m; };
  const seasons = index(data.seasons, (r) => [r.name]);
  const leagues = index(data.leagues, (r) => [r.name, r.short_name, r.slug, r.name.replace(/ league$/i, "")]);
  const venues = index(data.venues, (r) => [r.name]);
  const teams = index(data.teams, (r) => [r.name]);
  const players = [...data.players];
  const slugs = { teams: new Set(data.teams.map((t) => t.slug)), venues: new Set(data.venues.map((v) => v.slug)) };
  const freshSlug = (kind, name) => { let s = slugify(name) || "item", n = 1; while (slugs[kind].has(s)) s = `${slugify(name)}-${++n}`; slugs[kind].add(s); return s; };
  const fixtureKey = (seasonId, homeId, awayId, day) => `${seasonId}|${homeId}|${awayId}|${day}`;
  const fixtures = new Map(data.fixtures.map((f) => [fixtureKey(f.season_id, f.home_team_id, f.away_team_id, ukDay(f.starts_at)), f]));

  const seasonFor = (name, notes) => {
    if (seasons.has(norm(name))) return seasons.get(norm(name));
    const row = { id: `tmp:season:${norm(name)}`, name: name.trim(), is_current: false };
    plan.add.seasons.push(row); seasons.set(norm(name), row); notes.push(`creates season ${row.name}`);
    return row;
  };
  const venueFor = (name, notes) => {
    if (venues.has(norm(name))) return venues.get(norm(name));
    const row = { id: `tmp:venue:${norm(name)}`, name: name.trim(), slug: freshSlug("venues", name), address: "", description: "" };
    plan.add.venues.push(row); venues.set(norm(name), row); notes.push(`creates venue ${row.name}`);
    return row;
  };
  /** An existing team, or (when `league` is given) a new one. */
  const teamFor = (name, notes, { league = null, venue = null, active = false } = {}) => {
    if (teams.has(norm(name))) return teams.get(norm(name));
    if (!league) return null;
    const row = { id: `tmp:team:${norm(name)}`, name: name.trim(), slug: freshSlug("teams", name), league_id: league.id, venue_id: venue?.id ?? null, active };
    plan.add.teams.push(row); teams.set(norm(name), row); notes.push(`creates ${active ? "" : "past "}team ${row.name}`);
    return row;
  };
  /** A player by name: in this team first, then anyone with that name if there's only one. */
  const findPlayer = (name, teamId) => {
    const same = players.filter((p) => norm(p.full_name) === norm(name));
    return same.find((p) => p.team_id === teamId) ?? (same.length === 1 ? same[0] : null);
  };
  const playerFor = (name, team, notes) => {
    const hit = findPlayer(name, team?.id);
    if (hit) return hit;
    const row = { id: `tmp:player:${norm(name)}|${team?.id ?? ""}`, full_name: name.trim(), team_id: team?.id ?? null, position: "Player", handicap: 0 };
    plan.add.players.push(row); players.push(row); notes.push(`creates player ${row.full_name}${team ? ` (${team.name})` : ""}`);
    return row;
  };
  const POSITION = (v) => (/vice/i.test(v) ? "Vice Captain" : /capt/i.test(v) ? "Team Captain" : "Player");
  const STATUS = (v) => ({ approved: "approved", played: "approved", final: "approved", result: "approved", scheduled: "scheduled", fixture: "scheduled", postponed: "postponed", pp: "postponed", submitted: "submitted" })[norm(v).replace(/[^a-z]/g, "")];

  /** Shared by the fixtures and scorecards imports: find the match on this line, or create it. */
  function fixtureFor(get, notes, { score = null, status = null, mayCreate = true } = {}) {
    const date = parseDate(get("date"));
    if (!date) throw new Error(`can't read the date “${get("date")}” — use day/month/year, e.g. 24/09/2019`);
    const league = get("league") ? leagues.get(norm(get("league"))) : null;
    if (get("league") && !league) throw new Error(`there's no league called “${get("league")}” — add it under Admin → Leagues first, or fix the spelling`);
    const season = seasonFor(get("season"), notes);
    const home = teamFor(get("home"), notes, { league }), away = teamFor(get("away"), notes, { league });
    if (!home || !away) throw new Error(`there's no team called “${!home ? get("home") : get("away")}” — fill in the League column so it can be created`);
    if (home.id === away.id) throw new Error("a team can't play itself");
    const key = fixtureKey(season.id, home.id, away.id, date);
    const existing = fixtures.get(key);
    if (existing) return { fixture: existing, isNew: false };
    if (!mayCreate || !league) throw new Error("this match isn't on the site yet — fill in the League column so it can be created");
    const time = get("time") ? parseTime(get("time")) : "19:30";
    if (!time) throw new Error(`can't read the time “${get("time")}” — use e.g. 19:30`);
    const venue = get("venue") ? venueFor(get("venue"), notes) : null;
    const row = {
      id: `tmp:fixture:${key}`, season_id: season.id, league_id: league.id, home_team_id: home.id, away_team_id: away.id,
      venue_id: venue?.id ?? home.venue_id ?? null, starts_at: new Date(londonISO(date, time)).toISOString(),
      status: status ?? (score ? "approved" : "scheduled"), notes: "", home_score: score?.[0] ?? null, away_score: score?.[1] ?? null,
    };
    plan.add.fixtures.push(row); fixtures.set(key, row);
    return { fixture: row, isNew: true };
  }

  const seen = new Set();
  for (const line of csv.rows) {
    const get = (key) => cols.get(line, key);
    const notes = [];
    const out = (status, text) => plan.rows.push({ line: line.line, status, text, notes });
    // A line that fails must not leave half-made rows behind.
    const mark = Object.fromEntries(Object.entries(plan.add).map(([k, v]) => [k, v.length]));
    const undo = () => { for (const [k, n] of Object.entries(mark)) for (const gone of plan.add[k].splice(n)) forget(k, gone); };
    const forget = (kind, row) => {
      if (kind === "seasons") seasons.delete(norm(row.name));
      if (kind === "venues") { venues.delete(norm(row.name)); slugs.venues.delete(row.slug); }
      if (kind === "teams") { teams.delete(norm(row.name)); slugs.teams.delete(row.slug); }
      if (kind === "players") players.splice(players.indexOf(row), 1);
      if (kind === "fixtures") fixtures.delete(fixtureKey(row.season_id, row.home_team_id, row.away_team_id, ukDay(row.starts_at)));
    };
    try {
      const need = (key) => { if (!get(key)) throw new Error(`the ${IMPORTS[type].columns.find(([k]) => k === key)[1]} column is empty`); return get(key); };

      if (type === "teams") {
        const name = need("team");
        const league = leagues.get(norm(need("league")));
        if (!league) throw new Error(`there's no league called “${get("league")}” — add it under Admin → Leagues first`);
        if (teams.has(norm(name))) { out("skip", `${name} is already on the site`); continue; }
        const venue = get("venue") ? venueFor(get("venue"), notes) : null;
        teamFor(name, [], { league, venue, active: !no(get("playing")) });
        out("add", `${name} → ${league.name}${venue ? `, ${venue.name}` : ""}${no(get("playing")) ? " (past team)" : ""}`);

      } else if (type === "players") {
        const name = need("name");
        const team = get("team") ? teams.get(norm(get("team"))) : null;
        if (get("team") && !team) throw new Error(`there's no team called “${get("team")}” — import the teams first, or fix the spelling`);
        const handicap = get("handicap") === "" ? null : wholeNumber(get("handicap"));
        if (get("handicap") !== "" && handicap === null) throw new Error(`the handicap “${get("handicap")}” isn't a whole number`);
        const birth_date = get("birthday") ? parseDate(get("birthday")) : null;
        if (get("birthday") && !birth_date) throw new Error(`can't read the birthday “${get("birthday")}” — use day/month/year`);
        const key = `${norm(name)}|${team?.id ?? ""}`;
        if (seen.has(key)) { out("skip", `${name} is in the file more than once`); continue; }
        seen.add(key);
        const given = { ...(cols.has("team") && get("team") ? { team_id: team.id } : {}), ...(get("position") ? { position: POSITION(get("position")) } : {}),
          ...(handicap !== null ? { handicap } : {}), ...(birth_date ? { birth_date } : {}) };
        const existing = findPlayer(name, team?.id);
        if (existing && !String(existing.id).startsWith("tmp:")) {
          const patch = Object.fromEntries(Object.entries(given).filter(([k, v]) => existing[k] !== v));
          if (!Object.keys(patch).length) { out("skip", `${name} is already on the site with these details`); continue; }
          plan.change.players.push({ id: existing.id, ...patch });
          out("update", `${name}: ${Object.keys(patch).map((k) => ({ team_id: "team", birth_date: "birthday" })[k] ?? k).join(", ")} updated`);
        } else {
          const row = { id: `tmp:player:${key}`, full_name: name.trim(), team_id: team?.id ?? null, position: "Player", handicap: 0, ...given };
          plan.add.players.push(row); players.push(row);
          out("add", `${name}${team ? ` → ${team.name}` : ""}${handicap !== null ? `, handicap ${handicap}` : ""}`);
        }

      } else if (type === "fixtures") {
        need("season"); need("league"); need("home"); need("away"); need("date");
        let score = get("score") ? parseScore(get("score")) : null;
        if (get("score") && !score) throw new Error(`can't read the score “${get("score")}” — use e.g. 3-2`);
        if (!score && (get("home_score") !== "" || get("away_score") !== "")) {
          score = [wholeNumber(get("home_score")), wholeNumber(get("away_score"))];
          if (score.some((n) => n === null || n < 0)) throw new Error("fill in both the home score and the away score with whole numbers");
        }
        const status = get("status") ? STATUS(get("status")) : null;
        if (get("status") && !status) throw new Error(`don't know the status “${get("status")}” — use Approved, Scheduled or Postponed`);
        const { fixture, isNew } = fixtureFor(get, notes, { score, status });
        const text = `${get("home")} v ${get("away")}, ${get("date")}${score ? ` (${score[0]}-${score[1]})` : ""}`;
        if (isNew) { out("add", text); continue; }
        if (String(fixture.id).startsWith("tmp:")) { out("skip", `${text} is in the file more than once`); continue; }
        const patch = {};
        if (score && (fixture.home_score !== score[0] || fixture.away_score !== score[1])) Object.assign(patch, { home_score: score[0], away_score: score[1] });
        const want = status ?? (score && fixture.status === "scheduled" ? "approved" : null);
        if (want && want !== fixture.status) patch.status = want;
        if (!Object.keys(patch).length) { out("skip", `${text} is already on the site`); continue; }
        plan.change.fixtures.push({ id: fixture.id, ...patch });
        out("update", `${text}: ${Object.keys(patch).includes("home_score") ? "score" : "status"} updated`);

      } else if (type === "frames") {
        need("season"); need("home"); need("away"); need("date");
        const frame_no = wholeNumber(need("frame"));
        if (!frame_no || frame_no < 1 || frame_no > 25) throw new Error(`the frame number “${get("frame")}” should be 1 to 25`);
        const pts = ["home_points", "away_points"].map((k) => wholeNumber(need(k)));
        if (pts.some((n) => n === null || n < 0 || n > 200)) throw new Error("the points should be whole numbers from 0 to 200");
        const { fixture } = fixtureFor(get, notes, { status: "approved" });
        const key = `${fixture.id}|${frame_no}`;
        if (seen.has(key)) throw new Error(`frame ${frame_no} of this match is in the file more than once`);
        const sideTeam = (side) => [...teams.values()].find((t) => t.id === fixture[`${side}_team_id`]);
        const frame = { fixture_id: fixture.id, frame_no, home_points: pts[0], away_points: pts[1], home_player_id: null, away_player_id: null, home_ext: false, away_ext: false };
        for (const side of ["home", "away"]) {
          // "Name (Ext)" and "Extra Player" are how the old website wrote the extra player.
          const typed = extraPlayer(get(`${side}_player`));
          const who = typed.name ? playerFor(typed.name, sideTeam(side), notes) : null;
          frame[`${side}_player_id`] = who?.id ?? null;
          frame[`${side}_ext`] = typed.ext;
          if (typed.ext) notes.push(who ? `${who.full_name} as the extra player` : "an unnamed extra player");
          const values = parseBreaks(get(`${side}_breaks`));
          if (values === null) throw new Error(`can't read the ${side} breaks “${get(`${side}_breaks`)}” — use e.g. 34 or 34, 41`);
          if (values.length && !who) throw new Error(`the ${side} breaks need a player name`);
          for (const value of values) plan.add.breaks.push({ fixture_id: fixture.id, frame_no, player_id: who.id, value });
        }
        plan.add.frames.push(frame);
        seen.add(key);
        if (!plan.clearBreaks.includes(fixture.id)) plan.clearBreaks.push(fixture.id);
        // A match that was only a fixture becomes a result once its frames are in.
        if (!String(fixture.id).startsWith("tmp:") && fixture.status === "scheduled" && !plan.change.fixtures.some((c) => c.id === fixture.id))
          plan.change.fixtures.push({ id: fixture.id, status: "approved" });
        out("add", `${get("home")} v ${get("away")}, ${get("date")} — frame ${frame_no}: ${get("home_player") || "?"} ${pts[0]}-${pts[1]} ${get("away_player") || "?"}`);
      }
    } catch (err) {
      undo();
      notes.length = 0;
      out("error", `Not imported: ${err.message}.`);
    }
  }
  return plan;
}

/** "12 to add, 3 to update, 1 skipped, 2 with problems" */
export function planSummary(plan) {
  const n = (s) => plan.rows.filter((r) => r.status === s).length;
  return { add: n("add"), update: n("update"), skip: n("skip"), error: n("error") };
}
