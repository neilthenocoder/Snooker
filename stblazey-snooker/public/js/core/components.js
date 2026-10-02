// Reusable building blocks. Every table, panel and card on the site
// is drawn by one of these functions — change it here, it changes everywhere.
import { html, fmtDate, fmtTime } from "./dom.js";

// ── URLs (one place to change the site's link structure) ──────
export const urls = {
  team: (t) => `/team/${t.slug}`,
  venue: (v) => `/venue/${v.slug}`,
  match: (fx) => `/match/${fx.id}`,
  scorecard: (fx) => `/scorecard/${fx.id}`,
  article: (a) => `/news/${a.slug}`,
  standings: (l) => `/standings/${l.slug}`,
  page: (p) => `/page/${p.slug}`,
  player: (p) => `/player/${p.id}`,
  competition: (c) => `/competition/${c.slug}`,
};

export const shortName = (league) => league.short_name || league.name.replace(/ League$/i, "");

// ── primitives ────────────────────────────────────────────────
/** A player's photo, or the default cartoon if none has been uploaded. */
export const avatar = (player, cls = "avatar") =>
  html`<img class="${cls}" src="${player?.avatar_url || "/assets/avatar.svg"}" alt="" loading="lazy">`;

/** Photo + name, linking to the player's page. */
export const playerLink = (player, cls = "") =>
  player ? html`<a class="team-cell ${cls}" href="${urls.player(player)}">${avatar(player)}${player.full_name}</a>` : "Unknown";
export const picture = (url, alt = "", cls = "") =>
  url ? html`<img class="${cls}" src="${url}" alt="${alt}" loading="lazy">` : html`<div class="ph ${cls}"></div>`;

export function badge(team) {
  if (!team) return "";
  if (team.logo_url) return html`<span class="badge logo"><img src="${team.logo_url}" alt="" loading="lazy"></span>`;
  const initials = team.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return html`<span class="badge">${initials}</span>`;
}

/** A league's or venue's emblem (or its initials when none has been uploaded). */
export const emblem = (thing, cls = "") => (thing ? html`<span class="emblem ${cls}">${badge({ name: thing.name, logo_url: thing.logo_url })}</span>` : "");

/** Photo, name and a line of small print — used for squads and "Our Players". */
export const personCard = (p, note = "") => html`<a class="person-card" href="${urls.player(p)}">${avatar(p, "person-photo")}
  <strong>${p.full_name}</strong>${note ? html`<small>${note}</small>` : ""}</a>`;

export const teamLink = (team, strong = false) =>
  team ? html`<a class="team-cell ${strong ? "strong" : ""}" href="${urls.team(team)}">${badge(team)}${team.name}</a>` : "–";

export const statusBadge = (status) => html`<span class="status ${status}">${String(status).replace("_", " ")}</span>`;

/** Signed handicap: +16, -14, 0. */
export const handicapText = (h) => (Number(h) > 0 ? `+${h}` : String(h ?? 0));

/** Season dropdown — main.js reloads the page with ?season=… when it changes. */
export const seasonPicker = (ctx) => html`<label class="toolbar" style="font-weight:700">Season
  <select data-season-picker>${[...ctx.seasons].reverse().map((s) => html`<option value="${s.id}" ${s.id === ctx.season?.id ? "selected" : ""}>${s.name}</option>`)}</select></label>`;

/** "26-27" from "2026-2027". */
export const seasonShort = (season) => (season?.name ?? "").replace(/\d\d(\d\d)/g, "$1");

export function breadcrumb(items) {
  return html`<nav class="breadcrumb" aria-label="Breadcrumb">${items.map(([label, href]) =>
    href ? html`<a href="${href}">${label}</a>` : html`<span>${label}</span>`)}</nav>`;
}

export function panel(title, body, { color = "", href = "", foot = null, cls = "" } = {}) {
  const head = href ? html`<a class="panel-head ${color}" href="${href}">${title}</a>` : html`<div class="panel-head ${color}">${title}</div>`;
  return html`<section class="panel ${cls}">${head}${body}${foot ? html`<a class="panel-foot" href="${foot.href}">${foot.label}</a>` : ""}</section>`;
}

