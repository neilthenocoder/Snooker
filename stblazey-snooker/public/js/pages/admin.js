import { html, mount, $, toast, readForm, fmtDate, fmtTime, fromLocalInput } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table, insertMany, setFixtureStatus, save, invalidate, signups, cueviewSubmissions } from "../core/api.js";
import { isStaff, canOpenSection, isMember } from "../core/auth.js";
import { rearrangeBy, POSTPONE_WEEKS } from "../core/rules.js";
import { resetDemo } from "../core/db.js";
import { DEMO_MODE } from "../config.js";
import { roundRobin, addDays, londonISO } from "../core/schedule.js";
import { panel, dataTable, statusBadge, urls, breadcrumb } from "../core/components.js";
import { RESOURCES } from "../admin/resources.js";
import { crud } from "../admin/crud.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";
import { mustLogin } from "./scorecard.js";
import { draws } from "../admin/draws.js";
import { mediaPage } from "../admin/picker.js";
import { statsPage } from "../admin/stats.js";
import { importPage } from "../admin/import.js";
import { handicapsPage } from "../admin/handicaps.js";
import { entriesPage } from "../admin/entries.js";
import { rolesPage } from "../admin/roles.js";
import { activityPage } from "../admin/activity.js";
import { backupPage } from "../admin/backup.js";
import { awardsPage } from "../admin/awards.js";
import { scoreboardPage } from "../admin/scoreboard.js";
import { emailsPage } from "../admin/emails.js";
import { cueviewsPage } from "../admin/cueviews.js";


/** Watches the height of the dashboard menu (see where the menu is drawn). */
let navWatch = null;
// The dashboard menu. Each login only sees the sections its role allows
// (see SECTION_AREA and canManage in core/auth.js — the database enforces the same).
const NAV = [
  ["Match nights", [["overview", "Overview"], ["results", "Results to approve"]]],
  ["Fixtures", [["fixtures", "All fixtures"], ["byes", "Bye weeks"], ["generator", "Fixture generator"], ["import", "Import from CSV"]]],
  ["League", [["leagues", "Leagues"], ["teams", "Teams"], ["players", "Players"], ["cueviews", "CueViews to approve"], ["handicaps", "Handicaps"], ["venues", "Venues"], ["seasons", "Seasons"]]],
  ["Competitions", [["competitions", "Competitions"], ["entries", "Entries to approve"], ["draws", "Draws & results"], ["scoreboard", "Live scoreboard"], ["awards", "Presentation awards"]]],
  ["People", [["accounts", "Logins"]]],
  ["Website", [["articles", "News"], ["categories", "News categories"], ["announcements", "Announcements"], ["key_dates", "Key dates"], ["meetings", "Meetings"], ["media", "Image library"], ["pages", "Info pages & rules"], ["merchandise", "Merchandise"], ["sponsors", "Sponsors"], ["branding", "Branding"], ["settings", "Site settings & home page"], ["emails", "Result emails"], ["stats", "Statistics"]]],
  // Only the Master Admin sees these.
  ["Master Admin", [["roles", "Roles & permissions"], ["activity", "Activity log"], ["backup", "Backup"]]],
];
const SPECIAL = { overview, results, generator, draws, media: mediaPage, stats: statsPage, import: importPage, handicaps: handicapsPage, entries: entriesPage,
  roles: rolesPage, activity: activityPage, backup: backupPage, awards: awardsPage, scoreboard: scoreboardPage, emails: emailsPage, cueviews: cueviewsPage };
