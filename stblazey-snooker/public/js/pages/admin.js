import { html, mount, $, toast, readForm, fmtDate, fmtTime } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table, insertMany, setFixtureStatus } from "../core/api.js";
import { isAdmin } from "../core/auth.js";
import { resetDemo } from "../core/db.js";
import { DEMO_MODE } from "../config.js";
import { roundRobin, addDays, londonISO } from "../core/schedule.js";
import { panel, dataTable, statusBadge, urls, breadcrumb } from "../core/components.js";
import { RESOURCES } from "../admin/resources.js";
import { crud } from "../admin/crud.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";
import { mustLogin } from "./scorecard.js";

const NAV = [
  ["Match nights", [["overview", "Overview"], ["results", "Results to approve"]]],
  ["Fixtures", [["fixtures", "All fixtures"], ["generator", "Fixture generator"]]],
  ["League", [["teams", "Teams"], ["players", "Players"], ["venues", "Venues"], ["leagues", "Leagues"], ["seasons", "Seasons"]]],
  ["People", [["accounts", "Logins"]]],
  ["Website", [["articles", "News & competitions"], ["pages", "Info pages"], ["sponsors", "Sponsors"]]],
];
const SPECIAL = { overview, results, generator };

export default async function admin(view, { params, user }) {
  if (!user) return mustLogin(view);
  if (!isAdmin(user)) return navigate("/captain", { replace: true });
  const section = params.section || "overview";
  const title = NAV.flatMap(([, items]) => items).find(([k]) => k === section)?.[1] ?? "Admin";
  setTitle(`Admin – ${title}`);

  mount(view, html`<div class="wrap wide">
    ${breadcrumb([["Home", "/"], ["Admin", "/admin"], [title]])}
    <h1>${title}</h1>
    <div class="admin">
      <nav class="admin-nav">${NAV.map(([group, items]) => html`<div class="group">${group}</div>
        ${items.map(([key, label]) => html`<a href="/admin/${key}" class="${key === section ? "active" : ""}">${label}</a>`)}`)}
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

  const body = $("#admin-body");
  if (SPECIAL[section]) return SPECIAL[section](body);
  if (RESOURCES[section]) {
    const current = (await table("seasons", "name")).find((s) => s.is_current);
    return crud(body, RESOURCES[section], { preset: section === "fixtures" && current ? { season_id: current.id } : {} });
  }
  mount(body, html`<div class="notice error">Unknown section.</div>`);
}

// ── Overview ───────────────────────────────────────────────────
async function overview(el) {
  const ctx = await seasonContext();
  const count = (s) => ctx.fixtures.filter((f) => f.status === s).length;
  const stats = [
    ["Teams", ctx.teams.length], ["Players", ctx.players.length], ["Fixtures", ctx.fixtures.length],
    ["Approved", count("approved")], ["Awaiting approval", count("submitted")], ["Live now", count("in_progress")],
  ];
  mount(el, html`<div class="stats">${stats.map(([l, n]) => html`<div class="stat"><b>${n}</b>${l}</div>`)}</div>
    <p>Season: <b>${ctx.season?.name ?? "none — add one under Seasons"}</b>. Match nights: captains enter frames on their phones,
      press <b>Submit final result</b>, then you approve them under <a href="/admin/results" style="color:var(--red);font-weight:700">Results to approve</a>.
      Approved results are locked for captains; you can still edit them.</p>
    <div class="btn-row"><a class="btn" href="/admin/results">Results to approve</a><a class="btn secondary" href="/admin/accounts">Manage logins</a>
      <a class="btn blue" href="/admin/generator">Generate a season's fixtures</a></div>`);
}

// ── Results awaiting approval ──────────────────────────────────
async function results(el) {
  const ctx = await seasonContext();
  const pending = ctx.fixtures.filter((f) => ["submitted", "in_progress"].includes(f.status));
  const overdue = ctx.fixtures.filter((f) => f.status === "scheduled" && new Date(f.starts_at) < Date.now() - 86400000);
  const cols = (withApprove) => [
    { label: "Date", cell: (f) => `${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)}` },
    { label: "Match", cell: (f) => html`<a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} vs ${ctx.team.get(f.away_team_id)?.name}</a>` },
    { label: "Score", cell: (f) => { const s = ctx.scoreOf(f); return ctx.hasResult(f) ? `${s.home} - ${s.away}` : "–"; } },
    { label: "Status", cell: (f) => statusBadge(f.status) },
    { label: "", cls: "right", cell: (f) => html`<span class="btn-row" style="justify-content:flex-end">
      <a class="btn small secondary" href="${urls.scorecard(f)}">Check / edit</a>
      ${withApprove && f.status === "submitted" ? html`<button class="btn small green" data-approve="${f.id}">Approve</button>` : ""}</span>` },
  ];
  mount(el, html`<div id="results-root">${panel("Submitted & live results", dataTable(cols(true), pending, { empty: "Nothing waiting — all caught up." }))}
    <div style="height:26px"></div>
    ${panel("Played but no result entered", dataTable(cols(false), overdue, { empty: "No overdue scorecards." }))}</div>`);
  $("#results-root").addEventListener("click", async (e) => {
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
