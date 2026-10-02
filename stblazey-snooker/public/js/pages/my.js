// The logged-in area for captains, vice captains and players:
//   My Team · Fixtures · Profile · User details · Competitions
import { html, mount, $, readForm, toast, fmtDate, fmtTime } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadCompetitions, updateMyPlayer, addPlayerToTeam, seasonFrames } from "../core/api.js";
import { isCaptain, isAdmin, canEditFixture, canEditCompMatch, changePassword, ROLE_LABEL } from "../core/auth.js";
import { buildBracket, isEntry, roundName } from "../core/bracket.js";
import { extCounts, EXT_PER_SEASON } from "../core/rules.js";
import { CUEVIEW } from "../core/cueview.js";
import { uploadImage } from "../core/upload.js";
import { breadcrumb, panel, dataTable, fixturesTable, urls, statusBadge, playerLink, avatar, badge } from "../core/components.js";
import { setTitle, navigate } from "../core/router.js";
import { mustLogin } from "./scorecard.js";

const TABS = [["team", "My Team"], ["fixtures", "Fixtures"], ["profile", "Profile"], ["details", "User details"], ["competitions", "Competitions"]];

export default async function my(view, { params, user }) {
  if (!user) return mustLogin(view);
  if (isAdmin(user)) return navigate("/admin", { replace: true });
  const tab = TABS.some(([k]) => k === params.tab) ? params.tab : "team";
  const ctx = await seasonContext();
  const team = ctx.team.get(user.profile?.team_id);
  const me = ctx.player.get(user.profile?.player_id);
  setTitle(TABS.find(([k]) => k === tab)[1]);

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["My area", "/my"], [TABS.find(([k]) => k === tab)[1]]])}
    <div class="my-head">
      ${me ? avatar(me, "my-photo") : team ? html`<span class="my-badge">${badge(team)}</span>` : ""}
      <div><h1>${user.profile?.full_name || user.email}</h1>
        <p>${ROLE_LABEL[user.profile?.role] ?? "Member"}${team ? html` · ${team.name}` : ""}</p></div>
    </div>
    <nav class="tabs" aria-label="My area">${TABS.map(([k, label]) => html`<a href="/my/${k}" class="${k === tab ? "on" : ""}">${label}</a>`)}</nav>
    <div class="stack" data-tab></div>
  </div>`);

  const body = $("[data-tab]", view);
  const sections = { team: teamTab, fixtures: fixturesTab, profile: profileTab, details: detailsTab, competitions: competitionsTab };
  return sections[tab](body, { ctx, user, team, me });
}

const noTeam = html`<div class="notice error">Your login isn't linked to a team yet. Please contact the league secretary.</div>`;

// ── My Team ────────────────────────────────────────────────────
async function teamTab(el, { ctx, user, team }) {
  if (!team) return mount(el, noTeam);
  const fixtures = ctx.fixturesFor(team.id);
  const next = fixtures.find((f) => ["scheduled", "in_progress"].includes(f.status));
  const row = ctx.standings(team.league_id).find((r) => r.team.id === team.id);
  const ext = extCounts(await seasonFrames(ctx.season?.id));
  const opp = next && ctx.team.get(next.home_team_id === team.id ? next.away_team_id : next.home_team_id);

  mount(el, html`
    ${next ? html`<div class="next-match">
      <div><small>${next.status === "in_progress" ? "On now" : "Next match"} · ${fmtDate(next.starts_at)} ${fmtTime(next.starts_at)}</small>
        <strong>${next.home_team_id === team.id ? "Home" : "Away"} v ${opp?.name}</strong>
        <span>${ctx.venue.get(next.venue_id)?.name ?? ""}</span></div>
      ${canEditFixture(user, next)
        ? html`<a class="btn green" href="${urls.scorecard(next)}">${ctx.hasResult(next) ? "Continue scorecard" : "Open scorecard"}</a>`
        : html`<a class="btn ghost" href="${urls.match(next)}">Match page</a>`}
    </div>` : html`<div class="notice">No more matches scheduled this season.</div>`}
    <div class="stats">
      <div class="stat"><b>${row?.pos ?? "–"}</b>League position</div>
      <div class="stat"><b>${row?.p ?? 0}</b>Played</div>
      <div class="stat"><b>${row?.w ?? 0}</b>Won</div>
      <div class="stat"><b>${row?.pts ?? 0}</b>Points</div>
    </div>
    ${panel(`${team.name} squad`, dataTable([
      { label: "Player", cell: (p) => playerLink(p) },
      { label: "Position", cell: (p) => p.position, cls: "hide-sm" },
      { label: "Handicap", cell: (p) => (p.handicap > 0 ? `+${p.handicap}` : p.handicap ?? 0), cls: "num" },
      { label: "Ext games used", cell: (p) => `${ext.get(p.id) ?? 0} of ${EXT_PER_SEASON}`, cls: "num" },
    ], ctx.playersOf(team.id), { empty: "No players yet." }))}
    ${isCaptain(user) ? html`<div class="btn-row"><button class="btn secondary" data-add-player>+ Add a new player to ${team.name}</button>
      <a class="btn ghost" href="${urls.team(team)}">Public team page</a></div>` : ""}`);

  $("[data-add-player]", el)?.addEventListener("click", async () => {
    const name = prompt("New player's full name:")?.trim();
    if (!name) return;
    try { await addPlayerToTeam(name, team.id); toast(`${name} added`); navigate("/my/team", { replace: true }); }
    catch (err) { toast(err.message, "error"); }
  });
}