// Menu items that show a red number when something is waiting.
const COUNTS = { players: "New players to check", entries: "Entries waiting for payment", cueviews: "CueViews waiting to be checked" };
const COUNT_WORD = { players: "new", entries: "waiting", cueviews: "waiting" };
// A small picture for each group of the menu.
const ico = (d) => html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const GROUP_ICON = {
  "Match nights": ico("M9 2h6a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2-2Zm0 2v2h6V4Zm1.6 13.4 6-6L15.2 10l-4.6 4.6-1.8-1.8-1.4 1.4Z"),
  Fixtures: ico("M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2Zm12 8H5v10h14ZM7 12h4v4H7Z"),
  League: ico("M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 5v3h5V9Zm7 0v3h7V9Zm-7 5v4h5v-4Zm7 0v4h7v-4Z"),
  Competitions: ico("M7 3h10v2h4v3a4 4 0 0 1-4.2 4A5 5 0 0 1 13 15.9V19h3v2H8v-2h3v-3.1A5 5 0 0 1 7.2 12 4 4 0 0 1 3 8V5h4Zm0 4H5v1a2 2 0 0 0 2 2Zm10 3a2 2 0 0 0 2-2V7h-2Z"),
  People: ico("M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z"),
  Website: ico("M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6v2h3v2H7v-2h3v-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v10h16V6Z"),
  "Master Admin": ico("M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5Zm-1.2 13.4-3.3-3.3 1.4-1.4 1.9 1.9 4.3-4.3 1.4 1.4Z"),
  "My team": ico("m12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9Z"),
  Demo: ico("M12 5V2L7.5 6.5 12 11V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z"),
};
const logoutIcon = ico("M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5Zm6.6 4.6-1.4 1.4 2 2H9v2h8.2l-2 2 1.4 1.4L21 12Z");
// Which groups of the menu are folded away (remembered on this device).
const FOLD_KEY = "sbdsl-admin-folded";
const folded = () => { try { return new Set(JSON.parse(localStorage.getItem(FOLD_KEY) || "[]")); } catch { return new Set(); } };

