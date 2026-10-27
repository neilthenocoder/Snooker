// The logged-in area ("dashboard") for captains, vice captains and players.
//   Captains and vice captains:  My Team · Manage team · Fixtures · Write news · Profile · User details · Competitions · My Snooker
//   Players:                     My Snooker · (Profile and Competitions, if the login is linked to a player or team) · User details
//   Officers with no team:       My Snooker · User details (their tools are in the admin dashboard)
// A player's login has no tools: the one thing they control here is My Snooker (their own page, /myteam).
import { html, mount, $, readForm, toast, fmtDate, fmtTime, confirmBox } from "../core/dom.js";
import { loadForm, formPanel } from "../core/form.js";
import { seasonContext } from "../core/context.js";
import { settings, loadCompetitions, updateMyPlayer, addPlayerToTeam, seasonFrames, setFixtureStatus, setMyPrefs, table, teamLineups, setLineup, claimPlayer } from "../core/api.js";
import { upcomingFor, pickedCount, dayText, untilText, fixtureLine } from "../core/squad.js";
import { deadlineWarnings, deadlineList } from "../core/comp-deadlines.js";
import { SECTIONS, prefsToSave, sectionOrder, MAIN } from "../core/my-snooker.js";
import { listField, wireListFields } from "../core/list-field.js";
import { canWriteNews, isStaff, isCaptain, isMember, isPlainPlayer, mySnookerOn, myPrefs, refreshUser, canEditFixture, canPostpone, canEditCompMatch, canAddMatchPhotos, changePassword, roleText, isMaster } from "../core/auth.js";
import { buildBracket, isEntry, roundName, compScoreText } from "../core/bracket.js";
import { extCounts, EXT_PER_SEASON, POSTPONE_WEEKS, rearrangeBy, RULES } from "../core/rules.js";
import { CUEVIEW } from "../core/cueview.js";
import { uploadImage } from "../core/upload.js";
import { breadcrumb, panel, dataTable, fixturesTable, urls, statusBadge, playerLink, avatar, badge, handicapTag, handicapText } from "../core/components.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";
import { mustLogin } from "./scorecard.js";
import { newsWizardPage } from "../admin/news-wizard.js";

const LABEL = { news: "Write news", snooker: "My Snooker settings", team: "My Team", squad: "Manage team", fixtures: "Fixtures", profile: "Profile", details: "User details", competitions: "Competitions" };
/** The tabs this login gets. Everyone has My Snooker; what else they have is as it always was. */
function tabsFor(user) {
  if (!isMember(user)) return ["snooker", "details"];                       // an officer with no team or player
  // "Manage team" (the team sheet, and adding players) is for captains and vice captains only.
  // "Write news": captains and vice captains, only if the Master Admin ticks Write news for them (off to start with).
  if (!isPlainPlayer(user)) return ["team", ...(isCaptain(user) ? ["squad"] : []), "fixtures", ...(canWriteNews(user) && !isStaff(user) ? ["news"] : []), "profile", "details", "competitions", "snooker"];
  const p = user.profile ?? {};
  return ["snooker", ...(p.player_id ? ["profile"] : []), ...(p.player_id || p.team_id ? ["competitions"] : []), "details"];
}
const logoutIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5Zm6.6 4.6-1.4 1.4 2 2H9v2h8.2l-2 2 1.4 1.4L21 12Z"/></svg>`;

