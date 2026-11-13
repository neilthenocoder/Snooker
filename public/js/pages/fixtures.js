import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, badge, urls, seasonPicker, seasonShort, leagueCrests, seasonTitle } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function fixtures(view, { query }) {
  const ctx = await seasonContext(query.get("season"));
  const title = `Fixtures & Results ${seasonShort(ctx.season)}`;
  setTitle(title);
  adminEdit("fixtures");
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Seasons", "/seasons"], [`${ctx.season?.name} Season`, urls.season(ctx.season)], [title]])}
    <div class="title-plain">${seasonTitle("Fixtures & Results", ctx.season)}${seasonPicker(ctx)}</div>
    ${/* Round 98: the same crest wall as the home page's Our teams */ leagueCrests(ctx, { href: (t) => `${urls.team(t)}?season=${ctx.season?.id ?? ""}`, note: (t) => ctx.venue?.get?.(t.venue_id)?.name ?? "" })}
  </div>`);
}