export default async function admin(view, { params, user, query }) {
  if (!user) return mustLogin(view);
  if (!isStaff(user)) return navigate("/my", { replace: true });
  const nav = NAV.map(([group, items]) => [group, items.filter(([key]) => canOpenSection(user, key))]).filter(([, items]) => items.length);
  // Where the dashboard opens: the first section of this login's own area (Handicaps is shared, so it isn't the landing page).
  const mine = nav.flatMap(([, items]) => items);
  const first = (mine.find(([key]) => key !== "handicaps") ?? mine[0])[0];
  if (!params.section && first !== "overview") return navigate(`/admin/${first}`, { replace: true });
  const section = params.section || first;
  const title = NAV.flatMap(([, items]) => items).find(([k]) => k === section)?.[1] ?? "Admin";
  setTitle(`Admin – ${title}`);
  const closed = folded();
  const count = (key) => (COUNTS[key] ? html` <span class="nav-count" data-count="${key}" title="${COUNTS[key]}" hidden></span>` : "");

  mount(view, html`<div class="wrap wide">
    ${breadcrumb([["Home", "/"], ["Admin", "/admin"], [title]])}
    <h1>${title}</h1>
    <label class="admin-jump">Admin menu
      <select data-admin-jump>${nav.map(([group, items]) => html`<optgroup label="${group}">
        ${items.map(([key, label]) => html`<option value="${key}" data-label="${label}" ${key === section ? "selected" : ""}>${label}</option>`)}</optgroup>`)}</select></label>
    <div class="admin">
      <nav class="admin-nav" aria-label="Admin menu">
        <label class="admin-find">${ico("M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z")}
          <input type="search" placeholder="Find in the menu…" data-admin-find aria-label="Find in the menu" autocomplete="off"></label>
        ${[...nav, ...(isMember(user) ? [["My team", [["/my", "My Team area"]]]] : []), ...(DEMO_MODE ? [["Demo", [["#reset", "Reset sample data"]]]] : [])].map(([group, items]) => {
          const here = items.some(([key]) => key === section), shut = !here && closed.has(group);
          return html`<section class="nav-group ${here ? "has-active" : ""} ${shut ? "shut" : ""}" data-group="${group}">
            <button type="button" class="nav-group-head" aria-expanded="${shut ? "false" : "true"}"><span class="nav-ico">${GROUP_ICON[group] ?? ""}</span><span>${group}</span><small>${items.length}</small><i class="chev" aria-hidden="true"></i></button>
            <div class="nav-items">${items.map(([key, label]) => (key === "#reset" ? html`<a href="#" data-reset-demo>${label}</a>`
              : key.startsWith("/") ? html`<a href="${key}">${label}</a>`
              : html`<a href="/admin/${key}" class="${key === section ? "active" : ""}" ${key === section ? html`aria-current="page"` : ""}>${label}${count(key)}</a>`))}</div>
          </section>`; })}
        <p class="admin-none" hidden>Nothing in the menu matches.</p>
        <button type="button" class="admin-logout" data-logout>${logoutIcon}<span>Log out</span></button>
      </nav>
      <div id="admin-body"></div>
    </div>
    <button type="button" class="admin-logout admin-logout-m" data-logout>${logoutIcon}<span>Log out</span></button>
  </div>`);

  // Fold a group away or open it again (the group you are in always starts open).
  const menu = $(".admin-nav", view);
  // The menu never scrolls inside: it is as long as its items. The stylesheet is told how tall that is, so a menu
  // taller than the screen can follow the page down to its last item (style.css: .admin-nav).
  navWatch?.disconnect();
  if (typeof ResizeObserver === "function") {
    navWatch = new ResizeObserver(() => menu.style.setProperty("--admin-nav-h", `${menu.offsetHeight}px`));
    navWatch.observe(menu);
  }
  menu.addEventListener("click", (e) => {
    const head = e.target.closest(".nav-group-head");
    if (!head) return;
    const group = head.parentElement, shut = group.classList.toggle("shut");
    head.setAttribute("aria-expanded", String(!shut));
    const now = folded(); now[shut ? "add" : "delete"](group.dataset.group);
    try { localStorage.setItem(FOLD_KEY, JSON.stringify([...now])); } catch { /* not remembered */ }
  });
  // Type a few letters to find a page of the dashboard; Enter opens the first one found.
  const find = $("[data-admin-find]", view);
  find.addEventListener("input", () => {
    const q = find.value.trim().toLowerCase();
    let any = false;
    for (const group of menu.querySelectorAll(".nav-group")) {
      const whole = !q || group.dataset.group.toLowerCase().includes(q);
      let shown = 0;
      for (const a of group.querySelectorAll(".nav-items a")) { const hit = whole || a.textContent.toLowerCase().includes(q); a.classList.toggle("nav-hide", !hit); if (hit) shown++; }
      group.classList.toggle("nav-hide", !shown);
      group.classList.toggle("finding", !!q);
      any ||= shown > 0;
    }
    $(".admin-none", view).hidden = any;
  });
  find.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const first = menu.querySelector(".nav-group:not(.nav-hide) .nav-items a:not(.nav-hide)");
    if (first && find.value.trim()) { e.preventDefault(); first.click(); }
  });

  $("[data-reset-demo]")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("Reset all demo data back to the sample league? You'll be logged out.")) return;
    resetDemo(); await refreshShell(); navigate("/login");
  });

  $("[data-admin-jump]").addEventListener("change", (e) => navigate(`/admin/${e.target.value}`));

  // The red numbers in the menu: new players still to be checked, and competition entries
  // waiting for payment. Worked out again whenever something is saved, so they go as soon as it's dealt with.
  const drawCounts = async () => {
    invalidate();
    const waiting = {
      players: canOpenSection(user, "players") ? (await table("players", "full_name")).filter((p) => p.needs_review).length : 0,
      entries: canOpenSection(user, "entries") ? (await signups().catch(() => [])).filter((r) => r.status === "pending").length : 0,
      cueviews: canOpenSection(user, "cueviews") ? (await cueviewSubmissions().catch(() => [])).filter((r) => r.status === "pending").length : 0,
    };
    for (const [key, n] of Object.entries(waiting)) {
      const badge = $(`[data-count="${key}"]`, view);
      if (badge) { badge.textContent = n; badge.hidden = !n; }
      const opt = $(`[data-admin-jump] option[value="${key}"]`, view);
      if (opt) opt.textContent = `${opt.dataset.label}${n ? ` (${n} ${COUNT_WORD[key]})` : ""}`;
    }
  };
  drawCounts();

  const body = $("#admin-body");
  if (!canOpenSection(user, section)) {
    return mount(body, html`<div class="notice error">Your login doesn't include this part of the dashboard. Ask the Master Admin if you need it.</div>`);
  }
  if (SPECIAL[section]) return SPECIAL[section](body, { user, onChange: drawCounts });
  if (RESOURCES[section]) {
    const current = (await table("seasons", "name")).find((s) => s.is_current);
    return crud(body, RESOURCES[section], {
      // A list can be opened already filtered, e.g. /admin/fixtures?status=approved (the Overview boxes do this).
      preset: { ...(["fixtures", "byes"].includes(section) && current ? { season_id: current.id } : {}),
        ...Object.fromEntries((RESOURCES[section].filters ?? []).filter((f) => query.get(f)).map((f) => [f, query.get(f)])) },
      editId: query.get("edit"), user, onChange: drawCounts,
    });
  }
  mount(body, html`<div class="notice error">Unknown section.</div>`);
}

