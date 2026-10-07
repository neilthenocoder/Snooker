// Season archive & roll of honour: every season the website knows about, with its
// champions, top player, highest break and competition winners — and links to that
// season's full tables, rankings, breaks and results. Nothing is typed in by hand:
// it is all worked out from the results (the same maths as the live tables, rules.js).
import { html, mount, fmtDate } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table, loadCompetitions } from "../core/api.js";
import { buildBracket } from "../core/bracket.js";
import { breadcrumb, panel, dataTable, teamLink, playerLink, urls, shortName, emblem, trophy } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function archive(view) {
  setTitle("Season archive & roll of honour");
  adminEdit("seasons");
  const [seasons, comps] = await Promise.all([table("seasons", "name"), loadCompetitions()]);
  const current = seasons.find((s) => s.is_current) ?? seasons.at(-1);
  const list = await Promise.all([...seasons].reverse().map((s) => seasonContext(s.id)));

  // One line per season + league that has results.
  const lines = list.flatMap((ctx) => ctx.leagues.map((league) => {
    const tableRows = ctx.standings(league.id).filter((r) => r.p > 0);
    if (!tableRows.length) return null;
    return { ctx, league, live: ctx.season.id === current?.id, first: tableRows[0], second: tableRows[1], top: ctx.rankings(league.id)[0], best: ctx.breaksIn(league.id)[0] };
  }).filter(Boolean));
  const q = (ctx) => `?season=${ctx.season.id}`;

  // The best breaks ever recorded on the website, any season.
  const allBreaks = lines.flatMap((l) => l.ctx.breaksIn(l.league.id).map((b) => ({ ...b, season: l.ctx.season, team: l.ctx.team.get(b.player?.team_id) })))
    .sort((a, b) => b.value - a.value).slice(0, 10);
  // League titles, finished seasons only.
  const titles = new Map();
  for (const l of lines.filter((x) => !x.live)) {
    const t = titles.get(l.first.team.id) ?? titles.set(l.first.team.id, { team: l.first.team, n: 0, when: [] }).get(l.first.team.id);
    t.n++; t.when.push(`${shortName(l.league)} ${l.ctx.season.name}`);
  }
  // Competition winners, by season.
  const winners = (seasonId) => comps.competitions.filter((c) => (c.season_id ?? current?.id) === seasonId).map((c) => {
    const b = buildBracket(comps.entries.filter((e) => e.competition_id === c.id), comps.matches.filter((m) => m.competition_id === c.id));
    return { c, winner: b.champion ? b.entryById.get(b.champion)?.name : null };
  });

  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Season archive"]])}
      <h1>Season archive &amp; roll of honour</h1>
      <p class="muted" style="max-width:760px">Every season on the website: who won each league, the top-ranked player and the highest break — with the full tables, rankings, breaks and results one click away.</p></div>

    ${panel("Roll of honour", dataTable([
      { label: "Season", cell: (l) => html`<b>${l.ctx.season.name}</b>${l.live ? html` <span class="status in_progress">in progress</span>` : ""}` },
      { label: "League", cell: (l) => html`<a href="${urls.standings(l.league)}${q(l.ctx)}">${shortName(l.league)}</a>` },
      { label: "Champions", cell: (l) => html`<span class="inline-row">${teamLink(l.first.team, true)}${l.live ? html` <small class="muted">leading</small>` : ""}</span>` },
      { label: "Runners-up", cell: (l) => (l.second ? teamLink(l.second.team) : "–"), cls: "hide-sm" },
      { label: "Top player", cell: (l) => (l.top ? html`<span class="inline-row">${playerLink(l.top.player)} <small class="muted">${l.top.pts} pts</small></span>` : "–"), cls: "hide-sm" },
      { label: "Highest break", cell: (l) => (l.best ? html`<span class="inline-row"><b>${l.best.value}</b> ${playerLink(l.best.player)}</span>` : "–") },
    ], lines, { empty: "No results on the website yet." }))}

    <div class="grid-2" style="gap:30px">
      ${panel("Highest breaks of all time", dataTable([
        { label: "", cell: (b, i) => i + 1, cls: "num" },
        { label: "Player", cell: (b) => playerLink(b.player) },
        { label: "Season", cell: (b) => b.season.name, cls: "hide-sm" },
        { label: "Date", cell: (b) => html`<a href="${urls.match(b.fixture)}">${fmtDate(b.fixture.starts_at)}</a>` },
        { label: "Break", cell: (b) => b.value, cls: "num strong" },
      ], allBreaks, { highlight: (b) => b === allBreaks[0], empty: "No breaks recorded yet." }))}
      ${panel("Most league titles", dataTable([
        { label: "Team", cell: (t) => teamLink(t.team) },
        { label: "Titles", cell: (t) => t.n, cls: "num strong" },
        { label: "Seasons", cell: (t) => t.when.join(", ") },
      ], [...titles.values()].sort((a, b) => b.n - a.n || a.team.name.localeCompare(b.team.name)), { empty: "Titles appear here once a season has finished." }))}
    </div>

    ${list.map((ctx) => { const mine = lines.filter((l) => l.ctx === ctx), cups = winners(ctx.season.id);
      return html`<section class="season-block">
        <h2>${ctx.season.name}${ctx.season.id === current?.id ? html` <span class="status in_progress">this season</span>` : ""}</h2>
        ${mine.length ? html`<div class="season-leagues">${mine.map((l) => html`<div class="season-league">
          <h4 class="with-emblem">${trophy(l.league, "tiny", { always: false })}${l.league.logo_url ? emblem(l.league) : ""}${l.league.name}</h4>
          <dl>
            <dt>${l.live ? "Leading" : "Champions"}</dt><dd>${teamLink(l.first.team, true)} <small class="muted">${l.first.pts} pts</small></dd>
            ${l.second ? html`<dt>${l.live ? "Second" : "Runners-up"}</dt><dd>${teamLink(l.second.team)} <small class="muted">${l.second.pts} pts</small></dd>` : ""}
            ${l.top ? html`<dt>Top player</dt><dd>${playerLink(l.top.player)} <small class="muted">${l.top.pts} ranking pts</small></dd>` : ""}
            ${l.best ? html`<dt>Highest break</dt><dd><b>${l.best.value}</b> ${playerLink(l.best.player)}</dd>` : ""}
          </dl>
          <div class="season-links">
            <a href="${urls.standings(l.league)}${q(ctx)}">Full table</a>
            <a href="${urls.standings(l.league)}${q(ctx)}#players">Player rankings</a>
            <a href="${urls.standings(l.league)}${q(ctx)}#breaks">All breaks</a>
            ${l.league.shield_team_id ? html`<a href="${urls.shield(l.league)}${q(ctx)}">${l.league.shield_name || "Shield"}</a>` : ""}
          </div></div>`)}</div>` : html`<p class="muted">No league results recorded for this season.</p>`}
        ${cups.length ? html`<div class="season-cups"><b>Competitions</b>${cups.map(({ c, winner }) => html`<a href="${urls.competition(c)}">${c.name}<span>${winner ? `Winner: ${winner}` : "In progress"}</span></a>`)}</div>` : ""}
        <div class="btn-row"><a class="btn small secondary" href="/fixtures${q(ctx)}">Fixtures &amp; results ${ctx.season.name}</a>
          ${cups.length ? html`<a class="btn small ghost" href="/competitions${q(ctx)}">Competitions ${ctx.season.name}</a>` : ""}
          <a class="btn small ghost" href="/presentation${q(ctx)}">Trophies &amp; winners</a><a class="btn small ghost" href="/season-review${q(ctx)}">Season review</a></div>
      </section>`; })}
  </div>`);
}
