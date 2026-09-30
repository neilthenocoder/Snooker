// ─────────────────────────────────────────────────────────────
//  DATA ACCESS — every read and write the site makes goes through
//  here. Pages never talk to the database directly.
// ─────────────────────────────────────────────────────────────
import { db, run } from "./db.js";

const PAGE = 1000;           // Supabase returns at most 1000 rows per request
const CHUNK = 100;           // keep "id in (...)" lists short enough for a URL
const cache = new Map();

/** Fetch every row of a query, page by page. `build` must return a fresh query. */
export async function selectAll(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const rows = await run(build().range(from, from + PAGE - 1));
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Rows of `table` whose `col` is one of `ids`, fetched in URL-safe chunks. */
export async function selectIn(table, col, ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  const parts = [];
  for (let i = 0; i < unique.length; i += CHUNK)
    parts.push(selectAll(() => db.from(table).select("*").in(col, unique.slice(i, i + CHUNK))));
  return (await Promise.all(parts)).flat();
}

/** Whole small table (cached until the next write). */
export function table(name, order = "id") {
  if (!cache.has(name)) cache.set(name, selectAll(() => db.from(name).select("*").order(order)).catch((e) => { cache.delete(name); throw e; }));
  return cache.get(name);
}

export function invalidate() { cache.clear(); }

// ── generic writes (used by the admin dashboard) ─────────────────
export async function save(tableName, row) {
  const { id, ...fields } = row;
  const q = id ? db.from(tableName).update(fields).eq("id", id) : db.from(tableName).insert(fields);
  const [saved] = await run(q.select());
  if (tableName === "seasons" && fields.is_current) {
    await run(db.from("seasons").update({ is_current: false }).neq("id", saved.id));
  }
  invalidate();
  return saved;
}

export async function insertMany(tableName, rows) {
  const saved = rows.length ? await run(db.from(tableName).insert(rows).select()) : [];
  invalidate();
  return saved;
}

export async function remove(tableName, id) {
  await run(db.from(tableName).delete().eq("id", id));
  invalidate();
}

// ── season data ──────────────────────────────────────────────────
export async function currentSeason() {
  const seasons = await table("seasons", "name");
  return seasons.find((s) => s.is_current) ?? seasons[seasons.length - 1];
}

/** Everything needed to draw tables, fixtures and rankings for one season. */
export function loadSeason(seasonId) {
  const key = `season:${seasonId}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const [seasons, leagues, venues, teams, players, fixtures] = await Promise.all([
        table("seasons", "name"), table("leagues", "sort"), table("venues", "name"),
        table("teams", "name"), table("players", "full_name"),
        // No season yet (brand-new database): show everything else with no fixtures.
        seasonId ? selectAll(() => db.from("fixtures").select("*").eq("season_id", seasonId).order("starts_at")) : [],
      ]);
      const ids = fixtures.map((f) => f.id);
      const [frames, breaks] = await Promise.all([selectIn("frames", "fixture_id", ids), selectIn("breaks", "fixture_id", ids)]);
      return { season: seasons.find((s) => s.id === seasonId), seasons, leagues, venues, teams, players, fixtures, frames, breaks };
    })().catch((e) => { cache.delete(key); throw e; }));
  }
  return cache.get(key);
}

/** One fixture with its frames and breaks. */
export async function loadFixture(id) {
  const fixture = await run(db.from("fixtures").select("*").eq("id", id).maybeSingle());
  if (!fixture) return null;
  const [frames, breaks] = await Promise.all([
    run(db.from("frames").select("*").eq("fixture_id", id).order("frame_no")),
    run(db.from("breaks").select("*").eq("fixture_id", id).order("frame_no")),
  ]);
  return { fixture, frames, breaks };
}

/** All meetings between two teams, any season, with frames. */
export async function headToHead(teamA, teamB) {
  const fixtures = (await selectAll(() => db.from("fixtures").select("*").in("home_team_id", [teamA, teamB]).order("starts_at", { ascending: false })))
    .filter((f) => [teamA, teamB].includes(f.away_team_id));
  const frames = await selectIn("frames", "fixture_id", fixtures.map((f) => f.id));
  return { fixtures, frames };
}

export async function articles() {
  return (await table("articles", "published_at"))
    .filter((a) => a.is_published)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

// ── scorecards ───────────────────────────────────────────────────
/** Replace a fixture's frames and breaks with what the scorecard form holds. */
export async function saveScorecard(fixtureId, frames, breaks) {
  const rows = frames.map((f) => ({ ...f, fixture_id: fixtureId }));
  if (rows.length) await run(db.from("frames").upsert(rows, { onConflict: "fixture_id,frame_no" }).select());
  await run(db.from("frames").delete().eq("fixture_id", fixtureId).gt("frame_no", rows.length));
  await run(db.from("breaks").delete().eq("fixture_id", fixtureId));
  if (breaks.length) await run(db.from("breaks").insert(breaks.map((b) => ({ ...b, fixture_id: fixtureId }))).select());
  invalidate();
}

/** Captains can only move a fixture to in_progress / submitted (enforced in the database). */
export async function setFixtureStatus(fid, newStatus) {
  await run(db.rpc("set_fixture_status", { fid, new_status: newStatus }));
  invalidate();
}

// ── realtime ─────────────────────────────────────────────────────
/** Call `onChange` whenever any of `tables` changes. Returns an unsubscribe function. */
export function subscribe(tables, onChange) {
  let timer;
  const debounced = () => { invalidate(); clearTimeout(timer); timer = setTimeout(onChange, 300); };
  const ch = db.channel(`live-${tables.join("-")}-${Math.random().toString(36).slice(2)}`);
  for (const t of tables) ch.on("postgres_changes", { event: "*", schema: "public", table: t }, debounced);
  ch.subscribe();
  return () => db.removeChannel(ch);
}

// ── competitions ─────────────────────────────────────────────────
/** Every competition with its entrants and draw (small tables, cached). */
export async function loadCompetitions() {
  const [competitions, entries, matches] = await Promise.all([
    table("competitions", "sort"), table("competition_entries", "seed"), table("competition_matches", "round"),
  ]);
  return { competitions, entries, matches };
}

/** Replace a competition's draw with freshly generated match rows. */
export async function replaceDraw(competitionId, rows) {
  await run(db.from("competition_matches").delete().eq("competition_id", competitionId));
  if (rows.length) await run(db.from("competition_matches").insert(rows.map((r) => ({ ...r, competition_id: competitionId }))).select());
  invalidate();
}

// ── players ──────────────────────────────────────────────────────
/** Every frame a player has played (any season), plus those fixtures and their breaks. */
export async function playerHistory(playerId) {
  const [asHome, asAway, breaks] = await Promise.all([
    selectAll(() => db.from("frames").select("*").eq("home_player_id", playerId)),
    selectAll(() => db.from("frames").select("*").eq("away_player_id", playerId)),
    selectAll(() => db.from("breaks").select("*").eq("player_id", playerId)),
  ]);
  const frames = [...asHome, ...asAway];
  const fixtures = await selectIn("fixtures", "id", frames.map((f) => f.fixture_id));
  return { frames, fixtures, breaks };
}