// ── Overview ───────────────────────────────────────────────────
async function overview(el, { user }) {
  const ctx = await seasonContext();
  const unpaid = canOpenSection(user, "entries") ? (await signups().catch(() => [])).filter((r) => r.status === "pending") : [];
  const count = (s) => ctx.fixtures.filter((f) => f.status === s).length;
  // Each box opens the list behind its number (only for the parts of the dashboard this login has).
  const stats = [
    ["Teams", ctx.teams.length, "teams", "/admin/teams"], ["Players", ctx.players.length, "players", "/admin/players"], ["Fixtures", ctx.fixtures.length, "fixtures", "/admin/fixtures"],
    ["Approved", count("approved"), "fixtures", "/admin/fixtures?status=approved"], ["Awaiting approval", count("submitted"), "results", "/admin/results"], ["Live now", count("in_progress"), "results", "/admin/results"],
  ];
  const fresh = ctx.players.filter((p) => p.needs_review);
  const late = ctx.fixtures.filter((f) => f.status === "postponed" && Date.parse(rearrangeBy(f)) < Date.now());
  mount(el, html`
    ${fresh.length ? html`<div class="notice todo"><b>${fresh.length} new player${fresh.length > 1 ? "s" : ""} added by captains</b> — press a name to set their handicap (saving clears the alert), or use “Mark as checked” in the Players list.
      <div class="todo-list">${fresh.map((p) => html`<a href="/admin/players?edit=${p.id}">${p.full_name} <small>${ctx.team.get(p.team_id)?.name ?? "no team"}</small></a>`)}</div></div>` : ""}
    ${unpaid.length ? html`<div class="notice todo"><b>${unpaid.length} competition entr${unpaid.length > 1 ? "ies are" : "y is"} waiting for payment to be confirmed.</b> <a href="/admin/entries" style="font-weight:700">Entries to approve</a></div>` : ""}
    ${late.length ? html`<div class="notice error"><b>${late.length} postponed match${late.length > 1 ? "es have" : " has"} passed the ${POSTPONE_WEEKS}-week limit.</b> <a href="/admin/results" style="font-weight:700">Rearrange them</a></div>` : ""}
    <div class="stats">${stats.map(([l, n, section, href]) => (canOpenSection(user, section)
      ? html`<a class="stat stat-link" href="${href}" title="Open ${l.toLowerCase()}"><b>${n}</b>${l}<i aria-hidden="true">→</i></a>` : html`<div class="stat"><b>${n}</b>${l}</div>`))}</div>
    <p>Season: <b>${ctx.season?.name ?? "none — add one under Seasons"}</b>. Match nights: captains enter frames on their phones,
      press <b>Submit final result</b>, then you approve them under <a href="/admin/results" style="color:var(--red);font-weight:700">Results to approve</a>.
      Approved results are locked for captains; you can still edit them.</p>
    <div class="btn-row"><a class="btn" href="/admin/results">Results to approve</a>
      ${[["accounts", "secondary", "Manage logins"], ["generator", "blue", "Generate a season's fixtures"], ["leagues", "green", "Add a league"], ["draws", "ghost", "Competition draws"], ["roles", "ghost", "Roles & permissions"]]
        .filter(([key]) => canOpenSection(user, key)).map(([key, cls, label]) => html`<a class="btn ${cls}" href="/admin/${key}">${label}</a>`)}</div>`);
}

