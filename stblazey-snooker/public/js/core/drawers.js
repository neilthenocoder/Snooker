// ─────────────────────────────────────────────────────────────
//  SIDE PANELS — the two that slide in from the right when an icon
//  in the menu bar is pressed:
//    the person  → log in, or (logged in) your own links and Log out
//    the bell    → which live notifications you want
//  Plus "Add to home screen", which lives in the person's panel.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, readForm, toast, fmtDate, safeHref } from "./dom.js";
import { DEMO_MODE } from "../config.js";
import { canInstall, installApp } from "./install.js";
import { signInChecked, homeFor, isStaff, isMember, isPlainPlayer, isMaster, isCaptain, roleText, mySnookerOn, canWriteNews } from "./auth.js";
import { notificationsOn, setNotifications, NOTIFY_KINDS, notifyPrefs, setNotifyPref, latestNotices, markNoticesSeen, seenNotices, NOTICE_KIND } from "./notify.js";
import { navigate, refreshShell } from "./router.js";

const ico = (d) => html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = {
  star: ico("m12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9Z"),
  team: ico("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8v-1c0-2.8 3.1-5 7-5s7 2.2 7 5v1Z"),
  admin: ico("M4 4h7v7H4Zm9 0h7v4h-7ZM4 13h7v7H4Zm9-3h7v10h-7Z"),
  pen: ico("M3 17.2V21h3.8l11-11-3.8-3.8ZM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8Z"),
  cog: ico("M4 6h9v2H4Zm13 0h3v2h-3Zm-2-2h2v6h-2ZM4 11h3v2H4Zm7 0h9v2h-9ZM7 9h2v6H7Zm-3 7h9v2H4Zm13 0h3v2h-3Zm-2-2h2v6h-2Z"),
  help: ico("M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1 11h2v2h-2Zm1-9a3.5 3.5 0 0 1 1.6 6.6c-.4.2-.6.5-.6.9V14h-2v-.5c0-1.2.6-2.1 1.6-2.7A1.5 1.5 0 1 0 10.5 9.5h-2A3.5 3.5 0 0 1 12 6Z"),
  key: ico("M14 3a7 7 0 0 0-6.7 9L2 17.3V22h4.7v-2.3H9v-2.3h2.3l1.4-1.4A7 7 0 1 0 14 3Zm2.5 4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z"),
  phone: ico("M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 3v13h10V5Zm5 14.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"),
  out: ico("M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5Zm6.6 4.6-1.4 1.4 2 2H9v2h8.2l-2 2 1.4 1.4L21 12Z"),
  form: ico("M3 20h18v-2H3Zm2-4h3V9H5Zm5.5 0h3V4h-3ZM16 16h3v-5h-3Z"),
  go: ico("M9.3 5.3 7.9 6.7l5.3 5.3-5.3 5.3 1.4 1.4L16 12Z"),
};

let open = null;   // { el, close }
/** Close whichever panel is open. */
export function closeDrawer() { open?.close(); }

function drawer(name, title, body) {
  closeDrawer();
  const el = document.createElement("div");
  el.className = `drawer-wrap drawer-${name}`;
  mount(el, html`<div class="drawer-shade" data-drawer-close></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="${title}" tabindex="-1">
      <header class="drawer-head"><h2>${title}</h2><button type="button" class="drawer-x" data-drawer-close aria-label="Close">×</button></header>
      <div class="drawer-body">${body}</div>
    </aside>`);
  document.body.append(el);
  document.documentElement.classList.add("drawer-open");
  requestAnimationFrame(() => el.classList.add("in"));
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const close = () => {
    if (open?.el !== el) return;
    open = null;
    document.removeEventListener("keydown", onKey);
    document.documentElement.classList.remove("drawer-open");
    el.classList.remove("in");
    setTimeout(() => el.remove(), 260);
  };
  document.addEventListener("keydown", onKey);
  el.addEventListener("click", (e) => {
    // A press on the shade or the ×, or on any link in the panel, closes it.
    if (e.target.closest("[data-drawer-close]") || e.target.closest("a[href]")) close();
  });
  open = { el, close };
  $(".drawer", el).focus({ preventScroll: true });
  return el;
}

