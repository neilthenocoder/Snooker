import { html, mount, $, toast } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadFixture, saveScorecard, setFixtureStatus, seasonFrames, setScorecardPhoto, addPlayerToTeam } from "../core/api.js";
import { extCounts, isShieldMatch } from "../core/rules.js";
import { canEditFixture, isAdmin } from "../core/auth.js";
import { uploadImage } from "../core/upload.js";
import { scorecardEditor, breaksText } from "../core/scorecard-editor.js";
import { breadcrumb, statusBadge, urls } from "../core/components.js";
import { setTitle, navigate } from "../core/router.js";
import notFound from "./not-found.js";

export function mustLogin(view) {
  mount(view, html`<div class="wrap"><h1>Please log in</h1>
    <p>This area is for team captains and the league secretary. <a class="btn" href="/login">Log in</a></p></div>`);
}

export default async function scorecard(view, { params, user }) {
  if (!user) return mustLogin(view);
  const bundle = await loadFixture(params.id);
  if (!bundle) return notFound(view);
  const fx = bundle.fixture;
  const admin = isAdmin(user);
  if (!canEditFixture(user, fx)) {
    return mount(view, html`<div class="wrap"><h1>Scorecard locked</h1>
      <div class="notice error">You can only edit scorecards for your own team's matches, and only until they are approved.</div>
      <a class="btn" href="${urls.match(fx)}">View the match</a></div>`);
  }

  const [ctx, allSeasonFrames] = await Promise.all([seasonContext(fx.season_id), seasonFrames(fx.season_id)]);
  const home = ctx.team.get(fx.home_team_id), away = ctx.team.get(fx.away_team_id);
  const league = ctx.league.get(fx.league_id);
  setTitle(`Scorecard: ${home?.name} vs ${away?.name}`);

  // Ext appearances already used this season (not counting this match).
  const extUsed = extCounts(allSeasonFrames.filter((f) => f.fixture_id !== fx.id));
  const shield = league?.shield_team_id ? isShieldMatch(league, fx, ctx.fixtures, ctx.framesByFixture) : { isShield: false };
  const holder = ctx.team.get(shield.holderId);

  const toEditor = (f) => ({
    frame_no: f.frame_no, a_points: f.home_points, b_points: f.away_points,
    a: [{ player_id: f.home_player_id, ext: !!f.home_ext, breaks: breaksText(bundle.breaks, f.frame_no, f.home_player_id) }],
    b: [{ player_id: f.away_player_id, ext: !!f.away_ext, breaks: breaksText(bundle.breaks, f.frame_no, f.away_player_id) }],
  });
  const fromEditor = (f) => ({
    frame_no: f.frame_no, home_points: f.a_points, away_points: f.b_points,
    home_player_id: f.a[0].player_id, away_player_id: f.b[0].player_id, home_ext: !!f.a[0].ext, away_ext: !!f.b[0].ext,
  });
  const options = (teamId) => ctx.playersOf(teamId).map((p) => ({ id: p.id, name: `${p.full_name}${p.position === "Team Captain" ? " (c)" : p.position === "Vice Captain" ? " (vc)" : ""}` }));
  const myTeam = admin ? null : user.profile.team_id;

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], [admin ? "Admin" : "My team", admin ? "/admin/results" : "/captain"], ["Scorecard"]])}
    <p>Status: <span data-status>${statusBadge(fx.status)}</span> · Enter each frame as it finishes and press <b>Save progress</b> — the live page updates for everyone.
      When the match is over, press <b>Submit results</b>.</p>
    <div data-editor></div>
  </div>`);

  return scorecardEditor({
    el: $("[data-editor]", view),
    subtitle: league?.name ?? "League match", when: fx.starts_at, venue: ctx.venue.get(fx.venue_id)?.name,
    sides: { a: { name: home?.name, team: home, options: options(fx.home_team_id) }, b: { name: away?.name, team: away, options: options(fx.away_team_id) } },
    allowExt: true, extUsed, playerName: (id) => ctx.player.get(id)?.full_name ?? "A player",
    frames: bundle.frames.map(toEditor),
    notice: html`${shield.isShield ? html`<div class="sc-shield">🛡 ${league.shield_name || "Shield"} match — <b>${holder?.name}</b> ${holder ? "hold the shield and are defending it tonight." : ""}</div>` : ""}
      <div class="sc-tools">
        ${fx.scorecard_url ? html`<a class="btn small ghost" href="${fx.scorecard_url}" target="_blank" rel="noopener">View uploaded scorecard photo</a>` : ""}
        ${myTeam || admin ? html`<button type="button" class="btn small ghost" data-new-player>+ Add a new player to ${admin ? "a team" : ctx.team.get(myTeam)?.name}</button>` : ""}
      </div>`,
    actions: [
      { key: "progress", label: "Save progress", done: "Progress saved" },
      { key: "photo", label: "Upload scorecard", cls: "secondary", skipChecks: true, quiet: true },
      { key: "submit", label: "Submit results", cls: "green", final: true, confirm: "Submit the final result?", done: "Result submitted" },
      ...(admin ? [
        { key: "approve", label: "Save & approve", cls: "blue", final: true, confirm: "Approve this result? Captains won't be able to edit it afterwards.", done: "Approved" },
        { key: "postponed", label: "Mark postponed", cls: "ghost", skipChecks: true, done: "Marked as postponed" },
      ] : []),
      { key: "view", label: "View public page", cls: "ghost", skipChecks: true, quiet: true },
    ],
    extra: html`<input type="file" accept="image/*" capture="environment" hidden data-photo>`,
    async onSave(frames, breaks, action) {
      if (action === "view") return navigate(urls.match(fx));
      if (action === "photo") return pickPhoto();
      // (Unsaved frames are kept on screen while the photo uploads.)
      await saveScorecard(fx.id, frames.map(fromEditor), breaks);
      const target = { progress: fx.status === "scheduled" ? "in_progress" : fx.status, submit: "submitted", approve: "approved", postponed: "postponed" }[action];
      if (target && target !== fx.status) { await setFixtureStatus(fx.id, target); fx.status = target; mount($("[data-status]", view), statusBadge(target)); }
      if (action === "submit" && !admin) navigate("/captain");
      if (["approve", "postponed"].includes(action)) navigate(location.pathname, { replace: true });
    },
  });

  // Photo of the paper card (opens the camera on phones).
  function pickPhoto() {
    const input = $("[data-photo]", view);
    input.onchange = async () => {
      if (!input.files[0]) return;
      try {
        toast("Uploading photo…");
        const url = await uploadImage(input.files[0], { folder: "scorecards", maxSize: 2000 });
        await setScorecardPhoto(fx.id, url);
        toast("Scorecard photo uploaded");
        navigate(location.pathname, { replace: true });
      } catch (err) { toast(err.message, "error"); }
    };
    input.click();
  }

  // Captains can register a new player for their own team from the scorecard.
  view.addEventListener("click", async (e) => {
    if (!e.target.matches("[data-new-player]")) return;
    const name = prompt("New player's full name:")?.trim();
    if (!name) return;
    let teamId = myTeam;
    if (admin) {
      const pick = prompt(`Which team? Type 1 for ${home?.name} or 2 for ${away?.name}`, "1");
      teamId = pick === "2" ? fx.away_team_id : fx.home_team_id;
    }
    try { await addPlayerToTeam(name, teamId); toast(`${name} added`); navigate(location.pathname, { replace: true }); }
    catch (err) { toast(err.message, "error"); }
  });
}