/**
 * columns: [{ label, cell: (row, i) => content, cls?: "num" | "right" | "hide-sm" }]
 * options: { highlight: (row) => bool, rowClass: (row) => "class", empty: "text" }
 */
export function dataTable(columns, rows, { highlight = () => false, rowClass = () => "", empty = "Nothing to show yet." } = {}) {
  if (!rows.length) return html`<div class="empty">${empty}</div>`;
  return html`<div class="table-scroll"><table class="data">
    <thead><tr>${columns.map((c) => html`<th class="${c.cls || ""}">${c.label}</th>`)}</tr></thead>
    <tbody>${rows.map((r, i) => html`<tr class="${highlight(r) ? "hl" : ""} ${rowClass(r)}">${columns.map((c) => html`<td class="${c.cls || ""}" data-label="${c.label}">${c.cell(r, i)}</td>`)}</tr>`)}</tbody>
  </table></div>`;
}

export const tile = (title, text, href, cls = "") =>
  html`<a class="tile ${cls}" href="${href}"><h4>${title}</h4><div>Click here to view</div>${text ? html`<p>${text}</p>` : ""}</a>`;

/** The small round picture for an article (its circle image, or its main image). */
export const articleThumb = (a) => a.circle_image_url || a.image_url;

export function articleCard(a) {
  return html`<a class="card" href="${urls.article(a)}">${picture(a.image_url || a.circle_image_url, a.title)}
    <div><h4>${a.title}</h4><small>${fmtDate(a.published_at)}</small>${a.excerpt}</div></a>`;
}

// ── league widgets ────────────────────────────────────────────
export function leagueTablePanel(ctx, league, { limit = Infinity, highlightTeamId } = {}) {
  const rows = ctx.standings(league.id).slice(0, limit);
  const top = (r) => (highlightTeamId ? r.team.id === highlightTeamId : r.pos === 1 && r === rows[0]);
  const table = dataTable([
    { label: "P", cell: (r) => r.pos, cls: "num" },
    { label: "Team", cell: (r) => teamLink(r.team, top(r)) },
    { label: "P", cell: (r) => r.p, cls: "num" },
    { label: "W", cell: (r) => r.w, cls: "num" },
    { label: "L", cell: (r) => r.l, cls: "num" },
    { label: "F", cell: (r) => r.f, cls: "num" },
    { label: "A", cell: (r) => r.a, cls: "num" },
    { label: "P", cell: (r) => r.pts, cls: "num strong" },
  ], rows, { highlight: top, empty: "No teams in this league yet." });
  return panel(`${league.name} Table`, table, {
    foot: Number.isFinite(limit) ? { href: urls.standings(league), label: "View full table" } : null,
  });
}

export function rankingsPanel(ctx, league, { limit = Infinity } = {}) {
  const rows = ctx.rankings(league.id).slice(0, limit);
  const table = dataTable([
    { label: "", cell: (r) => r.pos, cls: "num" },
    { label: "Player", cell: (r) => playerLink(r.player) },
    ...(Number.isFinite(limit) ? [] : [
      { label: "Team", cell: (r) => teamLink(ctx.team.get(r.player.team_id)), cls: "hide-sm" },
      { label: "Won", cell: (r) => r.won, cls: "num" },
      { label: "Lost", cell: (r) => r.lost, cls: "num" },
      { label: "Break pts", cell: (r) => r.breakPts, cls: "num" },
    ]),
    { label: "Pts", cell: (r) => r.pts, cls: "num strong" },
  ], rows, { highlight: (r) => r === rows[0], empty: "No frames played yet." });
  return panel(`${shortName(league)} Rankings`, noHead(table, limit), {
    foot: Number.isFinite(limit) ? { href: `${urls.standings(league)}#players`, label: "View all players" } : null,
  });
}