// ── the person: log in, or your own links ──────────────────────
export function openAccount(user, { message = "", back = "" } = {}) {
  if (!user) {
    const el = drawer("account", "Log in", html`
      ${message ? html`<div class="notice">${message}</div>` : ""}
      <form class="form drawer-form" data-login>
        <div data-login-error></div>
        <label>Email<input name="email" type="email" autocomplete="username" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Log in</button>
        <p class="muted drawer-small">Logins are for players, captains and league officers, and are made by the league secretary. Forgotten your password? Ask them to reset it.</p>
        ${DEMO_MODE ? html`<p class="drawer-small"><a href="/login" style="font-weight:700;color:var(--red)">Demo logins →</a></p>` : ""}
      </form>
      ${installBlock()}`);
    $("[data-login]", el).addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      try {
        const { email, password } = readForm(e.target);
        const u = await signInChecked(email, password);
        await refreshShell();
        closeDrawer();
        // The two-step code, when this login's role needs it, is asked for on the login page.
        navigate(u?.mfaNeeded ? "/login" : back && back.startsWith("/") && !back.startsWith("//") ? back : homeFor(u));
      } catch (err) {
        mount($("[data-login-error]", el), html`<div class="notice error">${err.message}</div>`);
        btn.disabled = false;
      }
    });
    wireInstall(el);
    setTimeout(() => $("[name=email]", el)?.focus(), 280);
    return;
  }
  const p = user.profile ?? {};
  const name = p.full_name || user.email;
  const link = (href, icon, label, note = "") => html`<a class="drawer-link" href="${href}"><span class="drawer-ico">${icon}</span><span><b>${label}</b>${note ? html`<small>${note}</small>` : ""}</span>${ICON.go}</a>`;
  const el = drawer("account", "My account", html`
    <div class="drawer-who"><span class="drawer-initials">${initials(name)}</span><div><strong>${name}</strong><small>${roleText(p)}</small></div></div>
    <nav class="drawer-links" aria-label="My account">
      ${accountLinks(user).map((l) => (l.guide
        ? html`<button type="button" class="drawer-link as-btn" data-guide-start><span class="drawer-ico">${l.icon}</span><span><b>${l.label}</b>${l.note ? html`<small>${l.note}</small>` : ""}</span>${ICON.go}</button>`
        : link(l.href, l.icon, l.label, l.note)))}
    </nav>
    ${installBlock()}
    <button type="button" class="drawer-logout" data-logout>${ICON.out}<span>Log out</span></button>`);
  wireInstall(el);
  // (Log out itself is handled in main.js, like every other log out button.)
  $("[data-logout]", el).addEventListener("click", () => closeDrawer());
}
/**
 * Round 51 (Neil — one menu, not two): everything a logged-in person can open, most important first. The same list is
 * the dropdown in the menu bar on a computer (Admin ▾ / Captain ▾ / My account ▾) and the account part of the phone menu.
 * My Snooker is not in it any more: it is the home page (Home, or the logo).
 */
export function accountLinks(user) {
  const p = user?.profile ?? {};
  return [
    // Round 52: My Snooker is a page of its own again — first in the list, and it stands out (special: true).
    { href: "/mysnooker", icon: ICON.star, label: "My Snooker", note: "Your team's stats, table, rankings and breaks", special: true },
    isStaff(user) && { href: "/admin", icon: ICON.admin, label: "Admin dashboard", note: "Everything your role looks after" },
    isMember(user) && !isPlainPlayer(user) && { href: "/my", icon: ICON.team, label: "My team", note: "Scorecards, fixtures and your team" },
    isCaptain(user) && { href: "/my/squad", icon: ICON.team, label: "Manage team", note: "The team sheet, and adding players" },
    canWriteNews(user) && !isStaff(user) && { href: "/my/news", icon: ICON.pen, label: "Write news", note: "Step by step: headline, story, pictures" },
    { href: "/my/snooker", icon: ICON.cog, label: "My Snooker settings", note: "Who you follow, what you see and in what order" },
    p.player_id && { href: "/my/profile", icon: ICON.team, label: "My profile", note: "Your photo, bio and CueView" },
    p.player_id && { href: `/player/${p.player_id}#form`, icon: ICON.form, label: "My form", note: "Your mark out of 10 from your last 6 matches" },
    !p.player_id && isMaster(user) && { href: "/admin/accounts", icon: ICON.team, label: "Do you play? Link your player profile", note: "Then My profile and My form appear here" },
    { href: "/my/details", icon: ICON.key, label: "Password & details" },
    // Round 55: questions and problems for the league, and the answers.
    { href: "/support", icon: ICON.help, label: "Help & support", note: "Ask the league, and see your requests" },
    // (Round 53, Rich: "Help link should go in the footer" — Show me around is the Help link there now.)
  ].filter(Boolean);
}
/** The word on the account button once logged in: Admin, Captain or My account. */
export const roleLabel = (user) => (isStaff(user) ? "Admin" : isCaptain(user) ? "Captain" : "My account");
export { ICON as MENU_ICON };

