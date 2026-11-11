// ─────────────────────────────────────────────────────────────
//  MY SNOOKER (/mysnooker; /myteam still works) — round 52 (Neil): a page of its own again, not the home page.
//  The Live & upcoming strip (All | my team), the team at the top, then the sections the person chose, in their
//  order (core/my-snooker.js draws them). Changed under My Snooker settings (/my/snooker).
//  /mysnooker?team=… — a team chosen in the home page's strip filter ("View … stats"): that team's page, for
//  anyone, logged in or not (logged-in people keep what they follow, with that team first).
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast } from "../core/dom.js";
import { setMyPrefs, settings, subscribe } from "../core/api.js";
import { seasonContext } from "../core/context.js";
import { isLiveNow, frameWinner } from "../core/rules.js";
import { mountSquadBox } from "../core/squad.js";
import { myPrefs, refreshUser, isMaster, canEditFixture } from "../core/auth.js";
import { mySnookerData, mountMySnooker, mySnookerStar as star, prefsToSave, followButton } from "../core/my-snooker.js";
import { breadcrumb, urls, badge } from "../core/components.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";
import { mustLogin } from "./scorecard.js";
import { mountLiveStrip } from "./home.js";
import { maybeStartGuide } from "../core/guide.js";

export const MY_SNOOKER_SEEN = "sbds-my-snooker-seen";
export function markSeen() { try { sessionStorage.setItem(MY_SNOOKER_SEEN, "1"); } catch { /* nothing to remember */ } }

export default async function myteam(view, { user, query }) {
  setTitle("My Snooker");
  const asked = query?.get?.("team") ?? new URLSearchParams(location.search).get("team");
  if (!user && !asked) return mustLogin(view);
  markSeen();
  const crumbs = breadcrumb([["Home", "/"], ["My Snooker"]]);
  const [data, site] = await Promise.all([mySnookerData(), settings().catch(() => ({}))]);
  const { ctx } = data;
  const saved = myPrefs(user);
  const look = asked && ctx.team.get(asked) ? ctx.team.get(asked) : null;
  // A team looked at from the home page goes first (only for this visit — nothing is saved).
  const prefs = look ? { ...saved, teams: [look.id, ...saved.teams.filter((id) => id !== look.id)], players: user ? saved.players : [] } : saved;
  const teams = prefs.teams.map((id) => ctx.team.get(id)).filter(Boolean);
  const players = prefs.players.map((id) => ctx.player.get(id)).filter(Boolean);
  if (!teams.length && !players.length) return chooser(view, ctx, crumbs, prefs, user);

  view.classList.add("flush");
  mount(view, html`
    <section class="sb-strip live-strip sb-strip--mine" aria-labelledby="sb-strip-h"><div class="sb-strip__inner" data-strip></div></section>
    <div class="wrap ms ms-page">
      ${crumbs}
      ${hero(user, ctx, teams, players, look, saved)}
      <div data-ms-live></div>
      <div data-ms></div>
    </div>`);
  // Round 117 (Rich: "when your team is playing we need that as a live update happening, large"): a big live card at
  // the top for each team you follow that is playing now — crests, the score, the frame in play — updating by itself.
  const liveBox = $("[data-ms-live]", view);
  const liveTeams = new Set([...(prefs?.teams ?? []), user?.profile?.team_id].filter(Boolean));
  const drawLive = async () => {
    const c = await seasonContext().catch(() => null);
    if (!c || !liveBox.isConnected) return;
    const now = Date.now();
    const on = c.fixtures.filter((f) => (liveTeams.has(f.home_team_id) || liveTeams.has(f.away_team_id))
      && (f.status === "in_progress" || isLiveNow(f, now, c.scoreOf(f).framesPlayed)) && !["approved", "submitted", "postponed"].includes(f.status));
    mount(liveBox, on.length ? html`<div class="msl-list">${on.map((f) => {
      const sc = c.scoreOf(f), home = c.team.get(f.home_team_id), away = c.team.get(f.away_team_id);
      const frames = c.framesOf(f.id).filter((x) => !x.legacy), last = frames.filter((x) => frameWinner(x)).at(-1);
      const who = (id) => c.player.get(id)?.full_name ?? "–";
      return html`<article class="msl">
        <div class="msl__top"><span class="msl__live"><i aria-hidden="true"></i>Live now</span><span class="msl__league">${c.league.get(f.league_id)?.name ?? ""}${c.venue.get(f.venue_id)?.name ? ` · ${c.venue.get(f.venue_id).name}` : ""}</span></div>
        <a class="msl__match" href="${urls.match(f)}">
          <span class="msl__side"><span class="msl__crest">${badge(home)}</span><b>${home?.name ?? "TBC"}</b></span>
          <span class="msl__score" aria-label="${sc.home} to ${sc.away}"><i>${sc.home}</i><i>${sc.away}</i></span>
          <span class="msl__side"><span class="msl__crest">${badge(away)}</span><b>${away?.name ?? "TBC"}</b></span></a>
        <p class="msl__line">${last ? html`Frame ${last.frame_no}: <b>${who(last[`${frameWinner(last)}_player_id`])}</b> won ${last.home_points ?? ""}–${last.away_points ?? ""}${frames.length > sc.framesPlayed ? " · next frame under way" : ""}` : "Waiting for the first frame…"}</p>
        <div class="msl__btns"><a class="msl__btn" href="${urls.match(f)}">Follow it live</a>
          ${canEditFixture(user, f) ? html`<a class="msl__btn msl__btn--edit" href="${urls.scorecard(f)}">Edit the scorecard</a>` : ""}</div>
      </article>`; })}</div>` : "");
  };
  await drawLive().catch(() => {});
  const stopLive = subscribe(["frames", "fixtures"], () => drawLive().catch(() => {}));
  // Round 114 (Neil): the same strip as the home page — same cards, colours and sizes — showing your teams' matches
  // (with the All / your team switch).
  const stopStrip = await mountLiveStrip($("[data-strip]", view), user, { mode: "mine", layout: "sb" }).catch(() => () => {});
  const stopMine = await mountMySnooker($("[data-ms]", view), user, { data, prefs });
  // Captains and vice captains: the "Manage team" box, as on the home page.
  const stopSquad = user ? await mountSquadBox(user, ctx, site).catch(() => () => {}) : () => {};
  // The guide: the first time someone opens their own My Snooker, or straight after "Show me around".
  if (user && !look) maybeStartGuide({ personal: true, site });
  return () => { stopStrip?.(); stopMine?.(); stopSquad(); stopLive?.(); };
}

