import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, leagueTablePanel, rankingsPanel, breaksPanel, seasonPicker } from "../core/components.js";
import { RULES_TEXT } from "../core/rules.js";
import { setTitle } from "../core/router.js";
import notFound from "./not-found.js";

export default async function standings(view, { params, query }) {
  const ctx = await seasonContext(query.get("season"));
  const league = ctx.leagues.find((l) => l.slug === params.slug);
  if (!league) return notFound(view);
  setTitle(`${league.name} ${ctx.season?.name}`);
  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Our League", "/league"], [league.name]])}
    <h1>${league.name} ${ctx.season?.name}</h1>${seasonPicker(ctx)}</div>
    ${leagueTablePanel(ctx, league)}
    <div class="grid-2" style="gap:30px">
      <div id="players">${rankingsPanel(ctx, league)}</div>
      <div id="breaks">${breaksPanel(ctx, league)}</div>
    </div>
    <p class="muted">${RULES_TEXT}</p>
  </div>`);
}
