import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, panel, fixturesTable, urls, seasonPicker, seasonShort, personCard, badge } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

export default async function team(view, { params, query }) {
  const ctx = await seasonContext(query.get("season"));
  const team = ctx.teams.find((t) => t.slug === params.slug);
  if (!team) return notFound(view);
  const title = `${team.name} – ${ctx.season?.name} Fixtures & Results`;
  setTitle(title);
  adminEdit("teams", team.id);
  const league = ctx.league.get(team.league_id);
  const venue = ctx.venue.get(team.venue_id);
  const players = ctx.playersOf(team.id);

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Seasons", "/seasons"], [`${ctx.season?.name} Season`, urls.season(ctx.season)], [`Fixtures & Results ${seasonShort(ctx.season)}`, `/fixtures?season=${ctx.season?.id}`], [title]])}
    <h1 class="with-emblem">${badge(team)}${title}</h1>
    <div class="grid-2" style="margin-bottom:22px">
      <div class="box">
        <strong>League:</strong> ${league ? html`<a href="${urls.standings(league)}">${league.name}</a>` : "–"}<br>
        <strong>Home venue:</strong> ${venue ? html`<a href="${urls.venue(venue)}" style="color:var(--red)">${venue.name}</a>` : "–"}
      </div>
      ${seasonPicker(ctx)}
    </div>
    <h3 style="margin-top:0">Squad</h3>
    ${players.length ? html`<div class="people squad">${players.map((p) => personCard(p, p.position === "Player" ? "" : p.position))}</div>` : html`<div class="empty box">No players listed yet.</div>`}
    <div style="height:26px"></div>
    ${panel(team.name, fixturesTable(ctx, ctx.fixturesFor(team.id), { byes: ctx.byesFor(team.id) }))}
  </div>`);
}
