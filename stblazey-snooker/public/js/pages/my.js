// The logged-in area ("dashboard") for captains, vice captains and players.
//   Captains and vice captains:  My Team · Fixtures · Profile · User details · Competitions
//   Players:                     My Snooker · (Profile and Competitions, if the login is linked to a player or team) · User details
// A player's login has no tools: the one thing they control here is My Snooker (their own page, /myteam).
import { html, mount, $, readForm, toast, fmtDate, fmtTime, confirmBox } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadCompetitions, updateMyPlayer, addPlayerToTeam, seasonFrames, setFixtureStatus, setMySnooker } from "../core/api.js";
import { listField, wireListFields } from "../core/list-field.js";
import { isCaptain, isMember, isPlainPlayer, mySnookerOn, mySnookerTeamId, refreshUser, canEditFixture, canPostpone, canEditCompMatch, canAddMatchPhotos, changePassword, roleText } from "../core/auth.js";
import { buildBracket, isEntry, roundName } from "../core/bracket.js";
import { extCounts, EXT_PER_SEASON, POSTPONE_WEEKS, rearrangeBy } from "../core/rules.js";
import { CUEVIEW } from "../core/cueview.js";
import { uploadImage } from "../core/upload.js";
import { breadcrumb, panel, dataTable, fixturesTable, urls, statusBadge, playerLink, avatar, badge } from "../core/components.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";
import { mustLogin } from "./scorecard.js";

const LABEL = { snooker: "My Snooker", team: "My Team", fixtures: "Fixtures", profile: "Profile", details: "User details", competitions: "Competitions" };
/** The tabs this login gets. */
function tabsFor(user) {
  if (!isPlainPlayer(user)) return ["team", "fixtures", "profile", "details", "competitions"];
  const p = user.profile ?? {};
  return ["snooker", ...(p.player_id ? ["profile"] : []), ...(p.player_id || p.team_id ? ["competitions"] : []), "details"];
}
const logoutIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5Zm6.6 4.6-1.4 1.4 2 2H9v2h8.2l-2 2 1.4 1.4L21 12Z"/></svg>`;

export default async function my(view, { params, user }) {
  if (!user) return mustLogin(view);
  if (!isMember(user)) return navigate("/admin", { replace: true });   // officers with no team or player link
  const TABS = tabsFor(user).map((k) => [k, LABEL[k]]);
  const tab = TABS.some(([k]) => k === params.tab) ? params.tab : TABS[0][0];
  const ctx = await seasonContext();
  const team = ctx.team.get(user.profile?.team_id);
  const me = ctx.player.get(user.profile?.player_id);
  setTitle(TABS.find(([k]) => k === tab)[1]);

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["My area", "/my"], [TABS.find(([k]) => k === tab)[1]]])}
    <div class="my-head">
      ${me ? avatar(me, "my-photo") : team ? html`<span class="my-badge">${badge(team)}</span>` : ""}
      <div><h1>${user.profile?.full_name || user.email}</h1>
        <p>${roleText(user.profile)}${team ? html` · ${team.name}` : ""}</p></div>
    </div>
    <nav class="tabs" aria-label="My area">${TABS.map(([k, label]) => html`<a href="/my/${k}" class="${k === tab ? "on" : ""}">${label}</a>`)}
      <button type="button" class="tab-logout" data-logout>${logoutIcon}Log out</button></nav>
    <div class="stack" data-tab></div>
  </div>`);

  const body = $("[data-tab]", view);
  // Captains can postpone their own match before it starts (My Team and Fixtures tabs).
  body.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-postpone]");
    if (!btn) return;
    const fx = ctx.fixture.get(btn.dataset.postpone);
    const opp = ctx.team.get(fx.home_team_id === team?.id ? fx.away_team_id : fx.home_team_id);
    const ok = await confirmBox(`${fmtDate(fx.starts_at)} v ${opp?.name}.\n\nOnly do this once both captains have agreed. The match must be re-arranged within ${POSTPONE_WEEKS} weeks — tell the league secretary the new date and they will put it back on the fixture list.`,
      { title: "Postpone this match?", ok: "Postpone match" });
    if (!ok) return;
    try { await setFixtureStatus(fx.id, "postponed"); toast("Match postponed"); navigate(location.pathname, { replace: true }); }
    catch (err) { toast(err.message, "error"); }
  });
  const sections = { snooker: snookerTab, team: teamTab, fixtures: fixturesTab, profile: profileTab, details: detailsTab, competitions: competitionsTab };
  return sections[tab](body, { ctx, user, team, me });
}

/** Reminder box for each of the team's postponed matches. */
function postponedNotices(ctx, team) {
  return ctx.fixturesFor(team.id).filter((f) => f.status === "postponed").map((f) => {
    const by = rearrangeBy(f), late = by && Date.parse(by) < Date.now();
    const opp = ctx.team.get(f.home_team_id === team.id ? f.away_team_id : f.home_team_id);
    return html`<div class="postponed-note ${late ? "late" : ""}">
      <strong>Postponed: ${f.home_team_id === team.id ? "home" : "away"} v ${opp?.name}</strong>
      <span>Was due ${fmtDate(f.starts_at)}${f.postponed_at ? ` · postponed on ${fmtDate(f.postponed_at)}` : ""}.</span>
      <span>${late ? html`<b>The ${POSTPONE_WEEKS} weeks are up (${fmtDate(by)}).</b> Please agree a date with the other captain now` : html`It must be re-arranged within ${POSTPONE_WEEKS} weeks — <b>by ${fmtDate(by)}</b>. Agree a new date with the other captain`}
        and tell the league secretary, who will put it back on the fixture list.</span></div>`;
  });
}

const noTeam = html`<div class="notice error">Your login isn't linked to a team yet. Please contact the league secretary.</div>`;

