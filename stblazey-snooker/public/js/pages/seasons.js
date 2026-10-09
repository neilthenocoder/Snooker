// Seasons: /seasons lists every season; each season has its own page of tiles
// (Breaks, Competitions, Fixtures & Results, Handicaps, League Tables, Rankings),
// and breaks, rankings and league tables have a page for each league:
//   /seasons                                  every season
//   /seasons/2026-2027                        one season
//   /seasons/2026-2027/rankings               choose a league
//   /seasons/2026-2027/rankings/victory-league   that league's list
// Nothing is typed in: every figure is worked out from the results (rules.js).
import { html, mount, fmtDate } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table } from "../core/api.js";
import { breadcrumb, panel, dataTable, playerLink, teamLink, urls, seasonShort, breaksPanel, trophy, leagueMarks } from "../core/components.js";
import { RULES_TEXT } from "../core/rules.js";
import { setTitle, adminEdit, sideContext } from "../core/router.js";
import notFound from "./not-found.js";

// The parts of a season that have a page for each league: [heading, what a league's tile says, title of a league's page].
const BY_LEAGUE = {
  breaks: ["Breaks", "Click here to view all the breaks", (l) => `${l.name} Breaks`],
  rankings: ["Rankings", "Click here to view the rankings", (l) => `${l.name} Player Rankings`],
  "league-tables": ["League Tables", "Click here to view the league table", (l) => `${l.name} Table`],
};
const big = (title, line, href, note = "") => html`<a class="tile tall season-tile" href="${href}"><h4>${title}</h4><span class="tile-go">${line}</span>${note ? html`<p>${note}</p>` : ""}</a>`;
const crumbs = (...rest) => breadcrumb([["Home", "/"], ["Our League", "/league"], ...rest]);

export default async function seasons(view, { params }) {
  const all = await table("seasons", "name");
  const current = all.find((s) => s.is_current) ?? all.at(-1);
  if (!params.season) return list(view, all, current);

  const season = all.find((s) => s.name === params.season);
  if (!season) return notFound(view);
  const ctx = await seasonContext(season.id);
  adminEdit("seasons", season.id);
  if (!params.section) return hub(view, ctx, season, current);
  if (!BY_LEAGUE[params.section]) return notFound(view);
  if (!params.league) return chooser(view, ctx, season, params.section);

  const league = ctx.leagues.find((l) => l.slug === params.league);
  if (!league) return notFound(view);
  sideContext({ league });
  return { breaks, rankings, "league-tables": leagueTable }[params.section](view, ctx, season, league);
}

// ── /seasons ────────────────────────────────────────────────────
function list(view, all, current) {
  setTitle("Seasons");
  adminEdit("seasons");
  mount(view, html`<div class="wrap">
    ${crumbs(["Seasons"])}
    <h1>Seasons</h1>
    ${all.length ? html`<div class="cards season-cards">${[...all].reverse().map((s) => html`<a class="tile season-tile" href="${urls.season(s)}">
      <h4>${s.name}</h4><span class="tile-go">Click here to view</span>${s.id === current?.id ? html`<p><span class="status in_progress">This season</span></p>` : ""}</a>`)}</div>`
      : html`<div class="empty box">No seasons yet.</div>`}
    <a class="btn-bar" href="/archive">Season archive &amp; roll of honour: champions, top players and highest breaks</a>
  </div>`);
}

