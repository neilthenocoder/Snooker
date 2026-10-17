// ─────────────────────────────────────────────────────────────
//  MATCH NIGHT CHAT (Rich, rounds 22 and 24).
//  A "💬 Match chat" button near the top of every league and cup match opens the chat
//  in a panel that slides up from the bottom of the screen (it was a box at the very
//  bottom of the page). "Invite your team" shares a link that opens the chat straight
//  away (…#chat) — on WhatsApp, a text, anything the phone offers.
//  Anyone logged in can comment (500 letters at most, one every 10 seconds); they can remove
//  their own. The league can hide or remove any comment, and switch the chat off — for one
//  match (here, "Close the chat for this match") or for the whole site (Admin → Website → Comments).
// ─────────────────────────────────────────────────────────────
import { html, mount, $, fmtTime, fmtDate, toast, confirmBox } from "./dom.js";
import { matchComments, addComment, save, remove, settings, subscribe, invalidate, setChatOff } from "./api.js";
import { canManage } from "./auth.js";

const MAX = 500;
const initials = (name) => String(name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const chatIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v11h2v1.8L8.3 16H20V5Zm3 3h10v2H7Zm0 4h7v2H7Z"/></svg>`;

/**
 * where = { fixture_id } or { comp_match_id }; match = the fixture / cup match row (for its chat_off switch);
 * title = "Bethel A v Bugle". Returns { button (an element to put near the top of the page), stop() }.
 */
export async function matchChat(where, match, user, { title = "Match chat" } = {}) {
  const site = await settings();
  const button = document.createElement("button");
  button.type = "button"; button.className = "cm-open";
  if (site.comments_on === false) { button.hidden = true; return { button, stop: () => {} }; }
  const mod = canManage(user, "website");
  let closed = !!match?.chat_off, list = [], typed = "", open = false;
  const sheet = document.createElement("div");
  sheet.className = "cm-sheet";
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", `Match chat: ${title}`);
  document.body.append(sheet);

  const shown = () => list.filter((c) => !c.hidden || mod);
  const drawButton = () => mount(button, html`${chatIcon}<span>Match chat</span>${shown().length ? html`<b>${shown().length}</b>` : ""}`);
  const load = async () => { list = await matchComments(where).catch(() => []); };
  const draw = () => {
    const box = $("[data-cm-text]", sheet), focused = !!box && document.activeElement === box;
    if (box) typed = box.value;
    const items = shown();
    mount(sheet, html`<div class="cm-shade" data-cm-close></div><div class="cm-panel-s">
      <header class="cm-top"><span class="cm-grab" aria-hidden="true"></span>
        <div><b>💬 Match chat</b><small>${title}</small></div>
        <button type="button" class="cm-x" data-cm-close aria-label="Close the chat">×</button></header>
      <div class="cm-tools">
        <button type="button" class="btn small ghost" data-cm-invite>Invite your team</button>
        ${mod ? html`<button type="button" class="btn small ${closed ? "green" : ""}" data-cm-switch>${closed ? "Open the chat for this match" : "Close the chat for this match"}</button>` : ""}
      </div>
      <ol class="cm-list">${items.length ? items.map((c) => html`<li class="cm-item ${c.hidden ? "is-hidden" : ""} ${user && c.author_id === user.id ? "mine" : ""}">
          <span class="cm-av" aria-hidden="true">${initials(c.author_name)}</span>
          <div><p class="cm-meta"><b>${c.author_name ?? "Someone"}</b> <time>${fmtDate(c.created_at) === fmtDate(new Date().toISOString()) ? fmtTime(c.created_at) : `${fmtDate(c.created_at)} ${fmtTime(c.created_at)}`}</time>${c.hidden ? html` <span class="cm-flag">hidden</span>` : ""}</p>
            <p class="cm-body">${c.body}</p>
            ${(user && c.author_id === user.id) || mod ? html`<span class="cm-acts">${mod ? html`<button type="button" data-cm-hide="${c.id}">${c.hidden ? "Show it again" : "Hide"}</button>` : ""}<button type="button" data-cm-del="${c.id}">Remove</button></span>` : ""}</div></li>`)
        : html`<li class="cm-empty muted">No messages yet${user && !closed ? " — start the chat!" : "."}</li>`}</ol>
      <footer class="cm-foot">${closed ? html`<p class="cm-closed">The league has closed the chat for this match.</p>`
        : user ? html`<form class="cm-form" data-cm-form><textarea data-cm-text name="body" maxlength="${MAX}" rows="1" placeholder="Message…" aria-label="Your message" required>${typed}</textarea><button class="btn small" aria-label="Send">Send</button></form>`
        : html`<p class="cm-login"><button type="button" class="btn small" data-account-open>Log in to join the chat</button></p>`}</footer></div>`);
    sheet.classList.toggle("open", open);
    const listEl = $(".cm-list", sheet); listEl.scrollTop = listEl.scrollHeight;
    if (focused) $("[data-cm-text]", sheet)?.focus();
    drawButton();
  };
  const setOpen = (on) => {
    open = on; sheet.classList.toggle("open", on); document.documentElement.classList.toggle("cm-locked", on);
    if (on) { const l = $(".cm-list", sheet); if (l) l.scrollTop = l.scrollHeight; setTimeout(() => $("[data-cm-text]", sheet)?.focus({ preventScroll: true }), 250); }
  };
  await load(); draw();
  button.addEventListener("click", () => setOpen(true));
  if (location.hash === "#chat") setTimeout(() => setOpen(true), 400);

  sheet.addEventListener("click", async (e) => {
    if (e.target.closest("[data-cm-close]")) return setOpen(false);
    if (e.target.closest("[data-account-open]")) return setOpen(false);
    if (e.target.closest("[data-cm-invite]")) {
      const url = `${location.origin}${location.pathname}#chat`, text = `Join the match chat: ${title}`;
      if (navigator.share) return navigator.share({ title: text, url }).catch(() => {});
      try { await navigator.clipboard.writeText(url); toast("Chat link copied — paste it to your team"); } catch { window.prompt("Copy this link for your team:", url); }
      return;
    }
    if (e.target.closest("[data-cm-switch]")) {
      try { await setChatOff(where, !closed); closed = !closed; invalidate(); toast(closed ? "Chat closed for this match" : "Chat open again"); draw(); }
      catch (err) { toast(err.message, "error"); }
      return;
    }
    const hide = e.target.dataset?.cmHide, del = e.target.dataset?.cmDel;
    if (!hide && !del) return;
    try {
      if (del) { if (!(await confirmBox("The message is removed for good.", { title: "Remove this message?", ok: "Remove" }))) return; await remove("match_comments", del); }
      else { const c = list.find((x) => x.id === hide); await save("match_comments", { id: hide, hidden: !c.hidden }); }
      await load(); draw();
    } catch (err) { toast(err.message, "error"); }
  });
  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" && !e.shiftKey && e.target.matches("[data-cm-text]")) { e.preventDefault(); e.target.form.requestSubmit(); }
  });
  sheet.addEventListener("input", (e) => { if (e.target.matches("[data-cm-text]")) { e.target.style.height = "auto"; e.target.style.height = `${Math.min(120, e.target.scrollHeight)}px`; } });
  sheet.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = e.target.elements.body.value.trim(), btn = e.target.querySelector("button");
    if (!text) return;
    btn.disabled = true;
    try { await addComment(where, text); typed = ""; e.target.elements.body.value = ""; await load(); draw(); }
    catch (err) { toast(err.message, "error"); btn.disabled = false; }
  });
  const unsub = subscribe(["match_comments"], async () => { await load(); draw(); });
  return { button, stop: () => { unsub(); sheet.remove(); document.documentElement.classList.remove("cm-locked"); } };
}
