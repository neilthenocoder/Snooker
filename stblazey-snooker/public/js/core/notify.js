// ─────────────────────────────────────────────────────────────
//  LIVE NOTIFICATIONS — green pop-ups (with the player's photo)
//  when a frame is won, a break is made, news is published, a
//  league or the rankings has a new leader, a tie is drawn, a
//  competition is won or a player joins.
//  The bell in the menu opens a side panel where each visitor
//  switches the kinds they want on and off (remembered in this
//  browser only). The same listener sets off the confetti for the
//  big moments (Admin → Site settings → Celebrations).
// ─────────────────────────────────────────────────────────────
import { listen, table, selectIn, nearbyMatches, settings, invalidate, competitionBreaks, loadCompetitions } from "./api.js";
import { frameWinner, RULES } from "./rules.js";
import { celebrate } from "./celebrate.js";
import { buildBracket } from "./bracket.js";

const KEY = "sbdsl-notifications";
export const notificationsOn = () => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } };
export const setNotifications = (on) => { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {} };

/** The kinds of notification a visitor can have: [key, name, what it is]. Everything is on until they switch it off. */
export const NOTIFY_KINDS = [
  ["results", "Results", "A pop-up as each frame is won on a match night"],
  ["breaks", "Breaks", "Every break of 30 or more, as it is entered"],
  ["news", "News", "When a new article is published"],
  ["leaders", "Tables & rankings", "A new team at the top of a league, or a new leader of the player rankings"],
  ["comps", "Competitions", "Each tie as a draw is made live, and the winner of a competition"],
  ["players", "New players", "When a player joins a team"],
  ["confetti", "Celebrations", "Confetti for the big moments: a new highest break, new leaders, a competition winner"],
];
const PREFS = "sbdsl-notify-kinds";
export function notifyPrefs() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(PREFS) || "{}") ?? {}; } catch { /* nothing saved */ }
  return Object.fromEntries(NOTIFY_KINDS.map(([key]) => [key, saved[key] !== false]));
}
export function setNotifyPref(kind, on) {
  try { localStorage.setItem(PREFS, JSON.stringify({ ...notifyPrefs(), [kind]: !!on })); } catch { /* not remembered */ }
}
/** Does this visitor want this kind? Pop-ups need the bell on as well; celebrations have their own switch. */
export const wantsKind = (kind) => (kind === "confetti" ? notifyPrefs().confetti : notificationsOn() && notifyPrefs()[kind] !== false);

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

/**
 * options: kind (one of NOTIFY_KINDS — nothing shows if the visitor switched that kind, or the bell, off),
 * avatar (a picture link — a player's photo), icon ("trophy" for draws and winners), href (where a click goes).
 */
