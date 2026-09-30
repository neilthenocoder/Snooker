import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, panel, fixturesTable, urls, seasonPicker, seasonShort } from "../core/components.js";
import { setTitle } from "../core/router.js";
import notFound from "./not-found.js";

export default async function team(view, { params, query }) {
  const ctx = await seasonContext(query.get("season"));
  const team = ctx.teams.find((t) => t.slug === params.slug);
  if (!team) return notFound(view);
  const title = `${team.name} – ${ctx.season?.name} Fixtures & Results`;
  setTitle(title);
  const league = ctx.league.get(team.league_id);
  const venue = ctx.venue.get(team.venue_id);
  const players = ctx.playersOf(team.id);

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], [`${ctx.season?.name} Season`], [`Fixtures & Results ${seasonShort(ctx.season)}`, `/fixtures?season=${ctx.season?.id}`], [title]])}
    <h1>${title}</h1>
    <div class="grid-2" style="margin-bottom:26px">
      <div class="box">
        <strong>League:</strong> ${league ? html`<a href="${urls.standings(league)}">${league.name}</a>` : "–"}<br>
        <strong>Home venue:</strong> ${venue ? html`<a href="${urls.venue(venue)}" style="color:var(--red)">${venue.name}</a>` : "–"}<br>
        <strong>Squad:</strong> ${players.length ? players.map((p, i) => html`${i ? ", " : ""}<a href="${urls.player(p)}" style="color:var(--red)">${p.full_name}</a>`) : "–"}
      </div>
      ${seasonPicker(ctx)}
    </div>
    ${panel(team.name, fixturesTable(ctx, ctx.fixturesFor(team.id)))}
  </div>`);
}
