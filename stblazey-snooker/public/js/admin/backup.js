// Admin → Backup (Master Admin only): download a copy of everything in the database —
// one file with all of it, or any single list as a spreadsheet (CSV).
// It is a safety copy to keep somewhere of your own. It doesn't change anything on the website.
import { html, mount, toast, fmtDate } from "../core/dom.js";
import { allRows } from "../core/api.js";
import { toCsv } from "../core/csv.js";
import { panel, dataTable } from "../core/components.js";
import { SITE } from "../config.js";

// [table, what it is]. Statistics (page views) and the activity log are left out: they aren't needed to rebuild the site.
const TABLES = [
  ["seasons", "Seasons"], ["leagues", "Leagues"], ["venues", "Venues"], ["teams", "Teams"], ["players", "Players (profiles, handicaps, CueViews)"],
  ["fixtures", "Fixtures and results"], ["frames", "Scorecards: frames"], ["breaks", "Scorecards: breaks"],
  ["competitions", "Competitions"], ["competition_entries", "Competition entrants"], ["competition_matches", "Competition draws and results"],
  ["competition_frames", "Competition scorecards: frames"], ["competition_breaks", "Competition scorecards: breaks"], ["competition_signups", "Entry-form entries"],
  ["handicap_changes", "Handicap changes"], ["categories", "News categories"], ["articles", "News articles"], ["announcements", "Announcements"],
  ["pages", "Info pages"], ["sponsors", "Sponsors"], ["media", "Image library (the list of pictures)"], ["settings", "Site settings and branding"],
  ["profiles", "Logins (names, roles, teams — no passwords)"], ["role_permissions", "Roles & permissions"],
];
const stamp = () => new Date().toISOString().slice(0, 10);

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/** Rows → a spreadsheet: one column per field (lists and objects are written as JSON text). */
function asCsv(rows) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v);
  return toCsv([cols, ...rows.map((r) => cols.map((c) => cell(r[c])))]);
}

export async function backupPage(el) {
  let counts = null, last = null;
  try { last = localStorage.getItem("sbdsl-last-backup"); } catch {}

  const draw = () => mount(el, html`<div class="stack">
    <div class="notice">Your data lives safely in the Supabase database, and updating the website's code never touches it. A backup is a copy <b>you</b> keep, in case something is deleted by mistake
      or you ever want to move the league's records somewhere else. It's worth downloading one before the start of each season and before any big import.
      ${last ? html`<br>Last backup downloaded from this browser: <b>${fmtDate(last)}</b>.` : ""}</div>
    ${panel("Download everything", html`<div class="form">
      <p style="margin-top:0">One file with every list below. Keep it somewhere safe — it contains players' details and the logins' names and email addresses (never passwords).</p>
      <div class="btn-row"><button type="button" class="btn green" data-backup-all>Download full backup</button></div>
      <p class="muted" style="margin-bottom:0">The pictures themselves stay in Supabase Storage; the backup keeps the links to them. Passwords are never included — they are held, encrypted, by Supabase.</p></div>`)}
    ${panel("One list as a spreadsheet", dataTable([
      { label: "List", cell: ([, name]) => name },
      { label: "Rows", cell: ([t]) => (counts ? counts[t] ?? "–" : "–"), cls: "num" },
      { label: "", cls: "right", cell: ([t]) => html`<button type="button" class="btn small secondary" data-csv="${t}">Download CSV</button>` },
    ], TABLES))}
  </div>`);
  draw();

  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    t.disabled = true;
    try {
      if (t.dataset.csv) {
        const rows = await allRows(t.dataset.csv);
        if (!rows.length) toast("That list is empty");
        else { download(`${t.dataset.csv}-${stamp()}.csv`, `﻿${asCsv(rows)}`, "text/csv;charset=utf-8"); toast(`${rows.length} rows downloaded`); }
      }
      if (t.matches("[data-backup-all]")) {
        t.textContent = "Collecting…";
        const tables = {};
        for (const [name] of TABLES) tables[name] = await allRows(name).catch(() => []);
        counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
        download(`stblazey-snooker-backup-${stamp()}.json`, JSON.stringify({ site: SITE.name, made_at: new Date().toISOString(), version: 7, tables }, null, 1), "application/json");
        try { localStorage.setItem("sbdsl-last-backup", new Date().toISOString()); last = new Date().toISOString(); } catch {}
        toast(`Backup downloaded — ${Object.values(counts).reduce((a, b) => a + b, 0)} rows`);
        return draw();
      }
    } catch (err) { toast(err.message, "error"); }
    t.disabled = false;
  };
}
