// ─────────────────────────────────────────────────────────────
//  LIVE NOTIFICATIONS — green pop-ups (with the player's photo)
//  when a frame is won, a break is made, news is published, a
//  league or the rankings has a new leader, a tie is drawn, a
//  competition is won or a player joins — and, in their own
//  colours, the notices the league sends out itself: breaking
//  news, important updates and offers (Admin → Notifications).
//  The bell in the menu opens a side panel where each visitor
//  switches the kinds they want on and off (remembered in this
//  browser only). The same listener sets off the confetti for the
//  big moments (Admin → Site settings → Celebrations).
// ─────────────────────────────────────────────────────────────
import { listen, table, selectIn, nearbyMatches, settings, invalidate, competitionBreaks, loadCompetitions, currentCompetitions, articleList } from "./api.js";
import { frameWinner, RULES } from "./rules.js";
import { celebrate } from "./celebrate.js";
import { buildBracket } from "./bracket.js";
import { safeHref } from "./dom.js";
import { getUser } from "./auth.js";
import { myTickets } from "./api.js";
import { handlesSupport } from "./support.js";

const KEY = "sbdsl-notifications";
export const notificationsOn = () => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } };
export const setNotifications = (on) => { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {} };

/** The kinds of notification a visitor can have: [key, name, what it is]. Everything is on until they switch it off. */
export const NOTIFY_KINDS = [
  ["results", "Results", "A pop-up as each frame is won on a match night"],
  ["breaks", "Breaks", "Every break of 30 or more, as it is entered"],
  ["breaking", "Breaking news", "The big stories, the moment the league sends them out"],
  ["updates", "Important updates", "Things you need to know: a postponement, a rule change, a venue or date that has moved"],
  ["offers", "Offers", "Offers from the league and its sponsors"],
  ["news", "News", "When a new article is published"],
  ["leaders", "Tables & rankings", "A new team at the top of a league, or a new leader of the player rankings"],
  ["comps", "Competitions", "Each tie as a draw is made live, and the winner of a competition"],
  ["players", "New players", "When a player joins a team"],
  ["support", "Help & support", "When the league answers your request (officers: new requests and replies)"],
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

// ── notices: breaking news, important updates and offers ───────
// Sent from Admin → Notifications (and a news article ticked "Breaking news"). Anyone on the website at
// that moment gets a pop-up; everyone else finds them behind the bell, which shows how many are new.
/** A notice's kind → the switch that decides whether this visitor wants it, its label and its colour. */
export const NOTICE_KIND = {
  breaking: { pref: "breaking", label: "Breaking news", tone: "breaking" },
  update: { pref: "updates", label: "Important update", tone: "update" },
  offer: { pref: "offers", label: "Offer", tone: "offer" },
};
export const NOTICE_DAYS = 14;      // how long a notice stays in the list behind the bell
const SEEN_KEY = "sbdsl-notices-seen";
const todayIso = () => new Date().toISOString().slice(0, 10);
/** Is this notice showing today? (Switched on, not past its last day, and sent in the last NOTICE_DAYS days.) */
export const noticeLive = (n) => n.is_active !== false && !!n.title && (!n.ends_on || n.ends_on >= todayIso())
  && Date.now() - Date.parse(n.created_at ?? 0) < NOTICE_DAYS * 864e5;
/** The notices to list behind the bell, newest first — only the kinds this visitor has left switched on. */
export async function latestNotices() {
  const [rows, news] = await Promise.all([table("notices", "created_at").catch(() => []), articleList().catch(() => [])]);
  const prefs = notifyPrefs();
  const fromNews = news.filter((a) => a.is_published && a.breaking).map((a) => ({ id: `article-${a.id}`, kind: "breaking", title: a.title, body: a.excerpt ?? "",
    url: `/news/${a.slug}`, created_at: `${a.published_at}T12:00:00Z`, is_active: true }));
  return [...rows, ...fromNews].filter((n) => NOTICE_KIND[n.kind] && noticeLive(n) && prefs[NOTICE_KIND[n.kind].pref] !== false)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
/** The notices this visitor has already had in front of them (opening the bell reads everything listed). */
export function seenNotices() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); } }
/** How many of them this visitor hasn't opened the bell for yet (none while their notifications are switched off). */
export async function unreadNotices() {
  if (!notificationsOn()) return 0;
  const seen = seenNotices();
  return (await latestNotices().catch(() => [])).filter((n) => !seen.has(n.id)).length;
}
/** The bell has been opened: everything listed now counts as read. */
export async function markNoticesSeen() {
  const ids = (await latestNotices().catch(() => [])).map((n) => n.id);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...ids, ...seenNotices()])].slice(0, 200))); } catch { /* not remembered */ }
}
/** Called when a notice arrives or is read, so the bell's number can be redrawn. */
let onNotice = () => {};
export const setNoticeWatcher = (fn) => { onNotice = fn; };

