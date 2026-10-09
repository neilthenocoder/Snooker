// My Snooker (/myteam): a logged-in person's own page — the teams and players they follow,
// in the sections they chose (core/my-snooker.js draws it). Every login has one: players,
// captains and officers alike. It is set up and changed under My area → My Snooker (/my/snooker),
// or with the Follow button on any team or player page.
import { html, mount, $, toast } from "../core/dom.js";
import { setMyPrefs } from "../core/api.js";
import { mySnookerOn, myPrefs, refreshUser } from "../core/auth.js";
import { mySnookerData, mountMySnooker, mySnookerStar as star, prefsToSave } from "../core/my-snooker.js";
import { breadcrumb, urls, badge } from "../core/components.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";
import { mustLogin } from "./scorecard.js";

/** Remember, for this visit to the site, that they have seen their page (so Home shows the normal home page). */
export const MY_SNOOKER_SEEN = "sbds-my-snooker-seen";
export function markSeen() { try { sessionStorage.setItem(MY_SNOOKER_SEEN, "1"); } catch { /* private browsing: nothing to remember */ } }

export default async function myteam(view, { user }) {
  setTitle("My Snooker");
  if (!user) return mustLogin(view);
  markSeen();
  const crumbs = breadcrumb([["Home", "/"], ["My Snooker"]]);

  // Switched off: say so, and how to bring it back.
  if (!mySnookerOn(user)) {
    return mount(view, html`<div class="wrap">${crumbs}<h1>My Snooker</h1>
      <div class="box ms-off"><h3>My Snooker is switched off</h3>
        <p>Switch it on to get your own page: the teams and players you follow, with their matches, results, breaks, handicaps and news.</p>
        <div class="btn-row"><a class="btn" href="/my/snooker">Switch it on</a><a class="btn ghost" href="/">Normal home page</a></div></div></div>`);
  }

  const data = await mySnookerData();
  const { ctx } = data;
  const prefs = myPrefs(user);
  const teams = prefs.teams.map((id) => ctx.team.get(id)).filter(Boolean);
  const players = prefs.players.map((id) => ctx.player.get(id)).filter(Boolean);
  if (!teams.length && !players.length) return chooser(view, ctx, crumbs, prefs);

  const first = (user.profile?.full_name || "").trim().split(/\s+/)[0];
  const team = teams[0];
  const league = team && ctx.league.get(team.league_id), venue = team && ctx.venue.get(team.venue_id);
  mount(view, html`<div class="wrap ms">
    ${crumbs}
    <header class="ms-hero">
      ${team ? html`<span class="ms-badge">${badge(team)}</span>` : ""}
      <div class="ms-hero-text">
        <small class="ms-kicker">${star} My Snooker${first ? html` · ${first}` : ""}</small>
        <h1>${teams.length === 1 ? team.name : "My Snooker"}</h1>
        <p>${teams.length === 1 ? html`${league?.name ?? ""}${venue ? html` · Home: <a href="${urls.venue(venue)}">${venue.name}</a>` : ""}`
          : html`Following ${[teams.length ? `${teams.length} team${teams.length > 1 ? "s" : ""}` : "", players.length ? `${players.length} player${players.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(" and ")}`}</p>
      </div>
      <div class="ms-hero-actions">
        <a class="btn ghost" href="/">Normal home page</a>
        <a class="btn small ghost" href="/my/snooker">Change what I see</a>
      </div>
    </header>
    <p class="ms-note">${star}<span>You have made this page your own by using the <b>My Snooker</b> feature in your dashboard.
      <a href="/my/snooker">Click here to change or reset.</a></span></p>
    <div data-ms></div>
  </div>`);
  return mountMySnooker($("[data-ms]", view), user, { data });
}

/** Nothing followed yet: pick the first team (more teams, players and sections are chosen in the dashboard). */
function chooser(view, ctx, crumbs, prefs) {
  mount(view, html`<div class="wrap ms">${crumbs}
    <header class="ms-hero"><div class="ms-hero-text"><small class="ms-kicker">${star} My Snooker</small><h1>Choose your team</h1>
      <p>Pick the team you play for or follow. Your page then shows its matches, results, breaks, handicaps and news every time you log in.
        You can follow more teams and players, and choose what you see, whenever you like.</p></div>
      <div class="ms-hero-actions"><a class="btn ghost" href="/">Normal home page</a><a class="btn small ghost" href="/my/snooker">All the choices</a></div></header>
    ${ctx.leagues.map((l) => html`<h3>${l.name}</h3><div class="cards team-tiles">${ctx.teamsIn(l.id).map((t) => html`<button type="button" class="tile team-tile" data-pick="${t.id}">
      ${badge(t)}<h4>${t.name}</h4><span>Make this my team</span></button>`)}</div>`)}
  </div>`);
  $(".ms", view).addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-pick]");
    if (!btn) return;
    btn.disabled = true;
    try {
      await setMyPrefs(true, prefsToSave({ ...prefs, teams: [btn.dataset.pick] }));
      await refreshUser(); await refreshShell();
      toast("My Snooker is set up");
      navigate("/myteam", { replace: true });
    } catch (err) { toast(err.message, "error"); btn.disabled = false; }
  });
}
