// /tables — every league's table on one page, one press away (round 116).
// Rich: the League button at the bottom of a phone opened a page of tiles, "one page too many to get to the tables".
// Here the table is on the screen straight away, with a switch between the leagues as on the home page (it slides
// sideways when a season has more leagues than fit). The page of tiles is still there: /seasons/<season>/league-tables.
import { html, mount, $ } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, urls, leagueMarks, provisionalNote, seasonPicker } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import { loadForm, formChips } from "../core/form.js";

export default async function tables(view, { query, user }) {
  const ctx = await seasonContext(query.get("season"));
  setTitle(`League tables ${ctx.season?.name ?? ""}`.trim());
  adminEdit("leagues");
  const form = await loadForm(ctx).catch(() => null);
  const leagues = ctx.leagues.filter((l) => ctx.teamsIn(l.id).length);
  // Which league shows first: the one in the address (?league=…), else your own team's, else the first.
  const mine = ctx.team.get(user?.profile?.team_id);
  const first = leagues.find((l) => l.slug === query.get("league")) ?? leagues.find((l) => l.id === mine?.league_id) ?? leagues[0];
  const seasonQ = query.get("season") ? `?season=${encodeURIComponent(query.get("season"))}` : "";

  const pane = (l) => {
    const rows = ctx.standings(l.id), m = leagueMarks(ctx, l, { highlightTeamId: mine?.league_id === l.id ? mine.id : undefined, shown: rows });
    return html`<div data-seg-pane="${l.id}" ${l === first ? "" : "hidden"}>
      <div class="sb-table-wrap"><table class="sb-table sb-lt">
        <caption class="sr-only">${l.name} table</caption>
        <thead><tr><th class="sb-c" scope="col">Pos</th><th scope="col">Team</th><th class="sb-c" scope="col" title="Played">P</th><th class="sb-c" scope="col" title="Won">W</th><th class="sb-c" scope="col" title="Lost">L</th><th class="sb-c" scope="col" title="Frames for">F</th><th class="sb-c" scope="col" title="Frames against">A</th><th class="sb-c" scope="col" title="Points">Pts</th>${form ? html`<th class="tb-form" scope="col">Form</th>` : ""}</tr></thead>
        <tbody>${rows.map((r) => html`<tr class="${m.rowClass(r)}">
          <td class="sb-c">${m.pos(r)}</td><td class="sb-table__team">${m.team(r)}</td>
          <td class="sb-c">${r.p}</td><td class="sb-c">${r.w}</td><td class="sb-c">${r.l}</td><td class="sb-c">${r.f}</td><td class="sb-c">${r.a}</td><td class="sb-c sb-table__key">${m.pts(r)}</td>
          ${form ? html`<td class="tb-form">${formChips(form.team(r.team.id), { links: false })}</td>` : ""}</tr>`)}</tbody>
      </table></div>
      ${rows.length ? "" : html`<p class="sb-empty">No teams in this league yet.</p>`}
      ${m.key}${provisionalNote(ctx, l)}
      <div class="tb-more">
        <a class="sb-pill-link" href="${urls.standings(l)}${seasonQ}#players">${l.short_name || l.name} rankings</a>
        <a class="sb-pill-link" href="${urls.standings(l)}${seasonQ}#breaks">${l.short_name || l.name} breaks</a>
        <a class="sb-pill-link" href="/fixtures${seasonQ}">Fixtures &amp; results</a>
      </div>
    </div>`;
  };

  mount(view, html`<div class="wrap stack tb-page">
    <div>${breadcrumb([["Home", "/"], ["Our League", "/league"], [`${ctx.season?.name ?? ""} Season`, urls.season(ctx.season)], ["League tables"]])}
      <div class="title-plain"><h1>League tables</h1>${seasonPicker(ctx)}</div></div>
    ${leagues.length ? html`<div class="sb-card tb-card" data-seg-scope>
      ${leagues.length > 1 ? html`<div class="sb-seg tb-seg" role="group" aria-label="League" data-seg-group>${leagues.map((l) => html`<button type="button" data-seg="${l.id}" data-slug="${l.slug}" aria-pressed="${String(l === first)}">${l.name}</button>`)}</div>` : html`<h2 class="tb-one">${leagues[0].name}</h2>`}
      ${leagues.map(pane)}
    </div>` : html`<div class="empty box">No league tables yet this season.</div>`}
  </div>`);

  // The switch: show that league's table, and keep the address in step so the page can be shared.
  $("[data-seg-group]", view)?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-seg]");
    if (!b) return;
    for (const x of b.parentElement.querySelectorAll("[data-seg]")) x.setAttribute("aria-pressed", String(x === b));
    for (const p of view.querySelectorAll("[data-seg-pane]")) p.hidden = p.dataset.segPane !== b.dataset.seg;
    const q = new URLSearchParams(location.search); q.set("league", b.dataset.slug);
    history.replaceState(history.state, "", `${location.pathname}?${q}`);
    b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  });
  $("[data-seg-group] [aria-pressed=true]", view)?.scrollIntoView({ block: "nearest", inline: "center" });
}
