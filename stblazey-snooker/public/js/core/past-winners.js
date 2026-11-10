// ─────────────────────────────────────────────────────────────
//  PAST WINNERS (round 114 — Rich: "a manual override for old results and old players",
//  e.g. "X won the singles in 1980/81, 84/85").
//  Typed in by hand at Admin → Competitions → Past winners, for seasons before the website
//  (or anything the results can't show). Shown in:
//    • Season archive & roll of honour  — every past winner, by competition
//    • a competition's page              — "Previous winners"
//    • a player's / team's page          — "Honours"
//  It never changes results, tables or rankings: those are still worked out from the results.
//  Table: past_winners (supabase/fixes/round114-past-winners.sql).
// ─────────────────────────────────────────────────────────────
import { html } from "./dom.js";
import { table } from "./api.js";
import { panel, dataTable, urls } from "./components.js";

/** "1980/81" → 1980, "84/85" → 1984, "1984" → 1984, "2003-04" → 2003. Two-digit years: 30 and above are 19xx. */
export function yearFrom(season) {
  const s = String(season ?? "").trim();
  const four = s.match(/\b(1[89]\d\d|20\d\d)\b/);
  if (four) return Number(four[1]);
  const two = s.match(/^(\d{2})\b/);
  if (two) { const n = Number(two[1]); return n >= 30 ? 1900 + n : 2000 + n; }
  return null;
}

/** "1980/81, 84/85; 1990" → ["1980/81", "84/85", "1990"] — several seasons typed at once in Admin. */
export const splitSeasons = (text) => String(text ?? "").split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

/** Every past winner, newest season first (never fails: no table yet → none). */
export async function pastWinners() {
  const rows = await table("past_winners", "season").catch(() => []);
  return [...rows].sort((a, b) => (b.year_from ?? yearFrom(b.season) ?? 0) - (a.year_from ?? yearFrom(a.season) ?? 0)
    || String(a.title).localeCompare(String(b.title)));
}

/** The winner (or runner-up) as a link when they're on the website, otherwise just the name typed in. */
export function who(row, which, { players = [], teams = [] } = {}) {
  const p = players.find((x) => x.id === row[`${which}_player_id`]);
  const t = teams.find((x) => x.id === row[`${which}_team_id`]);
  const name = row[`${which}_name`] || p?.full_name || t?.name;
  if (!name) return "–";
  if (p) return html`<a href="${urls.player(p)}">${name}</a>`;
  if (t) return html`<a href="${urls.team(t)}">${name}</a>`;
  return name;
}

/** Past winners of one competition on the website — linked to it, or with the same name. */
export const winnersOf = (rows, comp) => rows.filter((r) => (r.competition_id && r.competition_id === comp.id)
  || (!r.competition_id && String(r.title).trim().toLowerCase() === String(comp.name).trim().toLowerCase()));

const nameMatch = (a, b) => a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
/** A player's or team's honours: won (and runner-up) — by the link, or by the same name typed in. */
export function honoursOf(rows, { player = null, team = null }) {
  const is = (r, which) => (player && (r[`${which}_player_id`] === player.id || (!r[`${which}_player_id`] && !r[`${which}_team_id`] && nameMatch(r[`${which}_name`], player.full_name))))
    || (team && (r[`${which}_team_id`] === team.id || (!r[`${which}_player_id`] && !r[`${which}_team_id`] && nameMatch(r[`${which}_name`], team.name))));
  return rows.flatMap((r) => (is(r, "winner") ? [{ ...r, place: "Winner" }] : is(r, "runner_up") ? [{ ...r, place: "Runner-up" }] : []));
}

/** The same list as a panel — for a team's page. */
export const honoursPanel = (list, { title = "Honours" } = {}) => (list.length ? panel(title, honoursList(list), { cls: "pw-panel" }) : "");

const groupHonours = (list) => {
  const groups = new Map();
  for (const r of list) {
    const k = `${String(r.title).trim().toLowerCase()}|${r.place}`;
    if (!groups.has(k)) groups.set(k, { title: r.title, place: r.place, seasons: [] });
    groups.get(k).seasons.push(r.season);
  }
  return [...groups.values()].sort((a, b) => (a.place === b.place ? b.seasons.length - a.seasons.length : a.place === "Winner" ? -1 : 1));
};
const honoursList = (list) => html`<ul class="pw-honours">${groupHonours(list).map((g) => html`<li>
  <span class="pw-honours__ico ${g.place === "Winner" ? "is-win" : "is-ru"}" aria-hidden="true">${g.place === "Winner" ? "1st" : "2nd"}</span>
  <span class="pw-honours__txt"><b>${g.title}</b>${g.place === "Runner-up" ? html` <small>runner-up</small>` : ""}${g.seasons.length > 1 ? html` <small>× ${g.seasons.length}</small>` : ""}
  <small class="pw-honours__yrs">${[...g.seasons].reverse().join(" · ")}</small></span></li>`)}</ul>`;

/** The "Honours" box on a player's page (same look as the other boxes there). */
export const honoursBox = (list, title = "Honours") => html`<section class="profile-box pw-box"><h3>${title}</h3>${honoursList(list)}</section>`;

/** A competition's "Previous winners" table. */
export function previousWinnersPanel(list, refs, { title = "Previous winners", compact = false } = {}) {
  if (!list.length) return "";
  const runners = list.some((r) => r.runner_up_name || r.runner_up_player_id || r.runner_up_team_id);
  const notes = !compact && list.some((r) => r.notes);   // no room for notes in a narrow side column
  return panel(title, dataTable([
    { label: "Season", cell: (r) => html`<b>${r.season}</b>` },
    { label: "Winner", cell: (r) => who(r, "winner", refs) },
    ...(runners ? [{ label: "Runner-up", cell: (r) => who(r, "runner_up", refs), cls: "hide-sm" }] : []),
    ...(notes ? [{ label: "", cell: (r) => (r.notes ? html`<small class="muted">${r.notes}</small>` : ""), cls: "hide-sm" }] : []),
  ], list, { phoneLimit: 10, more: "seasons" }), { cls: "pw-panel" });
}

/** Every past winner, one panel per competition — for the Season archive & roll of honour. */
export function pastWinnersSection(rows, refs) {
  if (!rows.length) return "";
  const byComp = new Map();
  for (const r of rows) { const k = String(r.title).trim(); if (!byComp.has(k)) byComp.set(k, []); byComp.get(k).push(r); }
  const comps = [...byComp.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  return html`<section class="pw-archive stack">
    <div><h2>Past winners</h2>
      <p class="muted" style="max-width:760px">Winners from before the website and earlier seasons, collected by the league. Know one that's missing or wrong? <a href="/support">Let us know</a>.</p></div>
    <div class="grid-2" style="gap:30px">${comps.map(([name, list]) => previousWinnersPanel(list, refs, { title: name }))}</div>
  </section>`;
}
