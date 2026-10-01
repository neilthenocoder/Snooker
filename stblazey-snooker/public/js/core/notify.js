// ─────────────────────────────────────────────────────────────
//  LIVE NOTIFICATIONS — green pop-ups when a frame is won, a break
//  is made or a player joins. The bell in the menu turns them on/off
//  (remembered in this browser only).
// ─────────────────────────────────────────────────────────────
import { listen, table, selectIn, nearbyMatches } from "./api.js";
import { frameWinner } from "./rules.js";

const KEY = "sbdsl-notifications";
export const notificationsOn = () => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } };
export const setNotifications = (on) => { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {} };

let stop = null;
const seen = new Set();
const SHOW_MS = 6000;

export function popup(message) {
  let box = document.querySelector(".live-pops");
  if (!box) { box = document.createElement("div"); box.className = "live-pops"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const el = document.createElement("div");
  el.className = "live-pop";
  el.textContent = message;
  box.append(el);
  // Never more than four on screen at once (a whole scorecard can arrive together).
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(() => el.classList.add("out"), SHOW_MS - 400);
  setTimeout(() => el.remove(), SHOW_MS);
}

const frameKey = (f, pre = "") => `${pre}f:${f.fixture_id ?? f.match_id}:${f.frame_no}:${f.home_points ?? f.a_points}-${f.away_points ?? f.b_points}`;
const breakKey = (b, pre = "") => `${pre}b:${b.fixture_id ?? b.match_id}:${b.frame_no}:${b.player_id}:${b.value}`;

export async function startNotifications() {
  stopNotifications();
  // Remember everything already played tonight, so re-saved frames don't pop up again.
  const { fixtures, comps } = await nearbyMatches(24).catch(() => ({ fixtures: [], comps: [] }));
  const [frames, breaks, cframes, cbreaks] = await Promise.all([
    selectIn("frames", "fixture_id", fixtures.map((f) => f.id)), selectIn("breaks", "fixture_id", fixtures.map((f) => f.id)),
    selectIn("competition_frames", "match_id", comps.map((m) => m.id)), selectIn("competition_breaks", "match_id", comps.map((m) => m.id)),
  ]).catch(() => [[], [], [], []]);
  frames.forEach((f) => seen.add(frameKey(f)));
  breaks.forEach((b) => seen.add(breakKey(b)));
  cframes.forEach((f) => seen.add(frameKey(f, "c")));
  cbreaks.forEach((b) => seen.add(breakKey(b, "c")));

  stop = listen(["frames", "breaks", "players", "competition_frames", "competition_breaks"], async (t, row, type) => {
    if (type === "DELETE" || !row.id) return;
    const [players, teams] = await Promise.all([table("players", "full_name"), table("teams", "name")]);
    const name = (id) => players.find((p) => p.id === id)?.full_name ?? "A player";
    if (t === "frames" || t === "competition_frames") {
      const comp = t === "competition_frames";
      const f = comp ? { ...row, home_points: row.a_points, away_points: row.b_points, home_player_id: row.a_player_id, away_player_id: row.b_player_id } : row;
      const w = frameWinner(f);
      const key = frameKey(row, comp ? "c" : "");
      if (!w || seen.has(key)) return;
      seen.add(key);
      const [win, lose] = w === "home" ? ["home", "away"] : ["away", "home"];
      popup(`${name(f[`${win}_player_id`])} has beaten ${name(f[`${lose}_player_id`])} (${f[`${win}_points`]}-${f[`${lose}_points`]})`);
    } else if (t === "breaks" || t === "competition_breaks") {
      const key = breakKey(row, t === "breaks" ? "" : "c");
      if (seen.has(key)) return;
      seen.add(key);
      popup(`${name(row.player_id)} has made a break of ${row.value}`);
    } else if (t === "players" && type === "INSERT") {
      popup(`${row.full_name} has joined ${teams.find((x) => x.id === row.team_id)?.name ?? "the league"}`);
    }
  });
}

export function stopNotifications() { if (stop) stop(); stop = null; }
