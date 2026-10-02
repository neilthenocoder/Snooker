import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, leagueTablePanel, rankingsPanel, breaksPanel, seasonPicker, emblem, urls } from "../core/components.js";
import { RULES_TEXT } from "../core/rules.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

export default async function standings(view, { params, query }) {
  const ctx = await seasonContext(query.get("season"));
  const league = ctx.leagues.find((l) => l.slug === params.slug);
  if (!league) return notFound(view);
  setTitle(`${league.name} ${ctx.season?.name}`);
  adminEdit("leagues", league.id);
  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Our League", "/league"], [league.name]])}
    <h1 class="with-emblem">${league.logo_url ? emblem(league) : ""}${league.name} ${ctx.season?.name}</h1>${seasonPicker(ctx)}</div>
    ${leagueTablePanel(ctx, league)}
    <div class="grid-2" style="gap:30px">
      <div id="players">${rankingsPanel(ctx, league)}</div>
      <div id="breaks">${breaksPanel(ctx, league)}</div>
    </div>
    ${league.shield_team_id ? html`<a class="btn-bar" href="${urls.shield(league)}${query.get("season") ? `?season=${query.get("season")}` : ""}">🛡 ${league.shield_name || "Shield"}: who holds it and where it has been</a>` : ""}
    <p class="muted">${RULES_TEXT}</p>
  </div>`);
}