// ── Fixtures ───────────────────────────────────────────────────
function fixturesTab(el, { ctx, user, team }) {
  if (!team) return mount(el, noTeam);
  mount(el, html`
    ${isCaptain(user) ? html`<p class="muted" style="margin:0">You can enter and edit scorecards for your own team's matches until the league secretary approves them.
      A photo of the paper scorecard is needed before a result can be submitted.</p>` : ""}
    ${panel(`${team.name} fixtures ${ctx.season?.name ?? ""}`, fixturesTable(ctx, ctx.fixturesFor(team.id), {
      actions: (f) => canEditFixture(user, f)
        ? html`<a class="btn small" href="${urls.scorecard(f)}">${ctx.hasResult(f) ? "Edit scorecard" : "Enter scorecard"}</a>`
        : html`${statusBadge(f.status)} <a href="${urls.match(f)}">View</a>`,
    }))}
    <a class="btn ghost" href="/calendar?team=${team.id}" style="align-self:start">See these on the calendar</a>`);
}

// ── Profile (your own player page) ─────────────────────────────
function profileTab(el, { me }) {
  if (!me) return mount(el, html`<div class="notice">Your login isn't linked to a player profile yet. Ask the league secretary to link it
    (Admin → Logins → Player profile), and you'll be able to edit your photo, bio, career history and CueView here.</div>`);
  let photo = me.avatar_url || "";
  let pictures = [...(me.gallery ?? [])];
  const drawPics = () => mount($("[data-pics]", el), html`${pictures.map((u, i) => html`<figure class="gal-thumb"><img src="${u}" alt="">
    <button type="button" data-remove-pic="${i}" aria-label="Remove">×</button></figure>`)}`);

  mount(el, html`<form class="form" data-profile>
    <div class="btn-row" style="justify-content:space-between;margin-bottom:10px">
      <span class="muted">This is what everyone sees on your player page. Your name, team and handicap are set by the league secretary.</span>
      <a class="btn small ghost" href="${urls.player(me)}">View my public page</a></div>
    <div class="grid-2">
      <div class="field-label">Photo (shown as a circle)
        <div class="image-field"><img class="image-preview round" data-photo-preview src="${photo || "/assets/avatar.svg"}" alt="">
          <div class="btn-row"><label class="btn small secondary">Upload a photo<input type="file" accept="image/*" hidden data-photo></label>
            <button type="button" class="btn small ghost" data-photo-clear>Remove</button></div></div></div>
      <label>Birthday (optional)<input type="date" name="birth_date" value="${me.birth_date ?? ""}"></label>
      <label style="grid-column:1/-1">Bio<textarea name="bio" style="min-height:120px">${me.bio ?? ""}</textarea></label>
      <label style="grid-column:1/-1">Career history <span class="muted" style="font-weight:400">(one achievement per line, e.g. “2019 — League singles champion”)</span>
        <textarea name="career_history" style="min-height:120px">${me.career_history ?? ""}</textarea></label>
      <label style="grid-column:1/-1">Past teams <span class="muted" style="font-weight:400">(teams you played for before, with years if you like)</span>
        <input name="past_teams" value="${me.past_teams ?? ""}"></label>
      <div class="field-label" style="grid-column:1/-1">Pictures
        <div class="gallery-field"><div class="gal-thumbs" data-pics></div>
          <div class="btn-row"><label class="btn small secondary">Add pictures<input type="file" accept="image/*" multiple hidden data-pics-upload></label></div></div></div>
      <h4 class="form-heading">CueView<small>Answer as many as you like — blank ones aren't shown.</small></h4>
      ${CUEVIEW.map((q) => html`<label style="grid-column:1/-1">${q.label}
        ${q.options ? html`<select name="cv_${q.key}">${q.options.map((o) => html`<option ${o === (me.cueview?.[q.key] ?? "") ? "selected" : ""} value="${o}">${o || "–"}</option>`)}</select>`
          : html`<input name="cv_${q.key}" value="${me.cueview?.[q.key] ?? ""}">`}</label>`)}
    </div>
    <div class="btn-row form-actions"><button class="btn">Save my profile</button></div>
  </form>`);
  drawPics();

  el.addEventListener("change", async (e) => {
    try {
      if (e.target.matches("[data-photo]") && e.target.files[0]) {
        photo = await uploadImage(e.target.files[0], { folder: "players", maxSize: 600, library: false });
        $("[data-photo-preview]", el).src = photo;
        toast("Photo uploaded — press Save my profile to keep it");
      }
      if (e.target.matches("[data-pics-upload]")) {
        for (const file of e.target.files) pictures.push(await uploadImage(file, { folder: "players", maxSize: 1600, library: false }));
        drawPics(); toast("Pictures added — press Save my profile to keep them");
      }
    } catch (err) { toast(err.message, "error"); }
    if (e.target.type === "file") e.target.value = "";
  });
  el.addEventListener("click", (e) => {
    if (e.target.matches("[data-photo-clear]")) { photo = ""; $("[data-photo-preview]", el).src = "/assets/avatar.svg"; }
    if (e.target.matches("[data-remove-pic]")) { pictures.splice(Number(e.target.dataset.removePic), 1); drawPics(); }
  });
  $("[data-profile]", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = readForm(e.target);
    const btn = e.target.querySelector("button.btn:not([type=button])");
    btn.disabled = true;
    try {
      await updateMyPlayer({
        avatar_url: photo, birth_date: v.birth_date ?? "", bio: v.bio ?? "", career_history: v.career_history ?? "", past_teams: v.past_teams ?? "",
        gallery: pictures, cueview: { ...(me.cueview ?? {}), ...Object.fromEntries(CUEVIEW.map((q) => [q.key, v[`cv_${q.key}`] ?? ""])) },
      });
      toast("Profile saved");
    } catch (err) { toast(err.message, "error"); }
    btn.disabled = false;
  });
}

