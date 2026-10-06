// Admin → Activity log (Master Admin only): who added, changed or removed what, and when.
// The database writes it by itself (the audit triggers in supabase/schema.sql), so nothing can be
// missed or edited. Scorecard frames aren't listed one by one — a match shows as its status changing
// (started, submitted, approved), with the name of whoever did it.
import { html, mount, fmtDate, fmtTime } from "../core/dom.js";
import { auditLog } from "../core/api.js";
import { panel, dataTable } from "../core/components.js";
import { ROLE_LABEL } from "../core/auth.js";

const THING = {
  seasons: "season", leagues: "league", venues: "venue", teams: "team", players: "player", fixtures: "fixture",
  competitions: "competition", competition_entries: "competition entrant", articles: "news article", pages: "info page",
  sponsors: "sponsor", categories: "news category", announcements: "announcement", settings: "settings",
  role_permissions: "permissions for", profiles: "login",
};
const VERB = { added: "Added", changed: "Changed", removed: "Removed" };
const PAGE = 50;
const show = (v) => (v === null || v === "" || (Array.isArray(v) && !v.length) ? "empty" : v === true ? "yes" : v === false ? "no"
  : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? Object.entries(v).map(([k, x]) => `${k} ${x}`).join(", ") || "empty" : String(v));
const pretty = (k) => k.replace(/_/g, " ");

/** "status: submitted → approved, handicap: 10 → 3, bio changed" */
function details(row) {
  const c = row.changes;
  if (!c) return "";
  if (row.action === "added") return c.count ? `${c.count} added together` : "";
  return Object.entries(c).map(([k, v]) => (Array.isArray(v) ? `${pretty(k)}: ${show(v[0])} → ${show(v[1])}` : `${pretty(k)} changed`)).join(" · ");
}

export async function activityPage(el) {
  const rows = await auditLog(1000);
  let who = "", thing = "", search = "", page = 0;
  const people = [...new Set(rows.map((r) => r.actor).filter(Boolean))].sort();
  const things = [...new Set(rows.map((r) => r.table_name))].sort((a, b) => (THING[a] ?? a).localeCompare(THING[b] ?? b));

  const draw = () => {
    const list = rows.filter((r) => (!who || r.actor === who) && (!thing || r.table_name === thing)
      && (!search || `${r.label ?? ""} ${r.actor ?? ""} ${details(r)}`.toLowerCase().includes(search)));
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    page = Math.min(page, pages - 1);
    const from = page * PAGE;
    mount(el, html`<div class="stack">
      <div class="notice">Everything that is added, changed or removed in the dashboard is written here automatically, with the name of the person who did it. Entries are kept for a year.
        “System” means it was done outside the website (for example in the Supabase SQL editor).</div>
      <div class="toolbar">
        <input type="search" placeholder="Search…" value="${search}" data-search>
        <select data-who><option value="">Anyone</option>${people.map((p) => html`<option ${p === who ? "selected" : ""}>${p}</option>`)}</select>
        <select data-thing><option value="">Everything</option>${things.map((t) => html`<option value="${t}" ${t === thing ? "selected" : ""}>${(THING[t] ?? t).replace(/^./, (c) => c.toUpperCase())}s</option>`)}</select>
      </div>
      ${panel(`Activity (${list.length})`, html`${dataTable([
        { label: "When", cell: (r) => html`${fmtDate(r.at)} <small class="muted">${fmtTime(r.at)}</small>` },
        { label: "Who", cell: (r) => r.actor ?? "System" },
        { label: "What", cell: (r) => html`<span class="status act-${r.action}">${VERB[r.action] ?? r.action}</span> ${THING[r.table_name] ?? r.table_name} <b>${(r.table_name === "role_permissions" && ROLE_LABEL[r.label]) || (r.label ?? "")}</b>` },
        { label: "Details", cell: (r) => details(r) || "–" },
      ], list.slice(from, from + PAGE), { empty: rows.length ? "Nothing matches." : "Nothing has been recorded yet." })}
      ${pages > 1 ? html`<div class="pager"><span><b>${from + 1}–${Math.min(list.length, from + PAGE)}</b> of <b>${list.length}</b></span>
        <button type="button" data-page="-1" aria-label="Newer" ${page === 0 ? "disabled" : ""}>‹</button>
        <button type="button" data-page="1" aria-label="Older" ${page >= pages - 1 ? "disabled" : ""}>›</button></div>` : ""}`)}
      ${rows.length >= 1000 ? html`<p class="muted">Showing the latest 1,000 entries.</p>` : ""}
    </div>`);
  };
  draw();
  el.oninput = (e) => {
    if (e.target.matches("[data-who]")) { who = e.target.value; page = 0; draw(); }
    if (e.target.matches("[data-thing]")) { thing = e.target.value; page = 0; draw(); }
    if (e.target.matches("[data-search]")) {
      search = e.target.value.trim().toLowerCase(); page = 0; draw();
      const box = el.querySelector("[data-search]"); box.focus(); box.setSelectionRange(box.value.length, box.value.length);
    }
  };
  el.onclick = (e) => { const t = e.target.closest("[data-page]"); if (t) { page += Number(t.dataset.page); draw(); } };
}