export default async function my(view, { params, user, query }) {
  if (!user) return mustLogin(view);
  if (!isMember(user) && !params.tab) return navigate("/admin", { replace: true });   // officers with no team or player link: their home is the dashboard
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
  const sections = { news: (el) => newsWizardPage(el), snooker: snookerTab, team: teamTab, squad: squadTab, fixtures: fixturesTab, profile: profileTab, details: detailsTab, competitions: competitionsTab };
  return sections[tab](body, { ctx, user, team, me, query });
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

// ── My Snooker settings: who they follow, what they see on /mysnooker and in what order (round 52: was "Home page settings") ──
// Round 48: a logged-in person's home page is their My Snooker (pages/home.js); this is where they change it.
// Every login has this tab. It changes what THEY see on the website; it gives no extra rights.
async function snookerTab(el, { ctx, user, team, me }) {
  const prefs = myPrefs(user);
  const order = sectionOrder(prefs);
  const categories = (await table("categories", "sort").catch(() => [])).map((c) => c.name);
  const followed = new Set(prefs.teams);
  let players = prefs.players.filter((id) => ctx.player.get(id));
  const wants = (key) => !prefs.sections || prefs.sections.includes(key) || (["form", "glance"].includes(key) && !prefs.sections.includes(`${key}_off`));
  const pickable = ctx.players.filter((p) => !["deceased"].includes(p.status)).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const teamName = (p) => ctx.team.get(p.team_id)?.name ?? "no team";
  const chips = () => mount($("[data-chips]", el), players.length ? html`${players.map((id) => { const p = ctx.player.get(id); return html`<span class="chip">${p.full_name} <small class="muted">${teamName(p)}</small>
    <button type="button" data-unfollow="${id}" aria-label="Stop following ${p.full_name}">×</button></span>`; })}` : html`<span class="muted">Nobody yet. Add a player below, or press Follow on any player's page.</span>`);

  mount(el, html`
    <form class="form ms-set" data-snooker>
      <div class="ms-card on">
        <div class="ms-card-head">
          <div><small>My Snooker settings</small><h2>Your own page of the league</h2></div>
          <a class="btn green" href="/mysnooker">Open My Snooker</a>
        </div>
        <p>My Snooker is your own page: the teams and players you follow, with their matches, results, the league table,
          rankings, breaks and news. Choose who to follow, which sections you see and the order they come in.
          Open it any time from <b>My Snooker</b> in your menu, or the button under Competitions, Calendar, Handicaps and Fixtures on the home page.</p>
      </div>

      <fieldset class="ms-set-box"><legend>Teams I follow</legend>
        <p class="ms-help">The first team you tick is the one your page opens on. Follow more and you get a button for each.</p>
        ${ctx.leagues.map((l) => html`<h4 class="ms-set-h">${l.name}</h4><div class="ms-ticks">${ctx.teamsIn(l.id).map((t) => html`<label class="ms-tick"><input type="checkbox" name="team" value="${t.id}" ${followed.has(t.id) ? "checked" : ""}>
          <span>${badge(t)}${t.name}</span></label>`)}</div>`)}</fieldset>

      <fieldset class="ms-set-box"><legend>Players I follow</legend>
        <div class="tag-chips ms-chips" data-chips></div>
        <div class="ms-add"><input type="text" list="ms-players" placeholder="Start typing a player's name…" data-player-add autocomplete="off" aria-label="Add a player to follow">
          <button type="button" class="btn small secondary" data-player-add-btn>Follow</button></div>
        <datalist id="ms-players">${pickable.map((p) => html`<option value="${p.full_name}">${teamName(p)}</option>`)}</datalist></fieldset>

      <fieldset class="ms-set-box"><legend>What I see, and in what order</legend>
        <p class="ms-help">Tick the sections you want, and use <b>↑</b> and <b>↓</b> to put the most important ones first.
          <button type="button" class="link-btn" data-all="1">Tick them all</button> · <button type="button" class="link-btn" data-all="0">Untick them all</button> ·
          <button type="button" class="link-btn" data-order-reset>Standard order</button></p>
        <div class="ms-order-cols">
          ${[["main", "Main column", "The wide column, on the left"], ["side", "Side column", "Beside it on a computer — under it on a phone"]].map(([col, name, help]) => html`<div>
            <h4 class="ms-set-h">${name} <small class="muted">${help}</small></h4>
            <ol class="ms-order" data-col="${col}">${order.filter((k) => (col === "main") === MAIN.includes(k)).map((key) => { const [, label, about] = SECTIONS.find(([k]) => k === key);
              return html`<li class="ms-order-row" data-key="${key}"><label class="ms-tick wide"><input type="checkbox" name="section" value="${key}" ${wants(key) ? "checked" : ""}>
                <span><b>${label}</b><small>${about}</small></span></label>
                <span class="ms-move"><button type="button" data-move="-1" aria-label="Move ${label} up" title="Move up">↑</button><button type="button" data-move="1" aria-label="Move ${label} down" title="Move down">↓</button></span></li>`; })}</ol></div>`)}
        </div></fieldset>

      ${categories.length ? html`<fieldset class="ms-set-box"><legend>News I want</legend>
        <p class="ms-help">For the “Latest news” section. Tick none and you get everything.</p>
        <label class="ms-tick wide ms-nonews"><input type="checkbox" name="nonews" ${!wants("news") && !wants("team_news") ? "checked" : ""}>
          <span><b>No news at all</b><small>No news sections on my page (Latest news and Team news are unticked above)</small></span></label>
        <div class="ms-ticks">${categories.map((c) => html`<label class="ms-tick"><input type="checkbox" name="cat" value="${c}" ${prefs.cats.includes(c) ? "checked" : ""}><span>${c}</span></label>`)}</div></fieldset>` : ""}

      <div class="btn-row form-actions" data-ms-actions><button class="btn green">Save my choices</button><span class="ms-unsaved">Not saved yet</span>
        <button type="button" class="btn ghost" data-reset>Reset</button>
        <span class="muted" style="font-size:13px"><b>Reset</b>: ${team ? `following ${team.name}` : "following nobody"}${me ? ` and ${me.full_name}` : ""}, every section, in the standard order.</span></div>
    </form>`);
  chips();

  const save = async (turnOn, next, message) => {
    try {
      await setMyPrefs(turnOn, prefsToSave(next));
      await refreshUser(); await refreshShell();
      toast(message);
      navigate("/my/snooker", { replace: true });
    } catch (err) { toast(err.message, "error"); }
  };
  const form = $("[data-snooker]", el);
  const addPlayer = () => {
    const box = $("[data-player-add]", el), typed = box.value.trim().toLowerCase();
    if (!typed) return box.focus();
    // The full name, or enough of it that only one player fits ("pears" → Richard Pearson).
    const close = pickable.filter((x) => x.full_name.toLowerCase().includes(typed));
    const p = pickable.find((x) => x.full_name.toLowerCase() === typed) ?? (close.length === 1 ? close[0] : null);
    if (!p) { toast(close.length ? "More than one player fits — choose one from the list" : "No player with that name — check the spelling", "error"); return box.focus(); }
    if (players.includes(p.id)) toast(`You already follow ${p.full_name}`);
    else { players = [...players, p.id]; toast(`${p.full_name} added — press “Save my choices” to keep it`); }
    box.value = ""; chips();
  };
  form.addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.unfollow) { players = players.filter((id) => id !== t.dataset.unfollow); chips(); }
    if (t.matches("[data-player-add-btn]")) addPlayer();
    if (t.dataset.all) for (const box of form.querySelectorAll("[name=section]")) box.checked = t.dataset.all === "1";
    // ↑ ↓: move a section one place up or down its column (round 48 — Rich: "shuffle up and down").
    if (t.dataset.move) {
      const row = t.closest("li"), up = t.dataset.move === "-1", other = up ? row.previousElementSibling : row.nextElementSibling;
      if (other) { (up ? other.before(row) : other.after(row)); t.focus(); row.classList.remove("moved"); void row.offsetWidth; row.classList.add("moved"); }
    }
    if (t.matches("[data-order-reset]")) for (const list of form.querySelectorAll(".ms-order")) {
      [...list.children].sort((a, b) => SECTIONS.findIndex(([k]) => k === a.dataset.key) - SECTIONS.findIndex(([k]) => k === b.dataset.key)).forEach((li) => list.append(li));
    }
    // Reset asks first (Neil, round 52: one accidental tap shouldn't lose everything).
    if (t.matches("[data-reset]")) confirmBox("Your teams and players go back to your own team only, and every section comes back in the standard order.\n\nThis can't be undone.",
      { title: "Reset My Snooker?", ok: "Yes, reset" }).then((ok) => ok && save(true, { place: "page", teams: [user.profile?.team_id].filter(Boolean), players: [user.profile?.player_id].filter(Boolean), cats: [], sections: null }, "My Snooker reset"));
  });
  // Anything changed: the Save bar at the bottom of the screen says so until it is saved.
  const dirty = () => $("[data-ms-actions]", el)?.classList.add("dirty");
  form.addEventListener("change", dirty);
  form.addEventListener("click", (e) => { if (e.target.closest("[data-unfollow], [data-player-add-btn], [data-all], [data-move], [data-order-reset]")) dirty(); });
  $("[data-player-add]", el).addEventListener("suggest:pick", dirty);
  // "No news at all" unticks (or ticks back) the two news sections; ticking a news section unticks "No news".
  form.addEventListener("change", (e) => {
    const news = [...form.querySelectorAll('[name=section][value="news"], [name=section][value="team_news"]')];
    if (e.target.name === "nonews") { for (const b of news) b.checked = !e.target.checked; }
    else if (news.includes(e.target) && form.elements.nonews) form.elements.nonews.checked = news.every((b) => !b.checked);
    if (e.target.name === "cat" && e.target.checked && form.elements.nonews?.checked) { form.elements.nonews.checked = false; for (const b of news) b.checked = true; }
  });
  $("[data-player-add]", el).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addPlayer(); } });
  // Choosing a name from the list under the box follows that player straight away.
  $("[data-player-add]", el).addEventListener("suggest:pick", addPlayer);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ticked = (name) => [...form.querySelectorAll(`[name=${name}]:checked`)].map((b) => b.value);
    // The ticked sections in the order they are on the screen (main column, then side column). Always saved as a
    // list, so the order is kept; "form_off" remembers that Form was unticked (it came later — see wants()).
    const sections = [...form.querySelectorAll(".ms-order [name=section]")].filter((b) => b.checked).map((b) => b.value);
    // Keep the order the teams were followed in (so the first stays first), then any newly ticked ones.
    const teams = [...prefs.teams.filter((id) => ticked("team").includes(id)), ...ticked("team").filter((id) => !prefs.teams.includes(id))];
    save(true, { place: "page", teams, players, cats: ticked("cat"), sections: [...sections, ...["form", "glance"].filter((k) => !sections.includes(k)).map((k) => `${k}_off`)] }, "My Snooker settings saved");
  });
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
        ${isCaptain(user) && next.status === "scheduled" ? html`<a class="btn secondary" href="/my/squad?m=${next.code || next.id}">Manage team</a>` : ""}
        ${canPostpone(user, next) && next.status === "scheduled" ? html`<button type="button" class="btn small ghost" data-postpone="${next.id}">Postpone</button>` : ""}</span>
    </div>` : html`<div class="notice">No more matches scheduled this season.</div>`}
    <div class="stats">
      <div class="stat"><b>${row?.pos ?? "–"}</b>League position</div>
      <div class="stat"><b>${row?.p ?? 0}</b>Played</div>
      <div class="stat"><b>${row?.w ?? 0}</b>Won</div>
      <div class="stat"><b>${row?.pts ?? 0}</b>Points</div>
    </div>
    ${panel(`${team.name}: the team`, dataTable([
      { label: "Player", cell: (p) => playerLink(p) },
      { label: "Position", cell: (p) => p.position, cls: "hide-sm" },
      { label: "Handicap", cell: (p) => (p.handicap > 0 ? `+${p.handicap}` : p.handicap ?? 0), cls: "num" },
      { label: "Ext games used", cell: (p) => `${ext.get(p.id) ?? 0} of ${EXT_PER_SEASON}`, cls: "num" },
    ], ctx.playersOf(team.id), { empty: "No players yet." }))}
    ${isCaptain(user) ? html`<div class="btn-row"><a class="btn secondary" href="/my/squad">Manage team: pick the players, add a new player</a>
      <a class="btn ghost" href="${urls.team(team)}">Public team page</a></div>` : ""}`);
}

