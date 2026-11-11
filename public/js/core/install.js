// ─────────────────────────────────────────────────────────────
//  ADD TO HOME SCREEN (Rich & Neil, round 23: as easy as possible for everyone).
//  • Chrome, Edge, Samsung Internet (Android, Windows, Mac): one press — the browser's own
//    "Install" box opens straight away and the icon is added.
//  • iPhone / iPad: Apple doesn't let any website add itself, so the button opens a short
//    picture guide that matches the screens people will see (menu → Share → View More →
//    Add to Home Screen → Add).
//  • A small bar offers it by itself on phones (from the second page someone opens), and the
//    button is in the menu and in the My account panel. "Not now" hides the bar for 30 days.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast } from "./dom.js";
import { SITE } from "../config.js";

let promptEvent = null;
const listeners = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); promptEvent = e; listeners.forEach((fn) => fn()); });
  window.addEventListener("appinstalled", () => { promptEvent = null; markInstalled(); document.querySelector(".a2hs-bar")?.remove(); toast("Added to your home screen"); });
}
export const isStandalone = () => (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
export const isApple = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isPhone = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
/** Can it be shown at all? (Not inside the app itself, once added.) */
export const canInstall = () => !isStandalone();

const LATER_KEY = "sbds-a2hs-later", VIEWS_KEY = "sbds-a2hs-views", NEVER_KEY = "sbds-a2hs-never";
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } };
/**
 * Round 24: someone who has already added the website is never offered it again. Opening the home-screen app
 * remembers it (on Android the app and Chrome share this memory, so Chrome stops asking too); on iPhone the
 * app and Safari don't share it, so the bar also has "Don't show again".
 */
function markInstalled() { set(NEVER_KEY, "installed"); }
if (typeof window !== "undefined" && isStandalone()) markInstalled();

/** The one button everywhere calls this. */
export async function installApp() {
  if (isStandalone()) return toast("You're already using the home screen app");
  if (promptEvent) {
    const e = promptEvent;
    promptEvent = null;
    e.prompt();
    const choice = await e.userChoice.catch(() => null);
    document.querySelector(".a2hs-bar")?.remove();
    if (choice?.outcome !== "accepted") promptEvent = null;
    return;
  }
  guide();
}

const I = {
  menu: html`<svg viewBox="0 0 24 24"><path d="M4 6h16v2H4Zm0 5h16v2H4Zm0 5h16v2H4Z"/></svg>`,
  dots: html`<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
  share: html`<svg viewBox="0 0 24 24"><path d="M12 2 7.5 6.5l1.4 1.4L11 5.8V15h2V5.8l2.1 2.1 1.4-1.4ZM5 10h3v2H6v8h12v-8h-2v-2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1Z"/></svg>`,
  more: html`<svg viewBox="0 0 24 24"><path d="m12 15.5-6-6 1.4-1.4 4.6 4.6 4.6-4.6L18 9.5Z"/></svg>`,
  plus: html`<svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v14h14V5Zm6 3h2v3h3v2h-3v3h-2v-3H8v-2h3Z"/></svg>`,
};

/** The picture guide (iPhone, or a browser that can't do it in one press). */
function guide() {
  document.querySelector(".a2hs-guide")?.remove();
  const apple = isApple();
  const step = (n, icon, text) => html`<li><span class="a2hs-n">${n}</span><span class="a2hs-ico">${icon}</span><span>${text}</span></li>`;
  const el = document.createElement("div");
  el.className = `a2hs-guide ${apple ? "apple" : ""}`;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Add to your home screen");
  mount(el, html`<div class="a2hs-card">
    <button type="button" class="a2hs-x" aria-label="Close">×</button>
    <h2>Add ${SITE.name.replace(/ and District Snooker League$/, " Snooker")} to your home screen</h2>
    ${apple ? html`<p>Apple asks you to do this part yourself — it takes four taps:</p>
      <ol class="a2hs-steps">
        ${step(1, html`${I.dots}`, html`Tap the <b>•••</b> button (or <b>☰</b>) in the address bar at the bottom of the screen. <small>(At the top in Chrome on iPhone: the <b>Share</b> button.)</small>`)}
        ${step(2, I.share, html`Tap <b>Share</b>.`)}
        ${step(3, I.more, html`Tap <b>View More</b> (the round ⌄ button) to see the full list.`)}
        ${step(4, I.plus, html`Tap <b>Add to Home Screen</b>, then <b>Add</b>.`)}
      </ol>
      <p class="a2hs-small">The league's icon then sits on your home screen and opens the website like an app.</p>
      <div class="a2hs-point" aria-hidden="true">↓ The address bar is down here ↓</div>`
    : html`<ol class="a2hs-steps">
        ${step(1, I.dots, html`Open your browser's menu (the <b>⋮</b> or <b>•••</b> button).`)}
        ${step(2, I.plus, html`Choose <b>Add to Home screen</b> or <b>Install app</b>, then <b>Add</b> / <b>Install</b>.`)}
      </ol>
      <p class="a2hs-small">In Chrome, Edge or Samsung Internet this is done for you with one press of the button — if you're in another browser, open the website in one of those.</p>`}
    <button type="button" class="btn a2hs-ok">Got it</button></div>`);
  const close = () => el.remove();
  el.addEventListener("click", (e) => { if (e.target === el || e.target.closest(".a2hs-x, .a2hs-ok")) close(); });
  document.body.append(el);
  $(".a2hs-ok", el).focus({ preventScroll: true });
}

/** The small bar at the bottom of the screen on phones, offering it by itself. Called on every page. */
export function offerInstall() {
  if (!canInstall() || !isPhone() || get(NEVER_KEY) || document.querySelector(".a2hs-bar")) return;
  const later = Number(get(LATER_KEY) || 0);
  if (Date.now() < later) return;
  const views = Number(get(VIEWS_KEY) || 0) + 1;
  set(VIEWS_KEY, String(views));
  if (views < 2) return;                              // not on the very first page someone opens
  const show = () => {
    if (document.querySelector(".a2hs-bar") || document.querySelector(".pop-shade")) return;
    const bar = document.createElement("div");
    bar.className = "a2hs-bar";
    mount(bar, html`<span class="a2hs-bar-ico">${I.plus}</span><span><b>Get the app</b><small>Add the league to your home screen</small></span>
      <button type="button" class="btn small green" data-a2hs-add>${promptEvent ? "Add" : "Show me"}</button><button type="button" class="a2hs-later" aria-label="Not now" title="Not now">×</button>
      <button type="button" class="a2hs-never" data-a2hs-never>Already added? Don't show this again</button>`);
    bar.addEventListener("click", (e) => {
      if (e.target.closest("[data-a2hs-add]")) { bar.remove(); installApp(); }
      if (e.target.closest(".a2hs-later")) { bar.remove(); set(LATER_KEY, String(Date.now() + 30 * 864e5)); }
      if (e.target.closest("[data-a2hs-never]")) { bar.remove(); set(NEVER_KEY, "never"); toast("OK — we won't ask again on this phone"); }
    });
    document.body.append(bar);
  };
  setTimeout(show, 2500);
}
export const onInstallReady = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
