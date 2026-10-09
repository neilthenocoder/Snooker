// Reusable building blocks. Every table, panel and card on the site
// is drawn by one of these functions — change it here, it changes everywhere.
import { html, fmtDate, fmtTime } from "./dom.js";

// ── URLs (one place to change the site's link structure) ──────
// Matches, cup matches and players have short addresses (/match/2627-14, /cup-match/27, /player/sam-bolitho);
// the long id is the fallback for rows made before those existed, and old links keep working.
export const urls = {
  team: (t) => `/team/${t.slug}`,
  venue: (v) => `/venue/${v.slug}`,
  match: (fx) => `/match/${fx.code || fx.id}`,
  scorecard: (fx) => `/scorecard/${fx.code || fx.id}`,
  cupMatch: (m) => `/cup-match/${m.no ?? m.id}`,
  cupScorecard: (m) => `/cup-scorecard/${m.no ?? m.id}`,
  scoreboard: (m) => `/scoreboard/${m.no ?? m.id}`,
  sponsor: (s) => `/sponsor/${s.slug || s.id}`,
  article: (a) => `/news/${a.slug}`,
  standings: (l) => `/standings/${l.slug}`,
  // A season's own pages: /seasons/2026-2027, /seasons/2026-2027/rankings/victory-league …
  season: (s, section = "", league = null) => `/seasons/${encodeURIComponent(s?.name ?? "")}${section ? `/${section}` : ""}${league ? `/${league.slug}` : ""}`,
  page: (p) => `/page/${p.slug}`,
  player: (p) => `/player/${p.slug || p.id}`,
  competition: (c) => `/competition/${c.slug}`,
  shield: (l) => `/shield/${l.slug}`,
};

/** Is this player in the current squad lists? (Not for those who have stopped playing or have died.) */
export const isActivePlayer = (p) => !["not_playing", "deceased"].includes(p?.status);
/**
 * The trophy picture of a league, competition or award (Admin → Edit → Trophy). Until one is uploaded
 * a placeholder cup stands in — pass { always: false } for small spots that should stay empty instead.
 */
export const trophy = (thing, cls = "", { always = true } = {}) => (thing?.trophy_url || always
  ? html`<img class="trophy ${cls} ${thing?.trophy_url ? "" : "placeholder"}" src="${thing?.trophy_url || "/assets/trophy.svg"}" alt="${thing?.trophy_url ? `${thing?.name ?? ""} trophy` : ""}" loading="lazy">` : "");

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

/** Up or down arrow against last year's handicap (set at the yearly review), or nothing if it hasn't moved. */
/** A handicap as a coloured tag: scratch and minus handicaps green, plus handicaps red. */
export const handicapTag = (h) => html`<span class="hc-val ${Number(h) > 0 ? "plus" : Number(h) < 0 ? "minus" : "zero"}">${handicapText(h)}</span>`;

export function handicapMove(player) {
  if (player?.last_handicap == null || player.last_handicap === player.handicap) return "";
  const diff = player.handicap - player.last_handicap, up = diff > 0;
  return html`<span class="hc-move ${up ? "up" : "down"}" title="${up ? "Up" : "Down"} ${Math.abs(diff)} from last year (was ${handicapText(player.last_handicap)})">${up ? "▲" : "▼"} ${Math.abs(diff)}</span>`;
}

/** Season dropdown — main.js reloads the page with ?season=… when it changes. */
export const seasonPicker = (ctx) => html`<label class="toolbar" style="font-weight:700">Season
  <select data-season-picker>${[...ctx.seasons].reverse().map((s) => html`<option value="${s.id}" ${s.id === ctx.season?.id ? "selected" : ""}>${s.name}</option>`)}</select></label>`;

/** "26-27" from "2026-2027". */
export const seasonShort = (season) => (season?.name ?? "").replace(/\d\d(\d\d)/g, "$1");

/**
 * Won / Lost / Drawn, always in the same colours everywhere: a win is green, a loss is red.
 * `what` is "won" | "lost" | "drawn" (anything else shows nothing).
 */
