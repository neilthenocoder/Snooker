// ─────────────────────────────────────────────────────────────
//  APP SHELL — draws the header, footer and sponsors once, then
//  shows the right page for the current URL. Every page lives in
//  js/pages/ and is loaded only when it's needed.
// ─────────────────────────────────────────────────────────────
import { SITE, DEMO_MODE } from "./config.js";
import { html, mount, $, ukDay, toast, LOADING } from "./core/dom.js";
import { getUser, signOut, isAdmin, isMember } from "./core/auth.js";
import { openSearch } from "./core/search.js";
import { table, invalidate, settings, nearbyMatches, subscribe, trackPageView } from "./core/api.js";
import { liveState } from "./core/rules.js";
import { notificationsOn, setNotifications, startNotifications, stopNotifications } from "./core/notify.js";
import { setNavigator, setShellRefresher } from "./core/router.js";

const ROUTES = [
  ["/", "home"],
  ["/fixtures", "fixtures"],
  ["/team/:slug", "team"],
  ["/match/:id", "match"],
  ["/venues", "venues"],
  ["/venue/:slug", "venue"],
  ["/league", "league"],
  ["/news", "news"],
  ["/news/:slug", "article"],
  ["/competitions", "competitions"],
  ["/standings/:slug", "standings"],
  ["/handicaps", "handicaps"],
  ["/player/:id", "player"],
  ["/competition/:slug", "competition"],
  ["/live", "live"],
  ["/calendar", "calendar"],
  ["/cup-match/:id", "cup-match"],
  ["/cup-scorecard/:id", "cup-scorecard"],
  ["/page/:slug", "page"],
  ["/login", "login"],
  ["/my", "my"],
  ["/my/:tab", "my"],
  ["/captain", "my"],
  ["/players", "players"],
  ["/scorecard/:id", "scorecard"],
  ["/admin", "admin"],
  ["/admin/:section", "admin"],
];

function match(path) {
  const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
  for (const [pattern, page] of ROUTES) {
    const pp = pattern.split("/").filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    if (pp.every((p, i) => (p.startsWith(":") ? (params[p.slice(1)] = decodeURIComponent(parts[i])) : p === parts[i])))
      return { page, params };
  }
  return { page: "not-found", params: {} };
}

// ── shell ──────────────────────────────────────────────────────
const bell = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1Z"/><path class="slash" d="M3.3 2.3 21.7 20.7l-1.4 1.4L1.9 3.7Z"/></svg>`;
const searchIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/></svg>`;
// Footer social icons: [settings field, name, icon]
const SOCIAL = [
  ["facebook_url", "Facebook", html`<path d="M14 8V6.5c0-.8.2-1.2 1.3-1.2H17V2.2c-.3 0-1.3-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2V8H8v3.2h2.5V22H14V11.2h2.7l.4-3.2Z"/>`],
  ["x_url", "X", html`<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8Zm-1.1 16.2h1.7L7.4 4.7H5.6Z"/>`],
  ["instagram_url", "Instagram", html`<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2"/>`],
  ["youtube_url", "YouTube", html`<path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3Z"/>`],
];
const LIVE_LABEL = { live: "Live", soon: "Live soon", idle: "Live" };

/** Recolour the LIVE button (orange "LIVE SOON" an hour before, green while matches are on). */
async function refreshLive() {
  const { fixtures, comps } = await nearbyMatches(36).catch(() => ({ fixtures: [], comps: [] }));
  const state = liveState([...fixtures, ...comps], Date.now(), ukDay);
  const btn = $(".nav-live-btn");
  if (!btn) return;
  btn.className = `nav-live nav-live-btn state-${state}`;
  btn.textContent = LIVE_LABEL[state];
}

function drawBell() {
  const on = notificationsOn();
  const b = $("[data-bell]");
  if (!b) return;
  b.classList.toggle("off", !on);
  b.title = on ? "Live notifications are on — click to turn off" : "Live notifications are off — click to turn on";
  b.setAttribute("aria-pressed", String(on));
}

async function drawHeader() {
  const [user, site] = await Promise.all([getUser(), settings()]);
  const account = isAdmin(user)
    ? html`<a class="nav-login" href="/admin">Admin</a>`
    : isMember(user) ? html`<a class="nav-login" href="/my">My Team</a>` : html`<a class="nav-login" href="/login">Login</a>`;
  mount($("#site-header"), html`
    ${DEMO_MODE ? html`<div class="demo-banner">Demo mode — sample data saved in this browser only. Add your Supabase keys in js/config.js to go live.</div>` : ""}
    <header class="site-header"><div class="wrap">
      <a class="logo" href="/" aria-label="${SITE.name} home"><img src="${site.logo_url || "/assets/logo.svg"}" alt="${SITE.name}"></a>
      <button class="nav-search-m" data-search-open aria-label="Search">${searchIcon}</button>
      <button class="nav-toggle" aria-expanded="false">Menu</button>
      <nav class="main-nav">
        <a class="nav-home" href="/">Home</a>
        <a class="nav-comps" href="/competitions">Competitions</a>
        <a class="nav-fixtures" href="/fixtures">Fixtures</a>
        <a class="nav-league" href="/league">League</a>
        ${account}
        ${user ? html`<button class="nav-live" data-logout>Logout</button>` : ""}
        <a class="nav-live nav-live-btn state-idle" href="/live">Live</a>
        <button class="nav-live nav-bell" data-bell aria-label="Live notifications">${bell}</button>
        <button class="nav-live nav-search" data-search-open aria-label="Search">${searchIcon}<span>Search</span></button>
      </nav>
    </div></header>`);
  const icon = document.querySelector("link[rel=icon]");
  if (icon) icon.href = site.favicon_url || "/assets/logo.svg";
  drawBell();
  refreshLive();
}

