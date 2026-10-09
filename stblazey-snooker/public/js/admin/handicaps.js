// Admin → Handicaps: adjust any player's handicap in one place, without
// opening their profile. Open to the league secretary AND the competition
// secretary. Every change is logged; the yearly review sets the "last year"
// figures that the public arrows compare against.
import { html, mount, $, toast, fmtDate, confirmBox } from "../core/dom.js";
import { table, setHandicap, startHandicapReview, handicapLog } from "../core/api.js";
import { panel, dataTable, handicapText, handicapMove } from "../core/components.js";
import { friendly } from "./crud.js";

export async function handicapsPage(el) {
  let search = "", teamId = "", note = "", page = 0;
  const PAGE = 50;   // players shown at a time, with ‹ › to move through the rest (like every other list in the dashboard)

  async function draw() {
    const [players, teams, log] = await Promise.all([table("players", "full_name"), table("teams", "name"), handicapLog().catch(() => [])]);
    const teamName = (id) => teams.find((t) => t.id === id)?.name ?? "No team";
    const name = (id) => players.find((p) => p.id === id)?.full_name ?? "A player";
    const list = players.filter((p) => (!teamId || p.team_id === teamId) && (!search || p.full_name.toLowerCase().includes(search)));
    const moved = players.filter((p) => p.last_handicap != null && p.last_handicap !== p.handicap).length;
    page = Math.max(0, Math.min(page, Math.ceil(list.length / PAGE) - 1));
    const from = page * PAGE, to = Math.min(list.length, from + PAGE);
    const pager = list.length > PAGE ? html`<div class="pager"><span><b>${from + 1}–${to}</b> of <b>${list.length}</b></span>
      <button type="button" data-page="-1" aria-label="Previous ${PAGE}" ${page === 0 ? "disabled" : ""}>‹</button>
      <button type="button" data-page="1" aria-label="Next ${PAGE}" ${to >= list.length ? "disabled" : ""}>›</button></div>` : "";

    mount(el, html`<div class="stack" data-hc>
      <div class="notice">Change a handicap here and it takes effect straight away — on the Handicaps page, player pages and handicap competition scorecards.
        Type the new figure and press <b>Save</b> (or Enter). Every change is recorded below.</div>
      <div class="toolbar">
        <input type="search" placeholder="Find a player…" value="${search}" data-search>
        <select data-team><option value="">Any team</option>${teams.map((t) => html`<option value="${t.id}" ${t.id === teamId ? "selected" : ""}>${t.name}</option>`)}</select>
        <input type="text" placeholder="Reason for the change (optional)" value="${note}" data-note style="flex:1 1 220px">
      </div>
      ${panel("Yearly review", html`<div class="form"><p style="margin-top:0">At the start of the yearly handicap review, press this once. It remembers everyone's handicap as it is today as <b>“last year”</b>.
          As you then adjust handicaps, the website shows an up or down arrow beside each player who has moved. ${moved ? html`<b>${moved}</b> player${moved > 1 ? "s have" : " has"} moved since the last review.` : "Nobody has moved since the last review."}</p>
        <div class="btn-row"><button type="button" class="btn secondary" data-review>Start a new yearly review</button></div></div>`)}

      ${panel(`Handicaps (${list.length})`, html`${pager}${dataTable([
        { label: "Player", cell: (p) => html`<a href="/player/${p.id}">${p.full_name}</a>` },
        { label: "Team", cell: (p) => teamName(p.team_id), cls: "hide-sm" },
        { label: "Last year", cell: (p) => (p.last_handicap == null ? "–" : handicapText(p.last_handicap)), cls: "num" },
        { label: "Now", cell: (p) => html`<b>${handicapText(p.handicap)}</b>${handicapMove(p)}`, cls: "num" },
        { label: "New handicap", cell: (p) => html`<span class="hc-edit"><input type="number" min="-200" max="200" step="1" value="${p.handicap}" data-hc-input="${p.id}" aria-label="New handicap for ${p.full_name}">
          <button type="button" class="btn small green" data-hc-save="${p.id}">Save</button></span>`, cls: "right" },
      ], list.slice(from, to), { empty: "No players match." })}${pager}`)}

      ${panel("Recent changes", dataTable([
        { label: "Date", cell: (c) => fmtDate(c.created_at) },
        { label: "Player", cell: (c) => name(c.player_id) },
        { label: "Change", cell: (c) => html`${handicapText(c.old_handicap)} → <b>${handicapText(c.new_handicap)}</b>`, cls: "num" },
        { label: "By", cell: (c) => c.changed_by ?? "–", cls: "hide-sm" },
        { label: "Reason", cell: (c) => c.note ?? "–" },
      ], log, { empty: "No handicap changes recorded yet." }))}
    </div>`);
  }

  async function saveOne(id, btn) {
    const input = $(`[data-hc-input="${id}"]`, el);
    const value = Number(input.value);
    if (input.value === "" || !Number.isInteger(value)) return toast("Type a whole number, e.g. 7 or -14", "error");
    btn.disabled = true;
    try { await setHandicap(id, value, note.trim()); toast("Handicap saved"); await draw(); }
    catch (err) { toast(friendly(err), "error"); btn.disabled = false; }
  }

  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.hcSave) return saveOne(t.dataset.hcSave, t);
    if (t.dataset.page) { page += Number(t.dataset.page); await draw(); return $("[data-hc] .pager", el)?.scrollIntoView({ block: "nearest" }); }
    if (t.matches("[data-review]")) {
      if (!(await confirmBox("Everyone's handicap today becomes their “last year” figure, and the up/down arrows on the website start again from here.\n\nDo this once, before you make this year's adjustments.", { title: "Start a new yearly review?", ok: "Start the review" }))) return;
      try { await startHandicapReview(); toast("Review started — today's handicaps saved as last year's"); draw(); }
      catch (err) { toast(friendly(err), "error"); }
    }
  };
  el.onkeydown = (e) => { if (e.key === "Enter" && e.target.dataset.hcInput) { e.preventDefault(); saveOne(e.target.dataset.hcInput, $(`[data-hc-save="${e.target.dataset.hcInput}"]`, el)); } };
  el.oninput = (e) => {
    if (e.target.matches("[data-note]")) note = e.target.value;
    if (e.target.matches("[data-search]")) { search = e.target.value.trim().toLowerCase(); page = 0; redrawKeepingFocus("[data-search]"); }
    if (e.target.matches("[data-team]")) { teamId = e.target.value; page = 0; draw(); }
  };
  // Redraw the list while typing in the search box without losing the cursor.
  async function redrawKeepingFocus(sel) {
    await draw();
    const box = $(sel, el); box.focus(); box.setSelectionRange(box.value.length, box.value.length);
  }
  await draw();
}
