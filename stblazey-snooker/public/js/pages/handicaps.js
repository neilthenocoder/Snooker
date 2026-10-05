import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, panel, dataTable, playerLink, handicapText, handicapMove } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function handicaps(view) {
  setTitle("Handicaps");
  adminEdit("handicaps");
  const ctx = await seasonContext();
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Handicaps"]])}
    <h1>Handicaps</h1>
    ${ctx.players.some((p) => p.last_handicap != null && p.last_handicap !== p.handicap) ? html`<p class="hc-key"><span class="hc-move up">▲</span> up from last year <span class="hc-move down">▼</span> down from last year — after the yearly handicap review.</p>` : ""}
    ${ctx.leagues.map((l) => html`<h3>${l.name}</h3><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
      ${ctx.teamsIn(l.id).map((t) => panel(t.name, dataTable([
        { label: "Player", cell: (p) => playerLink(p) },
        { label: "Last year", cell: (p) => (p.last_handicap == null ? "–" : handicapText(p.last_handicap)), cls: "num hide-sm" },
        { label: "Handicap", cell: (p) => html`${handicapText(p.handicap)}${handicapMove(p)}`, cls: "num strong" },
      ], ctx.playersOf(t.id), { empty: "No players listed." })))}
    </div>`)}
  </div>`);
}
