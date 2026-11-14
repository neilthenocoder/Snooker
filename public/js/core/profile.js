// ─────────────────────────────────────────────────────────────
//  THE PROFILE PAGE PIECES (round 116 — Rich's mock-up of the player page: "want the team one to be in a similar vein").
//  One set of building blocks used by pages/player.js and pages/team.js, so the two pages always match:
//    profileHero   the coloured header block: photo or crest, name, a line about them, the Follow button
//    profileTabs   the row of rounded buttons that slides sideways — each jumps to a part of the page
//    statTiles     the big-number tiles ("Player stats", "Team stats")
//    nextMatch     the next league match as a card: home · crest · time · crest · away
//    teamForm      the team's matches as columns (MW 6, MW 7 …) with the opponent's crest and the score,
//                  green for a win and red for a defeat, and a Previous / Upcoming switch
//    matesGrid     the squad as numbered cards
//    newsRail      articles as picture cards in a row that slides
//  No database calls here: everything is worked out from the season context (core/context.js).
// ─────────────────────────────────────────────────────────────
import { html, fmtTime, fmtDay, fmtAgo, safeHref, cssUrl } from "./dom.js";
import { avatar, badge, urls } from "./components.js";

const star = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8Z"/></svg>`;

/** The header block. opts: { picture, small, big, meta: [content…], follow, tone: "" | "dark" } */
/**
 * Round 117 (Rich: "the ability to upload an SVG background — the emblems as a faint pattern, and a colour, to brand
 * them"): the look of a header block. A team's own (Admin → Teams → "Header background") comes first, then the one for
 * every player and team page (Admin → Site settings → Player and team pages), then the plain red block.
 */
export function heroLook(team, site) {
  const h = site?.home_sections ?? {};
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v ?? "")) ? v : "");
  const color = hex(team?.hero_color) || hex(h.profile_bg_color);
  const own = safeHref(team?.hero_bg_url), bg = own || safeHref(h.profile_bg_url);
  const fit = (own ? team?.hero_bg_fit : h.profile_bg_fit) === "cover" ? "cover" : "pattern";
  // Light or dark writing, whichever reads on the colour.
  const [r, g, b] = color ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) : [241, 0, 42];
  return { color, bg, fit, light: (r * 299 + g * 587 + b * 114) / 1000 > 165 };
}
export function profileHero({ picture, small = "", big, meta = [], follow = "", tone = "", look = null }) {
  const style = look && !tone ? `${look.color ? `--pp-color:${look.color};` : ""}${look.bg ? `--pp-bg:${cssUrl(look.bg)};` : ""}` : "";
  return html`<header class="pp-hero ${tone ? `pp-hero--${tone}` : ""} ${style && look.bg ? `pp-hero--bg pp-hero--${look.fit}` : ""} ${style && look.light ? "pp-hero--light" : ""}" style="${style}">
    <span class="pp-hero__pic">${picture}</span>
    <div class="pp-hero__text">
      ${small ? html`<span class="pp-hero__small">${small}</span>` : ""}
      <h1 class="pp-hero__big">${big}</h1>
      ${meta.filter(Boolean).length ? html`<p class="pp-hero__meta">${meta.filter(Boolean).map((m, i) => html`<span>${i ? html`<i aria-hidden="true">•</i>` : ""}${m}</span>`)}</p>` : ""}
    </div>
    ${follow ? html`<span class="pp-hero__follow">${follow}</span>` : ""}
  </header>`;
}

/** The sliding row of buttons: [[label, "#anchor" or "/address"], …] — empty ones are left out. */
export const profileTabs = (items) => { const list = items.filter(Boolean);
  return list.length ? html`<nav class="pp-tabs" aria-label="On this page">${list.map(([label, href]) => html`<a href="${href}" ${href.startsWith("#") ? html`data-pp-jump` : ""}>${label}</a>`)}</nav>` : ""; };

/** Big-number tiles: [[label, value], …]. */
export const statTiles = (items, cls = "") => html`<div class="pp-stats ${cls}">${items.map(([label, value]) => html`<div class="pp-stat"><span>${label}</span><b>${value}</b></div>`)}</div>`;

