import { html, mount } from "../core/dom.js";
import { table, loadCompetitions } from "../core/api.js";
import { buildBracket, progressText } from "../core/bracket.js";
import { breadcrumb, picture, urls } from "../core/components.js";
import { setTitle } from "../core/router.js";

/** Summary line for each competition, shared with the home page. */
export async function competitionSummaries() {
  const [data, seasons] = await Promise.all([loadCompetitions(), table("seasons", "name")]);
  return data.competitions.map((c) => ({
    c, season: seasons.find((s) => s.id === c.season_id),
    progress: progressText(buildBracket(data.entries.filter((e) => e.competition_id === c.id), data.matches.filter((m) => m.competition_id === c.id))),
  }));
}

export default async function competitions(view) {
  setTitle("Competitions");
  const list = await competitionSummaries();
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Competitions"]])}
    <h1>All competitions</h1>
    ${list.length ? html`<div class="cards">${list.map(({ c, season, progress }) => html`<a class="card" href="${urls.competition(c)}">
      ${picture(c.image_url, c.name)}
      <div><h4>${c.name}</h4><small>${c.kind}${season ? ` · ${season.name}` : ""}</small><span class="status ${progress.startsWith("Winner") ? "approved" : "submitted"}">${progress}</span></div>
    </a>`)}</div>` : html`<div class="empty">No competitions yet.</div>`}
  </div>`);
}
