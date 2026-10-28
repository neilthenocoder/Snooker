// ─────────────────────────────────────────────────────────────
//  Admin → Support (round 55 — Rich: "a support function … a support ticket which certain roles get based on a
//  support enquiry dropdown category list").
//    Support inbox        the requests sent from /support that this login looks after (the Master Admin: all of
//                         them). Open one to read the conversation, answer, add a private note, change its status,
//                         move it to another category or say who is looking after it.
//    Support categories   (Master Admin) the list people choose from, and which roles get each kind.
//  The database decides who sees what (handles_support() in supabase/schema.sql); this only draws it.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$, toast, fmtDate, fmtTime, paragraphs, confirmBox } from "../core/dom.js";
import { supportTickets, ticketMessages, supportReply, updateTicket, deleteTicket, supportCategories, supportStaff, sendSupportEmail, save, remove, listen } from "../core/api.js";
import { panel, dataTable } from "../core/components.js";
import { navigate } from "../core/router.js";
import { ROLE_LABEL, isMaster } from "../core/auth.js";
import { SUPPORT_STATUS, SUPPORT_ROLES, supportStatus, ago } from "../core/support.js";
import { friendly } from "./crud.js";

/** Requests waiting for the league: not resolved, and the last word was the sender's (the red number in the menu). */
export const needsAnswer = async (user) => (await mine(user)).filter((t) => t.status !== "resolved" && t.last_from === "sender");
/** The requests this login looks after. (The database already sends only those; the demo database has no such rules.) */
const mine = async (user) => (await supportTickets()).filter((t) => isMaster(user) || (user?.supportCats ?? []).includes(t.category_id) || !t.category_id);

const FILTERS = [["open", "Open (not resolved)"], ["answer", "Waiting for us to answer"], ["new", "New"], ["in_progress", "In progress"], ["waiting", "Waiting for their reply"], ["resolved", "Resolved"], ["all", "All requests"]];
const FILTER_KEY = "sbdsl-support-filter";
const remembered = () => { try { return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); } catch { return {}; } };
const remember = (f) => { try { localStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* not kept */ } };

export async function supportPage(el, { user, onChange = () => {} } = {}) {
  const open = new URLSearchParams(location.search).get("t");
  let stop = () => {};
  const redraw = async () => { stop(); stop = open ? await ticketView(el, user, open, onChange) : await inbox(el, user); };
  await redraw();
  // A new request, or an answer, appears straight away.
  let timer = null;
  const unlisten = listen(["support_tickets", "support_messages"], () => { clearTimeout(timer); timer = setTimeout(() => {
    if (!el.isConnected) return;
    onChange();
    // Not while someone is in the middle of typing an answer.
    if (!el.querySelector("textarea:focus")?.value && !el.querySelector(".sup-toolbar input:focus")) redraw();
  }, 400); });
  const watch = new MutationObserver(() => { if (!el.isConnected) { unlisten(); stop(); watch.disconnect(); } });
  watch.observe(document.body, { childList: true, subtree: true });
}