// ── Results awaiting approval ──────────────────────────────────
async function results(el) {
  const ctx = await seasonContext();
  const pending = ctx.fixtures.filter((f) => ["submitted", "in_progress"].includes(f.status));
  const overdue = ctx.fixtures.filter((f) => f.status === "scheduled" && new Date(f.starts_at) < Date.now() - 86400000);
  const postponed = ctx.fixtures.filter((f) => f.status === "postponed");
  const cols = (withApprove) => [
    { label: "Date", cell: (f) => `${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)}` },
    { label: "Match", cell: (f) => html`<a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} vs ${ctx.team.get(f.away_team_id)?.name}</a>` },
    { label: "Score", cell: (f) => { const s = ctx.scoreOf(f); return ctx.hasResult(f) ? `${s.home} - ${s.away}` : "–"; } },
    { label: "Status", cell: (f) => statusBadge(f.status) },
    { label: "Card photo", cell: (f) => (f.scorecard_url ? html`<a href="${f.scorecard_url}" target="_blank" rel="noopener" style="color:var(--red);font-weight:700">View photo</a>` : "–") },
    { label: "", cls: "right", cell: (f) => html`<span class="btn-row" style="justify-content:flex-end">
      <a class="btn small secondary" href="${urls.scorecard(f)}">Check / edit</a>
      ${withApprove && f.status === "submitted" ? html`<button class="btn small green" data-approve="${f.id}">Approve</button>` : ""}</span>` },
  ];
  mount(el, html`<div id="results-root">${panel("Submitted & live results", dataTable(cols(true), pending, { empty: "Nothing waiting — all caught up." }))}
    <div style="height:26px"></div>
    ${panel("Played but no result entered", dataTable(cols(false), overdue, { empty: "No overdue scorecards." }))}
    <div style="height:26px"></div>
    ${panel("Postponed — waiting for a new date", dataTable([
      { label: "Was due", cell: (f) => `${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)}` },
      { label: "Match", cell: (f) => html`<a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} vs ${ctx.team.get(f.away_team_id)?.name}</a>` },
      { label: "Rearrange by", cell: (f) => { const by = rearrangeBy(f); return html`<span class="${Date.parse(by) < Date.now() ? "overdue" : ""}">${fmtDate(by)}</span>`; } },
      { label: "New date & time", cell: (f) => html`<input type="datetime-local" data-new-date="${f.id}" style="margin:0;width:auto">` },
      { label: "", cls: "right", cell: (f) => html`<button class="btn small green" data-reschedule="${f.id}">Rearrange</button>` },
    ], postponed, { empty: "No postponed matches." }))}
    <p class="muted"><b>How to postpone a match:</b> a captain or vice captain presses <b>Postpone</b> next to the match under My Team → Fixtures (before it starts),
      or you open its scorecard and press <b>Mark postponed</b>. It shows as “P - P” on the site, is left out of the tables, and waits here.
      It should be re-arranged within ${POSTPONE_WEEKS} weeks: both captains see a reminder with the date on their My Team page. Give it a new date above and it goes back on the fixture list.</p></div>`);
  $("#results-root").addEventListener("click", async (e) => {
    const fid = e.target.dataset.reschedule;
    if (fid) {
      const when = fromLocalInput($(`[data-new-date="${fid}"]`).value);
      if (!when) return toast("Choose the new date and time first", "error");
      try { await save("fixtures", { id: fid, starts_at: when, status: "scheduled" }); toast("Match rearranged"); results(el); }
      catch (err) { toast(err.message, "error"); }
      return;
    }
    const id = e.target.dataset.approve;
    if (!id) return;
    e.target.disabled = true;
    try { await setFixtureStatus(id, "approved"); toast("Result approved"); results(el); }
    catch (err) { toast(err.message, "error"); e.target.disabled = false; }
  });
}

