// Admin → League → CueViews to approve: the CueViews people sent in on the website's form (/cueview).
// For each one: check whose profile it belongs to, then approve it (the answers go onto that player's
// page) or remove it. Nothing a visitor sends appears on the website until it is approved here.
import { html, mount, toast, fmtDate, fmtTime } from "../core/dom.js";
import { table, save, remove, cueviewSubmissions } from "../core/api.js";
import { CUEVIEW } from "../core/cueview.js";
import { panel, dataTable, urls } from "../core/components.js";
import { friendly } from "./crud.js";

export async function cueviewsPage(el, { onChange = () => {} } = {}) {
  async function draw() {
    const [rows, players, teams] = await Promise.all([cueviewSubmissions(), table("players", "full_name"), table("teams", "name")]);
    const teamName = (p) => teams.find((t) => t.id === p?.team_id)?.name ?? "no team";
    const byName = (name) => players.filter((p) => p.full_name.trim().toLowerCase() === String(name ?? "").trim().toLowerCase());
    // Whose profile: the player they chose on the form, else the only player with exactly that name.
    const guess = (r) => players.find((p) => p.id === r.player_id) ?? (byName(r.name).length === 1 ? byName(r.name)[0] : null);
    const pending = rows.filter((r) => r.status === "pending"), done = rows.filter((r) => r.status !== "pending");
    const qa = (r) => CUEVIEW.filter((q) => String(r.answers?.[q.key] ?? "").trim());

    mount(el, html`<div class="stack">
      <div class="notice">Players and visitors can send a CueView in on the website's <a href="/cueview" style="font-weight:700;color:var(--red)">CueView form</a>.
        Each one waits here. Check <b>whose profile</b> it belongs to, then press <b>Approve</b>: the answers go onto that player's page (answers they left empty do not wipe what is already there).
        A player who has their own login can also change their CueView themselves under My area → Profile.</div>
      ${pending.length ? pending.map((r) => {
        const who = guess(r), list = qa(r);
        return html`<article class="cv-sub box" data-sub="${r.id}">
          <header><div><h3>${r.name}</h3><small class="muted">${r.team || "No team given"} · sent ${fmtDate(r.created_at)} ${fmtTime(r.created_at)}${r.contact ? html` · contact: <b>${r.contact}</b>` : ""}</small></div>
            <span class="status submitted">Waiting</span></header>
          <dl class="cv-answers">${list.map((q) => html`<div><dt>${q.label}</dt><dd>${r.answers[q.key]}</dd></div>`)}
            ${r.bio ? html`<div><dt>About them (for the bio on their page)</dt><dd>${r.bio}</dd></div>` : ""}</dl>
          <div class="cv-decide">
            <label>Whose profile is this?
              <select data-player><option value="">– choose the player –</option>${players.map((p) => html`<option value="${p.id}" ${p.id === who?.id ? "selected" : ""}>${p.full_name} (${teamName(p)})</option>`)}</select></label>
            ${r.bio ? html`<label class="check"><input type="checkbox" data-bio ${who?.bio ? "" : "checked"}> Use their words as the bio on the page${who?.bio ? " (replaces the bio that is there now)" : ""}</label>` : ""}
            <div class="btn-row"><button type="button" class="btn green" data-act="approve">Approve: put it on their page</button>
              <button type="button" class="btn ghost" data-act="reject">Remove</button></div>
            ${who ? "" : html`<p class="muted" style="margin:0">Nobody in the players list is called exactly “${r.name}”. Choose the player above, or add them first under League → Players.</p>`}
          </div></article>`; })
        : html`<div class="empty box">Nothing waiting: every CueView that was sent in has been dealt with.</div>`}
      ${done.length ? panel(`Dealt with (${done.length})`, dataTable([
        { label: "Sent", cell: (r) => fmtDate(r.created_at) },
        { label: "Name", cell: (r) => { const p = players.find((x) => x.id === r.player_id); return p && r.status === "approved" ? html`<a href="${urls.player(p)}">${p.full_name}</a>` : r.name; } },
        { label: "Team", cell: (r) => r.team || "–", cls: "hide-sm" },
        { label: "Answers", cell: (r) => qa(r).length, cls: "num" },
        { label: "", cell: (r) => html`<span class="status ${r.status === "approved" ? "approved" : "postponed"}">${r.status === "approved" ? "On their page" : "Removed"}</span>` },
        { label: "", cls: "right", cell: (r) => html`<span class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">
          ${r.status === "rejected" ? html`<button type="button" class="btn small ghost" data-back="${r.id}">Put back in the queue</button>` : ""}
          <button type="button" class="btn small" data-delete="${r.id}">Delete</button></span>` },
      ], done)) : ""}
    </div>`);

    el.onclick = async (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      const card = t.closest("[data-sub]"), row = rows.find((r) => r.id === (card?.dataset.sub ?? t.dataset.back ?? t.dataset.delete));
      if (!row) return;
      const now = new Date().toISOString();
      try {
        if (t.dataset.act === "approve") {
          const player = players.find((p) => p.id === card.querySelector("[data-player]").value);
          if (!player) return toast("Choose whose profile this CueView belongs to", "error");
          t.disabled = true;
          // Their answers go on top of what the player already has; an answer left empty changes nothing.
          const answers = Object.fromEntries(Object.entries(row.answers ?? {}).filter(([key, a]) => CUEVIEW.some((q) => q.key === key) && String(a).trim()));
          const useBio = row.bio && card.querySelector("[data-bio]")?.checked;
          await save("players", { id: player.id, cueview: { ...(player.cueview ?? {}), ...answers }, ...(useBio ? { bio: row.bio } : {}) });
          await save("cueview_submissions", { id: row.id, status: "approved", player_id: player.id, decided_at: now });
          toast(`On ${player.full_name}'s page`);
        } else if (t.dataset.act === "reject") {
          if (!confirm(`Remove the CueView sent in by ${row.name}? It will not go on the website.`)) return;
          await save("cueview_submissions", { id: row.id, status: "rejected", decided_at: now });
          toast("Removed");
        } else if (t.dataset.back) {
          await save("cueview_submissions", { id: row.id, status: "pending", decided_at: null });
        } else if (t.dataset.delete) {
          if (!confirm(`Delete this from the list for good? ${row.status === "approved" ? "The CueView stays on the player's page." : ""}`)) return;
          await remove("cueview_submissions", row.id);
        } else return;
        await draw(); onChange();
      } catch (err) { toast(friendly(err), "error"); t.disabled = false; }
    };
  }
  await draw();
}