// ── Manage team (captains and vice captains) ───────────────────
// The team sheet for a coming match — who plays each frame — and the squad, with a way to add a player.
// The sheet is put on the scorecard on the night; the other team can't see it before the day of the match.
async function squadTab(el, { ctx, user, team, query }) {
  if (!team) return mount(el, noTeam);
  if (!isCaptain(user)) return mount(el, html`<div class="notice">Only the captain and vice captain can manage the team.</div>`);
  const upcoming = upcomingFor(ctx, team.id).slice(0, 5);
  const wanted = query?.get("m");
  const fx = upcoming.find((f) => f.code === wanted || f.id === wanted) ?? upcoming[0] ?? null;
  const sheets = await teamLineups(team.id);
  const sheet = fx ? sheets.find((l) => l.fixture_id === fx.id) : null;
  const squad = ctx.playersOf(team.id);
  const ext = extCounts(await seasonFrames(ctx.season?.id));
  const N = RULES.framesPerMatch;
  const picks = Array.from({ length: Math.max(N, sheet?.picks?.length ?? 0) }, (_, i) => ({ player_id: sheet?.picks?.[i]?.player_id ?? null, ext: !!sheet?.picks?.[i]?.ext }))
    .map((x) => (x.player_id && !squad.some((p) => p.id === x.player_id) ? { player_id: null, ext: false } : x));   // someone who has since left the squad
  const locked = fx && fx.status !== "scheduled";
  const cap = (p) => (p.position === "Team Captain" ? " (c)" : p.position === "Vice Captain" ? " (vc)" : "");
  const taken = (i, id, isExt) => picks.some((x, j) => j !== i && x.player_id === id && !!x.ext === isExt);
  const options = (i) => { const cur = picks[i];
    const opt = (p, isExt) => { const sel = cur.player_id === p.id && cur.ext === isExt, off = !sel && taken(i, p.id, isExt);
      return html`<option value="${isExt ? `${p.id}|ext` : p.id}" ${sel ? "selected" : ""} ${off ? "disabled" : ""}>${p.full_name}${cap(p)}${p.needs_review ? "" : ` · ${handicapText(p.handicap)}`}${isExt ? " (Ext)" : ""}${p.needs_review ? " — awaiting approval" : ""}${off ? " — already picked" : ""}</option>`; };
    return html`<option value="">– not picked yet –</option>${squad.map((p) => opt(p, false))}<optgroup label="Playing a second frame as the extra player">${squad.map((p) => opt(p, true))}</optgroup>`; };
  // Each frame: the list to pick from (every name with its handicap) and, once picked, that player's handicap in its colour.
  const hcOf = (id) => { const p = id && squad.find((x) => x.id === id); return !p ? html`<i class="squad-hc none" aria-hidden="true">–</i>` : p.needs_review ? html`<i class="squad-hc none" title="The league sets the handicap when it accepts the player">new</i>` : html`<i class="squad-hc" title="Handicap">${handicapTag(p.handicap)}</i>`; };
  const rows = () => html`${picks.map((x, i) => html`<label class="squad-row"><span>Frame ${i + 1}</span><select data-pick="${i}" ${locked ? "disabled" : ""}>${options(i)}</select>${hcOf(x.player_id)}</label>`)}`;
  const tag = (p) => (p.needs_review ? html`<span class="new-tag" title="The league has been told and will accept them shortly. You can pick them in the meantime.">Awaiting approval</span>` : "");

  mount(el, html`
    ${fx ? html`
      ${upcoming.length > 1 ? html`<nav class="squad-matches" aria-label="Choose a match">${upcoming.map((f) => { const s = sheets.find((l) => l.fixture_id === f.id), n = pickedCount(s);
        return html`<a href="/my/squad?m=${f.code || f.id}" class="${f.id === fx.id ? "on" : ""}"><b>${dayText(f.starts_at)}</b><span>${f.home_team_id === team.id ? "home" : "away"} v ${ctx.team.get(f.home_team_id === team.id ? f.away_team_id : f.home_team_id)?.name ?? "?"}</span>
          <small class="${n >= N ? "ok" : ""}">${n >= N ? "Picked ✓" : n ? `${n} of ${N} picked` : "Not picked"}</small></a>`; })}</nav>` : ""}
      ${panel(`Your team: ${fixtureLine(ctx, fx, team.id)}`, html`<form class="squad-form" data-squad>
        <p class="squad-lead"><b>${untilText(fx.starts_at)}.</b> Choose who plays each frame. On the night the names are already on the scorecard when you open it — and you can still change them there.
          <span>The other team can't see your team before the day of the match.</span></p>
        ${locked ? html`<div class="notice">This match has started, so the players are now changed on the <a href="${urls.scorecard(fx)}" style="font-weight:700">scorecard</a>.</div>` : ""}
        <div class="squad-rows" data-rows>${rows()}</div>
        ${locked ? "" : html`<div class="btn-row"><button class="btn green">Save the team</button>
          <button type="button" class="btn ghost" data-clear>Clear</button>
          <span class="muted squad-saved" data-saved>${sheet ? `Saved${sheet.updated_by ? ` by ${sheet.updated_by}` : ""} on ${fmtDate(sheet.updated_at)} at ${fmtTime(sheet.updated_at)}` : "Not saved yet"}</span></div>`}
      </form>`)}` : html`<div class="notice">No more matches to play this season, so there is no team to pick.</div>`}
    ${panel(`${team.name}: the squad`, html`${dataTable([
      { label: "Player", cell: (p) => html`${playerLink(p)} ${tag(p)}` },
      { label: "Position", cell: (p) => p.position, cls: "hide-sm" },
      { label: "Handicap", cell: (p) => (p.needs_review ? html`<span class="muted" title="The league sets the handicap when it accepts the player">–</span>` : handicapTag(p.handicap)), cls: "num" },
      { label: "Ext games used", cell: (p) => `${ext.get(p.id) ?? 0} of ${EXT_PER_SEASON}`, cls: "num hide-sm" },
    ], squad, { empty: "No players yet." })}
      <p class="squad-key">Handicaps: <span><b class="hc-val plus">+</b> plus</span><span><b class="hc-val zero">0</b> scratch</span><span><b class="hc-val minus">−</b> minus</span></p>
      <form class="squad-add" data-add autocomplete="off">
        <label for="squad-add-name"><b>Add a player</b> <small>Someone new to the team. Type their full name. The league is told and has the final say; you can pick them straight away.</small></label>
        <div class="squad-add-row"><input id="squad-add-name" type="text" maxlength="80" placeholder="Full name" data-add-name><button class="btn secondary">Add as a new player</button></div>
        <div class="squad-found" data-found></div>
      </form>`)}`);

  // ── the team sheet ──
  const form = $("[data-squad]", el);
  form?.addEventListener("change", (e) => {
    const i = e.target.dataset?.pick;
    if (i === undefined) return;
    const [id, isExt] = e.target.value.split("|");
    picks[Number(i)] = { player_id: id || null, ext: isExt === "ext" };
    mount($("[data-rows]", el), rows());      // the other lists grey this player out
    $("[data-saved]", el).textContent = "Not saved yet — press Save the team";
  });
  const store = async (list, message) => {
    try { await setLineup(fx.id, list); toast(message); navigate(`/my/squad?m=${fx.code || fx.id}`, { replace: true }); }
    catch (err) { toast(err.message, "error"); }
  };
  form?.addEventListener("submit", (e) => { e.preventDefault(); store(picks, picks.some((x) => x.player_id) ? "Team saved" : "Team cleared"); });
  $("[data-clear]", el)?.addEventListener("click", async () => {
    if (await confirmBox("Take every player off this match's team sheet?", { title: "Clear the team?", ok: "Clear it" })) store([], "Team cleared");
  });

  // ── add a player: someone brand new, or someone already on the website with no team ──
  const addForm = $("[data-add]", el), nameBox = $("[data-add-name]", el), found = $("[data-found]", el);
  const free = ctx.players.filter((p) => !p.team_id && p.status !== "deceased");
  const clean = (t) => t.trim().replace(/\s+/g, " ");
  nameBox.addEventListener("input", () => {
    const q = clean(nameBox.value).toLowerCase();
    const hits = q.length < 3 ? [] : free.filter((p) => p.full_name.toLowerCase().includes(q)).slice(0, 5);
    mount(found, hits.length ? html`<p>Already on the website, with no team at the moment. Is it one of these?</p>
      ${hits.map((p) => html`<button type="button" class="squad-hit" data-claim="${p.id}">${avatar(p)}<span><b>${p.full_name}</b><small>Add to ${team.name}</small></span></button>`)}` : "");
  });
  const done = (name) => { toast(`${name} added — waiting for the league to accept them. You can pick them now.`); navigate(location.pathname + location.search, { replace: true }); };
  found.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-claim]");
    if (!b) return;
    const p = ctx.player.get(b.dataset.claim);
    b.disabled = true;
    try { await claimPlayer(p.id, team.id); done(p.full_name); } catch (err) { toast(err.message, "error"); b.disabled = false; }
  });
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = clean(nameBox.value);
    if (name.length < 3 || !name.includes(" ")) return toast("Type the player's first name and surname", "error");
    if (squad.some((p) => p.full_name.toLowerCase() === name.toLowerCase())) return toast(`${name} is already in your squad`, "error");
    const same = free.find((p) => p.full_name.toLowerCase() === name.toLowerCase());
    if (same && !(await confirmBox(`There is already a ${same.full_name} on the website with no team. If that is the same person, press Cancel and choose them from the list under the box instead — their results and breaks stay with them.`,
      { title: "Someone with that name is already on the website", ok: "No — add a new player" }))) return;
    const btn = addForm.querySelector("button"); btn.disabled = true;
    try { await addPlayerToTeam(name, team.id); done(name); } catch (err) { toast(err.message, "error"); btn.disabled = false; }
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
      byes: ctx.byesFor(team.id), forTeam: team.id,
      actions: (f) => canEditFixture(user, f)
        ? html`<span class="btn-row" style="flex-wrap:nowrap"><a class="btn small" href="${urls.scorecard(f)}">${ctx.hasResult(f) ? "Edit scorecard" : "Enter scorecard"}</a>
            ${canPostpone(user, f) && f.status === "scheduled" ? html`<button type="button" class="btn small ghost" data-postpone="${f.id}">Postpone</button>` : ""}
            ${photoLink(user, f)}</span>`
        : html`${statusBadge(f.status)} <a href="${urls.match(f)}">View</a> ${photoLink(user, f)}`,
    }))}
    <a class="btn ghost" href="/calendar?team=${team.id}" style="align-self:start">See these on the calendar</a>`);
}

// ── Profile (your own player page) ─────────────────────────────
function profileTab(el, { me, ctx, user }) {
  if (!me) return mount(el, html`<div class="notice">Your login isn't linked to a player profile yet. ${isMaster(user)
    ? html`As Master Admin you can link it yourself: <a href="/admin/accounts" style="font-weight:700">Admin → Logins</a> → your own login → <b>Player profile</b> → choose yourself → Save.`
    : html`Ask the league secretary to link it (Admin → Logins → Player profile).`} You'll then be able to edit your photo, bio, career history and CueView here, and see your form.</div>`);
  let photo = me.avatar_url || "";
  let pictures = [...(me.gallery ?? [])];
  const drawPics = () => mount($("[data-pics]", el), html`${pictures.map((u, i) => html`<figure class="gal-thumb"><img src="${u}" alt="">
    <button type="button" data-remove-pic="${i}" aria-label="Remove">×</button></figure>`)}`);

  // My form (Rich, round 25): the same Form box as on the public player page, above the profile form.
  if (ctx) loadForm(ctx).then((all) => { const f = all.player(me.id), slot = $("[data-my-form]", el);
    if (slot) mount(slot, f?.n ? formPanel(f, { name: me.full_name.split(" ")[0] }) : html`<div class="notice">Your form appears here once you have played a match this season.</div>`); }).catch(() => {});
  mount(el, html`<div data-my-form></div><form class="form" data-profile>
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
  const [data, site] = await Promise.all([loadCompetitions(), settings().catch(() => ({}))]);
  // Deadlines first: what is due soon, who is at home and who must contact whom (core/comp-deadlines.js).
  const deadlines = deadlineList(deadlineWarnings(user, ctx, data, site), { title: "Your deadlines" });
  const mine = (e) => e && ((team && e.team_id === team.id) || (me && e.player_id === me.id) || (team && ctx.player.get(e.player_id)?.team_id === team.id));
  const rows = data.competitions.flatMap((c) => {
    const entries = data.entries.filter((e) => e.competition_id === c.id);
    const b = buildBracket(entries, data.matches.filter((m) => m.competition_id === c.id));
    return b.rounds.flat().filter((m) => !m.isBye && (mine(b.entryById.get(m.a)) || mine(b.entryById.get(m.b)))).map((m) => ({ c, b, m }));
  }).sort((x, y) => (x.m.row.starts_at ?? "").localeCompare(y.m.row.starts_at ?? ""));
  const name = (b, id) => (isEntry(id) ? b.entryById.get(id).name : "To be decided");

  // On a phone each match is a block, like the fixture list (".fx-list" in style.css), so the button is never off the edge of the screen.
  mount(el, html`${deadlines}${panel(`Cup matches for ${team?.name ?? "you"}`, html`<div class="fx-list">${dataTable([
      { label: "Date", cell: ({ m }) => (m.row.starts_at ? `${fmtDate(m.row.starts_at)} ${fmtTime(m.row.starts_at)}` : "TBC"), cls: "fx-date" },
      { label: "Competition", cell: ({ c, b, m }) => html`<a href="${urls.competition(c)}">${c.name}</a> <small class="muted">${roundName(m.round, b.totalRounds, b)}</small>`, cls: "fx-comp" },
      { label: "Match", cell: ({ b, m }) => html`<a href="/cup-match/${m.row.no ?? m.row.id}">${name(b, m.a)} v ${name(b, m.b)}</a>`, cls: "fx-name" },
      { label: "Score", cell: ({ m }) => (compScoreText(m.row) || (m.row.status === "postponed" ? "P - P" : html`<span class="fx-none">–</span>`)), cls: "num fx-res" },
      { label: "", cls: "fx-act", cell: ({ b, m }) => (isEntry(m.a) && isEntry(m.b) && canEditCompMatch(user, m.row, [b.entryById.get(m.a), b.entryById.get(m.b)], ctx.players)
        ? html`<a class="btn small" href="/cup-scorecard/${m.row.no ?? m.row.id}">${m.row.score_a != null ? "Update scorecard" : "Score this match"}</a>`
        : statusBadge(m.row.status ?? "scheduled")) },
    ], rows, { empty: "No cup matches for your team yet." })}</div>`)}
    <a class="btn ghost" href="/competitions" style="align-self:start">All competitions</a>`);
}
