// ─────────────────────────────────────────────────────────────
//  Admin → Master Admin → Version history (Rich, round 22 — like Framer's).
//  Every update of the website Netlify has, newest first: its version number, whether it is
//  ready, who published it and when, what changed, a link to view that exact version, and a
//  button to put an older one back live if an update goes wrong. The list comes from Netlify
//  (netlify/functions/site-versions.mjs); the version numbers and notes are kept in site_versions.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, fmtDate, fmtTime, confirmBox } from "../core/dom.js";
import { siteVersions, siteVersionNotes, saveVersionNote } from "../core/api.js";
import { getUser } from "../core/auth.js";
import { panel, dataTable } from "../core/components.js";
import { SITE_VERSION, CHANGES } from "../core/release.js";
import { DEMO_MODE } from "../config.js";
import { friendly } from "./crud.js";

const STATE = { ready: "Ready", building: "Building", uploading: "Uploading", uploaded: "Uploaded", processing: "Processing", prepared: "Preparing", enqueued: "Waiting", new: "Waiting", error: "Failed", rejected: "Failed", retrying: "Retrying" };
const lines = (t) => String(t ?? "").split("\n").filter((x) => x.trim());

export async function versionsPage(el) {
  const intro = html`<div class="ver-now box"><small>This website</small><b>Version ${SITE_VERSION}</b>
    <ul>${lines(CHANGES).map((l) => html`<li>${l}</li>`)}</ul></div>`;
  if (DEMO_MODE) {
    return mount(el, html`${intro}<div class="notice">On the live website this page lists every update Netlify has published — Version, Status, Published by, Published at, Changes and View — with <b>Live</b> next to the one people see,
      and a button to put an earlier version back. It needs the Netlify access token described in the README (“Version history”).</div>`);
  }
  mount(el, html`${intro}<p class="muted">Asking Netlify for the list…</p>`);
  let data, notes;
  try { [data, notes] = await Promise.all([siteVersions({ action: "list" }), siteVersionNotes()]); }
  catch (err) {
    return mount(el, html`${intro}<div class="notice error">${err.message}</div>
      <div class="box prose" style="font-size:14px"><h3 style="margin-top:0">Setting it up (once)</h3><ol>
        <li>In Netlify, open your picture (top right) → <b>User settings</b> → <b>Applications</b> → <b>Personal access tokens</b> → <b>New access token</b>. Name it “Version history”, choose no expiry, and copy it.</li>
        <li>Site configuration → Environment variables → <b>Add a variable</b>: <code>NETLIFY_AUTH_TOKEN</code> = the token. Tick “Contains secret values”.</li>
        <li>Deploys → <b>Trigger deploy</b> (or upload the zip again). Open this page again.</li></ol></div>`);
  }
  const me = await getUser();
  const note = (id) => notes.find((n) => n.deploy_id === id);
  // The update people see now is this copy of the website: remember its version number and changes, the first time.
  if (data.live && !note(data.live)) {
    const n = { deploy_id: data.live, version: SITE_VERSION, changes: CHANGES, published_by: null };
    await saveVersionNote(n).catch(() => {}); notes.push(n);
  }
  const draw = () => mount(el, html`${intro}
    ${panel("Versions", dataTable([
      { label: "Version", cell: (d) => html`<b>${note(d.id)?.version ?? "–"}</b>${d.live ? html` <span class="ver-live">Live</span>` : ""}` },
      { label: "Status", cell: (d) => html`<span class="ver-state s-${d.state}">${STATE[d.state] ?? d.state}</span>${d.error_message ? html`<br><small class="lk-why">${d.error_message}</small>` : ""}` },
      { label: "Published by", cell: (d) => note(d.id)?.published_by || d.committer || (d.manual ? "Uploaded to Netlify" : "–"), cls: "hide-sm" },
      { label: "Published at", cell: (d) => { const t = d.published_at || d.created_at; return t ? `${fmtDate(t)} ${fmtTime(t)}` : "–"; } },
      { label: "Changes", cell: (d) => { const c = lines(note(d.id)?.changes || d.title || ""); return c.length ? html`<span class="ver-changes">${c.slice(0, 3).join(" · ")}${c.length > 3 ? ` (+${c.length - 3} more)` : ""}</span>` : html`<span class="muted">–</span>`; } },
      { label: "", cls: "right", cell: (d) => html`<span class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">
        ${d.permalink ? html`<a class="btn small ghost" href="${d.permalink}" target="_blank" rel="noopener">View</a>` : ""}
        <button type="button" class="btn small secondary" data-ver-edit="${d.id}">Notes</button>
        ${!d.live && d.state === "ready" ? html`<button type="button" class="btn small" data-ver-restore="${d.id}">Make live</button>` : ""}</span>` },
    ], data.deploys, { empty: "Netlify has no updates of this site yet.", rowClass: (d) => (d.live ? "hl" : "") }))}
    <div data-ver-form></div>
    <p class="muted">“View” opens that exact version at its own address, to look at without changing anything. “Make live” puts it back as the website everyone sees (the newer ones stay in the list).
      Version numbers come from <code>public/js/core/release.js</code> in each zip.</p>`);
  draw();

  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.verEdit) {
      const d = data.deploys.find((x) => x.id === t.dataset.verEdit), n = note(d.id) ?? { deploy_id: d.id };
      mount($("[data-ver-form]", el), panel(`Notes for the version of ${fmtDate(d.published_at || d.created_at)}`, html`<form class="form" data-ver-save="${d.id}">
        <div class="grid-2"><label>Version<input name="version" maxlength="40" value="${n.version ?? ""}" placeholder="1.22.0"></label>
          <label>Published by<input name="published_by" maxlength="120" value="${n.published_by ?? ""}" placeholder="${me?.profile?.full_name ?? ""}"></label></div>
        <label>Changes (one per line)<textarea name="changes" rows="5" maxlength="4000">${n.changes ?? d.title ?? ""}</textarea></label>
        <div class="btn-row form-actions"><button class="btn">Save notes</button><button type="button" class="btn ghost" data-ver-cancel>Cancel</button></div></form>`, { color: "yellow" }));
      return $("[data-ver-form]", el).scrollIntoView({ behavior: "smooth" });
    }
    if (t.dataset.verCancel !== undefined) return mount($("[data-ver-form]", el), "");
    if (t.dataset.verRestore) {
      const d = data.deploys.find((x) => x.id === t.dataset.verRestore);
      if (!(await confirmBox(`The website goes back to the version published ${fmtDate(d.published_at || d.created_at)}${note(d.id)?.version ? ` (version ${note(d.id).version})` : ""}. Everyone sees it within a minute. The newer versions stay in the list, so you can switch back.`, { title: "Make this version live?", ok: "Make it live" }))) return;
      t.disabled = true;
      try { await siteVersions({ action: "restore", deploy_id: d.id }); toast("Done — that version is live"); setTimeout(() => location.reload(), 1500); }
      catch (err) { toast(friendly(err), "error"); t.disabled = false; }
    }
  };
  el.onsubmit = async (e) => {
    if (!e.target.dataset.verSave) return;
    e.preventDefault();
    const f = e.target.elements, row = { deploy_id: e.target.dataset.verSave, version: f.version.value.trim() || null, changes: f.changes.value.trim() || null, published_by: f.published_by.value.trim() || null };
    try { await saveVersionNote(row); const i = notes.findIndex((n) => n.deploy_id === row.deploy_id); if (i >= 0) notes[i] = row; else notes.push(row); toast("Saved"); draw(); }
    catch (err) { toast(friendly(err), "error"); }
  };
}