// ── /seasons/2026-2027 ──────────────────────────────────────────
function hub(view, ctx, season, current) {
  const title = `${season.name} Season`;
  setTitle(title);
  const q = `?season=${season.id}`;
  const played = ctx.fixtures.filter((f) => ctx.hasResult(f) && f.status !== "in_progress").length;
  const tiles = [
    ["Breaks", "Every break of 30 or more, league by league", urls.season(season, "breaks")],
    ["Competitions", "Cups, singles and doubles: draws and results", `/competitions${q}`],
    ["Fixtures & Results", `${ctx.fixtures.length ? `${played} of ${ctx.fixtures.length} matches played` : "Team by team"}`, `/fixtures${q}`],
    // Handicaps are kept as they stand today, so only this season has them.
    ...(season.id === current?.id ? [["Handicaps", "Every player's handicap, team by team", "/handicaps"]] : []),
    ["League Tables", "Who is top, and by how much", urls.season(season, "league-tables")],
    ["Rankings", "The players' ranking points", urls.season(season, "rankings")],
  ];
  mount(view, html`<div class="wrap">
    ${crumbs(["Seasons", "/seasons"], [title])}
    <h1>${title}</h1>
    <div class="cards season-hub">${tiles.map(([t, note, href]) => big(t, "Click here to view", href, note))}</div>
  </div>`);
}

// ── /seasons/2026-2027/rankings: choose a league ────────────────
function chooser(view, ctx, season, section) {
  const [name, line] = BY_LEAGUE[section];
  const title = `${name} ${seasonShort(season)}`;
  setTitle(title);
  // A line under each league saying where things stand, so the tile is worth more than a link.
  const note = (l) => {
    if (section === "breaks") { const b = ctx.breaksIn(l.id)[0]; return b ? `Highest so far: ${b.value}, ${b.player?.full_name ?? "–"}` : "No breaks recorded yet"; }
    if (section === "rankings") { const r = ctx.rankings(l.id)[0]; return r ? `Top: ${r.name}, ${r.pts} pts` : "No frames played yet"; }
    const top = ctx.standings(l.id).find((r) => r.p > 0); return top ? `Top: ${top.name}, ${top.pts} pts` : "No results yet";
  };
  mount(view, html`<div class="wrap">
    ${crumbs(["Seasons", "/seasons"], [`${season.name} Season`, urls.season(season)], [title])}
    <h1>${title}</h1>
    <div class="cards season-leagues-pick">${ctx.leagues.map((l) => big(l.name, line, urls.season(season, section, l), note(l)))}</div>
  </div>`);
}

const head = (ctx, season, section, league) => {
  const [name, , pageTitle] = BY_LEAGUE[section];
  const title = `${pageTitle(league)} ${season.name}`;
  setTitle(title);
  return html`<div>${crumbs(["Seasons", "/seasons"], [`${season.name} Season`, urls.season(season)], [`${name} ${seasonShort(season)}`, urls.season(season, section)], [title])}
    <div class="title-trophy">${trophy(league, "", { always: false })}<h1>${title}</h1></div></div>`;
};
// The other lists for the same league, and the same list for the other leagues.
const more = (ctx, season, section, league) => html`<div class="btn-row season-more">
  ${Object.entries(BY_LEAGUE).filter(([key]) => key !== section).map(([key, [name]]) => html`<a class="btn small secondary" href="${urls.season(season, key, league)}">${league.short_name || league.name} ${name.toLowerCase()}</a>`)}
  ${ctx.leagues.filter((l) => l.id !== league.id).map((l) => html`<a class="btn small ghost" href="${urls.season(season, section, l)}">${l.name}</a>`)}
</div>`;

// ── a league's player rankings ──────────────────────────────────
function rankings(view, ctx, season, league) {
  const rows = ctx.rankings(league.id);
  mount(view, html`<div class="wrap stack">
    ${head(ctx, season, "rankings", league)}
    ${panel(league.name, dataTable([
      { label: "Rank", cell: (r) => r.pos, cls: "num" },
      { label: "Player", cell: (r) => playerLink(r.player) },
      { label: "Team", cell: (r) => teamLink(ctx.team.get(r.player.team_id)), cls: "hide-sm" },
      { label: "Position", cell: (r) => r.player.position, cls: "hide-sm" },
      { label: "Played", cell: (r) => r.played, cls: "num" },
      { label: "Won", cell: (r) => r.won, cls: "num" },
      { label: "Lost", cell: (r) => r.lost, cls: "num hide-sm" },
      { label: "Break pts", cell: (r) => r.breakPts || "–", cls: "num hide-sm" },
      { label: "Points", cell: (r) => r.pts, cls: "num strong" },
    ], rows, { highlight: (r) => r === rows[0], empty: "No frames played yet." }))}
    <p class="muted">${RULES_TEXT} A player appears here once they have played a frame.</p>
    ${more(ctx, season, "rankings", league)}
  </div>`);
}