// ── the list ─────────────────────────────────────────────────────
async function inbox(el, user) {
  const [tickets, cats, staff] = await Promise.all([mine(user), supportCategories().catch(() => []), supportStaff().catch(() => [])]);
  const f = { status: "open", cat: "", mine: false, q: "", ...remembered() };
  const who = (id) => staff.find((s) => s.id === id)?.full_name ?? "";
  const myCats = cats.filter((c) => tickets.some((t) => t.category_id === c.id) || isMaster(user) || (user.supportCats ?? []).includes(c.id));
  const count = (fn) => tickets.filter(fn).length;
  const passes = (t) => (f.status === "all" || (f.status === "open" ? t.status !== "resolved" : f.status === "answer" ? t.status !== "resolved" && t.last_from === "sender" : t.status === f.status))
    && (!f.cat || t.category_id === f.cat) && (!f.mine || t.assigned_to === user.id)
    && (!f.q || `#${t.no} ${t.subject} ${t.name} ${t.email}`.toLowerCase().includes(f.q.toLowerCase()));

  mount(el, html`<div class="notice">Requests people send from the <a href="/support" target="_blank" rel="noopener">Contact the league</a> page (it is linked from Help).
      ${isMaster(user) ? html`You see every request; officers see the categories given to their role under <a href="/admin/support_categories">Support categories</a>.` : "You see the kinds of request your role looks after."}
      Your answer is emailed to them, and they can reply from their private link. <b>Private notes</b> are only ever seen by the league.</div>
    <div class="sup-tallies">
      <span class="sup-tally"><b>${count((t) => t.status !== "resolved" && t.last_from === "sender")}</b> waiting for us</span>
      <span class="sup-tally"><b>${count((t) => t.status === "new")}</b> new</span>
      <span class="sup-tally"><b>${count((t) => t.status === "waiting")}</b> waiting for their reply</span>
      <span class="sup-tally"><b>${count((t) => t.status === "resolved")}</b> resolved</span>
    </div>
    <div class="toolbar sup-toolbar">
      <input type="search" placeholder="Search: #number, words, name or email" value="${f.q}" data-sup-q>
      <select data-sup-status aria-label="Which requests">${FILTERS.map(([k, l]) => html`<option value="${k}" ${f.status === k ? "selected" : ""}>${l}</option>`)}</select>
      <select data-sup-cat aria-label="Category"><option value="">Every category</option>${myCats.map((c) => html`<option value="${c.id}" ${f.cat === c.id ? "selected" : ""}>${c.name}</option>`)}</select>
      <label class="check"><input type="checkbox" data-sup-mine ${f.mine ? "checked" : ""}> Only ones I'm looking after</label>
    </div>
    <div data-sup-list></div>`);

  const drawList = () => {
    const rows = tickets.filter(passes).sort((a, b) => Number(b.last_from === "sender" && b.status !== "resolved") - Number(a.last_from === "sender" && a.status !== "resolved") || String(b.updated_at).localeCompare(String(a.updated_at)));
    mount($("[data-sup-list]", el), panel(`Requests (${rows.length})`, dataTable([
      { label: "#", cell: (t) => html`<span class="sup-no">#${t.no}</span>` },
      { label: "Request", cell: (t) => html`<a class="sup-open" href="/admin/support?t=${t.id}"><b>${t.subject}</b></a><br><small class="muted">${t.name}${t.user_id ? " · has a login" : ""}</small>` },
      { label: "Category", cell: (t) => t.category, cls: "hide-sm" },
      { label: "Status", cell: (t) => html`${supportStatus(t.status)}${t.status !== "resolved" && t.last_from === "sender" ? html` <span class="sup-flag">Needs an answer</span>` : ""}` },
      { label: "Looking after", cell: (t) => who(t.assigned_to) || html`<span class="muted">Nobody yet</span>`, cls: "hide-sm" },
      { label: "Last change", cell: (t) => html`<span title="${fmtDate(t.updated_at)} ${fmtTime(t.updated_at)}">${ago(t.updated_at)}</span>` },
    ], rows, { rowClass: (t) => (t.status !== "resolved" && t.last_from === "sender" ? "sup-needs" : ""),
      empty: f.status === "open" || f.status === "answer" ? "Nothing waiting — every request has been dealt with." : "No requests match." })));
  };
  drawList();
  const change = () => {
    f.q = $("[data-sup-q]", el).value.trim(); f.status = $("[data-sup-status]", el).value; f.cat = $("[data-sup-cat]", el).value; f.mine = $("[data-sup-mine]", el).checked;
    remember({ status: f.status, cat: f.cat, mine: f.mine }); drawList();
  };
  el.querySelector(".sup-toolbar").addEventListener("input", change);
  el.querySelector(".sup-toolbar").addEventListener("change", change);
  return () => {};
}

