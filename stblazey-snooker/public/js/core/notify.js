// ─────────────────────────────────────────────────────────────
//  LIVE NOTIFICATIONS — green pop-ups (with the player's photo)
//  when a frame is won, a break is made, a player joins or a tie
//  is drawn. The bell in the menu turns the pop-ups on/off
//  (remembered in this browser only).
//  The same listener also sets off the confetti when a break is a
//  new highest of the season (Admin → Site settings → Celebrations).
// ─────────────────────────────────────────────────────────────
import { listen, table, selectIn, nearbyMatches, settings, invalidate, competitionBreaks } from "./api.js";
import { frameWinner, RULES } from "./rules.js";
import { celebrateBreak } from "./celebrate.js";

const KEY = "sbdsl-notifications";
export const notificationsOn = () => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } };
export const setNotifications = (on) => { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {} };

let stop = null;
const seen = new Set();
const SHOW_MS = 6000;
// Only matches being played around now make pop-ups — so importing old
// results, or the admin tidying an old scorecard, doesn't flood the screen.
let tonight = new Set(), checkedAt = 0, recentJoins = [];
async function isTonight(id) {
  if (tonight.has(id)) return true;
  if (Date.now() - checkedAt < 60e3) return false;
  checkedAt = Date.now();
  const { fixtures, comps } = await nearbyMatches(24).catch(() => ({ fixtures: [], comps: [] }));
  tonight = new Set([...fixtures, ...comps].map((m) => m.id));
  return tonight.has(id);
}

