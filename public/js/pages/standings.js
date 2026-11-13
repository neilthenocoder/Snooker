import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, leagueTablePanel, rankingsPanel, breaksPanel, seasonPicker, urls, seasonTitle } from "../core/components.js";
import { RULES_TEXT } from "../core/rules.js";
import { setTitle, adminEdit, sideContext } from "../core/router.js";
import notFound from "./not-found.js";
import { loadForm } from "../core/form.js";

export default async function standings(view, { params, query }) {
  const ctx = await seasonContext(query.get("season"));
  const league = ctx.leagues.find((l) => l.slug === params.slug);
  if (!league) return notFound(view);
  ctx.form = await loadForm(ctx).catch(() => null);   // the Form columns (Rich, round 25)
  setTitle(`${league.name} ${ctx.season?.name}`);
  adminEdit("leagues", league.id);
  sideContext({ league });
  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Seasons", "/seasons"], [`${ctx.season?.name} Season`, urls.season(ctx.season)], [league.name]])}
    ${/* Round 116 (Rich: "let's remove the trophy and the league emblem from the header"). */ ""}
    <div class="title-plain">${seasonTitle(league.name, ctx.season)}${seasonPicker(ctx)}</div></div>
    ${leagueTablePanel(ctx, league)}
    <div id="players">${rankingsPanel(ctx, league)}</div>
    <div id="breaks">${breaksPanel(ctx, league)}</div>
    ${league.shield_team_id ? html`<a class="btn-bar" href="${urls.shield(league)}${query.get("season") ? `?season=${query.get("season")}` : ""}">🛡 ${league.shield_name || "Shield"}: who holds it and where it has been</a>` : ""}
    <p class="muted">${RULES_TEXT} <a href="/form?league=${league.slug}">Form guide →</a></p>
  </div>`);
}