// ── one request ──────────────────────────────────────────────────
async function ticketView(el, user, id, onChange) {
  const [tickets, cats, staff, msgs] = await Promise.all([mine(user), supportCategories().catch(() => []), supportStaff().catch(() => []), ticketMessages(id).catch(() => [])]);
  const t = tickets.find((x) => x.id === id);
  if (!t) { mount(el, html`<div class="notice error">That request isn't there any more, or your role doesn't look after its category.</div><p><a class="btn" href="/admin/support">All requests</a></p>`); return () => {}; }
  const cat = cats.find((c) => c.id === t.category_id);
  const canLook = staff.filter((s) => s.role === "admin" || (cat?.roles ?? []).includes(s.role));
  const draft = sessionStorage.getItem(`sup-draft-${id}`) ?? "";

  mount(el, html`<p><a class="btn small ghost" href="/admin/support">‹ All requests</a></p>
    <div class="sup-head">
      <div><span class="sup-no">#${t.no}</span> ${supportStatus(t.status)}
        <h2>${t.subject}</h2>
        <p class="muted">${t.category} · from <b>${t.name}</b> · <a href="mailto:${t.email}?subject=${encodeURIComponent(`Your request #${t.no}: ${t.subject}`)}">${t.email}</a>${t.user_id ? " · has a login" : ""}
          · sent ${fmtDate(t.created_at)} at ${fmtTime(t.created_at)}${t.page_url ? html` · from the page <a href="${t.page_url}" target="_blank" rel="noopener">${t.page_url}</a>` : ""}</p></div>
    </div>
    <div class="sup-grid">
      <div>
        <ol class="sup-thread">${msgs.map((m) => html`<li class="sup-msg ${m.internal ? "note" : m.from_league ? "league" : "them"}">
          <div class="sup-msg-head"><b>${m.internal ? `Private note — ${m.author_name ?? "the league"}` : m.from_league ? `${m.author_name ?? "The league"} (the league)` : m.author_name ?? t.name}</b>
            <time title="${fmtDate(m.created_at)} ${fmtTime(m.created_at)}">${ago(m.created_at)}</time></div>
          <div class="sup-msg-body">${paragraphs(m.body)}</div>
          ${m.image_url ? html`<a href="${m.image_url}" target="_blank" rel="noopener"><img class="sup-shot" src="${m.image_url}" alt="Screenshot sent with this message" loading="lazy"></a>` : ""}
        </li>`)}</ol>
        <form class="form box sup-reply" data-sup-reply>
          <label>Your answer <span class="muted" style="font-weight:400">(emailed to ${t.name.split(" ")[0]}, who can reply from their private link)</span>
            <textarea name="body" rows="6" maxlength="5000" required placeholder="Hello ${t.name.split(" ")[0]}, …">${draft}</textarea></label>
          <label class="check"><input type="checkbox" name="internal"> Private note — only the league sees it (no email is sent)</label>
          <div class="grid-2"><label>Then mark it as
            <select name="status">
              <option value="waiting">Waiting for their reply</option>
              <option value="resolved">Resolved — sorted</option>
              <option value="in_progress">In progress — still on it</option>
            </select></label></div>
          <div class="btn-row"><button class="btn green" data-sup-send>Send answer</button></div>
        </form>
      </div>
      <aside class="box sup-side">
        <h3>This request</h3>
        <label>Status<select data-sup-set="status">${Object.entries(SUPPORT_STATUS).map(([k, v]) => html`<option value="${k}" ${t.status === k ? "selected" : ""}>${v.label}</option>`)}</select></label>
        <label>Looking after it<select data-sup-set="assigned_to"><option value="">Nobody yet</option>${canLook.map((s) => html`<option value="${s.id}" ${t.assigned_to === s.id ? "selected" : ""}>${s.full_name}${s.id === user.id ? " (me)" : ""}</option>`)}</select></label>
        <label>Category <span class="muted" style="font-weight:400">(moving it sends it to that category's officers)</span>
          <select data-sup-set="category_id">${cats.filter((c) => c.is_active || c.id === t.category_id).map((c) => html`<option value="${c.id}" ${t.category_id === c.id ? "selected" : ""}>${c.name}</option>`)}</select></label>
        <div class="btn-row">
          ${t.status !== "resolved" ? html`<button type="button" class="btn small" data-sup-resolve>Mark as resolved</button>` : ""}
          ${t.assigned_to !== user.id ? html`<button type="button" class="btn small secondary" data-sup-take>I'll take it</button>` : ""}
        </div>
        <p class="muted sup-side-note">What they see: <a href="/support/${t.token}" target="_blank" rel="noopener">their page for this request</a> (the private link they were emailed — don't share it).</p>
        ${isMaster(user) ? html`<button type="button" class="btn small danger" data-sup-delete>Delete this request</button>` : ""}
      </aside>
    </div>`);

  const form = $("[data-sup-reply]", el), send = $("[data-sup-send]", el);
  form.elements.internal.addEventListener("change", () => { send.textContent = form.elements.internal.checked ? "Add private note" : "Send answer"; form.elements.status.disabled = form.elements.internal.checked; });
  form.elements.body.addEventListener("input", () => { try { sessionStorage.setItem(`sup-draft-${id}`, form.elements.body.value); } catch { /* not kept */ } });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const internal = form.elements.internal.checked;
    send.disabled = true;
    try {
      const mid = await supportReply({ ticket: t.id, body: form.elements.body.value, internal, status: internal ? null : form.elements.status.value });
      try { sessionStorage.removeItem(`sup-draft-${id}`); } catch { /* fine */ }
      if (!internal) sendSupportEmail(mid);
      toast(internal ? "Note added" : "Answer sent"); onChange();
      await ticketView(el, user, id, onChange);
    } catch (err) { toast(friendly(err), "error"); send.disabled = false; }
  });
  const set = async (patch, done) => {
    try { await updateTicket(t.id, patch); toast(done); onChange(); await ticketView(el, user, id, onChange); }
    catch (err) { toast(friendly(err), "error"); }
  };
  for (const sel of $$("[data-sup-set]", el)) sel.addEventListener("change", async () => {
    const k = sel.dataset.supSet, v = sel.value || null;
    if (k === "category_id" && !isMaster(user) && !(user.supportCats ?? []).includes(v)
      && !(await confirmBox("Your role doesn't look after that category, so the request will leave your inbox. Move it?", { ok: "Move it" }))) { sel.value = t.category_id; return; }
    const patch = { [k]: v };
    if (k === "category_id") { patch.category = cats.find((c) => c.id === v)?.name ?? t.category; patch.assigned_to = null; }
    set(patch, k === "status" ? "Status changed" : k === "category_id" ? "Moved" : "Saved");
  });
  $("[data-sup-resolve]", el)?.addEventListener("click", () => set({ status: "resolved" }, "Marked as resolved"));
  $("[data-sup-take]", el)?.addEventListener("click", () => set({ assigned_to: user.id, ...(t.status === "new" ? { status: "in_progress" } : {}) }, "It's yours"));
  $("[data-sup-delete]", el)?.addEventListener("click", async () => {
    if (!(await confirmBox(`Delete request #${t.no} and its whole conversation? This can't be undone.`, { ok: "Delete it" }))) return;
    try { await deleteTicket(t.id); toast("Deleted"); onChange(); navigate("/admin/support"); } catch (err) { toast(friendly(err), "error"); }
  });
  return () => {};
}

// ── the categories (Master Admin) ───────────────────────────────
export async function supportCategoriesPage(el) {
  const draw = async () => {
    const cats = await supportCategories();
    const roleBoxes = (c) => html`<div class="sup-roles">${SUPPORT_ROLES.map((r) => html`<label class="check"><input type="checkbox" name="role" value="${r}" ${(c.roles ?? []).includes(r) ? "checked" : ""}> ${ROLE_LABEL[r]}</label>`)}</div>`;
    const row = (c) => html`<form class="box form sup-cat" data-cat="${c.id ?? ""}">
      <div class="grid-2"><label>Name <span class="muted" style="font-weight:400">(what people choose)</span><input name="name" required maxlength="80" value="${c.name ?? ""}"></label>
        <label>A line under it <span class="muted" style="font-weight:400">(optional)</span><input name="description" maxlength="300" value="${c.description ?? ""}"></label></div>
      <div class="field-label">Goes to <span class="muted" style="font-weight:400">(the Master Admin always gets every request)</span>${roleBoxes(c)}</div>
      <div class="sup-cat-foot">
        <label class="sup-sort">Order <input type="number" name="sort" min="1" value="${c.sort ?? cats.length + 1}"></label>
        <label class="check"><input type="checkbox" name="is_active" ${c.is_active !== false ? "checked" : ""}> Show it on the form</label>
        <span class="btn-row"><button class="btn small">${c.id ? "Save" : "Add this category"}</button>${c.id ? html`<button type="button" class="btn small ghost" data-cat-del="${c.id}">Remove</button>` : ""}</span>
      </div></form>`;
    mount(el, html`<div class="notice">The list people choose from on the <a href="/support" target="_blank" rel="noopener">Contact the league</a> form, and <b>who gets each kind</b>.
        A request goes to every login with one of the ticked roles (they see it in their Support inbox, and get an email when the emails are on — Admin → Emails), and always to the Master Admin.
        Removing a category keeps its old requests; untick “Show it on the form” to stop new ones.</div>
      <div class="stack">${cats.map(row)}</div>
      <h2 class="adm-h">Add a category</h2>${row({ roles: ["league_admin"], is_active: true })}`);
  };
  await draw();
  el.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-cat]");
    if (!form) return;
    e.preventDefault();
    const roles = $$("input[name=role]:checked", form).map((x) => x.value);
    const row = { name: form.elements.name.value.trim(), description: form.elements.description.value.trim() || null, roles,
      sort: Number(form.elements.sort.value) || 1, is_active: form.elements.is_active.checked };
    if (form.dataset.cat) row.id = form.dataset.cat;
    if (!roles.length && !(await confirmBox("No role is ticked, so only the Master Admin will get these requests. Save anyway?", { ok: "Save" }))) return;
    try { await save("support_categories", row); toast(form.dataset.cat ? "Saved" : "Category added"); await draw(); } catch (err) { toast(friendly(err), "error"); }
  });
  el.addEventListener("click", async (e) => {
    const id = e.target.closest("[data-cat-del]")?.dataset.catDel;
    if (!id || !(await confirmBox("Remove this category? Requests already sent keep it, but nobody can choose it any more.", { ok: "Remove" }))) return;
    try { await remove("support_categories", id); toast("Removed"); await draw(); } catch (err) { toast(friendly(err), "error"); }
  });
}