// ── a league's breaks ───────────────────────────────────────────
function breaks(view, ctx, season, league) {
  // One line per player: every break they have made, biggest first.
  const byPlayer = new Map();
  for (const b of ctx.breaksIn(league.id)) {
    if (!b.player) continue;
    const row = byPlayer.get(b.player.id) ?? byPlayer.set(b.player.id, { player: b.player, values: [], last: "" }).get(b.player.id);
    row.values.push(b.value);
    if ((b.fixture?.starts_at ?? "") > row.last) row.last = b.fixture.starts_at;
  }
  const rows = [...byPlayer.values()].map((r) => ({ ...r, values: r.values.sort((a, b) => b - a) }))
    .sort((a, b) => b.values[0] - a.values[0] || b.values.length - a.values.length || a.player.full_name.localeCompare(b.player.full_name));
  mount(view, html`<div class="wrap stack">
    ${head(ctx, season, "breaks", league)}
    ${panel(league.name, dataTable([
      { label: "Rank", cell: (r, i) => i + 1, cls: "num" },
      { label: "Player", cell: (r) => playerLink(r.player) },
      { label: "Team", cell: (r) => teamLink(ctx.team.get(r.player.team_id)), cls: "hide-sm" },
      { label: "Position", cell: (r) => r.player.position, cls: "hide-sm" },
      { label: "Latest", cell: (r) => fmtDate(r.last), cls: "hide-sm" },
      { label: "Brks", cell: (r) => html`<span class="break-list">${r.values.map((v, i) => html`<b class="${i ? "" : "best"}">${v}</b>`)}</span>`, cls: "num strong" },
    ], rows, { highlight: (r) => r === rows[0], empty: "No breaks of 30 or more recorded yet." }))}
    ${rows.length ? breaksPanel(ctx, league) : ""}
    <p class="muted">Breaks of 30 and over are recorded. Each one also earns ranking points: 30–39 = 3, 40–49 = 4, and so on.</p>
    ${more(ctx, season, "breaks", league)}
  </div>`);
}

// ── a league's table ────────────────────────────────────────────
function leagueTable(view, ctx, season, league) {
  const rows = ctx.standings(league.id);
  const m = leagueMarks(ctx, league);
  mount(view, html`<div class="wrap stack">
    ${head(ctx, season, "league-tables", league)}
    ${panel(league.name, html`${dataTable([
      { label: "Pos", cell: m.pos, cls: "num" },
      { label: "Team", cell: (r) => teamLink(r.team, m.strong(r)) },
      { label: "Played", cell: (r) => r.p, cls: "num" },
      { label: "Won", cell: (r) => r.w, cls: "num" },
      { label: "Lost", cell: (r) => r.l, cls: "num" },
      { label: "Frames for", cell: (r) => r.f, cls: "num hide-sm" },
      { label: "Frames against", cell: (r) => r.a, cls: "num hide-sm" },
      { label: "Points", cell: m.pts, cls: "num strong" },
    ], rows, { highlight: m.highlight, rowClass: m.rowClass, empty: "No teams in this league yet." })}${m.key}`, { cls: "lt-panel" })}
    <p class="muted">A team gets one point for every frame it wins. Teams level on points are split by matches won, then frame difference.</p>
    <a class="btn-bar" href="${urls.standings(league)}?season=${season.id}">${league.name}: table, rankings and breaks on one page</a>
    ${more(ctx, season, "league-tables", league)}
  </div>`);
}
