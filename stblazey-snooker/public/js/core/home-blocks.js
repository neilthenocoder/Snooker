// ─────────────────────────────────────────────────────────────
//  THE STANDARD HOME PAGE (Rich, round 47)
//  "The standard homepage should be about news and promotion, players and teams — not loads of
//  tables and rankings, as that would be for My Snooker." The admin picks which blocks show and in
//  what order (Admin → Site settings → Home page → Home page sections). Between seasons (there is no
//  snooker from about April to September) a promotion block fills the gap: when the new season
//  starts, the AGM / presentation night and the other key dates, and "join the league".
// ─────────────────────────────────────────────────────────────
import { html, fmtDate, fmtLongDate, fmtTime, safeHref } from "./dom.js";
import { urls, badge, trophy, picture, compBoxStyle } from "./components.js";
import { buildBracket, roundName, compScoreText } from "./bracket.js";
import { mySnookerOn, mySnookerSetUp } from "./auth.js";
import { SITE } from "../config.js";

/** Every block the standard home page can show: [key, name in the dashboard, shown as standard]. */
export const HOME_SECTIONS = [
  ["promo", "Season & “join the league” promotion (shows by itself between seasons)", true],
  ["mysnooker", "“Make this page your own” — the My Snooker invitation", true],
  ["news", "Latest news", true],
  ["competitions", "Competitions (the one being played as the big feature)", true],
  ["spotlights", "Player and team of the week / month", true],
  ["teams", "Our teams", true],
  ["cueviews", "CueViews", true],
  ["tables", "League tables", false],
  ["shields", "Shield holders", false],
  ["side_breaks", "Side column: highest breaks", false],
  ["side_rankings", "Side column: player rankings", false],
];

/** The blocks to show, in order: [{ key, on }], from the settings (missing ones take their standard). */
export function homeSections(site) {
  const cfg = site.home_sections ?? {};
  return HOME_SECTIONS.map(([key, , std], i) => ({
    key, on: cfg[key] === undefined || cfg[key] === "" ? std : cfg[key] === true || cfg[key] === "true",
    pos: Number(cfg[`${key}_pos`]) || i + 1,
  })).sort((a, b) => a.pos - b.pos);
}

const DAY = 864e5;
/**
 * Between seasons: no league match in the last two weeks or the next three, and no competition match
 * coming up in the next three weeks. (Admin can also show the promotion all the time, or never.)
 */
export function isOffSeason(ctx, comps = []) {
  const now = Date.now();
  const near = (iso) => iso && Date.parse(iso) > now - 14 * DAY && Date.parse(iso) < now + 21 * DAY;
  if (ctx.fixtures.some((f) => near(f.starts_at))) return false;
  if (comps.some(({ facts }) => facts?.next && Date.parse(facts.next) < now + 21 * DAY)) return false;
  return true;
}

const arrow = html`<span aria-hidden="true">→</span>`;

