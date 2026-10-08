// My Snooker (/myteam): a logged-in player's own page — their team's next match, results,
// fixtures, breaks, handicaps and place in the table, all on one screen.
// The login does not have to be linked to a player: they choose the team to follow.
// It is switched on, changed and reset under My area → My Snooker (/my/snooker).
import { html, mount, $, fmtDate, fmtTime, toast } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { setMySnooker } from "../core/api.js";
import { mySnookerOn, mySnookerTeamId, refreshUser } from "../core/auth.js";
import { breadcrumb, panel, dataTable, leagueTablePanel, playerLink, handicapTag, urls, badge, resultText } from "../core/components.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";
import { mustLogin } from "./scorecard.js";

/** Remember, for this visit to the site, that they have seen their page (so Home shows the normal home page). */
export const MY_SNOOKER_SEEN = "sbds-my-snooker-seen";
export function markSeen() { try { sessionStorage.setItem(MY_SNOOKER_SEEN, "1"); } catch { /* private browsing: nothing to remember */ } }

const star = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9Z"/></svg>`;

export default async function myteam(view, { user }) {
  setTitle("My Snooker");
  if (!user) return mustLogin(view);
  markSeen();
  const ctx = await seasonContext();
  const crumbs = breadcrumb([["Home", "/"], ["My Snooker"]]);

  // Switched off: say so, and how to bring it back.
  if (!mySnookerOn(user)) {
    return mount(view, html`<div class="wrap">${crumbs}<h1>My Snooker</h1>
      <div class="box ms-off"><h3>My Snooker is switched off</h3>
        <p>Switch it on to get your own page with your team's matches, results, breaks and handicaps as soon as you log in.</p>
        <div class="btn-row"><a class="btn" href="/my/snooker">Switch it on</a><a class="btn ghost" href="/">Normal home page</a></div></div></div>`);
  }

  const team = ctx.team.get(mySnookerTeamId(user));
  if (!team) return chooser(view, ctx, crumbs);

  const league = ctx.league.get(team.league_id);
  const venue = ctx.venue.get(team.venue_id);
  const fixtures = ctx.fixturesFor(team.id);
  const byes = ctx.byesFor(team.id);
  const played = fixtures.filter((f) => ctx.hasResult(f) && f.status !== "in_progress").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const toCome = fixtures.filter((f) => !ctx.hasResult(f) || f.status === "in_progress");
  const today = new Date().toISOString().slice(0, 10);
  // What is still to come, in date order, with the team's bye weeks among the matches.
  const upcoming = [...toCome, ...byes.filter((b) => b.bye_on >= today).map((b) => ({ ...b, bye: true, starts_at: `${b.bye_on}T12:00:00Z` }))]
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  const next = toCome.find((f) => ["scheduled", "in_progress"].includes(f.status) && (f.status === "in_progress" || Date.parse(f.starts_at) > Date.now() - 6 * 36e5))
    ?? toCome.find((f) => f.status === "scheduled");
  const opp = (f) => ctx.team.get(f.home_team_id === team.id ? f.away_team_id : f.home_team_id);
  const row = league ? ctx.standings(league.id).find((r) => r.team.id === team.id) : null;
  const rank = new Map((league ? ctx.rankings(league.id) : []).map((r) => [r.player.id, r]));
  const squad = ctx.playersOf(team.id);
  const ids = new Set(squad.map((p) => p.id));
  const breaks = (league ? ctx.breaksIn(league.id) : []).filter((b) => ids.has(b.player_id));
  const best = (id) => breaks.find((b) => b.player_id === id)?.value;
  const me = ctx.player.get(user.profile?.player_id);
  const mine = me && rank.get(me.id);
  const first = (user.profile?.full_name || "").trim().split(/\s+/)[0];

  // W / L for the last five, newest first.
  const form = played.slice(0, 5).map((f) => {
    const s = ctx.scoreOf(f), us = f.home_team_id === team.id ? s.home : s.away, them = f.home_team_id === team.id ? s.away : s.home;
    return { f, won: us > them, text: `${us}–${them} v ${opp(f)?.name ?? ""}` };
  });

  mount(view, html`<div class="wrap ms">
    ${crumbs}
    <header class="ms-hero">
      <span class="ms-badge">${badge(team)}</span>
      <div class="ms-hero-text">
        <small class="ms-kicker">${star} My Snooker${first ? html` · ${first}` : ""}</small>
        <h1>${team.name}</h1>
        <p>${league?.name ?? ""}${venue ? html` · Home: <a href="${urls.venue(venue)}">${venue.name}</a>` : ""}</p>
      </div>
      <div class="ms-hero-actions">
        <a class="btn ghost" href="/">Normal home page</a>
        <a class="btn small ghost" href="${urls.team(team)}">Public team page</a>
      </div>
    </header>
    <p class="ms-note">${star}<span>You have made this page your own by using the <b>My Snooker</b> feature in your dashboard.
      <a href="/my/snooker">Click here to change or reset.</a></span></p>

    <div class="ms-grid">
      <div class="stack">
        ${next ? html`<a class="next-match ms-next" href="${urls.match(next)}">
          <div><small>${next.status === "in_progress" ? "On now" : "Next match"} · ${fmtDate(next.starts_at)} ${fmtTime(next.starts_at)}</small>
            <strong>${next.home_team_id === team.id ? "Home" : "Away"} v ${opp(next)?.name}</strong>
            <span>${ctx.venue.get(next.venue_id)?.name ?? ""}</span></div>
          <span class="btn green">${next.status === "in_progress" ? "Follow it live" : "Match preview"}</span></a>`
          : html`<div class="notice">No more matches scheduled for ${team.name} this season.</div>`}
        <div class="stats">
          <div class="stat"><b>${row?.p ? row.pos : "–"}</b>League position</div>
          <div class="stat"><b>${row?.p ?? 0}</b>Played</div>
          <div class="stat"><b>${row?.w ?? 0}</b>Won</div>
          <div class="stat"><b>${row?.pts ?? 0}</b>Points</div>
        </div>
        ${form.length ? html`<div class="ms-form"><span>Last ${form.length === 1 ? "match" : form.length}</span>
          ${form.map((x) => html`<a href="${urls.match(x.f)}" class="${x.won ? "w" : "l"}" title="${x.text}">${x.won ? "W" : "L"}</a>`)}</div>` : ""}
        ${mine || me ? panel(`Your season, ${me.full_name}`, html`<div class="stats ms-mine">
          <div class="stat"><b>${handicapTag(me.handicap)}</b>Handicap</div>
          <div class="stat"><b>${mine?.played ?? 0}</b>Frames played</div>
          <div class="stat"><b>${mine?.won ?? 0}</b>Won</div>
          <div class="stat"><b>${mine?.pts ?? 0}</b>Ranking points</div>
          <div class="stat"><b>${best(me.id) ?? "–"}</b>Best break</div></div>`, { foot: { href: urls.player(me), label: "Your player page" } }) : ""}
        ${panel("Games played", dataTable([
          { label: "Date", cell: (f) => fmtDate(f.starts_at) },
          { label: "Match", cell: (f) => html`<a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} vs ${ctx.team.get(f.away_team_id)?.name}</a>` },
          { label: "Result", cell: (f) => resultText(ctx, f), cls: "num strong" },
          { label: "", cell: (f) => html`<a href="${urls.match(f)}">Frame by frame</a>`, cls: "hide-sm" },
        ], played, { empty: "No matches played yet this season." }))}
        ${panel(`Fixtures to come${ctx.season?.name ? ` · ${ctx.season.name}` : ""}`, dataTable([
          { label: "Date", cell: (f) => fmtDate(f.starts_at) },
          { label: "Match", cell: (f) => (f.bye ? html`<span class="bye-row"><b>Bye week</b> no match</span>`
            : html`<a href="${urls.match(f)}"><span class="ms-ha ${f.home_team_id === team.id ? "h" : "a"}">${f.home_team_id === team.id ? "Home" : "Away"}</span> v ${opp(f)?.name ?? "–"}</a>`) },
          { label: "Time", cell: (f) => (f.bye ? "–" : f.status === "postponed" ? "Postponed" : f.status === "in_progress" ? html`<span class="live-dot">Live</span>` : fmtTime(f.starts_at)), cls: "num" },
          { label: "Venue", cell: (f) => { const v = !f.bye && ctx.venue.get(f.venue_id); return v ? html`<a href="${urls.venue(v)}">${v.name}</a>` : "–"; }, cls: "hide-sm" },
        ], upcoming, { rowClass: (f) => (f.bye ? "is-bye" : ""), empty: "No more fixtures this season." }),
          { foot: { href: `/calendar?team=${team.id}`, label: "See these on the calendar" } })}
      </div>
      <div class="stack">
        ${panel("Squad & handicaps", dataTable([
          { label: "Player", cell: (p) => html`${playerLink(p)}${p.position && p.position !== "Player" ? html` <small class="muted">${p.position}</small>` : ""}` },
          { label: "Handicap", cell: (p) => handicapTag(p.handicap), cls: "num" },
          { label: "Played", cell: (p) => rank.get(p.id)?.played ?? 0, cls: "num" },
          { label: "Won", cell: (p) => rank.get(p.id)?.won ?? 0, cls: "num" },
          { label: "Pts", cell: (p) => rank.get(p.id)?.pts ?? 0, cls: "num strong" },
        ], squad, { highlight: (p) => p.id === me?.id, empty: "No players listed yet." }), { foot: { href: "/handicaps", label: "Every team's handicaps" } })}
        ${panel("Team breaks", dataTable([
          { label: "Player", cell: (b) => playerLink(b.player) },
          { label: "Date", cell: (b) => html`<a href="${urls.match(b.fixture)}">${fmtDate(b.fixture.starts_at)}</a>` },
          { label: "Break", cell: (b) => b.value, cls: "num strong" },
        ], breaks, { empty: "No breaks of 30 or more yet this season." }))}
        ${league ? leagueTablePanel(ctx, league, { highlightTeamId: team.id }) : ""}
      </div>
    </div>
  </div>`);
}