/** options: avatar (a picture link — a player's photo), icon ("trophy" for draws). Nothing shows while the bell is off. */
export function popup(message, { avatar = null, icon = null } = {}) {
  if (!notificationsOn()) return;
  let box = document.querySelector(".live-pops");
  if (!box) { box = document.createElement("div"); box.className = "live-pops"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const el = document.createElement("div");
  el.className = "live-pop";
  if (avatar !== null || icon) {
    const img = document.createElement("img");
    img.className = `live-pop-face ${icon ? "icon" : ""}`;
    img.src = icon === "trophy" ? "/assets/trophy.svg" : avatar || "/assets/avatar.svg";
    img.alt = "";
    el.classList.add("with-face");
    el.append(img);
  }
  const text = document.createElement("span");
  text.textContent = message;
  el.append(text);
  box.append(el);
  // Never more than four on screen at once (a whole scorecard can arrive together).
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(() => el.classList.add("out"), SHOW_MS - 400);
  setTimeout(() => el.remove(), SHOW_MS);
}

const frameKey = (f, pre = "") => `${pre}f:${f.fixture_id ?? f.match_id}:${f.frame_no}:${f.home_points ?? f.a_points}-${f.away_points ?? f.b_points}`;
const breakKey = (b, pre = "") => `${pre}b:${b.fixture_id ?? b.match_id}:${b.frame_no}:${b.player_id}:${b.value}`;

/**
 * Is this break a new best — of the season in its league or competition, or (if the
 * setting says so) of the last seven days? Returns the words for the card, or null.
 */
async function recordBreak(row, isCup, mode) {
  if (mode === "off" || row.value < RULES.breakMinimum) return null;
  invalidate();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  let others, where, href;
  if (isCup) {
    const [matches, comps] = await Promise.all([table("competition_matches", "round"), table("competitions", "sort")]);
    const match = matches.find((m) => m.id === row.match_id), comp = comps.find((c) => c.id === match?.competition_id);
    if (!comp) return null;
    const inComp = matches.filter((m) => m.competition_id === comp.id);
    others = (await competitionBreaks(inComp.map((m) => m.id))).filter((b) => b.id !== row.id)
      .map((b) => ({ value: b.value, when: inComp.find((m) => m.id === b.match_id)?.starts_at ?? "" }));
    where = comp.name; href = `/cup-match/${match.no ?? match.id}`;
  } else {
    const { seasonContext } = await import("./context.js");
    const ctx = await seasonContext();
    const fx = ctx.fixture.get(row.fixture_id), league = ctx.league.get(fx?.league_id);
    if (!league) return null;
    // This season's breaks in the league — and the ones made tonight in matches that haven't been submitted yet.
    const playing = ctx.fixturesIn(league.id).filter((f) => tonight.has(f.id));
    const live = await selectIn("breaks", "fixture_id", playing.map((f) => f.id)).catch(() => []);
    const all = new Map([...ctx.breaksIn(league.id).map((b) => [b.id, { value: b.value, when: b.fixture?.starts_at ?? "" }]),
      ...live.map((b) => [b.id, { value: b.value, when: ctx.fixture.get(b.fixture_id)?.starts_at ?? "" }])]);
    all.delete(row.id);
    others = [...all.values()];
    where = league.name; href = `/match/${fx.code || fx.id}`;
  }
  const best = (list) => Math.max(0, ...list.map((b) => b.value));
  if (row.value > best(others)) return { what: "New highest break of the season", where, href };
  if (mode === "week" && row.value > best(others.filter((b) => b.when >= weekAgo))) return { what: "Highest break of the week", where, href };
  return null;
}

export async function startNotifications() {
  stopNotifications();
  // Remember everything already played tonight, so re-saved frames don't pop up again.
  const { fixtures, comps } = await nearbyMatches(24).catch(() => ({ fixtures: [], comps: [] }));
  tonight = new Set([...fixtures, ...comps].map((m) => m.id)); checkedAt = Date.now();
  const [frames, breaks, cframes, cbreaks] = await Promise.all([
    selectIn("frames", "fixture_id", fixtures.map((f) => f.id)), selectIn("breaks", "fixture_id", fixtures.map((f) => f.id)),
    selectIn("competition_frames", "match_id", comps.map((m) => m.id)), selectIn("competition_breaks", "match_id", comps.map((m) => m.id)),
  ]).catch(() => [[], [], [], []]);
  frames.forEach((f) => seen.add(frameKey(f)));
  breaks.forEach((b) => seen.add(breakKey(b)));
  cframes.forEach((f) => seen.add(frameKey(f, "c")));
  cbreaks.forEach((b) => seen.add(breakKey(b, "c")));

  // Live draws: remember how many ties each competition has shown already.
  const tiesSeen = new Map((await table("competitions", "sort").catch(() => [])).map((c) => [c.id, c.draw_live?.log?.length ?? 0]));

  stop = listen(["frames", "breaks", "players", "competition_frames", "competition_breaks", "competitions"], async (t, row, type) => {
    if (type === "DELETE" || !row.id) return;
    if (t === "competitions") {
      const log = row.draw_live?.log ?? [], from = tiesSeen.get(row.id) ?? 0;
      tiesSeen.set(row.id, log.length);
      if (row.draw_live?.status === "live" && !log.length && from === 0 && type === "UPDATE") popup(`The ${row.name} draw is starting — watch it live`, { icon: "trophy" });
      if (log.length <= from) return;
      const entries = await table("competition_entries", "seed");
      const who = (id) => entries.find((e) => e.id === id)?.name ?? "?";
      for (const tie of log.slice(from)) popup(tie.a && tie.b ? `${row.name} draw: ${who(tie.a)} has drawn ${who(tie.b)}` : `${row.name} draw: ${who(tie.a ?? tie.b)} gets a bye`, { icon: "trophy" });
      return;
    }
    if (t !== "players" && !(await isTonight(row.fixture_id ?? row.match_id))) return;
    if (t === "players") {
      // A whole squad arriving at once is an import, not news.
      const now = Date.now();
      recentJoins = [...recentJoins.filter((x) => now - x < 5000), now];
      if (type !== "INSERT" || recentJoins.length > 3) return;
    }
    const [players, teams] = await Promise.all([table("players", "full_name"), table("teams", "name")]);
    const person = (id) => players.find((p) => p.id === id);
    const name = (id) => person(id)?.full_name ?? "A player";
    const face = (id) => person(id)?.avatar_url ?? "";
    if (t === "frames" || t === "competition_frames") {
      const comp = t === "competition_frames";
      const f = comp ? { ...row, home_points: row.a_points, away_points: row.b_points, home_player_id: row.a_player_id, away_player_id: row.b_player_id } : row;
      const w = frameWinner(f);
      const key = frameKey(row, comp ? "c" : "");
      if (!w || seen.has(key)) return;
      seen.add(key);
      const [win, lose] = w === "home" ? ["home", "away"] : ["away", "home"];
      popup(`${name(f[`${win}_player_id`])} has beaten ${name(f[`${lose}_player_id`])} (${f[`${win}_points`]}-${f[`${lose}_points`]})`, { avatar: face(f[`${win}_player_id`]) });
    } else if (t === "breaks" || t === "competition_breaks") {
      const cup = t !== "breaks";
      const key = breakKey(row, cup ? "c" : "");
      if (seen.has(key)) return;
      seen.add(key);
      popup(`${name(row.player_id)} has made a break of ${row.value}`, { avatar: face(row.player_id) });
      // A new best? Confetti — for everyone on the site, whether or not their bell is on.
      const site = await settings().catch(() => ({}));
      const record = await recordBreak(row, cup, site.celebrate_breaks ?? "season").catch(() => null);
      if (record) celebrateBreak({ ...record, value: row.value, name: name(row.player_id), avatar: face(row.player_id) });
    } else if (t === "players" && type === "INSERT") {
      popup(`${row.full_name} has joined ${teams.find((x) => x.id === row.team_id)?.name ?? "the league"}`, { avatar: row.avatar_url ?? "" });
    }
  });
}

export function stopNotifications() { if (stop) stop(); stop = null; }
