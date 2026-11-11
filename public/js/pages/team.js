import { pastWinners, honoursOf, honoursPanel } from "../core/past-winners.js";
import { html, mount, fmtDate } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { breadcrumb, fixturesTable, urls, seasonPicker, seasonShort, badge, avatar, dataTable, playerLink, breakTag, topPoints, leagueTablePanel } from "../core/components.js";
import { articles, settings } from "../core/api.js";
import { profileHero, heroLook, profileTabs, statTiles, profileSection, nextMatch, teamForm as teamFormBlock, matesGrid, newsRail, teamNewsOf, wireProfile } from "../core/profile.js";
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
  // Round 114: titles the league typed in by hand (Admin → Competitions → Past winners).
  const honours = honoursOf(await pastWinners(), { team });

  // ── Round 116 (Rich: "the team one in a similar vein" — header block, top performers, table, team form, team news,
  //    next match): the same pieces as the player page (core/profile.js). ──
  const row = league ? ctx.standings(league.id).find((r) => r.team.id === team.id) : null;
  const started = !!row?.p;
  const ord = (k) => `${k}${k % 10 === 1 && k % 100 !== 11 ? "st" : k % 10 === 2 && k % 100 !== 12 ? "nd" : k % 10 === 3 && k % 100 !== 13 ? "rd" : "th"}`;
  const news = teamNewsOf(await articles().catch(() => []), team, players);
  const site = await settings().catch(() => ({}));
  // Top performers: the most ranking points, the best form and the highest break in the squad.
  const byForm = players.map((p) => ({ p, f: form?.player(p.id) })).filter((x) => x.f?.n).sort((a, b) => b.f.form - a.f.form || b.f.n - a.f.n)[0];
  const performers = [
    ranks[0]?.pts ? { label: "Most ranking points", p: ranks[0].player, value: ranks[0].pts, unit: "pts" } : null,
    byForm ? { label: "Best form", p: byForm.p, value: byForm.f.form.toFixed(1), unit: "out of 10" } : null,
    breaks[0] ? { label: "Highest break", p: breaks[0].player, value: breaks[0].value, unit: "break" } : null,
  ].filter((x) => x?.p);
  const captain = players.find((p) => /captain/i.test(p.position ?? "") && !/vice/i.test(p.position ?? ""));

  mount(view, html`<div class="wrap stack pp-page">
    <div>
      ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Seasons", "/seasons"], [`${ctx.season?.name} Season`, urls.season(ctx.season)], [`Fixtures & Results ${seasonShort(ctx.season)}`, `/fixtures?season=${ctx.season?.id}`], [title]])}
      ${profileHero({
        picture: html`<span class="pp-hero__crest">${badge(team)}</span>`, small: "Team", big: team.name,
        meta: [league ? html`<a href="${urls.standings(league)}">${league.name}</a>` : "", started ? html`<b>${ord(row.pos)}</b> in the table` : "", venue ? html`<a href="${urls.venue(venue)}">${venue.name}</a>` : ""],
        follow: followButton("team", team.id, user), look: heroLook(team, site),
      })}
    </div>
    <div class="pp-tabsrow">${profileTabs([["Stats", "#stats"], ["Next match", "#next"], performers.length ? ["Top performers", "#performers"] : null, league ? ["Table", "#table"] : null, ["Form", "#team-form"],
      news.length ? ["News", "#news"] : null, ["Fixtures", "#fixtures"], ["Team", "#team"], league ? ["Rankings", "#rankings"] : null, ["Breaks", "#breaks"]])}${seasonPicker(ctx)}</div>

    <section class="pp-sec" id="stats"><div class="pp-sec__head"><h2>Team stats</h2></div>
      ${statTiles([["League position", started ? ord(row.pos) : "–"], ["Played", row?.p ?? 0], ["Won", row?.w ?? 0], ["Lost", row?.l ?? 0], ["Frames", row ? `${row.f}–${row.a}` : "–"], ["Points", row?.pts ?? 0]])}
      <div class="pp-minis">
        ${teamForm?.n ? html`<a class="pp-mini" href="#form" data-pp-jump><span>Form</span><span class="pp-mini__form">${formBadge(teamForm, { trend: true })}</span><small>out of 10</small></a>` : ""}
        ${league ? html`<a class="pp-mini" href="${urls.standings(league)}"><span>League</span><b class="pp-mini__v">${league.short_name || league.name.replace(/ League$/i, "")}</b></a>` : ""}
        ${venue ? html`<a class="pp-mini" href="${urls.venue(venue)}"><span>Home venue</span><b class="pp-mini__v pp-mini__v--sm">${venue.name}</b></a>` : ""}
        ${captain ? html`<a class="pp-mini" href="${urls.player(captain)}"><span>Captain</span><b class="pp-mini__v pp-mini__v--sm">${captain.full_name}</b></a>` : ""}
      </div>
    </section>

    ${profileSection("next", "Next match", ctx.season?.is_current === false ? "" : nextMatch(ctx, team.id))}

    ${profileSection("performers", "Top performers", performers.length ? html`<div class="pp-perf">${performers.map((x) => html`<a class="pp-card pp-perf__card" href="${urls.player(x.p)}">
      <span class="pp-perf__label">${x.label}</span>${avatar(x.p, "avatar pp-perf__face")}<b class="pp-perf__name">${x.p.full_name}</b>
      <span class="pp-perf__value"><b>${x.value}</b> ${x.unit}</span></a>`)}</div>` : "")}

    ${league ? html`<section class="pp-sec" id="table"><div class="pp-sec__head"><h2>Table</h2><a class="sb-pill-link" href="${urls.standings(league)}">Full table</a></div>
      ${leagueTablePanel(ctx, league, { highlightTeamId: team.id, around: 2 })}</section>` : ""}

    ${profileSection("team-form", "Team form", teamFormBlock(ctx, team))}
    ${teamForm?.n ? html`<section class="pp-sec"><div class="pp-sec__head"><h2>Form, match by match</h2></div>${formPanel(teamForm, { name: team.name, kind: "team" })}</section>` : html`<span id="form"></span>`}

    ${profileSection("news", "Team news", newsRail(news))}

    <section class="pp-sec" id="fixtures"><div class="pp-sec__head"><h2>Fixtures &amp; results</h2></div>
      <div class="pp-card pp-tablecard">${fixturesTable(ctx, ctx.fixturesFor(team.id), { byes: ctx.byesFor(team.id), forTeam: team.id })}</div></section>

    <section class="pp-sec" id="team"><div class="pp-sec__head"><h2>Team</h2></div>
      ${players.length ? matesGrid(players, { note: (p) => { const f = form?.player(p.id); return f?.n ? html`Form ${formBadge(f)}` : ""; } }) : html`<div class="pp-card pp-empty">No players listed yet.</div>`}</section>

    ${league ? html`<section class="pp-sec" id="rankings"><div class="pp-sec__head"><h2>In the rankings</h2><a class="sb-pill-link" href="${urls.season(ctx.season, "rankings", league)}">Full rankings</a></div>
      <div class="pp-card pp-tablecard">${dataTable([
        { label: "Pos", cell: (r) => html`<span class="lt-pos"><b class="lt-circ">${r.pos}</b></span>`, cls: "num" },
        { label: "Player", cell: (r) => playerLink(r.player) },
        { label: "Played", cell: (r) => r.played, cls: "num" },
        { label: "Won", cell: (r) => r.won, cls: "num" },
        { label: "Pts", cell: (r) => topPoints(r, allRanks[0]), cls: "num strong" },
      ], ranks, { empty: "No frames played yet this season." })}</div></section>` : ""}

    <section class="pp-sec" id="breaks"><div class="pp-sec__head"><h2>Breaks</h2></div>
      <div class="pp-card pp-tablecard">${dataTable([
        { label: "Player", cell: (b) => playerLink(b.player) },
        { label: "Date", cell: (b) => html`<a href="${urls.match(b.fixture)}">${fmtDate(b.fixture.starts_at)}</a>` },
        { label: "Break", cell: (b) => breakTag(b.value), cls: "num strong" },
      ], breaks, { empty: "No breaks of 30 or more yet this season.", phoneLimit: 8, minHidden: 2, more: "breaks" })}</div></section>

    ${honoursPanel(honours, { title: `${team.name} honours` })}
  </div>`);
  wireProfile(view);
}
