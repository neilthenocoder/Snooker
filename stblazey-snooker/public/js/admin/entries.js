// Admin → Entries to approve: entries made on the website's entry form.
// The competition secretary confirms each one once the fee has been paid —
// that adds the entrant to the competition. Unpaid entries lapse by themselves.
import { html, mount, $, toast, fmtDate } from "../core/dom.js";
import { table, signups, decideSignup, settings, loadCompetitions } from "../core/api.js";
import { panel, dataTable, urls } from "../core/components.js";
import { friendly } from "./crud.js";

export async function entriesPage(el, { onChange = () => {} } = {}) {
  let compId = "";

  async function draw() {
    const [rows, data, site, players] = await Promise.all([signups(), loadCompetitions(), settings(), table("players", "full_name")]);
    const comp = (id) => data.competitions.find((c) => c.id === id);
    const list = rows.filter((r) => !compId || r.competition_id === compId);
    const by = (status) => list.filter((r) => r.status === status);
    const open = data.competitions.filter((c) => c.entries_open);
    const drawn = (id) => data.matches.some((m) => m.competition_id === id);
    const cols = (actions) => [
      { label: "Entered", cell: (r) => fmtDate(r.created_at) },
      { label: "Competition", cell: (r) => html`<a href="/admin/draws?c=${r.competition_id}">${comp(r.competition_id)?.name ?? "–"}</a>${comp(r.competition_id)?.entry_fee ? html` <small class="muted">${comp(r.competition_id).entry_fee}</small>` : ""}` },
      { label: "Entrant", cell: (r) => html`<b>${r.name}</b>${r.team_id ? html` <small class="muted">entered by ${players.find((p) => p.id === r.player_id)?.full_name ?? "–"}</small>` : ""}` },
      { label: "Contact", cell: (r) => r.contact ?? "–" },
      { label: "Pay by", cell: (r) => html`<span class="${r.status !== "approved" && Date.parse(r.pay_by) < Date.now() ? "overdue" : ""}">${fmtDate(r.pay_by)}</span>` },
      { label: "", cls: "right", cell: actions },
    ];
    const btns = (r, list) => html`<span class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">${list.map(([label, cls, approve]) => html`<button type="button" class="btn small ${cls}" data-decide="${r.id}" data-approve="${approve}">${label}</button>`)}</span>`;

    mount(el, html`<div class="stack">
      <div class="notice">People enter on the website's <a href="/enter" style="font-weight:700;color:var(--red)">entry form</a>. Each entry waits here until you have seen the payment in the league's bank account:
        press <b>Paid — approve</b> and the entrant goes straight into that competition. Entries not paid within ${site.entry_pay_days || 7} days lapse on their own.
        ${open.length ? html`Open for entries now: <b>${open.map((c) => c.name).join(", ")}</b>.` : html`<b>No competition is open for entries</b> — tick “Open for entries” under Competitions → Edit.`}
        ${site.bacs_details ? "" : html`<br><b>The bank details for the form are empty</b> — add them under Website → Site settings → Competition entry form.`}</div>
      <div class="toolbar"><select data-comp><option value="">All competitions</option>${data.competitions.map((c) => html`<option value="${c.id}" ${c.id === compId ? "selected" : ""}>${c.name}</option>`)}</select>
        <a class="btn ghost" href="/enter">Open the entry form</a></div>

      ${panel(`Waiting for payment (${by("pending").length})`, html`${by("pending").some((r) => drawn(r.competition_id)) ? html`<div class="notice error" style="margin:12px">Some of these competitions have already been drawn. Approving adds the entrant to the list, but you'll need to place them in the draw by hand (Draws & results → step 4).</div>` : ""}
        ${dataTable(cols((r) => btns(r, [["Paid — approve", "green", true], ["Remove", "", false]])), by("pending"), { empty: "Nothing waiting — every entry has been dealt with.", rowClass: () => "todo-row" })}`)}
      ${by("expired").length ? panel(`Lapsed — not paid in time (${by("expired").length})`, dataTable(cols((r) => btns(r, [["Approve anyway", "secondary", true], ["Remove", "", false]])), by("expired"))) : ""}
      ${panel(`Approved (${by("approved").length})`, dataTable(cols((r) => btns(r, [["Undo", "ghost", false]])), by("approved"), { empty: "No entries approved yet." }))}
      ${by("rejected").length ? panel(`Removed (${by("rejected").length})`, dataTable(cols((r) => btns(r, [["Approve after all", "ghost", true]])), by("rejected"))) : ""}
    </div>`);
  }

  el.onchange = (e) => { if (e.target.matches("[data-comp]")) { compId = e.target.value; draw(); } };
  el.onclick = async (e) => {
    const t = e.target.closest("[data-decide]");
    if (!t) return;
    const approve = t.dataset.approve === "true";
    if (!approve && !confirm(t.textContent.trim() === "Undo" ? "Undo this approval? The entrant is taken out of the competition." : "Remove this entry?")) return;
    t.disabled = true;
    try { await decideSignup(t.dataset.decide, approve); toast(approve ? "Approved — they're in the competition" : "Entry removed"); await draw(); onChange(); }
    catch (err) { toast(friendly(err), "error"); t.disabled = false; }
  };
  await draw();
}