/** A section with its heading (and an id to jump to). */
export const profileSection = (id, title, body, extra = "") => (body ? html`<section class="pp-sec" id="${id}"><div class="pp-sec__head"><h2>${title}</h2>${extra}</div>${body}</section>` : "");

const teamFixtures = (ctx, teamId) => ctx.fixturesFor(teamId).filter((f) => f.starts_at).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
const isDone = (ctx, f) => ctx.hasResult(f) && f.status !== "in_progress";

/** A team's next league match (not postponed, no result yet), or null. */
export function nextFixture(ctx, teamId) {
  const from = new Date(Date.now() - 3 * 3600e3).toISOString();
  return teamFixtures(ctx, teamId).find((f) => f.starts_at >= from && !ctx.hasResult(f) && f.status !== "postponed") ?? null;
}

/** The next match as a card. */
export function nextMatch(ctx, teamId) {
  const f = nextFixture(ctx, teamId);
  if (!f) return html`<div class="pp-card pp-empty">No league match coming up just now. <a href="/calendar">See the calendar</a></div>`;
  const home = ctx.team.get(f.home_team_id), away = ctx.team.get(f.away_team_id), league = ctx.league.get(f.league_id), venue = ctx.venue.get(f.venue_id ?? home?.venue_id);
  return html`<a class="pp-card pp-next" href="${urls.match(f)}">
    <span class="pp-next__row"><b class="pp-next__team">${home?.name ?? "TBC"}</b><span class="pp-next__crest">${badge(home)}</span>
      <span class="pp-next__time">${fmtTime(f.starts_at)}</span>
      <span class="pp-next__crest">${badge(away)}</span><b class="pp-next__team">${away?.name ?? "TBC"}</b></span>
    <span class="pp-next__meta">${[league?.name, fmtDay(f.starts_at, { withYear: true }), venue?.name].filter(Boolean).join(" • ")}</span></a>`;
}

/**
 * Team form: the last six matches and the next six, as columns. Each column: "MW 7" (the team's 7th match of the
 * season), the opponent's crest, and the score (green = won, red = lost, grey = level) or the date for one to come.
 */
export function teamForm(ctx, team, { count = 6 } = {}) {
  const all = teamFixtures(ctx, team.id);
  if (!all.length) return "";
  const week = new Map(all.map((f, i) => [f.id, i + 1]));
  const played = all.filter((f) => isDone(ctx, f)).slice(-count);
  const from = new Date(Date.now() - 3 * 3600e3).toISOString();
  const coming = all.filter((f) => !ctx.hasResult(f) && (f.starts_at >= from || f.status === "postponed")).slice(0, count);
  if (!played.length && !coming.length) return "";
  const col = (f, done) => {
    const home = f.home_team_id === team.id, opp = ctx.team.get(home ? f.away_team_id : f.home_team_id);
    const s = done ? ctx.scoreOf(f) : null, mine = s ? (home ? s.home : s.away) : 0, theirs = s ? (home ? s.away : s.home) : 0;
    const what = done ? (mine > theirs ? "w" : mine < theirs ? "l" : "d") : f.status === "postponed" ? "pp" : "tc";
    const word = { w: "Won", l: "Lost", d: "Drew", pp: "Postponed", tc: "" }[what];
    const chip = done ? `${mine}-${theirs}` : f.status === "postponed" ? "P-P" : fmtDay(f.starts_at).replace(/\s\d{4}$/, "");
    return html`<a class="pp-mw" href="${urls.match(f)}" title="${done ? `${word} ${mine}–${theirs} ${home ? "at home to" : "away to"} ${opp?.name ?? "?"}` : `${home ? "Home to" : "Away to"} ${opp?.name ?? "?"} · ${fmtDay(f.starts_at, { withYear: true })}`}">
      <small>MW ${week.get(f.id)}</small><span class="pp-mw__crest">${badge(opp)}</span><span class="pp-mw__opp">${home ? "H" : "A"}</span><b class="pp-mw__chip is-${what}">${chip}</b></a>`;
  };
  const first = played.length ? "prev" : "next";
  return html`<div class="pp-card pp-form" data-pp-form>
    <div class="pp-form__head"><a class="pp-form__team" href="${urls.team(team)}">${badge(team)}<b>${team.name}</b></a>
      ${played.length && coming.length ? html`<span class="pp-switch" role="group" aria-label="Which matches">
        <button type="button" data-pp-form-tab="prev" aria-pressed="${String(first === "prev")}">Previous</button>
        <button type="button" data-pp-form-tab="next" aria-pressed="${String(first === "next")}">Upcoming</button></span>` : ""}</div>
    ${played.length ? html`<div class="pp-form__row" data-pp-form-pane="prev" ${first === "prev" ? "" : "hidden"}>${played.map((f) => col(f, true))}</div>` : ""}
    ${coming.length ? html`<div class="pp-form__row" data-pp-form-pane="next" ${first === "next" ? "" : "hidden"}>${coming.map((f) => col(f, false))}</div>` : ""}
  </div>`;
}

