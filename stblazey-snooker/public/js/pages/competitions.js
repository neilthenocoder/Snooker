import { html, mount, fmtDate } from "../core/dom.js";
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
    ...summary(buildBracket(data.entries.filter((e) => e.competition_id === c.id), data.matches.filter((m) => m.competition_id === c.id)), data.entries.filter((e) => e.competition_id === c.id).length),
  }));
}
/** Where a competition stands, in words and in numbers. */
function summary(b, entrants) {
  const real = b.rounds.flat().filter((m) => !m.isBye);
  const next = real.filter((m) => !m.played && m.row.starts_at).map((m) => m.row.starts_at).sort()[0] ?? null;
  return { progress: progressText(b), facts: { entrants, played: real.filter((m) => m.played).length, total: real.length, next } };
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
    ${list.length ? html`<div class="comp-list">${list.map(({ c, progress, parent, openTo, facts }) => html`<a class="comp-row" href="${urls.competition(c)}">
      <div class="comp-pic">${c.image_url ? picture(c.image_url, "") : html`<div class="ph"></div>`}${trophy(c, "comp-row-trophy")}</div>
      <div class="comp-info">
        <small class="comp-kind">${[c.handicap ? `Handicap ${c.kind.toLowerCase()}` : c.kind, openTo ? `${openTo} only` : "", parent ? `Plate of the ${parent.name}` : ""].filter(Boolean).join(" · ")}</small>
        <h3>${c.name}</h3>
        ${c.info ? html`<p class="comp-blurb">${c.info}</p>` : ""}
        <dl class="comp-facts">
          <div><dt>Entrants</dt><dd>${facts.entrants || "–"}</dd></div>
          <div><dt>Matches played</dt><dd>${facts.total ? `${facts.played} of ${facts.total}` : "–"}</dd></div>
          <div><dt>${facts.next ? "Next match" : c.draw_at && !facts.total ? "Draw" : "Best of"}</dt><dd>${facts.next ? fmtDate(facts.next) : c.draw_at && !facts.total ? fmtDate(c.draw_at) : `${c.best_of ?? 5} frame${(c.best_of ?? 5) === 1 ? "" : "s"}`}</dd></div>
          ${c.entry_fee ? html`<div><dt>Entry</dt><dd>${c.entry_fee}</dd></div>` : ""}
        </dl>
        <span class="comp-tags"><span class="status ${progress.startsWith("Winner") ? "approved" : "submitted"}">${progress}</span>
          ${openForEntry([c]).length ? html`<span class="status in_progress">Entries open${c.entry_closes ? ` until ${fmtDate(c.entry_closes)}` : ""}</span>` : ""}</span>
      </div>
      <span class="comp-go" aria-hidden="true">›</span>
    </a>`)}</div>` : html`<div class="empty box">No competitions for ${season?.name ?? "this season"} yet.</div>`}
  </div>`);
}