/** Nobody chosen yet (a login that isn't linked to a team): pick the team to follow. */
function chooser(view, ctx, crumbs) {
  mount(view, html`<div class="wrap ms">${crumbs}
    <header class="ms-hero"><div class="ms-hero-text"><small class="ms-kicker">${star} My Snooker</small><h1>Choose your team</h1>
      <p>Pick the team you play for or follow. This page then shows its matches, results, breaks and handicaps every time you log in. You can change it whenever you like.</p></div>
      <div class="ms-hero-actions"><a class="btn ghost" href="/">Normal home page</a></div></header>
    ${ctx.leagues.map((l) => html`<h3>${l.name}</h3><div class="cards team-tiles">${ctx.teamsIn(l.id).map((t) => html`<button type="button" class="tile team-tile" data-pick="${t.id}">
      ${badge(t)}<h4>${t.name}</h4><span>Make this my team</span></button>`)}</div>`)}
  </div>`);
  $(".ms", view).addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-pick]");
    if (!btn) return;
    btn.disabled = true;
    try {
      await setMySnooker(btn.dataset.pick, true);
      await refreshUser(); await refreshShell();
      toast("My Snooker is set up");
      navigate("/myteam", { replace: true });
    } catch (err) { toast(err.message, "error"); btn.disabled = false; }
  });
}
