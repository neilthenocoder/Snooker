import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, badge, urls, seasonPicker, seasonShort } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function fixtures(view, { query }) {
  const ctx = await seasonContext(query.get("season"));
  const title = `Fixtures & Results ${seasonShort(ctx.season)}`;
  setTitle(title);
  adminEdit("fixtures");
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Seasons", "/seasons"], [`${ctx.season?.name} Season`, urls.season(ctx.season)], [title]])}
    <h1>${title}</h1>
    ${seasonPicker(ctx)}
    ${ctx.leagues.map((l) => html`<h3>${l.name}</h3>
      <div class="cards">${ctx.teamsIn(l.id).map((t) => html`<a class="tile with-emblem" href="${urls.team(t)}?season=${ctx.season?.id ?? ""}">${badge(t)}<span><h4>${t.name}</h4>Click here to view the fixtures</span></a>`)}</div>`)}
  </div>`);
}
