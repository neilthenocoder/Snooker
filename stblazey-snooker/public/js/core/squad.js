// ─────────────────────────────────────────────────────────────
//  MANAGE TEAM — for captains and vice captains only.
//    • the box at the bottom of the home page (and of My Snooker) in the days before
//      a match: "Manage team". It can be closed, and stays closed for that match;
//    • the team sheet itself is filled in under My area → Manage team (pages/my.js):
//      who plays each frame, plus adding a new player.
//  A team sheet is kept apart from the scorecard (the "lineups" table): the other
//  team cannot see it until the day of the match. On the night it is already on the
//  scorecard when the card is opened.
// ─────────────────────────────────────────────────────────────
import { html, mount, fmtTime, ukDay, todayUK } from "./dom.js";
import { isCaptain } from "./auth.js";
import { teamLineups } from "./api.js";
import { RULES } from "./rules.js";

/** The box appears this many days before the match unless Site settings says otherwise (0 switches it off). */
export const SQUAD_BOX_DAYS = 3;
const CLOSED_KEY = "sbdsl-squad-box-closed";
const closed = () => { try { return JSON.parse(localStorage.getItem(CLOSED_KEY) || "[]"); } catch { return []; } };
const close = (fixtureId) => { try { localStorage.setItem(CLOSED_KEY, JSON.stringify([...closed().filter((id) => id !== fixtureId), fixtureId].slice(-20))); } catch { /* not remembered */ } };

/** A team's matches still to be played, soonest first (a match stays in the list on its own day, even after its start time). */
export function upcomingFor(ctx, teamId) {
  const today = todayUK();
  return ctx.fixturesFor(teamId).filter((f) => ["scheduled", "in_progress"].includes(f.status) && ukDay(f.starts_at) >= today)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
/** How many of a sheet's places have a player in them. */
export const pickedCount = (lineup) => (lineup?.picks ?? []).filter((x) => x?.player_id).length;
/** "Tue 13 Oct" */
export const dayText = (iso) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).replace(",", "");
/** How long until the match, in words. */
export function untilText(iso) {
  const days = Math.round((Date.parse(`${ukDay(iso)}T12:00:00Z`) - Date.parse(`${todayUK()}T12:00:00Z`)) / 864e5);
  return days <= 0 ? "Tonight" : days === 1 ? "Tomorrow" : `In ${days} days`;
}

/**
 * The "Manage team" box. Shown to a captain or vice captain when their team's next match is within
 * `site.squad_box_days` days (and they have not closed it for that match). Fixed to the bottom of the screen.
 * Returns a function that takes it away again (call it when the page is left).
 */
export async function mountSquadBox(user, ctx, site) {
  if (!isCaptain(user)) return () => {};
  const days = site?.squad_box_days ?? SQUAD_BOX_DAYS;
  if (!(days > 0)) return () => {};
  const teamId = user.profile.team_id, team = ctx.team.get(teamId);
  const fx = upcomingFor(ctx, teamId).find((f) => f.status === "scheduled");
  if (!team || !fx || closed().includes(fx.id)) return () => {};
  const away = Math.round((Date.parse(`${ukDay(fx.starts_at)}T12:00:00Z`) - Date.parse(`${todayUK()}T12:00:00Z`)) / 864e5);
  if (away > days) return () => {};
  const sheet = (await teamLineups(teamId)).find((l) => l.fixture_id === fx.id);
  const n = pickedCount(sheet), want = RULES.framesPerMatch;
  const opp = ctx.team.get(fx.home_team_id === teamId ? fx.away_team_id : fx.home_team_id);

  const el = document.createElement("aside");
  el.className = "squad-box";
  el.setAttribute("aria-label", "Manage team");
  mount(el, html`<div class="squad-box-text">
      <strong>Manage team</strong>
      <span><b>${untilText(fx.starts_at)}:</b> ${fx.home_team_id === teamId ? "home" : "away"} v ${opp?.name ?? "?"} · ${dayText(fx.starts_at)}, ${fmtTime(fx.starts_at)}</span>
      <small class="${n >= want ? "ok" : ""}">${n >= want ? "Your team is picked ✓" : n ? `${n} of ${want} players picked so far` : "Pick your players for the night"}</small>
    </div>
    <a class="btn" href="/my/squad?m=${fx.code || fx.id}">${n ? "Change the team" : "Pick the team"}</a>
    <button type="button" class="squad-box-x" aria-label="Close" title="Close (it comes back for your next match)">×</button>`);
  document.body.append(el);
  document.documentElement.classList.add("has-squad-box");
  requestAnimationFrame(() => el.classList.add("in"));
  const gone = () => { el.remove(); document.documentElement.classList.remove("has-squad-box"); };
  el.addEventListener("click", (e) => {
    if (e.target.closest(".squad-box-x")) { close(fx.id); gone(); }
  });
  return gone;
}

/** One line for a match: "Tue 13 Oct, 19:30 · home v Bugle" */
export const fixtureLine = (ctx, fx, teamId) => `${dayText(fx.starts_at)}, ${fmtTime(fx.starts_at)} · ${fx.home_team_id === teamId ? "home" : "away"} v ${ctx.team.get(fx.home_team_id === teamId ? fx.away_team_id : fx.home_team_id)?.name ?? "?"}`;