export const initials = (name) => String(name ?? "").trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

// ── the bell: the league's notices, and which notifications ────
const LEAGUE_KINDS = ["breaking", "updates", "offers"];   // the ones the league sends out itself
export async function openNotifications({ onChange = () => {} } = {}) {
  const row = (key, label, help, on, disabled = false) => html`<label class="switch-row ${disabled ? "is-off" : ""}">
    <span><b>${label}</b><small>${help}</small></span>
    <input type="checkbox" data-kind="${key}" ${on ? "checked" : ""} ${disabled ? "disabled" : ""}><span class="ms-slider" aria-hidden="true"></span></label>`;
  const kinds = (keys) => NOTIFY_KINDS.filter(([key]) => keys(key));
  // What the league has sent out lately (breaking news, important updates, offers) — the kinds left switched on.
  const seen = seenNotices();      // as it was before the panel was opened: those not in it are marked "New"
  const notices = (list) => (list.length ? html`<h3 class="drawer-h">Latest from the league</h3>
    <div class="notice-list">${list.map((n) => { const k = NOTICE_KIND[n.kind], href = safeHref(n.url);
      const inner = html`<span class="notice-tag tone-${k.tone}">${k.label}</span>${seen.has(n.id) ? "" : html`<i class="notice-new">New</i>`}
        <b>${n.title}</b>${n.body ? html`<p>${n.body}</p>` : ""}<small>${fmtDate(n.created_at)}${href ? " · Find out more →" : ""}</small>`;
      return href ? html`<a class="notice-item" href="${href}" ${/^https?:/i.test(href) ? html`target="_blank" rel="noopener"` : ""}>${inner}</a>` : html`<div class="notice-item">${inner}</div>`; })}</div>` : "");
  const body = (list) => { const all = notificationsOn(), prefs = notifyPrefs();
    return html`
      ${notices(list)}
      <p class="drawer-lead">Choose what pops up while you are on the website. Your choices are remembered on this phone or computer.</p>
      <div class="switch-list">${row("all", "Live notifications", "The pop-ups in the corner. Switch this off to stop them all.", all)}</div>
      <h3 class="drawer-h">From the league</h3>
      <div class="switch-list">${kinds((key) => LEAGUE_KINDS.includes(key)).map(([key, label, help]) => row(key, label, help, prefs[key], !all))}</div>
      <h3 class="drawer-h">From the matches</h3>
      <div class="switch-list">${kinds((key) => key !== "confetti" && !LEAGUE_KINDS.includes(key)).map(([key, label, help]) => row(key, label, help, prefs[key], !all))}</div>
      <h3 class="drawer-h">Celebrations</h3>
      <div class="switch-list">${kinds((key) => key === "confetti").map(([key, label, help]) => row(key, label, help, prefs[key]))}</div>`; };
  const el = drawer("notify", "Notifications", html`<div data-notify>${body([])}</div>`);
  const redraw = async () => { const list = await latestNotices().catch(() => []); if (el.isConnected) mount($("[data-notify]", el), body(list)); };
  el.addEventListener("change", async (e) => {
    const kind = e.target.dataset?.kind;
    if (!kind) return;
    if (kind === "all") { setNotifications(e.target.checked); toast(e.target.checked ? "Live notifications on" : "Live notifications off"); }
    else setNotifyPref(kind, e.target.checked);
    await redraw();
    onChange();
  });
  await redraw();
  // Opening the bell reads them: the number on the bell goes (the "New" marks stay until the panel is closed).
  await markNoticesSeen();
  onChange();
}

// ── add to home screen ─────────────────────────────────────────
// One press where the browser allows it, a picture guide on iPhone (core/install.js).
function installBlock() {
  if (!canInstall()) return "";
  return html`<div class="drawer-install">
    <button type="button" class="drawer-link as-btn" data-install><span class="drawer-ico">${ICON.phone}</span><span><b>Add to your home screen</b><small>Open the website like an app, straight from your phone's home screen</small></span>${ICON.go}</button></div>`;
}
function wireInstall(el) {
  $("[data-install]", el)?.addEventListener("click", () => { closeDrawer(); installApp(); });
}