// ── Fixture generator ──────────────────────────────────────────
async function generator(el) {
  const ctx = await seasonContext();
  const nextTuesday = (() => { const d = new Date(); d.setDate(d.getDate() + ((9 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
  mount(el, html`<div class="notice">Creates a full round-robin for one league: every team plays every other team, home and away.
    Venues come from each home team. You can edit or postpone any fixture afterwards.
    A league with an odd number of teams gets a <b>bye week</b> for the team left without a match each night (Fixtures → Bye weeks).</div>
  <form class="form" id="gen-form"><div class="grid-2">
    <label>Season<select name="season_id">${[...ctx.seasons].reverse().map((s) => html`<option value="${s.id}" ${s.id === ctx.season?.id ? "selected" : ""}>${s.name}</option>`)}</select></label>
    <label>League<select name="league_id">${ctx.leagues.map((l) => html`<option value="${l.id}">${l.name} (${ctx.teamsIn(l.id).length} teams)</option>`)}</select></label>
    <label>First match night<input type="date" name="start" value="${nextTuesday}" required></label>
    <label>Start time<input type="time" name="time" value="19:30" required></label>
    <label>Days between rounds<input type="number" name="gap" value="7" min="1" required></label>
    <label>Skip these dates (e.g. Christmas) — one per line, YYYY-MM-DD<textarea name="skip" style="min-height:70px"></textarea></label>
    <label class="check"><input type="checkbox" name="double" checked> Home and away (double round-robin)</label>
  </div>
  <div class="btn-row"><button type="button" class="btn secondary" data-preview>Preview</button><button class="btn green">Create fixtures</button></div></form>
  <div id="gen-preview" style="margin-top:22px"></div>`);

  const build = () => {
    const v = readForm($("#gen-form"));
    const teams = ctx.teamsIn(v.league_id);
    if (teams.length < 2) throw new Error("This league needs at least two teams.");
    const skip = new Set(String(v.skip ?? "").split(/\s+/).filter(Boolean));
    const rounds = roundRobin(teams.map((t) => t.id));
    const used = v.double ? rounds : rounds.slice(0, rounds.length / 2);
    let date = v.start;
    const byes = [];
    const list = used.flatMap((pairs, i) => {
      if (i > 0) date = addDays(date, v.gap);
      while (skip.has(date)) date = addDays(date, v.gap);
      // With an odd number of teams, whoever isn't in a pair that night has a bye week.
      const playing = new Set(pairs.flat());
      for (const t of teams) if (!playing.has(t.id)) byes.push({ season_id: v.season_id, league_id: v.league_id, team_id: t.id, bye_on: date });
      return pairs.map(([home, away]) => ({
        season_id: v.season_id, league_id: v.league_id, home_team_id: home, away_team_id: away,
        venue_id: ctx.team.get(home)?.venue_id ?? null, starts_at: londonISO(date, v.time), status: "scheduled", notes: "",
      }));
    });
    return Object.assign(list, { byes });
  };

  const preview = () => {
    const list = build();
    const v = readForm($("#gen-form"));
    const existing = v.season_id === ctx.season?.id ? ctx.fixturesIn(v.league_id).length : 0;
    mount($("#gen-preview"), html`${existing ? html`<div class="notice error">This league already has ${existing} fixtures this season — creating more will add duplicates.</div>` : ""}
      ${list.byes.length ? html`<div class="notice">An odd number of teams: ${list.byes.length} bye weeks will be added too, one team each night.</div>` : ""}
      ${panel(`Preview: ${list.length} fixtures`, dataTable([
        { label: "Date", cell: (f) => `${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)}` },
        { label: "Home", cell: (f) => ctx.team.get(f.home_team_id)?.name },
        { label: "Away", cell: (f) => ctx.team.get(f.away_team_id)?.name },
        { label: "Venue", cell: (f) => ctx.venue.get(f.venue_id)?.name ?? "–" },
      ], list))}`);
    return list;
  };

  el.addEventListener("click", (e) => { if (e.target.matches("[data-preview]")) { try { preview(); } catch (err) { toast(err.message, "error"); } } });
  $("#gen-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const list = preview();
      if (!confirm(`Create ${list.length} fixtures?`)) return;
      await insertMany("fixtures", [...list]);
      if (list.byes.length) await insertMany("byes", list.byes);
      toast(`${list.length} fixtures created${list.byes.length ? ` and ${list.byes.length} bye weeks` : ""}`);
      navigate("/admin/fixtures");
    } catch (err) { toast(err.message, "error"); }
  });
}
