// ─────────────────────────────────────────────────────────────
//  SIDE PANELS — the two that slide in from the right when an icon
//  in the menu bar is pressed:
//    the person  → log in, or (logged in) your own links and Log out
//    the bell    → which live notifications you want
//  Plus "Add to home screen", which lives in the person's panel.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, readForm, toast } from "./dom.js";
import { DEMO_MODE } from "../config.js";
import { signIn, homeFor, isStaff, isMember, isPlainPlayer, roleText, mySnookerOn } from "./auth.js";
import { notificationsOn, setNotifications, NOTIFY_KINDS, notifyPrefs, setNotifyPref } from "./notify.js";
import { navigate, refreshShell } from "./router.js";

const ico = (d) => html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = {
  star: ico("m12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9Z"),
  team: ico("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8v-1c0-2.8 3.1-5 7-5s7 2.2 7 5v1Z"),
  admin: ico("M4 4h7v7H4Zm9 0h7v4h-7ZM4 13h7v7H4Zm9-3h7v10h-7Z"),
  cog: ico("M4 6h9v2H4Zm13 0h3v2h-3Zm-2-2h2v6h-2ZM4 11h3v2H4Zm7 0h9v2h-9ZM7 9h2v6H7Zm-3 7h9v2H4Zm13 0h3v2h-3Zm-2-2h2v6h-2Z"),
  key: ico("M14 3a7 7 0 0 0-6.7 9L2 17.3V22h4.7v-2.3H9v-2.3h2.3l1.4-1.4A7 7 0 1 0 14 3Zm2.5 4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z"),
  phone: ico("M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 3v13h10V5Zm5 14.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"),
  out: ico("M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5Zm6.6 4.6-1.4 1.4 2 2H9v2h8.2l-2 2 1.4 1.4L21 12Z"),
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
export function openAccount(user, { message = "" } = {}) {
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
        const u = await signIn(email, password);
        await refreshShell();
        closeDrawer();
        navigate(homeFor(u));
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
      ${link(mySnookerOn(user) ? "/myteam" : "/my/snooker", ICON.star, "My Snooker", mySnookerOn(user) ? "Your own page: the teams and players you follow" : "Switched off — press to switch it on")}
      ${isMember(user) && !isPlainPlayer(user) ? link("/my", ICON.team, "My Team", "Scorecards, fixtures and your team") : ""}
      ${isStaff(user) ? link("/admin", ICON.admin, "Admin dashboard", "Everything your role looks after") : ""}
      ${link("/my/snooker", ICON.cog, "My Snooker settings", "Who you follow, what you see and where")}
      ${p.player_id ? link("/my/profile", ICON.team, "My profile", "Your photo, bio and CueView") : ""}
      ${link("/my/details", ICON.key, "Password & details")}
    </nav>
    ${installBlock()}
    <button type="button" class="drawer-logout" data-logout>${ICON.out}<span>Log out</span></button>`);
  wireInstall(el);
  // (Log out itself is handled in main.js, like every other log out button.)
  $("[data-logout]", el).addEventListener("click", () => closeDrawer());
}
export const initials = (name) => String(name ?? "").trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

// ── the bell: which notifications ──────────────────────────────
export function openNotifications({ onChange = () => {} } = {}) {
  const row = (key, label, help, on, disabled = false) => html`<label class="switch-row ${disabled ? "is-off" : ""}">
    <span><b>${label}</b><small>${help}</small></span>
    <input type="checkbox" data-kind="${key}" ${on ? "checked" : ""} ${disabled ? "disabled" : ""}><span class="ms-slider" aria-hidden="true"></span></label>`;
  const body = () => { const all = notificationsOn(), prefs = notifyPrefs();
    return html`
      <p class="drawer-lead">Choose what pops up while you are on the website. Your choices are remembered on this phone or computer.</p>
      <div class="switch-list">${row("all", "Live notifications", "The green pop-ups in the corner. Switch this off to stop them all.", all)}</div>
      <h3 class="drawer-h">What you want to hear about</h3>
      <div class="switch-list">${NOTIFY_KINDS.filter(([key]) => key !== "confetti").map(([key, label, help]) => row(key, label, help, prefs[key], !all))}</div>
      <h3 class="drawer-h">Celebrations</h3>
      <div class="switch-list">${NOTIFY_KINDS.filter(([key]) => key === "confetti").map(([key, label, help]) => row(key, label, help, prefs[key]))}</div>`; };
  const el = drawer("notify", "Notifications", html`<div data-notify>${body()}</div>`);
  el.addEventListener("change", (e) => {
    const kind = e.target.dataset?.kind;
    if (!kind) return;
    if (kind === "all") { setNotifications(e.target.checked); toast(e.target.checked ? "Live notifications on" : "Live notifications off"); }
    else setNotifyPref(kind, e.target.checked);
    mount($("[data-notify]", el), body());
    onChange();
  });
}

// ── add to home screen ─────────────────────────────────────────
// Android and desktop Chrome offer an install prompt (kept here until someone asks for it);
// on an iPhone or iPad it is done from the Share button, so we show how.
let installEvent = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; });
  window.addEventListener("appinstalled", () => { installEvent = null; });
}
const isStandalone = () => (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const isApple = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function installBlock() {
  if (isStandalone()) return "";
  return html`<div class="drawer-install">
    <button type="button" class="drawer-link as-btn" data-install><span class="drawer-ico">${ICON.phone}</span><span><b>Add to your home screen</b><small>Open the website like an app, straight from your phone's home screen</small></span>${ICON.go}</button>
    <div class="install-how" data-install-how hidden></div></div>`;
}
function wireInstall(el) {
  $("[data-install]", el)?.addEventListener("click", async () => {
    if (installEvent) {
      installEvent.prompt();
      const choice = await installEvent.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") { installEvent = null; toast("Added to your home screen"); }
      return;
    }
    const how = $("[data-install-how]", el);
    mount(how, isApple()
      ? html`<ol><li>Press the <b>Share</b> button at the bottom of Safari (the square with an arrow pointing up).</li><li>Scroll down and choose <b>Add to Home Screen</b>.</li><li>Press <b>Add</b>.</li></ol>`
      : html`<ol><li>Open your browser's menu (the three dots, top right).</li><li>Choose <b>Add to Home screen</b> or <b>Install app</b>.</li><li>Press <b>Add</b> (or <b>Install</b>).</li></ol>`);
    how.hidden = !how.hidden;
  });
}