// ── User details ───────────────────────────────────────────────
function detailsTab(el, { user, team, me }) {
  mount(el, html`
    ${panel("Your login", html`<dl class="facts">
      <div><dt>Name</dt><dd>${user.profile?.full_name ?? "–"}</dd></div>
      <div><dt>Email (your username)</dt><dd>${user.email}</dd></div>
      <div><dt>Role</dt><dd>${ROLE_LABEL[user.profile?.role] ?? "–"}</dd></div>
      <div><dt>Team</dt><dd>${team?.name ?? "–"}</dd></div>
      <div><dt>Player profile</dt><dd>${me ? html`<a href="${urls.player(me)}">${me.full_name}</a>` : "Not linked"}</dd></div>
    </dl><p class="muted" style="padding:0 22px 16px;margin:0">To change your name, email or team, ask the league secretary.</p>`)}
    ${panel("Change your password", html`<form class="form" id="pw-form" style="max-width:420px">
      <label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
      <label>Repeat new password<input name="repeat" type="password" minlength="8" autocomplete="new-password" required></label>
      <button class="btn secondary">Update password</button></form>`)}`);
  $("#pw-form", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const { password, repeat } = readForm(e.target);
    if (password !== repeat) return toast("Passwords don't match", "error");
    try { await changePassword(password); e.target.reset(); toast("Password updated"); } catch (err) { toast(err.message, "error"); }
  });
}

// ── Competitions ───────────────────────────────────────────────
async function competitionsTab(el, { ctx, user, team, me }) {
  const data = await loadCompetitions();
  const mine = (e) => e && ((team && e.team_id === team.id) || (me && e.player_id === me.id) || (team && ctx.player.get(e.player_id)?.team_id === team.id));
  const rows = data.competitions.flatMap((c) => {
    const entries = data.entries.filter((e) => e.competition_id === c.id);
    const b = buildBracket(entries, data.matches.filter((m) => m.competition_id === c.id));
    return b.rounds.flat().filter((m) => !m.isBye && (mine(b.entryById.get(m.a)) || mine(b.entryById.get(m.b)))).map((m) => ({ c, b, m }));
  }).sort((x, y) => (x.m.row.starts_at ?? "").localeCompare(y.m.row.starts_at ?? ""));
  const name = (b, id) => (isEntry(id) ? b.entryById.get(id).name : "To be decided");

  mount(el, html`${panel(`Cup matches for ${team?.name ?? "you"}`, dataTable([
      { label: "Date", cell: ({ m }) => (m.row.starts_at ? `${fmtDate(m.row.starts_at)} ${fmtTime(m.row.starts_at)}` : "TBC") },
      { label: "Competition", cell: ({ c, b, m }) => html`<a href="${urls.competition(c)}">${c.name}</a> <small class="muted">${roundName(m.round, b.totalRounds)}</small>` },
      { label: "Match", cell: ({ b, m }) => html`<a href="/cup-match/${m.row.id}">${name(b, m.a)} v ${name(b, m.b)}</a>` },
      { label: "Score", cell: ({ m }) => (m.row.score_a != null ? `${m.row.score_a} - ${m.row.score_b}` : "–"), cls: "num" },
      { label: "", cell: ({ b, m }) => (isEntry(m.a) && isEntry(m.b) && canEditCompMatch(user, m.row, [b.entryById.get(m.a), b.entryById.get(m.b)], ctx.players)
        ? html`<a class="btn small" href="/cup-scorecard/${m.row.id}">${m.row.score_a != null ? "Update scorecard" : "Score this match"}</a>`
        : statusBadge(m.row.status ?? "scheduled")) },
    ], rows, { empty: "No cup matches for your team yet." }))}
    <a class="btn ghost" href="/competitions" style="align-self:start">All competitions</a>`);
}
