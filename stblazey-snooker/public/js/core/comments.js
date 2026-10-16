// ─────────────────────────────────────────────────────────────
//  MATCH NIGHT CHAT (Rich, round 22): comments under a match, so people
//  can chat on the night. Anyone logged in can comment (500 letters at most,
//  one every 10 seconds); they can remove their own, and the league can hide
//  or remove any (here, or Admin → Website → Comments). Switched off for the
//  whole site under Admin → Website → Comments.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, fmtDate, fmtTime, toast, confirmBox } from "./dom.js";
import { matchComments, addComment, save, remove, settings, subscribe } from "./api.js";
import { canManage } from "./auth.js";
import { panel } from "./components.js";

const MAX = 500;
const initials = (name) => String(name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

/**
 * Draw the chat into `el` for one match — where = { fixture_id } (league) or { comp_match_id } (cup).
 * Returns a function that stops it listening for new comments.
 */
export async function mountComments(el, where, user) {
  const site = await settings();
  if (site.comments_on === false) { mount(el, ""); return () => {}; }
  const mod = canManage(user, "website");
  let list = [], typed = "";
  const load = async () => { list = await matchComments(where).catch(() => []); };
  const draw = () => {
    const box = $("[data-cm-text]", el), focused = !!box && document.activeElement === box;
    if (box) typed = box.value;
    const shown = list.filter((c) => !c.hidden || mod);
    mount(el, panel(html`Match night chat${shown.length ? html` <span class="cm-count">${shown.length}</span>` : ""}`, html`<div class="cm">
      ${shown.length ? html`<ol class="cm-list">${shown.map((c) => html`<li class="cm-item ${c.hidden ? "is-hidden" : ""} ${user && c.author_id === user.id ? "mine" : ""}">
        <span class="cm-av" aria-hidden="true">${initials(c.author_name)}</span>
        <div><p class="cm-meta"><b>${c.author_name ?? "Someone"}</b> <time>${fmtDate(c.created_at)} ${fmtTime(c.created_at)}</time>${c.hidden ? html` <span class="cm-flag">hidden from everyone</span>` : ""}</p>
          <p class="cm-body">${c.body}</p>
          ${(user && c.author_id === user.id) || mod ? html`<span class="cm-acts">
            ${mod ? html`<button type="button" data-cm-hide="${c.id}">${c.hidden ? "Show it again" : "Hide"}</button>` : ""}
            <button type="button" data-cm-del="${c.id}">Remove</button></span>` : ""}</div></li>`)}</ol>`
        : html`<p class="muted cm-empty">No comments yet${user ? " — start the chat!" : "."}</p>`}
      ${user ? html`<form class="cm-form" data-cm-form>
          <textarea data-cm-text name="body" maxlength="${MAX}" rows="2" placeholder="Say something about the match…" aria-label="Your comment" required>${typed}</textarea>
          <div class="cm-send"><small class="muted" data-cm-left>${MAX - typed.length} letters left</small><button class="btn small">Post</button></div></form>`
        : html`<p class="cm-login"><button type="button" class="btn small" data-account-open>Log in to join the chat</button></p>`}
    </div>`, { cls: "cm-panel" }));
    if (focused) { const b = $("[data-cm-text]", el); b?.focus(); b?.setSelectionRange(b.value.length, b.value.length); }
  };
  await load(); draw();

  el.addEventListener("input", (e) => { if (e.target.matches("[data-cm-text]")) $("[data-cm-left]", el).textContent = `${MAX - e.target.value.length} letters left`; });
  el.addEventListener("submit", async (e) => {
    if (!e.target.matches("[data-cm-form]")) return;
    e.preventDefault();
    const text = e.target.elements.body.value.trim(), btn = e.target.querySelector("button");
    if (!text) return;
    btn.disabled = true;
    try { await addComment(where, text); typed = ""; $("[data-cm-text]", el).value = ""; await load(); draw(); }
    catch (err) { toast(err.message, "error"); btn.disabled = false; }
  });
  el.addEventListener("click", async (e) => {
    const hide = e.target.dataset.cmHide, del = e.target.dataset.cmDel;
    if (!hide && !del) return;
    try {
      if (del) { if (!(await confirmBox("The comment is removed for good.", { title: "Remove this comment?", ok: "Remove" }))) return; await remove("match_comments", del); }
      else { const c = list.find((x) => x.id === hide); await save("match_comments", { id: hide, hidden: !c.hidden }); }
      await load(); draw();
    } catch (err) { toast(err.message, "error"); }
  });
  // New comments from everyone else appear by themselves.
  return subscribe(["match_comments"], async () => { await load(); draw(); });
}
