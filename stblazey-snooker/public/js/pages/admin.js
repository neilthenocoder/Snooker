import { html, mount, $, toast, readForm, fmtDate, fmtTime, fromLocalInput } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table, insertMany, setFixtureStatus, save, invalidate, signups } from "../core/api.js";
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

// The dashboard menu. Each login only sees the sections its role allows
// (see SECTION_AREA and canManage in core/auth.js — the database enforces the same).
const NAV = [
  ["Match nights", [["overview", "Overview"], ["results", "Results to approve"]]],
  ["Fixtures", [["fixtures", "All fixtures"], ["generator", "Fixture generator"], ["import", "Import from CSV"]]],
  ["League", [["leagues", "Leagues"], ["teams", "Teams"], ["players", "Players"], ["handicaps", "Handicaps"], ["venues", "Venues"], ["seasons", "Seasons"]]],
  ["Competitions", [["competitions", "Competitions"], ["entries", "Entries to approve"], ["draws", "Draws & results"]]],
  ["People", [["accounts", "Logins"]]],
  ["Website", [["articles", "News"], ["categories", "News categories"], ["media", "Image library"], ["pages", "Info pages"], ["sponsors", "Sponsors"], ["branding", "Branding"], ["settings", "Site settings & home page"], ["stats", "Statistics"]]],
];
const SPECIAL = { overview, results, generator, draws, media: mediaPage, stats: statsPage, import: importPage, handicaps: handicapsPage, entries: entriesPage };
// Menu items that show a red number when something is waiting.
const COUNTS = { players: "New players to check", entries: "Entries waiting for payment" };

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
  const count = (key) => (COUNTS[key] ? html` <span class="nav-count" data-count="${key}" title="${COUNTS[key]}" hidden></span>` : "");

  mount(view, html`<div class="wrap wide">
    ${breadcrumb([["Home", "/"], ["Admin", "/admin"], [title]])}
    <h1>${title}</h1>
    <label class="admin-jump">Admin menu
      <select data-admin-jump>${nav.map(([group, items]) => html`<optgroup label="${group}">
        ${items.map(([key, label]) => html`<option value="${key}" data-label="${label}" ${key === section ? "selected" : ""}>${label}</option>`)}</optgroup>`)}</select></label>
    <div class="admin">
      <nav class="admin-nav">${nav.map(([group, items]) => html`<div class="group">${group}</div>
        ${items.map(([key, label]) => html`<a href="/admin/${key}" class="${key === section ? "active" : ""}">${label}${count(key)}</a>`)}`)}
        ${isMember(user) ? html`<div class="group">My team</div><a href="/my">My Team area</a>` : ""}
        ${DEMO_MODE ? html`<div class="group">Demo</div><a href="#" data-reset-demo>Reset sample data</a>` : ""}
      </nav>
      <div id="admin-body"></div>
    </div>
  </div>`);

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
    };
    for (const [key, n] of Object.entries(waiting)) {
      const badge = $(`[data-count="${key}"]`, view);
      if (badge) { badge.textContent = n; badge.hidden = !n; }
      const opt = $(`[data-admin-jump] option[value="${key}"]`, view);
      if (opt) opt.textContent = `${opt.dataset.label}${n ? ` (${n} ${key === "players" ? "new" : "waiting"})` : ""}`;
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
      preset: section === "fixtures" && current ? { season_id: current.id } : {},
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
  const stats = [
    ["Teams", ctx.teams.length], ["Players", ctx.players.length], ["Fixtures", ctx.fixtures.length],
    ["Approved", count("approved")], ["Awaiting approval", count("submitted")], ["Live now", count("in_progress")],
  ];
  const fresh = ctx.players.filter((p) => p.needs_review);
  const late = ctx.fixtures.filter((f) => f.status === "postponed" && Date.parse(rearrangeBy(f)) < Date.now());
  mount(el, html`
    ${fresh.length ? html`<div class="notice todo"><b>${fresh.length} new player${fresh.length > 1 ? "s" : ""} added by captains</b> — press a name to set their handicap (saving clears the alert), or use “Mark as checked” in the Players list.
      <div class="todo-list">${fresh.map((p) => html`<a href="/admin/players?edit=${p.id}">${p.full_name} <small>${ctx.team.get(p.team_id)?.name ?? "no team"}</small></a>`)}</div></div>` : ""}
    ${unpaid.length ? html`<div class="notice todo"><b>${unpaid.length} competition entr${unpaid.length > 1 ? "ies are" : "y is"} waiting for payment to be confirmed.</b> <a href="/admin/entries" style="font-weight:700">Entries to approve</a></div>` : ""}
    ${late.length ? html`<div class="notice error"><b>${late.length} postponed match${late.length > 1 ? "es have" : " has"} passed the ${POSTPONE_WEEKS}-week limit.</b> <a href="/admin/results" style="font-weight:700">Rearrange them</a></div>` : ""}
    <div class="stats">${stats.map(([l, n]) => html`<div class="stat"><b>${n}</b>${l}</div>`)}</div>
    <p>Season: <b>${ctx.season?.name ?? "none — add one under Seasons"}</b>. Match nights: captains enter frames on their phones,
      press <b>Submit final result</b>, then you approve them under <a href="/admin/results" style="color:var(--red);font-weight:700">Results to approve</a>.
      Approved results are locked for captains; you can still edit them.</p>
    <div class="btn-row"><a class="btn" href="/admin/results">Results to approve</a><a class="btn secondary" href="/admin/accounts">Manage logins</a>
      <a class="btn blue" href="/admin/generator">Generate a season's fixtures</a>
      <a class="btn green" href="/admin/leagues">Add a league</a><a class="btn ghost" href="/admin/draws">Competition draws</a></div>`);
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
    Venues come from each home team. You can edit or postpone any fixture afterwards.</div>
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
    return used.flatMap((pairs, i) => {
      if (i > 0) date = addDays(date, v.gap);
      while (skip.has(date)) date = addDays(date, v.gap);
      return pairs.map(([home, away]) => ({
        season_id: v.season_id, league_id: v.league_id, home_team_id: home, away_team_id: away,
        venue_id: ctx.team.get(home)?.venue_id ?? null, starts_at: londonISO(date, v.time), status: "scheduled", notes: "",
      }));
    });
  };

  const preview = () => {
    const list = build();
    const v = readForm($("#gen-form"));
    const existing = v.season_id === ctx.season?.id ? ctx.fixturesIn(v.league_id).length : 0;
    mount($("#gen-preview"), html`${existing ? html`<div class="notice error">This league already has ${existing} fixtures this season — creating more will add duplicates.</div>` : ""}
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
      await insertMany("fixtures", list);
      toast(`${list.length} fixtures created`);
      navigate("/admin/fixtures");
    } catch (err) { toast(err.message, "error"); }
  });
}