// ── My Snooker (the one thing a player's login controls) ───────
function snookerTab(el, { ctx, user, team }) {
  const on = mySnookerOn(user);
  const chosen = user.profile?.my_team_id || "";
  const showing = ctx.team.get(mySnookerTeamId(user));
  mount(el, html`
    <div class="ms-card ${on ? "on" : "off"}">
      <div class="ms-card-head">
        <div><small>My Snooker</small><h2>${on ? (showing ? showing.name : "Choose your team") : "Switched off"}</h2></div>
        ${on ? html`<a class="btn green" href="/myteam">Open my page</a>` : ""}
      </div>
      <p>${on ? html`When you log in you go straight to your own page: ${showing ? html`<b>${showing.name}</b>'s` : "your team's"} next match, results, fixtures, breaks and handicaps.
        The normal home page is always one press away.` : html`You see the normal home page when you log in. Switch My Snooker back on whenever you like — nothing is lost.`}</p>
      <form class="form ms-form-set" data-snooker>
        <label class="ms-switch"><input type="checkbox" name="on" ${on ? "checked" : ""}><span class="ms-slider" aria-hidden="true"></span>
          <span><b>Use My Snooker</b><small>Show my own page when I log in</small></span></label>
        <label>Team to follow
          <select name="team"><option value="">${team ? `My own team (${team.name})` : "Choose a team…"}</option>
            ${ctx.leagues.map((l) => html`<optgroup label="${l.name}">${ctx.teamsIn(l.id).map((t) => html`<option value="${t.id}" ${t.id === chosen ? "selected" : ""}>${t.name}</option>`)}</optgroup>`)}</select></label>
        <div class="btn-row form-actions"><button class="btn">Save</button>
          <button type="button" class="btn ghost" data-reset>Reset</button></div>
        <p class="muted" style="margin:0;font-size:13px"><b>Reset</b> puts My Snooker back as it was when your login was made: switched on, ${team ? `following ${team.name}` : "with no team chosen"}.</p>
      </form>
    </div>`);
  const save = async (teamId, turnOn, message) => {
    try {
      await setMySnooker(teamId, turnOn);
      await refreshUser(); await refreshShell();
      toast(message);
      navigate("/my/snooker", { replace: true });
    } catch (err) { toast(err.message, "error"); }
  };
  $("[data-snooker]", el).addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target.elements;
    save(f.team.value || null, f.on.checked, f.on.checked ? "My Snooker saved" : "My Snooker switched off");
  });
  $("[data-reset]", el).addEventListener("click", () => save(null, true, "My Snooker reset"));
}