export function breaksPanel(ctx, league, { limit = Infinity } = {}) {
  // Short lists sit under the big "Highest Break" box, so they start with the next one down.
  const all = ctx.breaksIn(league.id);
  const rows = Number.isFinite(limit) ? all.slice(1, 1 + limit) : all;
  const table = dataTable([
    { label: "Player", cell: (b) => playerLink(b.player) },
    ...(Number.isFinite(limit) ? [] : [
      { label: "Team", cell: (b) => teamLink(ctx.team.get(b.player?.team_id)), cls: "hide-sm" },
      { label: "Date", cell: (b) => html`<a href="${urls.match(b.fixture)}">${fmtDate(b.fixture.starts_at)}</a>` },
    ]),
    { label: "Break", cell: (b) => b.value, cls: "num strong" },
  ], rows, { empty: "No breaks recorded yet." });
  return panel(`${shortName(league)} Breaks`, noHead(table, limit), {
    foot: Number.isFinite(limit) && all.length ? { href: `${urls.standings(league)}#breaks`, label: "View all breaks" } : null,
  });
}

/** A break made in the last week gets a pulsing NEW label. */
const NEW_DAYS = 7;
const isRecent = (iso) => iso && Date.now() - Date.parse(iso) < NEW_DAYS * 864e5;

/** Big "highest break" panel. `best` = { value, player, when } or undefined. */
export function topBreakPanel(title, best) {
  const body = best
    ? html`<a class="top-break" href="${best.player ? urls.player(best.player) : "#"}">${avatar(best.player)}<div class="value">${best.value}</div><span></span><div class="who">${best.player?.full_name}</div></a>`
    : html`<div class="top-break">${avatar(null)}<div class="value">0</div><span></span><div class="who">No breaks yet</div></div>`;
  return panel(html`${title}${best && isRecent(best.when) ? html`<span class="new-badge">NEW</span>` : ""}`, body);
}

export function highestBreakPanel(ctx, league) {
  const best = ctx.breaksIn(league.id)[0];
  return topBreakPanel(`${shortName(league)} Highest Break`, best && { ...best, when: best.fixture?.starts_at });
}

// Sidebar widgets hide the grey column-heading row, like the original site.
const noHead = (table, limit) => (Number.isFinite(limit) ? html`<div class="no-head">${table}</div>` : table);

/**
 * Which articles the home page's Latest News box shows (Admin → Site settings):
 * the newest, the newest that aren't in the banner, one category, or hand-picked.
 */
export function latestNews(news, site, bannerIds = []) {
  const mode = site.latest_news_mode ?? "newest";
  const picked = (site.latest_news_ids ?? []).map((id) => news.find((a) => a.id === id)).filter(Boolean);
  const list = mode === "picked" && picked.length ? picked
    : mode === "category" && site.latest_news_category ? news.filter((a) => a.category === site.latest_news_category)
    : mode === "not_banner" ? news.filter((a) => !bannerIds.includes(a.id))
    : news;
  return list.length ? list : news;
}

export const newsMini = (a) => html`<a class="news-mini" href="${urls.article(a)}">${picture(articleThumb(a))}
  <div><strong>${a.title}</strong><small>${a.category} · ${fmtDate(a.published_at)}</small>${a.excerpt}</div></a>`;

/**
 * The right-hand column. By default it shows every league; pass `leagues`
 * to show only the relevant one(s), and `top` for page-specific panels
 * (e.g. a competition's own highest breaks).
 */
export function sidebar(ctx, news = [], { leagues = ctx.leagues, top = "", count = 1 } = {}) {
  const latest = news.slice(0, Math.max(1, count));
  return html`<aside class="sidebar">
    ${top}
    ${panel("Latest News", latest.length ? html`<div>${latest.map(newsMini)}</div>` : "", { color: "blue", href: "/news" })}
    <a class="btn-bar" href="/news">Click here to go to the news hub</a>
    ${leagues.map((l) => html`${highestBreakPanel(ctx, l)}${breaksPanel(ctx, l, { limit: 2 })}${rankingsPanel(ctx, l, { limit: 4 })}`)}
  </aside>`;
}