/** The squad as numbered cards, captain first. `skipId` leaves one player out (the page you are on). */
export function matesGrid(players, { skipId = null, note = () => "" } = {}) {
  const order = (p) => (/vice/i.test(p.position ?? "") ? 1 : /captain/i.test(p.position ?? "") ? 0 : 2);
  const list = [...players].sort((a, b) => order(a) - order(b) || a.full_name.localeCompare(b.full_name)).map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => p.id !== skipId);
  if (!list.length) return "";
  return html`<div class="pp-card pp-mates">${list.map(({ p, n }) => html`<a class="pp-mate" href="${urls.player(p)}">
    ${avatar(p, "avatar pp-mate__face")}
    <span class="pp-mate__text"><b>${p.full_name}</b><small>${(p.position || "Player").replace(/^Team /i, "")}</small>${note(p) ? html`<small class="pp-mate__note">${note(p)}</small>` : ""}</span></a>`)}</div>`;
}

/** Articles as picture cards in one row that slides sideways. */
export function newsRail(list, { limit = 8 } = {}) {
  if (!list.length) return "";
  const fresh = (a) => Date.now() - Date.parse(a.published_at) < 7 * 864e5;
  return html`<div class="pp-news">${list.slice(0, limit).map((a) => html`<a class="pp-newscard" href="${urls.article(a)}">
    ${a.image_url || a.circle_image_url ? html`<img src="${a.image_url || a.circle_image_url}" alt="" loading="lazy">` : ""}
    ${fresh(a) ? html`<span class="pp-newscard__new">New</span>` : ""}
    <span class="pp-newscard__text"><b>${a.title}</b><small>${fmtAgo(a.published_at)}</small></span></a>`)}</div>`;
}

/** Articles about a team: ones that name one of its players, or name the team in the headline or summary. */
export function teamNewsOf(news, team, players) {
  const ids = new Set(players.map((p) => p.id)), name = String(team?.name ?? "").toLowerCase();
  return news.filter((a) => (a.player_ids ?? []).some((id) => ids.has(id)) || (name && `${a.title} ${a.excerpt ?? ""}`.toLowerCase().includes(name)));
}

/** Makes the switches and the jump buttons on a profile page work. Returns nothing; listeners die with the page. */
export function wireProfile(view) {
  view.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-pp-form-tab]");
    if (tab) {
      const box = tab.closest("[data-pp-form]");
      for (const b of box.querySelectorAll("[data-pp-form-tab]")) b.setAttribute("aria-pressed", String(b === tab));
      for (const p of box.querySelectorAll("[data-pp-form-pane]")) p.hidden = p.dataset.ppFormPane !== tab.dataset.ppFormTab;
      return;
    }
    const jump = e.target.closest("[data-pp-jump]");
    if (jump) {
      const target = view.querySelector(jump.getAttribute("href"));
      if (!target) return;
      e.preventDefault(); e.stopPropagation();
      const top = target.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64) - 14;
      scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      history.replaceState(history.state, "", jump.getAttribute("href"));
    }
  });
}
export { star as profileStar };
