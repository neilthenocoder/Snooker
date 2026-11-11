// Admin → Import from CSV: bring in teams, players, old fixtures and
// results, or whole scorecards from a spreadsheet. The file is checked
// first and nothing is saved until "Import" is pressed.
// (What each file looks like, and all the checks, live in core/csv.js.)
import { html, mount, $, toast } from "../core/dom.js";
import { table, save, insertMany, allFixtures, upsertFrames, clearBreaks, invalidate } from "../core/api.js";
import { IMPORTS, parseCsv, toCsv, mapHeaders, planImport, planSummary, norm } from "../core/csv.js";
import { panel, dataTable } from "../core/components.js";
import { friendly } from "./crud.js";

const STATUS_LABEL = { add: "Add", update: "Update", skip: "Skip", error: "Problem" };
const SHOW_ROWS = 300;

export async function importPage(el) {
  let type = "fixtures", csv = null, plan = null, fileName = "", done = "";

  const load = async () => {
    invalidate();
    const [seasons, leagues, venues, teams, players, fixtures] = await Promise.all([
      table("seasons", "name"), table("leagues", "sort"), table("venues", "name"), table("teams", "name"), table("players", "full_name"), allFixtures(),
    ]);
    return { seasons, leagues, venues, teams, players, fixtures };
  };

  const columnsTable = () => dataTable([
    { label: "Column heading", cell: ([, heading]) => html`<b>${heading}</b>` },
    { label: "Needed?", cell: ([, , required]) => (required ? "Yes" : "Optional") },
    { label: "What goes in it", cell: ([, , , what]) => what },
  ], IMPORTS[type].columns);

  function draw() {
    const spec = IMPORTS[type];
    const sum = plan && !plan.problem ? planSummary(plan) : null;
    const todo = sum ? sum.add + sum.update : 0;
    mount(el, html`<div class="stack" data-import>
      <div class="notice">Bring in data from a spreadsheet: save it as a <b>CSV file</b> (in Excel or Google Sheets: File → Save as / Download → CSV) with the column headings shown below.
        The file is checked first — nothing is saved until you press Import. Do them in this order: <b>Teams → Players → Fixtures & results → Full scorecards</b>.</div>

      <div class="import-types" role="group" aria-label="What to import">${Object.entries(IMPORTS).map(([key, x]) => html`<button type="button" class="${key === type ? "on" : ""}" data-type="${key}">${x.label}</button>`)}</div>

      ${panel(`1. ${spec.label}: the columns`, html`<p class="import-hint">${spec.hint}</p>${columnsTable()}
        <div class="btn-row" style="padding:14px"><button type="button" class="btn secondary" data-template>Download a template for ${spec.label.toLowerCase()}</button>
          <span class="muted">Opens in Excel. Replace the two example rows with your own. The order of the columns doesn't matter, and extra columns are ignored.</span></div>`)}

      ${panel("2. Choose your file", html`<div class="form">
        <div class="btn-row"><label class="btn green">Choose a CSV file<input type="file" accept=".csv,text/csv,text/plain" hidden data-file></label>
          <span class="muted">${fileName ? html`<b>${fileName}</b> — ${csv.rows.length} row${csv.rows.length === 1 ? "" : "s"}` : "…or paste the rows here:"}</span></div>
        <textarea data-paste placeholder="${spec.columns.map(([, h]) => h).join(",")}" style="min-height:90px;font-family:monospace;font-size:13px"></textarea>
        <div class="btn-row"><button type="button" class="btn secondary" data-check>Check pasted rows</button></div></div>`)}

      ${done ? html`<div class="notice ok" data-done><b>✓ Imported.</b> ${done} Importing the same file again is safe — what's already there is skipped or updated, not doubled.</div>` : ""}
      ${plan ? panel("3. Check, then import", plan.problem ? html`<div class="notice error" style="margin:14px">${plan.problem}</div>` : html`
        <div class="import-sum">
          <span class="add"><b>${sum.add}</b> to add</span><span class="update"><b>${sum.update}</b> to update</span>
          <span class="skip"><b>${sum.skip}</b> skipped</span><span class="error"><b>${sum.error}</b> with a problem</span></div>
        ${extras(plan)}
        ${sum.error ? html`<div class="notice error" style="margin:0 14px 14px">Rows with a problem are left out. You can import the rest now and fix those rows in the file afterwards — importing the same file again skips what's already there.</div>` : ""}
        <div class="btn-row" style="padding:0 14px 14px"><button type="button" class="btn green" data-run ${todo ? "" : "disabled"}>Import ${todo} row${todo === 1 ? "" : "s"}</button>
          <span class="muted" data-progress></span></div>
        ${dataTable([
          { label: "Line", cell: (r) => r.line, cls: "num" },
          { label: "", cell: (r) => html`<span class="status imp-${r.status}">${STATUS_LABEL[r.status]}</span>` },
          { label: "What happens", cell: (r) => html`${r.text}${r.notes.length ? html`<small class="imp-notes">Also ${r.notes.join("; ")}</small>` : ""}` },
        ], [...plan.rows].sort((a, b) => (b.status === "error") - (a.status === "error")).slice(0, SHOW_ROWS), { rowClass: (r) => `imp-row-${r.status}` })}
        ${plan.rows.length > SHOW_ROWS ? html`<p class="muted" style="padding:0 14px">Showing the first ${SHOW_ROWS} of ${plan.rows.length} rows (problems first).</p>` : ""}`) : ""}
    </div>`);
  }

  /** Lists of things the import will create along the way (teams, seasons…). */
  const extras = (p) => {
    const bits = [["seasons", "season"], ["venues", "venue"], ["teams", "team"], ["players", "player"]]
      .filter(([k]) => p.add[k].length && !(type === k))
      .map(([k, one]) => html`<li><b>${p.add[k].length} new ${one}${p.add[k].length > 1 ? "s" : ""}</b> will be created: ${p.add[k].slice(0, 12).map((r) => r.name ?? r.full_name).join(", ")}${p.add[k].length > 12 ? "…" : ""}</li>`);
    return bits.length ? html`<ul class="import-extras">${bits}</ul>` : "";
  };

  async function check(text, name) {
    csv = parseCsv(text); fileName = name; done = "";
    // A file for a different import? Switch to the one its headings fit best
    // (no required column missing, and the fewest headings left unused).
    const fit = (t) => { const m = mapHeaders(csv.headers, t); return m.missing.length * 100 + m.ignored.length; };
    const best = Object.keys(IMPORTS).sort((x, y) => fit(x) - fit(y))[0];
    if (best !== type && fit(best) < fit(type) && fit(best) < 100) { type = best; toast(`That looks like a “${IMPORTS[best].label}” file — switched to that.`); }
    plan = planImport(type, csv, await load());
    draw();
    $("[data-run]", el)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /** Save the plan. Rows made by this import get real ids as we go ("tmp:…" → the saved row's id). */
  async function run(btn) {
    const say = (t) => { const p = $("[data-progress]", el); if (p) p.textContent = t; };
    btn.disabled = true;
    const real = new Map();
    const fix = (id) => real.get(id) ?? id;
    const strip = ({ id, ...row }) => row;
    try {
      // New rows are matched back to their placeholders by name.
      const addAll = async (kind, tableName, prep, keyOf) => {
        const rows = plan.add[kind];
        if (!rows.length) return;
        say(`Adding ${rows.length} ${kind}…`);
        const saved = await insertMany(tableName, rows.map((r) => strip(prep(r))));
        const byKey = new Map(saved.map((r) => [keyOf(r), r.id]));
        for (const r of rows) real.set(r.id, byKey.get(keyOf(prep(r))));
      };
      await addAll("seasons", "seasons", (r) => r, (r) => norm(r.name));
      await addAll("venues", "venues", (r) => r, (r) => r.slug);
      await addAll("teams", "teams", (r) => ({ ...r, venue_id: fix(r.venue_id) }), (r) => r.slug);
      await addAll("players", "players", (r) => ({ ...r, team_id: fix(r.team_id) }), (r) => `${norm(r.full_name)}|${r.team_id ?? ""}`);
      for (const [i, c] of plan.change.players.entries()) { say(`Updating players… ${i + 1} of ${plan.change.players.length}`); await save("players", "team_id" in c ? { ...c, team_id: fix(c.team_id) } : c); }
      await addAll("fixtures", "fixtures",
        (r) => ({ ...r, season_id: fix(r.season_id), home_team_id: fix(r.home_team_id), away_team_id: fix(r.away_team_id), venue_id: fix(r.venue_id) }),
        (r) => `${r.season_id}|${r.home_team_id}|${r.away_team_id}|${new Date(r.starts_at).toISOString()}`);
      for (const [i, c] of plan.change.fixtures.entries()) { say(`Updating fixtures… ${i + 1} of ${plan.change.fixtures.length}`); await save("fixtures", c); }
      if (plan.add.frames.length) {
        say(`Adding ${plan.add.frames.length} frames…`);
        await clearBreaks(plan.clearBreaks.map(fix));
        await upsertFrames(plan.add.frames.map((f) => ({ ...f, fixture_id: fix(f.fixture_id), home_player_id: fix(f.home_player_id), away_player_id: fix(f.away_player_id) })));
        say(`Adding ${plan.add.breaks.length} breaks…`);
        await insertMany("breaks", plan.add.breaks.map((b) => ({ ...b, fixture_id: fix(b.fixture_id), player_id: fix(b.player_id) })));
      }
      const sum = planSummary(plan);
      toast(`Imported: ${sum.add} added, ${sum.update} updated`);
      done = `${fileName}: ${sum.add} added, ${sum.update} updated${sum.error ? ` — ${sum.error} row${sum.error > 1 ? "s" : ""} had a problem and ${sum.error > 1 ? "were" : "was"} left out` : ""}.`;
      plan = null; csv = null; fileName = "";
      draw();
    } catch (err) {
      say(""); btn.disabled = false;
      toast(`The import stopped: ${friendly(err)}`, "error");
    }
  }

  // The dashboard's content box is reused between sections, so these are tidied away when it's redrawn.
  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.type) { type = t.dataset.type; plan = null; csv = null; fileName = ""; done = ""; return draw(); }
    if (t.matches("[data-template]")) {
      const spec = IMPORTS[type];
      const blob = new Blob([toCsv([spec.columns.map(([, heading]) => heading), ...spec.example])], { type: "text/csv" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `import-${type}-template.csv` });
      document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
      return;
    }
    if (t.matches("[data-check]")) {
      const text = $("[data-paste]", el).value;
      if (!text.trim()) return toast("Paste the rows first (including the heading line)", "error");
      return check(text, "Pasted rows");
    }
    if (t.matches("[data-run]")) return run(t);
  };
  el.onchange = async (e) => {
    if (!e.target.matches("[data-file]") || !e.target.files[0]) return;
    const file = e.target.files[0];
    check(await file.text(), file.name);
  };
  draw();
}