// ── My Team ────────────────────────────────────────────────────
async function teamTab(el, { ctx, user, team }) {
  if (!team) return mount(el, noTeam);
  const fixtures = ctx.fixturesFor(team.id);
  const next = fixtures.find((f) => ["scheduled", "in_progress"].includes(f.status));
  const row = ctx.standings(team.league_id).find((r) => r.team.id === team.id);
  const ext = extCounts(await seasonFrames(ctx.season?.id));
  const opp = next && ctx.team.get(next.home_team_id === team.id ? next.away_team_id : next.home_team_id);

  mount(el, html`
    ${postponedNotices(ctx, team)}
    ${next ? html`<div class="next-match">
      <div><small>${next.status === "in_progress" ? "On now" : "Next match"} · ${fmtDate(next.starts_at)} ${fmtTime(next.starts_at)}</small>
        <strong>${next.home_team_id === team.id ? "Home" : "Away"} v ${opp?.name}</strong>
        <span>${ctx.venue.get(next.venue_id)?.name ?? ""}</span></div>
      <span class="btn-row">${canEditFixture(user, next)
        ? html`<a class="btn green" href="${urls.scorecard(next)}">${ctx.hasResult(next) ? "Continue scorecard" : "Open scorecard"}</a>`
        : html`<a class="btn ghost" href="${urls.match(next)}">Match page</a>`}
        ${canPostpone(user, next) && next.status === "scheduled" ? html`<button type="button" class="btn small ghost" data-postpone="${next.id}">Postpone</button>` : ""}</span>
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
/** Home captains can add match night photos once the match has started. */
const photoLink = (user, f) => (isCaptain(user) && canAddMatchPhotos(user, f) && f.status !== "scheduled" && f.status !== "postponed"
  ? html`<a class="btn small ghost" href="${urls.match(f)}#match-photos">Photos${f.gallery?.length ? ` (${f.gallery.length})` : ""}</a>` : "");
function fixturesTab(el, { ctx, user, team }) {
  if (!team) return mount(el, noTeam);
  mount(el, html`
    ${postponedNotices(ctx, team)}
    ${isCaptain(user) ? html`<p class="muted" style="margin:0">You can enter and edit scorecards for your own team's matches until the league admin approves them.
      A photo of the paper scorecard is needed before a result can be submitted. A match that hasn't started can be postponed here.
      <b>Home matches:</b> press <b>Photos</b> to add match night pictures — they show on the match page and in that week's news report.</p>` : ""}
    ${panel(`${team.name} fixtures ${ctx.season?.name ?? ""}`, fixturesTable(ctx, ctx.fixturesFor(team.id), {
      byes: ctx.byesFor(team.id),
      actions: (f) => canEditFixture(user, f)
        ? html`<span class="btn-row" style="flex-wrap:nowrap"><a class="btn small" href="${urls.scorecard(f)}">${ctx.hasResult(f) ? "Edit scorecard" : "Enter scorecard"}</a>
            ${canPostpone(user, f) && f.status === "scheduled" ? html`<button type="button" class="btn small ghost" data-postpone="${f.id}">Postpone</button>` : ""}
            ${photoLink(user, f)}</span>`
        : html`${statusBadge(f.status)} <a href="${urls.match(f)}">View</a> ${photoLink(user, f)}`,
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
      <div class="field-label" style="grid-column:1/-1">Past teams <span class="muted" style="font-weight:400">(every team you've played for before — add as many as you like, with the years if you know them)</span>
        ${listField("past_teams", me.past_teams, { add: "+ Add another past team", placeholder: "e.g. St Blazey A (2015–2019)" })}</div>
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
  wireListFields(el);

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
      <div><dt>Role</dt><dd>${roleText(user.profile)}</dd></div>
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
      { label: "Match", cell: ({ b, m }) => html`<a href="/cup-match/${m.row.no ?? m.row.id}">${name(b, m.a)} v ${name(b, m.b)}</a>` },
      { label: "Score", cell: ({ m }) => (m.row.score_a != null ? `${m.row.score_a} - ${m.row.score_b}` : "–"), cls: "num" },
      { label: "", cell: ({ b, m }) => (isEntry(m.a) && isEntry(m.b) && canEditCompMatch(user, m.row, [b.entryById.get(m.a), b.entryById.get(m.b)], ctx.players)
        ? html`<a class="btn small" href="/cup-scorecard/${m.row.no ?? m.row.id}">${m.row.score_a != null ? "Update scorecard" : "Score this match"}</a>`
        : statusBadge(m.row.status ?? "scheduled")) },
    ], rows, { empty: "No cup matches for your team yet." }))}
    <a class="btn ghost" href="/competitions" style="align-self:start">All competitions</a>`);
}