let stop = null;
const seen = new Set();
const SHOW_MS = 9000;        // how long a pop-up stays (match news): long enough to read on a phone. Each has a × to close it sooner.
const NOTICE_MS = 20000;     // breaking news, important updates and offers stay longer
const HOLD_MS = 2500;        // after a finger or the mouse leaves a pop-up, it stays at least this long
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
export function popup(message, { kind = "results", avatar = null, icon = null, href = null, tone = "", label = "", stay = SHOW_MS } = {}) {
  if (!wantsKind(kind)) return;
  let box = document.querySelector(".live-pops");
  if (!box) { box = document.createElement("div"); box.className = "live-pops"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  // The message (a link when there is somewhere to go) and, beside it, a × to close it now.
  const el = document.createElement("div");
  el.className = `live-pop ${tone ? `tone-${tone}` : ""}`;
  const body = document.createElement(href ? "a" : "div");
  body.className = "live-pop-body";
  if (href) body.href = href;
  if (avatar !== null || icon) {
    const img = document.createElement("img");
    img.className = `live-pop-face ${icon ? "icon" : ""}`;
    img.src = icon === "trophy" ? "/assets/trophy.svg" : avatar || "/assets/avatar.svg";
    img.alt = "";
    el.classList.add("with-face");
    body.append(img);
  }
  const text = document.createElement("span");
  if (label) { const tag = document.createElement("b"); tag.className = "live-pop-tag"; tag.textContent = label; text.append(tag); }
  text.append(message);
  body.append(text);
  const x = document.createElement("button");
  x.type = "button"; x.className = "live-pop-x"; x.setAttribute("aria-label", "Close this message"); x.title = "Close"; x.textContent = "×";
  el.append(body, x);
  box.append(el);
  // Never more than four on screen at once (a whole scorecard can arrive together).
  while (box.children.length > 4) box.firstElementChild.remove();

  // It goes by itself after `stay` — but the clock stops while a finger or the mouse is on it, so there is time to read it.
  let left = stay, since = Date.now(), timer = null, gone = false;
  const leave = () => { if (gone) return; gone = true; clearTimeout(timer); el.classList.add("out"); setTimeout(() => el.remove(), 400); };
  const start = () => { if (gone) return; clearTimeout(timer); since = Date.now(); timer = setTimeout(leave, left); };
  const hold = () => { if (gone) return; clearTimeout(timer); left = Math.max(HOLD_MS, left - (Date.now() - since)); };
  for (const [on, off] of [["mouseenter", "mouseleave"], ["touchstart", "touchend"], ["focusin", "focusout"]]) {
    el.addEventListener(on, hold, { passive: true }); el.addEventListener(off, start, { passive: true });
  }
  el.addEventListener("touchcancel", start, { passive: true });
  x.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); gone = true; clearTimeout(timer); el.remove(); });
  if (href) body.addEventListener("click", () => setTimeout(leave, 0));      // opened: it has done its job
  start();
}

const frameKey = (f, pre = "") => `${pre}f:${f.fixture_id ?? f.match_id}:${f.frame_no}:${f.home_points ?? f.a_points}-${f.away_points ?? f.b_points}`;
const breakKey = (b, pre = "") => `${pre}b:${b.fixture_id ?? b.match_id}:${b.frame_no}:${b.player_id}:${b.value}`;

/**
 * Is this break a new best — of the season in its league or competition, or (if the
 * setting says so) of the last seven days? Returns the words for the card, or null.
 */
/** Small print on a live celebration (Rich, round 23): it pops up the moment the break is saved. */
const UNOFFICIAL = "This break is not official until the scorecard has been submitted and approved.";
async function recordBreak(row, isCup, mode) {
  if (mode === "off" || row.value < RULES.breakMinimum) return null;
  invalidate();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  let others, where, href, note = "";
  if (isCup) {
    const [matches, comps] = await Promise.all([table("competition_matches", "round"), table("competitions", "sort")]);
    const match = matches.find((m) => m.id === row.match_id), comp = comps.find((c) => c.id === match?.competition_id);
    if (!comp) return null;
    const inComp = matches.filter((m) => m.competition_id === comp.id);
    others = (await competitionBreaks(inComp.map((m) => m.id))).filter((b) => b.id !== row.id)
      .map((b) => ({ value: b.value, when: inComp.find((m) => m.id === b.match_id)?.starts_at ?? "" }));
    where = comp.name; href = `/cup-match/${match.no ?? match.id}`;
    if (match.status !== "completed") note = UNOFFICIAL;
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
    if (fx.status !== "approved") note = UNOFFICIAL;
  }
  const best = (list) => Math.max(0, ...list.map((b) => b.value));
  // Rich, round 38: in a competition it says so — "New highest break of the competition (Team Handicap)".
  if (row.value > best(others)) return { what: isCup ? `New highest break of the competition (${where})` : "New highest break of the season", where, href, note };
  if (mode === "week" && row.value > best(others.filter((b) => b.when >= weekAgo))) return { what: "Highest break of the week", where, href, note };
  return null;
}

