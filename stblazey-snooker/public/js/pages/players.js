// "Our Players": pick a team to see its players, past and present.
import { html, mount, $ } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { teamPlayerHistory } from "../core/api.js";
import { breadcrumb, badge, urls, personCard as playerCard, isActivePlayer } from "../core/components.js";
import { setTitle, navigate, adminEdit } from "../core/router.js";

export default async function players(view, { query }) {
  const ctx = await seasonContext();
  const team = ctx.teams.find((t) => t.slug === query.get("team"));
  setTitle(team ? `${team.name} players` : "Our Players");
  adminEdit("players");

  const picker = html`<label class="toolbar" style="font-weight:700">Team
    <select data-team><option value="">Choose a team…</option>${ctx.leagues.map((l) => html`<optgroup label="${l.name}">
      ${ctx.teamsIn(l.id).map((t) => html`<option value="${t.slug}" ${t.id === team?.id ? "selected" : ""}>${t.name}</option>`)}</optgroup>`)}</select></label>`;

  if (!team) {
    mount(view, html`<div class="wrap">
      ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Our Players"]])}
      <h1>Our Players</h1>
      ${picker}
      ${ctx.leagues.map((l) => html`<h3>${l.name}</h3><div class="cards team-tiles">${ctx.teamsIn(l.id).map((t) => html`<a class="tile team-tile" href="/players?team=${t.slug}">
        ${badge(t)}<h4>${t.name}</h4><span>${ctx.playersOf(t.id).length} players</span></a>`)}</div>`)}
    </div>`);
  } else {
    // Past players: anyone who has played a frame for this team but isn't in it now.
    const everPlayed = await teamPlayerHistory(team.id);
    const current = ctx.playersOf(team.id);
    const past = ctx.players.filter((p) => (p.team_id !== team.id || !isActivePlayer(p)) && everPlayed.has(p.id));
    mount(view, html`<div class="wrap">
      ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Our Players", "/players"], [team.name]])}
      <div class="player-head" style="margin-bottom:14px"><h1>${badge(team)} ${team.name}</h1>${picker}</div>
      <p><a href="${urls.team(team)}" style="color:var(--red);font-weight:700">Fixtures & results</a> · ${ctx.league.get(team.league_id)?.name ?? ""}</p>
      <h3>Current players</h3>
      ${current.length ? html`<div class="people">${current.map((p) => playerCard(p, p.position))}</div>` : html`<div class="empty box">No players listed yet.</div>`}
      <h3>Past players</h3>
      ${past.length ? html`<div class="people">${past.map((p) => playerCard(p, `Now at ${ctx.team.get(p.team_id)?.name ?? "no team"}`))}</div>`
        : html`<div class="empty box">No past players on record yet.</div>`}
    </div>`);
  }
  $("[data-team]", view).addEventListener("change", (e) => navigate(e.target.value ? `/players?team=${e.target.value}` : "/players"));
}
