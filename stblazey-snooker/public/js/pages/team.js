import { html, mount, fmtDate } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, panel, fixturesTable, urls, seasonPicker, seasonShort, personCard, badge, dataTable, playerLink, breakTag, topPoints } from "../core/components.js";
import { followButton } from "../core/my-snooker.js";
import { setTitle, adminEdit, sideContext } from "../core/router.js";
import notFound from "./not-found.js";
import { loadForm, formPanel, formBadge } from "../core/form.js";

export default async function team(view, { params, query, user }) {
  const ctx = await seasonContext(query.get("season"));
  const team = ctx.teams.find((t) => t.slug === params.slug);
  if (!team) return notFound(view);
  const title = `${team.name} – ${ctx.season?.name} Fixtures & Results`;
  setTitle(title);
  adminEdit("teams", team.id);
  sideContext({ team });
  const league = ctx.league.get(team.league_id);
  const venue = ctx.venue.get(team.venue_id);
  const players = ctx.playersOf(team.id);
  // Form (Rich, round 25): the team's, and each player's next to their name.
  const form = await loadForm(ctx).catch(() => null);
  const teamForm = form?.team(team.id);
  // Rich, round 48: the rankings and breaks belong on the team's page too — where each of its players is in the
  // league's rankings, and the team's breaks of 30 or more this season.
  const squadIds = new Set(players.map((p) => p.id));
  const allRanks = league ? ctx.rankings(league.id) : [];
  const ranks = allRanks.filter((r) => squadIds.has(r.player.id));
  const breaks = (league ? ctx.breaksIn(league.id) : []).filter((b) => squadIds.has(b.player_id));

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Seasons", "/seasons"], [`${ctx.season?.name} Season`, urls.season(ctx.season)], [`Fixtures & Results ${seasonShort(ctx.season)}`, `/fixtures?season=${ctx.season?.id}`], [title]])}
    <div class="title-row"><h1 class="with-emblem">${badge(team)}${title}</h1>${followButton("team", team.id, user)}</div>
    <div class="grid-2" style="margin-bottom:22px">
      <div class="box">
        <strong>League:</strong> ${league ? html`<a href="${urls.standings(league)}">${league.name}</a>` : "–"}<br>
        <strong>Home venue:</strong> ${venue ? html`<a href="${urls.venue(venue)}" style="color:var(--red)">${venue.name}</a>` : "–"}
      </div>
      ${seasonPicker(ctx)}
    </div>
    ${teamForm?.n ? formPanel(teamForm, { name: team.name, kind: "team" }) : ""}
    ${panel(`${team.name} fixtures & results`, fixturesTable(ctx, ctx.fixturesFor(team.id), { byes: ctx.byesFor(team.id), forTeam: team.id }))}
    ${league && (ranks.length || breaks.length) ? html`<div class="grid-2 team-extra">
      ${panel(`${team.name} in the rankings`, dataTable([
        { label: "Pos", cell: (r) => r.pos, cls: "num" },
        { label: "Player", cell: (r) => playerLink(r.player) },
        { label: "Played", cell: (r) => r.played, cls: "num" },
        { label: "Won", cell: (r) => r.won, cls: "num" },
        { label: "Pts", cell: (r) => topPoints(r, allRanks[0]), cls: "num strong" },
      ], ranks, { empty: "No frames played yet this season." }), { foot: { href: urls.season(ctx.season, "rankings", league), label: `The full ${league.short_name || league.name} rankings` } })}
      ${panel(`${team.name} breaks`, dataTable([
        { label: "Player", cell: (b) => playerLink(b.player) },
        { label: "Date", cell: (b) => html`<a href="${urls.match(b.fixture)}">${fmtDate(b.fixture.starts_at)}</a>` },
        { label: "Break", cell: (b) => breakTag(b.value), cls: "num strong" },
      ], breaks, { empty: "No breaks of 30 or more yet this season.", phoneLimit: 8, minHidden: 2, more: "breaks" }))}
    </div>` : ""}
    <h3>Team</h3>
    ${players.length ? html`<div class="people squad">${players.map((p) => { const f = form?.player(p.id);
      return personCard(p, html`${p.position === "Player" ? "" : p.position}${f?.n ? html` <span class="pc-form">Form ${formBadge(f)}</span>` : ""}`); })}</div>` : html`<div class="empty box">No players listed yet.</div>`}
  </div>`);
}
