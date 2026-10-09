import { html, mount, $ } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, panel, dataTable, playerLink, handicapTag, handicapMove, isActivePlayer } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function handicaps(view) {
  setTitle("Handicaps");
  adminEdit("handicaps");
  const ctx = await seasonContext();
  const cols = [
    { label: "Player", cell: (p) => playerLink(p) },
    { label: "Last year", cell: (p) => (p.last_handicap == null ? "–" : handicapTag(p.last_handicap)), cls: "num hide-sm" },
    { label: "Handicap", cell: (p) => html`${handicapTag(p.handicap)}${handicapMove(p)}`, cls: "num strong" },
  ];
  // Players who still play (in competitions) but aren't in a team this season.
  const loose = ctx.players.filter((p) => isActivePlayer(p) && !p.team_id);
  const moved = ctx.players.some((p) => p.last_handicap != null && p.last_handicap !== p.handicap);
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Handicaps"]])}
    <h1>Handicaps</h1>
    <div class="hc-bar">
      <label>Jump to a team
        <select data-team-jump><option value="">– choose a team –</option>
          ${ctx.leagues.map((l) => html`<optgroup label="${l.name}">${ctx.teamsIn(l.id).map((t) => html`<option value="hc-${t.slug}">${t.name}</option>`)}</optgroup>`)}</select></label>
      <p class="hc-key"><span class="hc-val plus">+1 and up</span> plus handicaps <span class="hc-val zero">0</span> scratch <span class="hc-val minus">−1 and down</span> minus handicaps
        ${moved ? html`<span class="hc-move up">▲</span> up from last year <span class="hc-move down">▼</span> down from last year` : ""}</p>
    </div>
    ${ctx.leagues.map((l) => html`<h3>${l.name}</h3><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
      ${ctx.teamsIn(l.id).map((t) => html`<div class="hc-team" id="hc-${t.slug}">${panel(t.name, dataTable(cols, ctx.playersOf(t.id), { empty: "No players listed." }))}</div>`)}
    </div>`)}
    ${loose.length > 20 ? html`<h3>No team at the moment</h3>
      <details class="hc-loose"><summary><b>${loose.length} players</b> on the league's books without a team this season <span class="muted">— show their handicaps</span></summary>
        <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
          ${[0, 1, 2].map((i) => loose.slice(Math.ceil((loose.length * i) / 3), Math.ceil((loose.length * (i + 1)) / 3))).map((part) => html`<div class="hc-team">${panel(`${part[0]?.full_name.split(" ")[0]} to ${part.at(-1)?.full_name.split(" ")[0]}`, dataTable(cols, part))}</div>`)}
        </div></details>`
    : loose.length ? html`<h3>No team at the moment</h3><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
      <div class="hc-team">${panel("Players without a team", dataTable(cols, loose))}</div></div>` : ""}
  </div>`);

  // Choosing a team scrolls down to it and flashes its box, so it's easy to spot.
  $("[data-team-jump]", view).addEventListener("change", (e) => {
    const box = e.target.value && document.getElementById(e.target.value);
    if (!box) return;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    box.classList.remove("flash"); void box.offsetWidth; box.classList.add("flash");
    history.replaceState(null, "", `#${e.target.value}`);
  });
}
