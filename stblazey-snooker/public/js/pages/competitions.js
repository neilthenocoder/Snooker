import { html, mount } from "../core/dom.js";
import { table, loadCompetitions } from "../core/api.js";
import { buildBracket, progressText } from "../core/bracket.js";
import { breadcrumb, picture, urls, shortName, trophy } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import { openForEntry } from "./enter.js";

/** Summary line for each competition, shared with the home page. */
export async function competitionSummaries() {
  const [data, seasons, leagues] = await Promise.all([loadCompetitions(), table("seasons", "name"), table("leagues", "sort")]);
  return data.competitions.map((c) => ({
    c, season: seasons.find((s) => s.id === c.season_id),
    parent: data.competitions.find((x) => x.id === c.parent_id),
    // "Rees only", "Victory and Rees", or nothing when it's open to everyone.
    openTo: (c.league_ids ?? []).length ? leagues.filter((l) => c.league_ids.includes(l.id)).map(shortName).join(" and ") : "",
    progress: progressText(buildBracket(data.entries.filter((e) => e.competition_id === c.id), data.matches.filter((m) => m.competition_id === c.id))),
  }));
}

/** /competitions — this season's competitions, with a list to look back at earlier seasons. */
export default async function competitions(view, { query }) {
  setTitle("Competitions");
  adminEdit("competitions");
  const [all, seasons] = await Promise.all([competitionSummaries(), table("seasons", "name")]);
  const current = seasons.find((s) => s.is_current) ?? seasons.at(-1);
  const season = seasons.find((s) => s.id === query.get("season")) ?? current;
  // A competition with no season set belongs to the current one.
  const list = all.filter(({ c }) => (c.season_id ?? current?.id) === season?.id);
  const withComps = new Set(all.map(({ c }) => c.season_id ?? current?.id));
  const choices = [...seasons].reverse().filter((s) => withComps.has(s.id) || s.id === season?.id);

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Competitions"]])}
    <h1>Competitions ${season?.name ?? ""}</h1>
    ${choices.length > 1 ? html`<label class="toolbar" style="font-weight:700">Season
      <select data-season-picker>${choices.map((s) => html`<option value="${s.id}" ${s.id === season?.id ? "selected" : ""}>${s.name}${s.id === current?.id ? " (this season)" : ""}</option>`)}</select></label>` : ""}
    ${openForEntry(all.map((x) => x.c)).length ? html`<a class="enter-bar" href="/enter"><b>Entries are open</b> for ${openForEntry(all.map((x) => x.c)).map((c) => c.name).join(", ")} <span>Enter now →</span></a>` : ""}
    ${list.length ? html`<div class="cards">${list.map(({ c, progress, parent, openTo }) => html`<a class="card" href="${urls.competition(c)}">
      <div class="card-pic">${c.image_url ? picture(c.image_url, c.name) : html`<div class="ph"></div>`}${trophy(c, "card-trophy")}</div>
      <div><h4>${c.name}</h4><small>${[c.kind, c.handicap ? "Handicap" : "", openTo ? `${openTo} only` : "", parent ? `Plate of the ${parent.name}` : "", openForEntry([c]).length ? "Entries open" : ""].filter(Boolean).join(" · ")}</small>
        <span class="status ${progress.startsWith("Winner") ? "approved" : "submitted"}">${progress}</span></div>
    </a>`)}</div>` : html`<div class="empty box">No competitions for ${season?.name ?? "this season"} yet.</div>`}
  </div>`);
}