export const outcomeTag = (what, text = null) => (["won", "lost", "drawn"].includes(what)
  ? html`<span class="wl ${what}">${text ?? { won: "Won", lost: "Lost", drawn: "Drawn" }[what]}</span>` : "");

/**
 * Where a page sits. On the public site this is a single back arrow to the page above
 * ("‹ Our League"); in the dashboard and My area it is the full trail (Home - Admin - Players).
 * main.js sets which, page by page (crumbs.trail).
 */
export const crumbs = { trail: false };
const backArrow = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 5.3 8 12l6.7 6.7 1.4-1.4L10.8 12l5.3-5.3Z"/></svg>`;
export function breadcrumb(items) {
  if (!crumbs.trail) {
    const up = [...items].slice(0, -1).reverse().find(([, href]) => href);
    if (!up) return "";
    return html`<nav class="back-nav" aria-label="Back"><a class="back-link" href="${up[1]}">${backArrow}<span>${up[0]}</span></a></nav>`;
  }
  return trail(items);
}
function trail(items) {
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
  html`<a class="tile ${cls}" href="${href}"><h4>${title}</h4><span class="tile-go">Click here to view</span>${text ? html`<p>${text}</p>` : ""}</a>`;

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
  return panel(html`${trophy(league, "tiny", { always: false })}${league.name} Table`, table, {
    foot: Number.isFinite(limit) ? { href: urls.standings(league), label: "View full table" } : null, cls: "lt-panel",
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
export function sidebar(ctx, news = [], { leagues = ctx.leagues, top = "", count = 1, box = null } = {}) {
  return html`<aside class="sidebar">
    ${top}
    ${sideBox(ctx, news, count, box)}
    ${leagues.map((l) => html`${highestBreakPanel(ctx, l)}${breaksPanel(ctx, l, { limit: 2 })}${rankingsPanel(ctx, l, { limit: 4 })}`)}
  </aside>`;
}

/**
 * The box at the top of the side column. What it shows is chosen under
 * Admin → Site settings → "Side column: top box": the latest league results (the standard),
 * competition results, both, the latest news (as it used to be), or nothing.
 * `box` comes from sideBoxData() in core/context.js.
 */
function sideBox(ctx, news, count, box) {
  const site = box?.site ?? {};
  const mode = site.side_box_mode ?? "results";
  if (mode === "off") return "";
  if (mode === "news") {
    const latest = news.slice(0, Math.max(1, count));
    return html`${panel(site.side_box_title || "Latest News", latest.length ? html`<div>${latest.map(newsMini)}</div>` : "", { color: "blue", href: "/news" })}
      <a class="btn-bar" href="/news">Click here to go to the news hub</a>`;
  }
  const league = mode === "cup" ? [] : ctx.fixtures
    .filter((f) => ctx.hasResult(f) && f.status !== "in_progress" && (!site.side_box_league || f.league_id === site.side_box_league))
    .map((f) => { const s = ctx.scoreOf(f); return { when: f.starts_at, home: ctx.team.get(f.home_team_id)?.name, away: ctx.team.get(f.away_team_id)?.name, score: `${s.home} – ${s.away}`, href: urls.match(f), won: s.home > s.away ? "h" : s.away > s.home ? "a" : "" }; });
  const cups = mode === "results" ? [] : box?.cups ?? [];
  const rows = [...league, ...cups].sort((a, b) => String(b.when ?? "").localeCompare(String(a.when ?? ""))).slice(0, Math.max(1, site.side_box_count || 5));
  return html`${panel(site.side_box_title || "Latest Results", rows.length
      ? html`<div class="res-list">${rows.map((r) => html`<a class="res-mini" href="${r.href}">
          <small>${r.when ? fmtDate(r.when) : ""}${r.title ? ` · ${r.title}` : ""}</small>
          <span class="${r.won === "h" ? "won" : r.won ? "lost" : ""}">${r.home}</span><b>${r.score}</b><span class="${r.won === "a" ? "won" : r.won ? "lost" : ""}">${r.away}</span></a>`)}</div>`
      : html`<div class="empty">No results yet.</div>`, { color: "blue", href: "/results" })}
    <a class="btn-bar" href="/results">See all results</a>`;
}

// ── fixtures ──────────────────────────────────────────────────
export function resultText(ctx, fx) {
  if (fx.status === "postponed") return "P - P";
  if (!ctx.hasResult(fx)) return fmtTime(fx.starts_at);
  const s = ctx.scoreOf(fx);
  return `${s.home} - ${s.away}`;
}

/**
 * Full fixtures table used on team pages and in the captain area.
 * `byes` are that team's bye weeks (ctx.byesFor): each shows as a line on its date, with no match behind it.
 */
export function fixturesTable(ctx, fixtures, { actions, byes = [], forTeam = null } = {}) {
  const rows = [...fixtures, ...byes.map((b) => ({ ...b, bye: true, starts_at: `${b.bye_on}T12:00:00Z` }))]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  // A finished match (not one still being played) has a result to pick out.
  const done = (f) => !f.bye && ctx.hasResult(f) && f.status !== "in_progress";
  /** "won" | "lost" | "drawn" for the team whose list this is. */
  const outcome = (f) => { if (!forTeam || !done(f)) return ""; const s = ctx.scoreOf(f), us = f.home_team_id === forTeam ? s.home : s.away, them = f.home_team_id === forTeam ? s.away : s.home;
    return us > them ? "won" : us < them ? "lost" : "drawn"; };
  return dataTable([
    { label: "Date", cell: (f) => fmtDate(f.starts_at) },
    { label: "Fixtures", cell: (f) => (f.bye ? html`<span class="bye-row">${ctx.team.get(f.team_id)?.name} <b>Bye week</b></span>`
      : html`<a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} vs ${ctx.team.get(f.away_team_id)?.name}</a>`) },
    { label: "Results", cell: (f) => (f.bye ? "–" : html`<span class="res-score ${done(f) ? "done" : ""}">${resultText(ctx, f)}</span>${f.status === "in_progress" ? html` <span class="live-dot">Live</span>` : ""}`), cls: "num" },
    ...(forTeam ? [{ label: "Won / Lost", cell: (f) => outcomeTag(outcome(f)) || "–", cls: "num" }] : []),
    { label: "League", cell: (f) => ctx.league.get(f.league_id)?.name, cls: "hide-sm" },
    { label: "Season", cell: () => ctx.season?.name, cls: "hide-sm" },
    { label: "Venue", cell: (f) => { const v = ctx.venue.get(f.venue_id); return v ? html`<a href="${urls.venue(v)}">${v.name}</a>` : "–"; }, cls: "hide-sm" },
    actions
      ? { label: "", cell: (f) => (f.bye ? "" : actions(f)) }
      : { label: "Article", cell: (f) => (f.bye ? "No match" : html`<a href="${urls.match(f)}">${ctx.hasResult(f) ? "Recap" : "Preview"}</a>`) },
    { label: "Postponed", cell: (f) => (f.status === "postponed" ? "Yes" : "-"), cls: "hide-sm" },
  ], rows, { rowClass: (f) => (f.bye ? "is-bye" : ""), empty: "No fixtures for this season yet." });
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

// ── news: the related-news strip, video and share buttons ─────
const WORDS_A_MINUTE = 200;
/** Roughly how long an article takes to read, in whole minutes. */
export const readTime = (a) => Math.max(1, Math.round(String(`${a.excerpt ?? ""} ${a.lead ?? ""} ${a.body ?? ""}`).trim().split(/\s+/).length / WORDS_A_MINUTE));
/** Every category an article is listed under: its main one first, then any others. */
export const categoriesOf = (a) => [...new Set([a.category, ...(Array.isArray(a.more_categories) ? a.more_categories : [])].filter(Boolean))];

/**
 * A strip of news that scrolls sideways: picture cards with the headline over the picture.
 * Used for "Related news" under an article and under a competition. The ‹ › buttons are
 * handled once, in main.js (data-ns-move).
 */
export function newsStrip(title, list, { more = "/news" } = {}) {
  if (!list.length) return "";
  return html`<section class="news-strip" aria-label="${title}"><div class="wrap">
    <header><h2>${title}</h2><span class="ns-ctrl"><a href="${more}">All news</a>
      <button type="button" data-ns-move="-1" aria-label="Earlier articles">‹</button><button type="button" data-ns-move="1" aria-label="More articles">›</button></span></header>
    <div class="ns-row">${list.map((a) => html`<a class="ns-card" href="${urls.article(a)}">
      ${a.image_url || a.circle_image_url ? html`<img src="${a.image_url || a.circle_image_url}" alt="" loading="lazy">` : html`<span class="ns-ph" aria-hidden="true"></span>`}
      <span class="ns-text"><strong>${a.title}</strong><small>${a.category} | ${fmtDate(a.published_at)}</small></span></a>`)}</div>
  </div></section>`;
}

/**
 * A video from the link pasted into an article: YouTube and Vimeo are shown in their own player,
 * anything else that is a video file plays in the browser's. Nothing else is ever put in a frame.
 */
export function videoEmbed(url) {
  const u = String(url ?? "").trim();
  if (!/^https:\/\//i.test(u)) return "";
  const yt = u.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,20})/i);
  const vm = u.match(/^https:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{5,12})/i);
  const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vm ? `https://player.vimeo.com/video/${vm[1]}` : "";
  if (src) return html`<div class="video-box"><iframe src="${src}" title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return html`<div class="video-box"><video src="${u}" controls preload="metadata" playsinline></video></div>`;
  return html`<p><a class="btn ghost" href="${u}" target="_blank" rel="noopener">Watch the video</a></p>`;
}

const shareIcon = {
  share: "M18 16a3 3 0 0 0-2.2 1l-7-4a3 3 0 0 0 0-2l7-4A3 3 0 1 0 15 5a3 3 0 0 0 .1.7l-7 4a3 3 0 1 0 0 4.6l7 4A3 3 0 1 0 18 16Z",
  link: "M10.6 13.4a4 4 0 0 0 5.7 0l3.5-3.5a4 4 0 0 0-5.7-5.7l-1.1 1.1 1.4 1.4 1.1-1.1a2 2 0 0 1 2.9 2.9l-3.5 3.5a2 2 0 0 1-2.9 0Zm2.8-2.8a4 4 0 0 0-5.7 0l-3.5 3.5a4 4 0 0 0 5.7 5.7l1.1-1.1-1.4-1.4-1.1 1.1a2 2 0 0 1-2.9-2.9l3.5-3.5a2 2 0 0 1 2.9 0Z",
  whatsapp: "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.1 14.9l-.4-.2-2.6.7.7-2.6-.2-.4A8 8 0 0 1 12 4Zm-3.1 3.8c-.3 0-.6.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.4l-1.9-.9c-.3-.1-.5-.1-.7.2l-.9 1.1c-.2.2-.3.2-.6.1a7 7 0 0 1-3.4-3c-.3-.4.3-.4.7-1.3.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.5-.6-.5Z",
  facebook: "M14 8V6.5c0-.8.2-1.2 1.3-1.2H17V2.2c-.3 0-1.3-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2V8H8v3.2h2.5V22H14V11.2h2.7l.4-3.2Z",
  x: "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8Zm-1.1 16.2h1.7L7.4 4.7H5.6Z",
  email: "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.8 2 7.2 5.4L19.2 7Zm15.2 1.6-8 6-8-6V17h16Z",
};
/**
 * Share buttons for a page: the phone's own share sheet (where there is one), copy the link,
 * WhatsApp, Facebook, X and email. Presses are handled once, in main.js (data-share).
 */
export function shareBar(title, path) {
  const btn = (kind, label) => html`<button type="button" class="share-btn" data-share="${kind}" data-share-title="${title}" data-share-path="${path}" aria-label="${label}" title="${label}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${shareIcon[kind]}"/></svg></button>`;
  return html`<div class="share-bar"><span>Share</span>${btn("share", "Share this")}${btn("link", "Copy the link")}${btn("whatsapp", "Share on WhatsApp")}${btn("facebook", "Share on Facebook")}${btn("x", "Share on X")}${btn("email", "Send by email")}</div>`;
}