export function popup(message, { kind = "results", avatar = null, icon = null, href = null } = {}) {
  if (!wantsKind(kind)) return;
  let box = document.querySelector(".live-pops");
  if (!box) { box = document.createElement("div"); box.className = "live-pops"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const el = document.createElement(href ? "a" : "div");
  el.className = "live-pop";
  if (href) el.href = href;
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

  // News already published, so only a NEW article makes a pop-up.
  const newsSeen = new Set((await table("articles", "published_at").catch(() => [])).filter((a) => a.is_published).map((a) => a.id));
  // Who leads each league and its rankings now, and who has won each competition — to spot a change.
  let tops = await leaders().catch(() => null);
  let champs = await champions().catch(() => null);
  let leaderTimer = null, champTimer = null;
  const checkLeaders = () => { clearTimeout(leaderTimer); leaderTimer = setTimeout(async () => {
    const [now, site] = await Promise.all([leaders().catch(() => null), settings().catch(() => ({}))]);
    if (!now || !tops) { tops = now ?? tops; return; }
    for (const [id, l] of now) {
      const was = tops.get(id);
      if (!was) continue;
      // Both can change on the same night: each gets its pop-up, and one card (the league leaders first).
      const newTeam = l.team && l.team.id !== was.team?.id, newPlayer = l.player && l.player.id !== was.player?.id;
      if (newTeam) {
        popup(`${l.team.name} are the new leaders of the ${l.name}`, { kind: "leaders", icon: "trophy", href: l.href });
        if (site.celebrate_leaders !== false && wantsKind("confetti")) celebrate({ what: "New league leaders", name: l.team.name, where: l.name, value: "1st", avatar: l.team.logo_url || "/assets/trophy.svg", trophy: !l.team.logo_url, href: l.href, hrefLabel: "See the table" });
      }
      if (newPlayer) {
        popup(`${l.player.full_name} is the new leader of the ${l.name} rankings`, { kind: "leaders", avatar: l.player.avatar_url ?? "", href: l.rankHref });
        if (!(newTeam && site.celebrate_leaders !== false) && site.celebrate_rankings !== false && wantsKind("confetti")) celebrate({ what: "New rankings leader", name: l.player.full_name, where: l.name, value: `${l.pts} pts`, avatar: l.player.avatar_url, href: l.rankHref, hrefLabel: "See the rankings" });
      }
    }
    tops = now;
  }, 1500); };
  const checkChampions = () => { clearTimeout(champTimer); champTimer = setTimeout(async () => {
    const [now, site] = await Promise.all([champions().catch(() => null), settings().catch(() => ({}))]);
    if (!now || !champs) { champs = now ?? champs; return; }
    for (const [id, c] of now) {
      if (!c.winner || champs.get(id)?.winner === c.winner) continue;
      popup(`${c.winner} has won the ${c.name}`, { kind: "comps", icon: "trophy", href: c.href });
      if (site.celebrate_winners !== false && wantsKind("confetti")) celebrate({ what: "Competition winner", name: c.winner, where: c.name, avatar: c.trophy, trophy: true, href: c.href, hrefLabel: "See the competition" });
    }
    champs = now;
  }, 1500); };

  stop = listen(["frames", "breaks", "players", "competition_frames", "competition_breaks", "competitions", "articles", "fixtures", "competition_matches"], async (t, row, type) => {
    if (type === "DELETE" || !row.id) return;
    if (t === "articles") {
      if (!row.is_published || newsSeen.has(row.id)) return;
      newsSeen.add(row.id);
      return popup(`News: ${row.title}`, { kind: "news", avatar: row.circle_image_url || row.image_url || "", href: `/news/${row.slug}` });
    }
    // A result being approved (or changed) can put a new team or player on top.
    if (t === "fixtures") return checkLeaders();
    if (t === "competition_matches") { if (row.status === "completed") checkChampions(); return; }
    if (t === "competitions") {
      const log = row.draw_live?.log ?? [], from = tiesSeen.get(row.id) ?? 0;
      tiesSeen.set(row.id, log.length);
      if (row.draw_live?.status === "live" && !log.length && from === 0 && type === "UPDATE") popup(`The ${row.name} draw is starting — watch it live`, { kind: "comps", icon: "trophy", href: `/draw/${row.slug}` });
      if (log.length <= from) return;
      const entries = await table("competition_entries", "seed");
      const who = (id) => entries.find((e) => e.id === id)?.name ?? "?";
      for (const tie of log.slice(from)) popup(tie.a && tie.b ? `${row.name} draw: ${who(tie.a)} has drawn ${who(tie.b)}` : `${row.name} draw: ${who(tie.a ?? tie.b)} gets a bye`, { kind: "comps", icon: "trophy", href: `/draw/${row.slug}` });
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
      popup(`${name(f[`${win}_player_id`])} has beaten ${name(f[`${lose}_player_id`])} (${f[`${win}_points`]}-${f[`${lose}_points`]})`, { kind: "results", avatar: face(f[`${win}_player_id`]) });
    } else if (t === "breaks" || t === "competition_breaks") {
      const cup = t !== "breaks";
      const key = breakKey(row, cup ? "c" : "");
      if (seen.has(key)) return;
      seen.add(key);
      popup(`${name(row.player_id)} has made a break of ${row.value}`, { kind: "breaks", avatar: face(row.player_id) });
      // A new best? Confetti — whether or not their bell is on (it has its own switch: Celebrations).
      const site = await settings().catch(() => ({}));
      const record = await recordBreak(row, cup, site.celebrate_breaks ?? "season").catch(() => null);
      if (record && wantsKind("confetti")) celebrate({ ...record, value: row.value, name: name(row.player_id), avatar: face(row.player_id) });
    } else if (t === "players" && type === "INSERT") {
      popup(`${row.full_name} has joined ${teams.find((x) => x.id === row.team_id)?.name ?? "the league"}`, { kind: "players", avatar: row.avatar_url ?? "" });
    }
  });
}

export function stopNotifications() { if (stop) stop(); stop = null; }

/** Who is top of each league's table and of its player rankings right now: Map(league id → { name, team, player, pts, href, rankHref }). */
async function leaders() {
  invalidate();
  const { seasonContext } = await import("./context.js");
  const ctx = await seasonContext();
  return new Map(ctx.leagues.map((l) => {
    const top = ctx.standings(l.id).find((r) => r.p > 0 && r.pos === 1), best = ctx.rankings(l.id)[0];
    return [l.id, { name: l.name, team: top?.team ?? null, player: best?.pts ? best.player : null, pts: best?.pts ?? 0,
      href: `/seasons/${ctx.season?.name}/league-tables/${l.slug}`, rankHref: `/seasons/${ctx.season?.name}/rankings/${l.slug}` }];
  }));
}
/** The winner (if there is one yet) of every competition: Map(competition id → { name, winner, trophy, href }). */
async function champions() {
  invalidate();
  const data = await loadCompetitions();
  return new Map(data.competitions.map((c) => {
    const b = buildBracket(data.entries.filter((e) => e.competition_id === c.id), data.matches.filter((m) => m.competition_id === c.id));
    return [c.id, { name: c.name, winner: b.champion ? b.entryById.get(b.champion)?.name ?? null : null, trophy: c.trophy_url || "", href: `/competition/${c.slug}` }];
  }));
}