/** Round 113.3 (Rich): "Do you play? Link your player profile" moved here from the account menu. A Master Admin links it
 *  themselves (Admin → Logins); anyone else asks the league. Gone once their login has a player profile. */
const linkMe = (user) => (user && !user.profile?.player_id
  ? html`<a class="btn small ghost ms-linkme" href="${isMaster(user) ? "/admin/accounts" : "/support"}" title="${isMaster(user) ? "Then My profile and My form appear in your menu" : "Ask the league to link your login to your player profile"}">Do you play? Link your player profile</a>` : "");

/** The top of the page: the team, and My Snooker settings (or Follow, for a team looked at from the home page). */
function hero(user, ctx, teams, players, look, saved) {
  const team = teams[0];
  const league = team && ctx.league.get(team.league_id), venue = team && ctx.venue.get(team.venue_id);
  const first = (user?.profile?.full_name || "").trim().split(/\s+/)[0];
  const following = look && saved.teams.includes(look.id);
  return html`<header class="ms-hero ms-home-hero" data-guide="hero">
    ${team ? html`<span class="ms-badge">${badge(team)}</span>` : ""}
    <div class="ms-hero-text">
      <small class="ms-kicker">${star} My Snooker${first && !look ? html` · ${first}` : ""}</small>
      <h1>${teams.length === 1 || look ? team.name : first ? `Hello, ${first}` : "My Snooker"}</h1>
      <p>${teams.length === 1 || look ? html`${league?.name ?? ""}${venue ? html` · Home: <a href="${urls.venue(venue)}">${venue.name}</a>` : ""}`
        : `Following ${[teams.length ? `${teams.length} team${teams.length > 1 ? "s" : ""}` : "", players.length ? `${players.length} player${players.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(" and ")}`}</p>
    </div>
    <div class="ms-hero-actions">
      ${look && user && !following ? followButton("team", look.id, user) : ""}
      ${!look ? linkMe(user) : ""}
      ${user ? html`<a class="btn small" href="/my/snooker" data-guide="settings">My Snooker settings</a>`
        : html`<a class="btn small" href="/login">Log in for your own My Snooker</a>`}
    </div>
  </header>`;
}

/** Nothing followed yet: pick the first team (more teams, players and sections are chosen in My Snooker settings). */
function chooser(view, ctx, crumbs, prefs, user) {
  mount(view, html`<div class="wrap ms">${crumbs}
    <header class="ms-hero"><div class="ms-hero-text"><small class="ms-kicker">${star} My Snooker</small><h1>Choose your team</h1>
      <p>Pick the team you play for or follow. Your My Snooker page then shows its matches, results, breaks, handicaps and news every time you log in.
        You can follow more teams and players, and choose what you see, whenever you like.</p></div>
      <div class="ms-hero-actions"><a class="btn ghost" href="/">Home page</a><a class="btn small" href="/my/snooker">My Snooker settings</a>${linkMe(user)}</div></header>
    ${ctx.leagues.map((l) => html`<section class="pick-league"><h2 class="league-group-h">${l.name}</h2><div class="pick-grid">${ctx.teamsIn(l.id).map((t) => html`<button type="button" class="pick-team" data-pick="${t.id}">
      <span class="pick-badge">${badge(t)}</span><b>${t.name}</b><span class="pick-go">Choose this team</span></button>`)}</div></section>`)}
  </div>`);
  $(".ms", view).addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-pick]");
    if (!btn) return;
    btn.disabled = true;
    try {
      await setMyPrefs(true, prefsToSave({ ...prefs, teams: [btn.dataset.pick] }));
      await refreshUser(); await refreshShell();
      toast("My Snooker is set up");
      navigate("/mysnooker", { replace: true });
    } catch (err) { toast(err.message, "error"); btn.disabled = false; }
  });
}