export async function startNotifications() {
  stopNotifications();
  // Wait until the first page is up (main.js sets sbdslStarted): this is background work, and it shouldn't compete
  // with the page the visitor is waiting for.
  for (let i = 0; i < 40 && !window.sbdslStarted; i++) await new Promise((r) => setTimeout(r, 250));
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
  const newsSeen = new Set((await articleList().catch(() => [])).filter((a) => a.is_published).map((a) => a.id));
  // Who leads each league and its rankings now, and who has won each competition — to spot a change.
  let tops = await leaders().catch(() => null);
  let champs = await champions().catch(() => null);
  let leaderTimer = null, champTimer = null;
  const checkLeaders = () => { clearTimeout(leaderTimer); leaderTimer = setTimeout(async () => {
    const [now, site] = await Promise.all([leaders(true).catch(() => null), settings().catch(() => ({}))]);
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
    const [now, site] = await Promise.all([champions(true).catch(() => null), settings().catch(() => ({}))]);
    if (!now || !champs) { champs = now ?? champs; return; }
    for (const [id, c] of now) {
      if (!c.winner || champs.get(id)?.winner === c.winner) continue;
      popup(`${c.winner} has won the ${c.name}`, { kind: "comps", icon: "trophy", href: c.href });
      if (site.celebrate_winners !== false && wantsKind("confetti")) celebrate({ what: "Competition winner", name: c.winner, where: c.name, avatar: c.trophy, trophy: true, href: c.href, hrefLabel: "See the competition" });
    }
    champs = now;
  }, 1500); };

  // Notices already sent, so only a NEW one (or one just switched on) makes a pop-up.
  const noticesSeen = new Set((await table("notices", "created_at").catch(() => [])).filter(noticeLive).map((n) => n.id));

  stop = listen(["frames", "breaks", "players", "competition_frames", "competition_breaks", "competitions", "articles", "fixtures", "competition_matches", "notices", "support_tickets", "support_messages"], async (t, row, type) => {
    if (t === "notices") { invalidate(); onNotice(); }
    if (type === "DELETE" || !row.id) return;
    if (t === "support_tickets" || t === "support_messages") return supportNotice(t, row, type).catch(() => {});
    if (t === "notices") {
      const k = NOTICE_KIND[row.kind];
      if (!k || !noticeLive(row)) { noticesSeen.delete(row.id); return; }
      if (noticesSeen.has(row.id)) return;
      noticesSeen.add(row.id);
      return popup(row.title, { kind: k.pref, tone: k.tone, label: k.label, href: safeHref(row.url) || null, stay: NOTICE_MS });
    }
    if (t === "articles") {
      if (!row.is_published || newsSeen.has(row.id)) return;
      newsSeen.add(row.id);
      if (row.breaking) { invalidate(); onNotice(); return popup(row.title, { kind: "breaking", tone: "breaking", label: "Breaking news", href: `/news/${row.slug}`, stay: NOTICE_MS }); }
      return popup(`News: ${row.title}`, { kind: "news", avatar: row.circle_image_url || row.image_url || "", href: `/news/${row.slug}` });
    }
    // A result being approved (or changed) can put a new team or player on top.
    if (t === "fixtures") { matchResult(row).catch(() => {}); return checkLeaders(); }
    if (t === "competition_matches") { if (row.status === "completed") { cupResult(row).catch(() => {}); checkChampions(); } return; }
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

// Round 54 (Rich): when a whole match is finished — "Mevagissey C have beaten Lerryn 5–0" — not just each frame.
// Once per match, and only for a match played in the last two days (an old result being corrected is not news).
const recent = (iso) => iso && Math.abs(Date.now() - Date.parse(iso)) < 2 * 864e5;
// ── Round 55: Help & support ──────────────────────────────────
// The database only sends each login the requests it may see: the sender their own (never private notes), the
// officers the categories their role looks after.
const newTickets = new Set();
async function supportNotice(t, row, type) {
  if (type !== "INSERT") return;
  const me = await getUser().catch(() => null);
  if (!me) return;
  const opts = (href) => ({ kind: "support", href, tone: "update", label: "Help & support", stay: NOTICE_MS });
  if (t === "support_tickets") {
    newTickets.add(row.id);
    if (handlesSupport(me) && row.user_id !== me.id && !location.pathname.startsWith("/admin/support")) popup(`New support request #${row.no}: ${row.subject}`, opts(`/admin/support?t=${row.id}`));
    return;
  }
  if (row.internal || (row.author_id && row.author_id === me.id)) return;
  await new Promise((r) => setTimeout(r, 1500));          // (a new request's first message isn't news on its own)
  if (newTickets.has(row.ticket_id)) return;
  if (row.from_league) {
    const mine = (await myTickets(me.id).catch(() => [])).find((x) => x.id === row.ticket_id);
    if (mine && !location.pathname.startsWith(`/support/${mine.token}`)) popup(`The league has answered your request #${mine.no}: ${mine.subject}`, opts(`/support/${mine.token}`));
  } else if (handlesSupport(me) && !location.search.includes(row.ticket_id)) {
    popup(`${row.author_name || "Someone"} has replied on a support request`, opts(`/admin/support?t=${row.ticket_id}`));
  }
}

async function matchResult(row) {
  if (!["submitted", "approved"].includes(row.status) || !recent(row.starts_at) || seen.has(`fx-${row.id}`)) return;
  seen.add(`fx-${row.id}`);
  invalidate();
  const { seasonContext } = await import("./context.js");
  const ctx = await seasonContext();
  const fx = ctx.fixture.get(row.id) ?? row, sc = ctx.scoreOf(fx);
  const home = ctx.team.get(fx.home_team_id), away = ctx.team.get(fx.away_team_id);
  if (!home || !away || (!sc.home && !sc.away)) return;
  const [w, l, ws, ls] = sc.home >= sc.away ? [home, away, sc.home, sc.away] : [away, home, sc.away, sc.home];
  popup(ws === ls ? `${home.name} and ${away.name} have drawn ${ws}–${ls}` : `${w.name} have beaten ${l.name} ${ws}–${ls}`,
    { kind: "results", avatar: w.logo_url ?? "", href: (await import("./components.js")).urls.match(fx) });
}
async function cupResult(row) {
  if (!recent(row.result_at ?? row.starts_at) || seen.has(`cm-${row.id}`)) return;
  seen.add(`cm-${row.id}`);
  const [entries, comps] = await Promise.all([table("competition_entries", "seed"), table("competitions", "sort")]);
  const name = (id) => entries.find((e) => e.id === id)?.name;
  const c = comps.find((x) => x.id === row.competition_id);
  // The two sides come from the draw; the scores are on the match itself.
  const a = row.score_a ?? 0, b = row.score_b ?? 0;
  const ea = entries.filter((e) => e.competition_id === row.competition_id);
  const side = (s) => name(row[`entry_${s}`]);
  const A = side("a"), B = side("b");
  if (!A || !B || !c || !ea.length) return;
  popup(a > b ? `${c.name}: ${A} have beaten ${B} ${a}–${b}` : `${c.name}: ${B} have beaten ${A} ${b}–${a}`, { kind: "results", icon: "trophy", href: `/cup-match/${row.no ?? row.id}` });
}

export function stopNotifications() { if (stop) stop(); stop = null; }

/** Who is top of each league's table and of its player rankings right now: Map(league id → { name, team, player, pts, href, rankHref }). */
async function leaders(fresh = false) {
  // Only after a change (fresh): at start-up the page that is loading uses the same data, and clearing it made
  // every first page load everything two or three times over (Rich, round 32: stuck on the loading screen).
  if (fresh) invalidate();
  const { seasonContext } = await import("./context.js");
  const ctx = await seasonContext();
  return new Map(ctx.leagues.map((l) => {
    const top = ctx.standings(l.id).find((r) => r.p > 0 && r.pos === 1), best = ctx.rankings(l.id)[0];
    return [l.id, { name: l.name, team: top?.team ?? null, player: best?.pts ? best.player : null, pts: best?.pts ?? 0,
      href: `/seasons/${ctx.season?.name}/league-tables/${l.slug}`, rankHref: `/seasons/${ctx.season?.name}/rankings/${l.slug}` }];
  }));
}
/** The winner (if there is one yet) of every competition: Map(competition id → { name, winner, trophy, href }). */
async function champions(fresh = false) {
  if (fresh) invalidate();
  const data = await currentCompetitions();
  return new Map(data.competitions.map((c) => {
    const b = buildBracket(data.entries.filter((e) => e.competition_id === c.id), data.matches.filter((m) => m.competition_id === c.id));
    return [c.id, { name: c.name, winner: b.champion ? b.entryById.get(b.champion)?.name ?? null : null, trophy: c.trophy_url || "", href: `/competition/${c.slug}` }];
  }));
}
