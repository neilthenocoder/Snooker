// The story of a league's weekly shield over one season: who holds it now,
// who has won it most, and every match it was played for.
// (Who holds it is worked out from the results by shieldHolder() in core/rules.js.)
import { html, mount, fmtDate } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { shieldHolder, shieldTable, matchScore } from "../core/rules.js";
import { breadcrumb, panel, dataTable, teamLink, badge, seasonPicker, shortName, urls } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

export default async function shield(view, { params, query }) {
  const ctx = await seasonContext(query.get("season"));
  const league = ctx.leagues.find((l) => l.slug === params.slug);
  if (!league) return notFound(view);
  const name = league.shield_name || `${shortName(league)} Shield`;
  setTitle(`${name} ${ctx.season?.name ?? ""}`);
  adminEdit("leagues", league.id);

  const { holderId, since, history } = shieldHolder(league, ctx.fixtures, ctx.framesByFixture);
  const holder = ctx.team.get(holderId), first = ctx.team.get(league.shield_team_id);
  const table = shieldTable(history);
  const defences = history.filter((h) => h.defended && h.to === holderId && (!since || h.fixture.starts_at > since.starts_at)).length;
  const changes = history.filter((h) => !h.defended).length;
  const other = (h) => ctx.team.get([h.fixture.home_team_id, h.fixture.away_team_id].find((id) => id !== h.from));
  const score = (fx) => { const s = matchScore(ctx.framesByFixture.get(fx.id)); return `${s.home} - ${s.away}`; };

  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Our League", "/league"], [league.name, urls.standings(league)], [name]])}
      <h1>${name} ${ctx.season?.name ?? ""}</h1>${seasonPicker(ctx)}</div>

    ${!league.shield_team_id ? html`<div class="notice">This league's shield hasn't been set up yet. The league admin chooses who holds it at the start of the season under Admin → Leagues.</div>` : html`
    <div class="shield-now">
      <svg class="shield-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5.2 3.4 9.7 8 11 4.6-1.3 8-5.8 8-11V5Z"/></svg>
      <small>${ctx.season?.is_current === false ? "Holders at the end of the season" : "Current holders"}</small>
      ${holder ? html`<a class="shield-team" href="${urls.team(holder)}">${badge(holder)}<strong>${holder.name}</strong></a>` : html`<strong>–</strong>`}
      <span>${since ? `Won it on ${fmtDate(since.starts_at)}` : "Holders since the start of the season"}${defences ? ` · defended it ${defences} time${defences > 1 ? "s" : ""} since` : ""}</span>
    </div>
    <div class="stats">
      <div class="stat"><b>${history.length}</b>Shield matches</div>
      <div class="stat"><b>${changes}</b>Times it changed hands</div>
      <div class="stat"><b>${new Set([league.shield_team_id, ...history.filter((h) => !h.defended).map((h) => h.to)]).size}</b>Teams that have held it</div>
      <div class="stat"><b class="words">${table[0]?.wins ? ctx.team.get(table[0].teamId)?.name ?? "–" : "–"}</b>Most shield wins${table[0]?.wins ? ` (${table[0].wins})` : ""}</div>
    </div>

    ${panel("Who has won it most", dataTable([
      { label: "", cell: (r, i) => i + 1, cls: "num" },
      { label: "Team", cell: (r) => teamLink(ctx.team.get(r.teamId), r.teamId === holderId) },
      { label: "Shield wins", cell: (r) => r.wins, cls: "num strong" },
      { label: "Won the shield", cell: (r) => r.won, cls: "num" },
      { label: "Defended it", cell: (r) => r.defended, cls: "num" },
      { label: "Lost it", cell: (r) => r.lost, cls: "num hide-sm" },
      { label: "Failed challenges", cell: (r) => r.tried, cls: "num hide-sm" },
    ], table, { highlight: (r) => r.teamId === holderId, empty: "No shield matches have been played yet this season." }))}
    <p class="table-note" style="background:none;padding:0">A shield win is any shield match a team won — taking it from the holders, or defending it. The current holders are highlighted.</p>

    ${panel("Where the shield has been", html`<ol class="shield-trail">
      <li class="start"><span class="when">Start of season</span><div><b>${first?.name ?? "–"}</b> begin the season as holders.</div></li>
      ${history.map((h) => { const from = ctx.team.get(h.from), ch = other(h), to = ctx.team.get(h.to);
        return html`<li class="${h.defended ? "kept" : "moved"}"><span class="when">${fmtDate(h.fixture.starts_at)}</span>
          <div><a href="${urls.match(h.fixture)}">${ctx.team.get(h.fixture.home_team_id)?.name} <b>${score(h.fixture)}</b> ${ctx.team.get(h.fixture.away_team_id)?.name}</a>
            <span class="status ${h.defended ? "approved" : "in_progress"}">${h.defended ? "Defended" : "Changed hands"}</span>
            <p>${h.defended ? html`<b>${from?.name}</b> kept the shield against ${ch?.name}.` : html`<b>${to?.name}</b> took the shield from ${from?.name}.`}</p></div></li>`; })}
      ${history.length ? "" : html`<li class="none"><span class="when"></span><div class="muted">No shield matches played yet — the holders defend it every time they play.</div></li>`}
    </ol>`)}
    <p class="muted">How it works: whoever holds the shield defends it in every league match they play. If they lose, the winners take it and defend it in their next match.</p>`}
  </div>`);
}
