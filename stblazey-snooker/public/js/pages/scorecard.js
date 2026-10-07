import { html, mount, $, toast } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadFixture, saveScorecard, setFixtureStatus, seasonFrames, setScorecardPhoto, addPlayerToTeam, sendResultEmail } from "../core/api.js";
import { extCounts, isShieldMatch } from "../core/rules.js";
import { canEditFixture, isAdmin } from "../core/auth.js";
import { uploadImage } from "../core/upload.js";
import { scorecardEditor, breaksText } from "../core/scorecard-editor.js";
import { breadcrumb, statusBadge, urls } from "../core/components.js";
import { setTitle, navigate } from "../core/router.js";
import notFound from "./not-found.js";

export function mustLogin(view) {
  mount(view, html`<div class="wrap"><h1>Please log in</h1>
    <p>This area is for players, team captains and the league secretary. <a class="btn" href="/login">Log in</a></p></div>`);
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
  const playerOption = (p) => ({ id: p.id, name: `${p.full_name}${p.position === "Team Captain" ? " (c)" : p.position === "Vice Captain" ? " (vc)" : ""}` });
  // Who can be picked: the team's squad today, plus anyone already on this card (someone who has since left, say).
  const squad = (teamId, side) => {
    const list = ctx.playersOf(teamId);
    const onCard = bundle.frames.map((f) => ctx.player.get(f[`${side}_player_id`])).filter((p) => p && !list.includes(p));
    return [...list, ...new Set(onCard)].map(playerOption);
  };
  const sides = {
    a: { name: home?.name, team: home, options: squad(fx.home_team_id, "home") },
    b: { name: away?.name, team: away, options: squad(fx.away_team_id, "away") },
  };
  const myTeam = admin ? null : user.profile.team_id;
  const back = admin ? "/admin/results" : "/my/fixtures";
  const CHECK = "Please be certain the scores are correct and in the right columns.";

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], [admin ? "Admin" : "My Team", back], ["Scorecard"]])}
    <p class="sc-intro">Status: <span data-status>${statusBadge(fx.status)}</span> · Each frame you save shows on the live pages straight away.</p>
    <div data-editor></div>
    <input type="file" accept="image/*" capture="environment" hidden data-photo>
  </div>`);

  const editor = scorecardEditor({
    el: $("[data-editor]", view),
    subtitle: league?.name ?? "League match", when: fx.starts_at, venue: ctx.venue.get(fx.venue_id)?.name,
    sides, allowExt: true, extUsed,
    playerName: (id) => ctx.player.get(id)?.full_name ?? "A player",
    person: (id) => { const p = ctx.player.get(id); return { name: p?.full_name ?? "A player", avatar_url: p?.avatar_url, club: ctx.team.get(p?.team_id)?.name }; },
    photo: { required: true, url: () => fx.scorecard_url, pick: () => pickPhoto() },
    addPlayer: myTeam || admin ? { label: `+ Add a new player to ${admin ? "a team" : ctx.team.get(myTeam)?.name}`, run: () => addPlayer() } : null,
    frames: bundle.frames.filter((f) => !f.legacy).map(toEditor),
    notice: shield.isShield ? html`<div class="sc-shield">🛡 ${league.shield_name || "Shield"} match — <b>${holder?.name}</b> ${holder ? "hold the shield and are defending it tonight." : ""}</div>` : "",
    actions: [
      { key: "progress", label: "Save progress", done: "Progress saved", saves: true },
      { key: "submit", label: "Submit results", cls: "green", final: true, needsPhoto: true, done: "Result submitted",
        confirmTitle: "Submit the final result?", confirm: `${CHECK}\n\nOnce submitted, the result goes to the league admin to approve.` },
      ...(admin ? [
        { key: "approve", label: "Save & approve", cls: "blue", final: true, done: "Approved",
          confirmTitle: "Approve this result?", confirm: `${CHECK}\n\nCaptains won't be able to edit it afterwards.` },
        { key: "postponed", label: "Mark postponed", cls: "ghost", skipChecks: true, done: "Marked as postponed",
          confirmTitle: "Postpone this match?", confirm: "It will show as “P - P” and wait under Results to approve until you give it a new date." },
      ] : []),
      { key: "view", label: "View public page", cls: "ghost", skipChecks: true, quiet: true },
    ],
    async onSave(frames, breaks, action) {
      if (action === "view") return navigate(urls.match(fx));
      await saveScorecard(fx.id, frames.map(fromEditor), breaks);
      const target = { progress: fx.status === "scheduled" ? "in_progress" : fx.status, submit: "submitted", approve: "approved", postponed: "postponed" }[action];
      if (target && target !== fx.status) {
        await setFixtureStatus(fx.id, target); fx.status = target; mount($("[data-status]", view), statusBadge(target));
        // The results secretary gets an email as soon as a card is submitted (Admin → Result emails).
        if (target === "submitted") sendResultEmail(fx.id);
      }
      if (action === "submit" && !admin) navigate(back);
      if (["approve", "postponed"].includes(action)) navigate(location.pathname, { replace: true });
    },
  });

  // Photo of the paper card (opens the camera on phones). The scorecard on
  // screen is left alone while it uploads, so nothing typed is lost.
  function pickPhoto() {
    const input = $("[data-photo]", view);
    input.onchange = async () => {
      if (!input.files[0]) return;
      try {
        toast("Uploading photo…");
        const url = await uploadImage(input.files[0], { folder: "scorecards", maxSize: 2000, library: false });
        await setScorecardPhoto(fx.id, url);
        fx.scorecard_url = url;
        editor.redraw();
        toast("Scorecard photo uploaded");
      } catch (err) { toast(err.message, "error"); }
    };
    input.click();
  }

  // Captains can register a new player for their own team from the scorecard.
  // (The player is flagged for the league admin, who sets the handicap.)
  async function addPlayer() {
    const name = prompt("New player's full name:")?.trim();
    if (!name) return;
    let teamId = myTeam;
    if (admin) {
      const pick = prompt(`Which team? Type 1 for ${home?.name} or 2 for ${away?.name}`, "1");
      teamId = pick === "2" ? fx.away_team_id : fx.home_team_id;
    }
    try {
      const id = await addPlayerToTeam(name, teamId);
      const p = { id, full_name: name, team_id: teamId, position: "Player" };
      ctx.player.set(id, p);
      sides[teamId === fx.home_team_id ? "a" : "b"].options.push(playerOption(p));
      editor.redraw();
      toast(admin ? `${name} added — you can pick them now` : `${name} added — you can pick them now. The league admin will be asked to set their handicap.`);
    } catch (err) { toast(err.message, "error"); }
  }

  return editor.destroy;
}