// ── fixtures ──────────────────────────────────────────────────
export function resultText(ctx, fx) {
  if (fx.status === "postponed") return "P - P";
  if (!ctx.hasResult(fx)) return fmtTime(fx.starts_at);
  const s = ctx.scoreOf(fx);
  return `${s.home} - ${s.away}`;
}

/** Full fixtures table used on team pages and in the captain area. */
export function fixturesTable(ctx, fixtures, { actions } = {}) {
  return dataTable([
    { label: "Date", cell: (f) => fmtDate(f.starts_at) },
    { label: "Fixtures", cell: (f) => html`<a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} vs ${ctx.team.get(f.away_team_id)?.name}</a>` },
    { label: "Results", cell: (f) => html`${resultText(ctx, f)}${f.status === "in_progress" ? html` <span class="live-dot">Live</span>` : ""}` },
    { label: "League", cell: (f) => ctx.league.get(f.league_id)?.name, cls: "hide-sm" },
    { label: "Season", cell: () => ctx.season?.name, cls: "hide-sm" },
    { label: "Venue", cell: (f) => { const v = ctx.venue.get(f.venue_id); return v ? html`<a href="${urls.venue(v)}">${v.name}</a>` : "–"; }, cls: "hide-sm" },
    actions
      ? { label: "", cell: actions }
      : { label: "Article", cell: (f) => html`<a href="${urls.match(f)}">${ctx.hasResult(f) ? "Recap" : "Preview"}</a>` },
    { label: "Postponed", cell: (f) => (f.status === "postponed" ? "Yes" : "-"), cls: "hide-sm" },
  ], fixtures, { empty: "No fixtures for this season yet." });
}

/** Compact Home / Results / Away table (team history, past meetings). */
export function resultsList(ctx, fixtures, { scoreFn = (f) => resultText(ctx, f) } = {}) {
  return dataTable([
    { label: "Date", cell: (f) => html`<a href="${urls.match(f)}">${fmtDate(f.starts_at)}</a>` },
    { label: "Home", cell: (f) => ctx.team.get(f.home_team_id)?.name, cls: "right" },
    { label: "Results", cell: (f) => scoreFn(f), cls: "num" },
    { label: "Away", cell: (f) => ctx.team.get(f.away_team_id)?.name },
    { label: "Time", cell: (f) => fmtTime(f.starts_at), cls: "num" },
  ], fixtures, { empty: "No previous meetings." });
}

// ── galleries & quotes ────────────────────────────────────────
/** Picture grid; clicking a picture opens it full size (see main.js). */
export const gallery = (urls = []) => (urls?.length
  ? html`<div class="gallery">${urls.map((u) => html`<button type="button" class="gallery-item" data-lightbox="${u}"><img src="${u}" alt="" loading="lazy"></button>`)}</div>`
  : "");

/** The dark CueView block: `qa` is [{ label, answer, long? }]. Used on player pages and news articles. */
export const cueviewSection = (name, qa) => (qa.length ? html`<section class="cueview" id="cueview">
  <div class="cueview-head"><span>CueView</span><h2>${name}</h2></div>
  <div class="cueview-grid">${qa.map((q) => html`<div class="${q.long ? "wide" : ""}"><h4>${q.label}</h4><p>${q.answer}</p></div>`)}</div>
</section>` : "");

export const quoteBox = (text, by) => (text
  ? html`<blockquote class="quote-box"><p>${text}</p>${by ? html`<cite>— ${by}</cite>` : ""}</blockquote>`
  : "");

// ── competition matches ───────────────────────────────────────
/**
 * Everything about one cup match: the competition, the two entrants
 * (worked out from the bracket for later rounds) and their players.
 */
export function cupMatchInfo(compData, match, buildBracket) {
  const c = compData.competitions.find((x) => x.id === match.competition_id);
  const entries = compData.entries.filter((e) => e.competition_id === c?.id);
  const b = buildBracket(entries, compData.matches.filter((m) => m.competition_id === c?.id));
  const bm = b.rounds[match.round - 1]?.[match.slot];
  const entry = (id) => entries.find((e) => e.id === id) ?? null;
  return { c, bracket: b, bm, a: entry(bm?.a), b: entry(bm?.b) };
}