/** The promotion block: the new season's start, the dates coming up, and the invitation to join. */
export function promoBlock(site, ctx, dates, today) {
  const future = ctx.fixtures.map((f) => f.starts_at).filter((d) => d && d.slice(0, 10) >= today).sort();
  const seasonDate = dates.find((d) => d.is_active !== false && d.starts_on >= today && /season|start|opening/i.test(d.title));
  const start = future[0] ?? (seasonDate ? `${seasonDate.starts_on}T19:30:00Z` : null);
  const coming = dates.filter((d) => d.is_active !== false && (d.ends_on || d.starts_on) >= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on)).slice(0, 4);
  const title = site.promo_title || (start ? html`The new season starts <span>${fmtLongDate(start)}</span>` : "The new season is on its way");
  const text = site.promo_text || `Playing in the league is free for players and teams. Bring your mates, enter a team and play in one of Cornwall's oldest leagues — established ${SITE.established}.`;
  const url = safeHref(site.promo_url) || "/page/contact-us";
  return html`<section class="promo" aria-label="The new season">
    <div class="promo-main">
      <span class="promo-kicker">${start ? "Coming up" : "Between seasons"}</span>
      <h2>${title}</h2>
      <p>${text}</p>
      <div class="promo-btns"><a class="btn promo-go" href="${url}">${site.promo_button || "Join the league"} ${arrow}</a>
        <a class="btn ghost promo-more" href="/calendar">All the dates</a></div>
    </div>
    ${coming.length ? html`<ul class="promo-dates">${coming.map((d) => html`<li><a href="${safeHref(d.url) || "/calendar"}">
      <time datetime="${d.starts_on}"><b>${fmtDate(d.starts_on).slice(0, 2)}</b><small>${new Date(`${d.starts_on}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</small></time>
      <span>${d.title}</span></a></li>`)}</ul>` : ""}
  </section>`;
}

/** The invitation to make the page your own with My Snooker (or the way back to it). */
export function mySnookerPrompt(user, ctx) {
  if (user && mySnookerOn(user) && mySnookerSetUp(user)) return "";       // they already have the bar at the top
  const href = user ? "/my/snooker" : "/login";
  return html`<a class="ms-invite" href="${href}">
    <span class="ms-invite-star" aria-hidden="true">★</span>
    <span><b>Make this page your own</b><small>${user ? "Set up My Snooker" : "Log in and use My Snooker"}: your team's table, fixtures, results, rankings, breaks and news on one page.</small></span>
    <i>${user ? "Set it up" : "Log in"} ${arrow}</i></a>`;
}

/** Latest news: six cards (the banner's stories left out). */
export function newsBlock(news, skipIds = []) {
  const list = news.filter((a) => !skipIds.includes(a.id)).slice(0, 6);
  if (!list.length) return "";
  const pic = (a) => (a.image_url || a.circle_image_url ? html`<img src="${a.image_url || a.circle_image_url}" alt="" loading="lazy">` : html`<span class="hub-ph" aria-hidden="true"></span>`);
  return html`<section class="home-block">
    <div class="hb-head"><h2>Latest news</h2><a href="/news">All the news ${arrow}</a></div>
    <div class="mini-cards home-news">${list.map((a) => html`<a class="hub-card" href="${urls.article(a)}">
      <div class="hub-pic">${pic(a)}</div>
      <div class="hub-body">${a.category ? html`<span class="hub-cat">${a.category}</span>` : ""}<h3>${a.title}</h3>
        <div class="hub-meta"><span>${fmtDate(a.published_at)}</span></div></div></a>`)}</div>
  </section>`;
}

/**
 * Competitions like the news: the one being played now (or next, or most recently) as the big
 * feature, and the others beside it.
 */
export function compsBlock(comps, data) {
  if (!comps.length) return "";
  const now = Date.now();
  const info = comps.map((x) => {
    const b = buildBracket(data.entries.filter((e) => e.competition_id === x.c.id), data.matches.filter((m) => m.competition_id === x.c.id));
    const real = b.rounds.flat().filter((m) => !m.isBye);
    const live = real.find((m) => m.row.status === "in_progress");
    const last = real.filter((m) => m.played).sort((p, q) => String(q.row.result_at ?? q.row.starts_at ?? "").localeCompare(String(p.row.result_at ?? p.row.starts_at ?? "")))[0];
    const known = (m) => b.entryById.has(m.a) && b.entryById.has(m.b);      // both sides decided (not "TBC v TBC")
    const next = real.filter((m) => !m.played && known(m) && m.row.starts_at && Date.parse(m.row.starts_at) > now - 3 * 3600e3).sort((p, q) => p.row.starts_at.localeCompare(q.row.starts_at))[0];
    const name = (id) => b.entryById.get(id)?.name ?? "TBC";
    const done = !!b.champion, drawn = real.length > 0;
    // Most active first: live, then the soonest match coming up, then the latest result; finished and undrawn last.
    const score = live ? 4e15 : next && !done ? 3e15 - Date.parse(next.row.starts_at) : last && !done ? 2e15 + Date.parse(last.row.result_at ?? last.row.starts_at ?? 0) : done ? 1e15 : 0;
    return { ...x, b, live, last, next, name, done, drawn, score };
  }).sort((p, q) => q.score - p.score);
  const [top, ...rest] = info;
  const line = (m, x) => html`${x.name(m.a)} <b>${compScoreText(m.row, "–") || "v"}</b> ${x.name(m.b)}`;
  const status = top.live ? html`<span class="cf-live">Being played now</span>` : top.next ? "Next match" : top.done ? "Finished" : top.last ? "Latest result" : "Coming up";
  const pic = compBoxStyle(top.c) !== "trophy" && top.c.image_url ? picture(top.c.image_url, "", "cf-pic") : html`<div class="cf-trophy">${trophy(top.c)}</div>`;
  const focus = top.live ?? top.next ?? top.last;
  return html`<section class="home-block">
    <div class="hb-head"><h2>Competitions</h2><a href="/competitions">All competitions ${arrow}</a></div>
    <div class="comp-feature ${rest.length ? "" : "solo"}">
      <a class="cf-main" href="${urls.competition(top.c)}">${pic}
        <div class="cf-text"><span class="cf-kicker">${status}</span><strong>${top.c.name}</strong>
          <small>${top.progress}</small>
          ${focus ? html`<p class="cf-match">${roundName(focus.round, top.b.totalRounds, top.b)}: ${line(focus, top)}${top.next && focus === top.next ? html` <em>${fmtDate(focus.row.starts_at)} ${fmtTime(focus.row.starts_at)}</em>` : ""}</p>` : ""}
          <span class="cf-go">See the draw ${arrow}</span></div></a>
      ${rest.length ? html`<div class="cf-side">${rest.slice(0, 4).map((x) => html`<a class="cf-card" href="${urls.competition(x.c)}">
        <span class="cf-mini">${trophy(x.c)}</span><span><strong>${x.c.name}</strong><small>${x.live ? "Being played now" : x.next && !x.done ? `Next match ${fmtDate(x.next.row.starts_at)}` : x.progress}</small></span></a>`)}</div>` : ""}
    </div>
  </section>`;
}

/** Our teams: every team this season, by league, as small tiles with their emblem. */
export function teamsBlock(ctx) {
  const groups = ctx.leagues.map((l) => ({ l, teams: ctx.teamsIn(l.id).slice().sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.teams.length);
  if (!groups.length) return "";
  return html`<section class="home-block">
    <div class="hb-head"><h2>Our teams</h2><a href="/fixtures">Fixtures & results ${arrow}</a></div>
    ${groups.map(({ l, teams }) => html`<h3 class="hb-sub">${l.name}</h3>
      <div class="team-tiles">${teams.map((t) => html`<a class="team-tile" href="${urls.team(t)}">${badge(t)}<span>${t.name}</span></a>`)}</div>`)}
  </section>`;
}
