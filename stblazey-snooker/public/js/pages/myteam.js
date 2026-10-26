// My Snooker (/myteam): a logged-in person's own page — the teams and players they follow,
// in the sections they chose (core/my-snooker.js draws it). Every login has one: players,
// captains and officers alike. It is set up and changed under My area → My Snooker (/my/snooker),
// or with the Follow button on any team or player page.
import { html, mount, $, toast } from "../core/dom.js";
import { setMyPrefs, settings } from "../core/api.js";
import { mountSquadBox } from "../core/squad.js";
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

  // Round 48: My Snooker is the home page now (pages/home.js). This address is kept for old links and
  // bookmarks — and for someone who follows nobody yet, it is where they pick their team.
  const data = await mySnookerData();
  const { ctx } = data;
  const prefs = myPrefs(user);
  const teams = prefs.teams.map((id) => ctx.team.get(id)).filter(Boolean);
  const players = prefs.players.map((id) => ctx.player.get(id)).filter(Boolean);
  if (!teams.length && !players.length) return chooser(view, ctx, crumbs, prefs);
  return navigate("/", { replace: true });
}

/** Nothing followed yet: pick the first team (more teams, players and sections are chosen in the dashboard). */
function chooser(view, ctx, crumbs, prefs) {
  mount(view, html`<div class="wrap ms">${crumbs}
    <header class="ms-hero"><div class="ms-hero-text"><small class="ms-kicker">${star} My Snooker</small><h1>Choose your team</h1>
      <p>Pick the team you play for or follow. Your home page then shows its matches, results, breaks, handicaps and news every time you log in.
        You can follow more teams and players, and choose what you see, whenever you like.</p></div>
      <div class="ms-hero-actions"><a class="btn ghost" href="/?home=1">Normal home page</a><a class="btn small ghost" href="/my/snooker">Home page settings</a></div></header>
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
      toast("Your home page is set up");
      navigate("/", { replace: true });
    } catch (err) { toast(err.message, "error"); btn.disabled = false; }
  });
}