async function drawFooter() {
  const [sponsors, pages, site] = await Promise.all([
    table("sponsors", "sort").catch(() => []), table("pages", "sort").catch(() => []), settings(),
  ]);
  const socials = SOCIAL.filter(([key]) => site[key]);
  const links = pages.filter((p) => p.show_in_footer);
  mount($("#site-footer"), html`<footer class="site-footer"><div class="wrap">
    ${sponsors.length ? html`<h3 class="foot-h">Principal Partners</h3>
      <div class="sponsors">${sponsors.map((s) => html`<a href="${s.url || "#"}" ${s.url ? html`target="_blank" rel="noopener"` : ""}>${s.image_url ? html`<img src="${s.image_url}" alt="${s.name}">` : s.name}</a>`)}</div>` : ""}
    <h3 class="foot-h">#SBDS</h3>
    ${socials.length ? html`<div class="socials">${socials.map(([key, name, icon]) => html`<a href="${site[key]}" target="_blank" rel="noopener" aria-label="${name}" title="${name}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></a>`)}</div>` : ""}
    ${links.length ? html`<nav class="foot-links" aria-label="Footer">${links.map((p) => html`<a href="/page/${p.slug}">${p.title}</a>`)}</nav>` : ""}
    <p class="foot-copy">© ${new Date().getFullYear()} ${SITE.copyright ?? "St Blazey and District Snooker"}${SITE.credit?.text ? html` · <a href="${SITE.credit.url}">${SITE.credit.text}</a>` : ""}</p>
  </div></footer>`);
}

// ── routing ────────────────────────────────────────────────────
let cleanup = null;

async function navigate(path, { replace = false } = {}) {
  if (path !== location.pathname + location.search + location.hash)
    history[replace ? "replaceState" : "pushState"](null, "", path);
  await renderRoute();
}

async function refreshShell() {
  invalidate();
  await Promise.all([drawHeader(), drawFooter()]);
}
setNavigator(navigate);
setShellRefresher(refreshShell);

async function renderRoute() {
  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  const view = $("#view");
  view.className = "";
  $(".main-nav")?.classList.remove("open");
  const { page, params } = match(location.pathname);
  mount(view, LOADING);
  trackPageView(location.pathname);
  try {
    const mod = await import(`./pages/${page}.js`);
    const user = await getUser();
    cleanup = await mod.default(view, { params, user, query: new URLSearchParams(location.search) });
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    mount(view, html`<div class="wrap"><div class="notice error">Something went wrong: ${err.message}</div></div>`);
  }
}

/** Full-size picture viewer for galleries. */
function openLightbox(url) {
  const dlg = document.createElement("dialog");
  dlg.className = "lightbox";
  mount(dlg, html`<img src="${url}" alt=""><button type="button" aria-label="Close">×</button>`);
  dlg.addEventListener("click", () => { dlg.close(); dlg.remove(); });
  document.body.append(dlg);
  dlg.showModal();
}

// Intercept clicks on internal links so pages switch without a full reload.
document.addEventListener("click", async (e) => {
  const a = e.target.closest("a[href]");
  if (e.target.closest("[data-logout]")) {
    await signOut(); await drawHeader(); return navigate("/");
  }
  if (e.target.closest(".nav-toggle")) { $(".main-nav").classList.toggle("open"); return; }
  const shot = e.target.closest("[data-lightbox]");
  if (shot) return openLightbox(shot.dataset.lightbox);
  if (e.target.closest("[data-search-open]")) { $(".main-nav")?.classList.remove("open"); return openSearch(); }
  if (e.target.closest("[data-bell]")) {
    const on = !notificationsOn();
    setNotifications(on);
    drawBell();
    if (on) startNotifications(); else stopNotifications();
    toast(on ? "Live notifications on" : "Live notifications off");
    return;
  }
  if (!a || a.target || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || /\.\w+$/.test(url.pathname)) return;
  if (url.pathname === location.pathname && url.hash) return;
  e.preventDefault();
  navigate(url.pathname + url.search + url.hash);
});
window.addEventListener("popstate", renderRoute);
document.addEventListener("change", (e) => {
  if (e.target.matches("[data-season-picker]")) navigate(`${location.pathname}?season=${e.target.value}`);
});

await Promise.all([drawHeader(), drawFooter()]);
renderRoute();

// Keep the LIVE button current: every minute, and whenever a match changes.
setInterval(refreshLive, 60e3);
subscribe(["fixtures", "competition_matches"], refreshLive);
if (notificationsOn()) startNotifications();

