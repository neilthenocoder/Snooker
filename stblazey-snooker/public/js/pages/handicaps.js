import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, panel, dataTable, playerLink, handicapText } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function handicaps(view) {
  setTitle("Handicaps");
  adminEdit("players");
  const ctx = await seasonContext();
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Handicaps"]])}
    <h1>Handicaps</h1>
    ${ctx.leagues.map((l) => html`<h3>${l.name}</h3><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
      ${ctx.teamsIn(l.id).map((t) => panel(t.name, dataTable([
        { label: "Player", cell: (p) => playerLink(p) },
        { label: "Handicap", cell: (p) => handicapText(p.handicap), cls: "num strong" },
      ], ctx.playersOf(t.id), { empty: "No players listed." })))}
    </div>`)}
  </div>`);
}
