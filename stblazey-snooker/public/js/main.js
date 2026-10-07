// ─────────────────────────────────────────────────────────────
//  APP SHELL — draws the header, footer and sponsors once, then
//  shows the right page for the current URL. Every page lives in
//  js/pages/ and is loaded only when it's needed.
// ─────────────────────────────────────────────────────────────
import { SITE, DEMO_MODE } from "./config.js";
import { html, mount, $, ukDay, toast } from "./core/dom.js";
import { applyBranding, loaderOn, loaderOff, layoutFor, TICKER_PX } from "./core/branding.js";
import { getUser, signOut, isStaff, isMember, canOpenSection, roleText } from "./core/auth.js";
import { seasonContext, sideBoxData } from "./core/context.js";
import { sidebar } from "./core/components.js";
import { openSearch } from "./core/search.js";
import { table, invalidate, settings, nearbyMatches, subscribe, trackPageView, articles, liveMatches } from "./core/api.js";
import { liveState } from "./core/rules.js";
import { notificationsOn, setNotifications, startNotifications } from "./core/notify.js";
import { urls } from "./core/components.js";
import { setNavigator, setShellRefresher, takeEditTarget } from "./core/router.js";

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
  ["/shield/:slug", "shield"],
  ["/archive", "archive"],
  ["/enter", "enter"],
  ["/draw/:slug", "draw"],
  ["/handicaps", "handicaps"],
  ["/player/:id", "player"],
  ["/competition/:slug", "competition"],
  ["/live", "live"],
  ["/results", "results"],
  ["/presentation", "presentation"],
  ["/season-review", "presentation"],
  ["/in-memoriam", "memoriam"],
  ["/meetings", "meetings"],
  ["/rules", "rules"],
  ["/sponsor/:slug", "sponsor"],
  ["/scoreboard", "scoreboard"],
  ["/scoreboard/:id", "scoreboard"],
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

// Which part of the site each page belongs to. Its headers take that menu button's colour
// (Admin → Branding → "Colour-code each section").
const SECTION = {
  competitions: "competitions", competition: "competitions", "cup-match": "competitions", handicaps: "competitions", enter: "competitions", draw: "competitions", scoreboard: "competitions",
  fixtures: "fixtures", team: "fixtures", match: "fixtures", calendar: "fixtures", live: "fixtures", results: "fixtures",
  league: "league", standings: "league", shield: "league", archive: "league", players: "league", player: "league",
  venues: "league", venue: "league", page: "league", presentation: "league", memoriam: "league", meetings: "league", rules: "league", sponsor: "league",
  news: "news", article: "news",
  login: "login", my: "login", scorecard: "login", "cup-scorecard": "login",
};
// Page layout (Admin → Branding → Page layout) is chosen for these parts of the site.
const LAYOUT_GROUP = (page) => (page === "home" ? "home" : ["competitions", "fixtures", "league", "news"].includes(SECTION[page]) ? SECTION[page] : null);
// Pages that never get the standard side boxes added (they need the full width, or are a short form).
const NO_SIDE = new Set(["calendar", "enter", "draw", "not-found", "scoreboard", "presentation"]);

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
const logoutIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5Zm6.6 4.6-1.4 1.4 2 2H9v2h8.2l-2 2 1.4 1.4L21 12Z"/></svg>`;

/** Recolour the LIVE button (orange "LIVE SOON" an hour before, green while matches are on). */
async function refreshLive() {
  const [{ fixtures, comps }, competitions, boards] = await Promise.all([
    nearbyMatches(36).catch(() => ({ fixtures: [], comps: [] })), table("competitions", "sort").catch(() => []), liveMatches().catch(() => [])]);
  // A match being scored ball by ball counts as well.
  const scored = boards.filter((m) => m.status === "live" || (m.status === "setup" && m.starts_at))
    .map((m) => ({ starts_at: m.started_at ?? m.starts_at, status: m.status === "live" ? "in_progress" : "scheduled" }));
  // A competition draw counts too: "live soon" before it, "live" while it's being made.
  const draws = competitions.filter((c) => c.draw_live?.status === "live" || (!c.draw_live && c.draw_at))
    .map((c) => ({ starts_at: c.draw_live?.started_at ?? c.draw_at, status: c.draw_live ? "in_progress" : "scheduled" }));
  const state = liveState([...fixtures, ...comps, ...draws, ...scored], Date.now(), ukDay);
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
  applyBranding(site);
  // Officers get the Admin button; anyone linked to a team or player gets My Team (some people have both).
  // Under it, very small: who is logged in and their club.
  const staff = isStaff(user), member = isMember(user);
  const club = user?.profile?.team_id ? (await table("teams", "name").catch(() => [])).find((t) => t.id === user.profile.team_id)?.name : "";
  const who = user ? [...new Set([user.profile?.full_name || user.email, club || (member ? "" : roleText(user.profile))].filter(Boolean))].join(" · ") : "";
  const tagged = (label) => html`<span class="nav-who"><b>${label}</b><small>${who}</small></span>`;
  const account = !user ? html`<a class="nav-login" href="/login">Login</a>`
    : html`${staff ? html`<a class="nav-login" href="/admin">${member ? "Admin" : tagged("Admin")}</a>` : ""}${member ? html`<a class="nav-login nav-my" href="/my">${tagged("My Team")}</a>` : ""}`;
  mount($("#site-header"), html`
    ${DEMO_MODE ? html`<div class="demo-banner">Demo mode — sample data saved in this browser only. Add your Supabase keys in js/config.js to go live.</div>` : ""}
    <header class="site-header"><div class="wrap">
      <a class="logo" href="/" aria-label="${SITE.name} home"><img src="${site.logo_url || "/assets/logo.svg"}" alt="${SITE.name}"></a>
      <button class="nav-search-m" data-search-open aria-label="Search">${searchIcon}</button>
      <button class="nav-toggle" aria-expanded="false">Menu</button>
      <nav class="main-nav ${user ? (staff && member ? "tight-2" : "tight") : ""}">
        <a class="nav-home" href="/">Home</a>
        <a class="nav-comps" href="/competitions">Competitions</a>
        <a class="nav-fixtures" href="/fixtures">Fixtures</a>
        <a class="nav-league" href="/league">League</a>
        <a class="nav-news" href="/news">News</a>
        ${account}
        <a class="nav-live nav-live-btn state-idle" href="/live">Live</a>
        <button class="nav-live nav-bell" data-bell aria-label="Live notifications">${bell}</button>
        <button class="nav-live nav-search" data-search-open aria-label="Search">${searchIcon}<span>Search</span></button>
        ${user ? html`<button class="nav-live nav-logout" data-logout aria-label="Log out" title="Log out">${logoutIcon}<span>Log out</span></button>` : ""}
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
      <div class="sponsors">${sponsors.map((s) => html`<a href="${urls.sponsor(s)}" title="About ${s.name}">${s.image_url ? html`<img src="${s.image_url}" alt="${s.name}">` : s.name}</a>`)}</div>` : ""}
    <h3 class="foot-h">#SBDS</h3>
    ${socials.length ? html`<div class="socials">${socials.map(([key, name, icon]) => html`<a href="${site[key]}" target="_blank" rel="noopener" aria-label="${name}" title="${name}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></a>`)}</div>` : ""}
    ${links.length ? html`<nav class="foot-links" aria-label="Footer">${links.map((p) => html`<a href="/page/${p.slug}">${p.title}</a>`)}</nav>` : ""}
    <p class="foot-copy">© ${new Date().getFullYear()} ${SITE.copyright ?? "St Blazey and District Snooker"}${SITE.credit?.text ? html` · <a href="${SITE.credit.url}">${SITE.credit.text}</a>` : ""}</p>
  </div></footer>`);
}

// ── announcements ticker (home page only) ──────────────────────
async function drawTicker(show) {
  const box = $("#ticker");
  if (!show) return mount(box, "");
  const [site, rows] = await Promise.all([settings(), table("announcements", "sort").catch(() => [])]);
  const today = ukDay(new Date().toISOString());
  const items = rows.filter((a) => a.is_active !== false && a.text && (!a.starts_on || a.starts_on <= today) && (!a.ends_on || a.ends_on >= today));
  if (site.ticker_show === false || !items.length) return mount(box, "");
  const one = (a) => (a.url ? html`<a class="ticker-item" href="${a.url}" ${/^https?:/.test(a.url) ? html`target="_blank" rel="noopener"` : ""}>${a.text}<i>→</i></a>` : html`<span class="ticker-item">${a.text}</span>`);
  // The list is written twice so the loop has no gap; the copy is hidden from screen readers.
  mount(box, html`<div class="ticker" role="region" aria-label="Announcements">
    <span class="ticker-label">Announcements</span>
    <div class="ticker-view"><div class="ticker-track">
      <div class="ticker-set">${items.map(one)}</div><div class="ticker-set" aria-hidden="true">${items.map(one)}</div></div></div>
    <button type="button" class="ticker-stop" data-ticker-stop aria-pressed="false" aria-label="Stop the announcements moving" title="Stop / start"><span></span></button>
  </div>`);
  // The speed is set from how wide the announcements really are, so a short list doesn't race across a wide screen.
  const track = $(".ticker-track", box), pace = Math.max(1, Math.min(10, Math.round(Number(site.ticker_pace) || 3)));
  const setPace = () => { track.style.animationDuration = `${Math.max(8, Math.round($(".ticker-set", box).getBoundingClientRect().width / TICKER_PX[pace - 1]))}s`; };
  setPace();
  document.fonts?.ready.then(() => track.isConnected && setPace());
}

/**
 * Page layout for this part of the site: as designed, a right sidebar on every page, or full width.
 * Pages that already have side boxes are handled by the stylesheet; a page without any gets the
 * standard ones (latest results, breaks, rankings) in the #side column next to it.
 */
async function applyLayout(view, page) {
  const shell = $("#shell"), side = $("#side");
  const group = LAYOUT_GROUP(page);
  const mode = group ? layoutFor(group) : "auto";
  view.dataset.layout = mode;
  const add = mode === "sidebar" && !NO_SIDE.has(page) && !view.querySelector(".layout > .sidebar, .layout > aside");
  shell.classList.toggle("has-side", add);
  if (!add) return mount(side, "");
  const [ctx, news, box] = await Promise.all([seasonContext(), articles(), sideBoxData()]);
  mount(side, sidebar(ctx, news, { box }));
}

/** Maintenance mode (Admin → Site settings): visitors see a holding page, anyone logged in sees the site. */
function holdingPage(view, site) {
  view.classList.add("flush");
  mount(view, html`<div class="holding"><img src="${site.logo_url || "/assets/logo.svg"}" alt="">
    <h1>${SITE.name}</h1>
    <p>${site.maintenance_text || "We're making a few improvements to the website. Please check back shortly."}</p>
    <a class="btn ghost" href="/login">Officer and captain login</a></div>`);
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
  document.querySelector(".edit-page")?.remove();
  const view = $("#view");
  view.className = "";
  $(".main-nav")?.classList.remove("open");
  const { page, params } = match(location.pathname);
  view.dataset.section = SECTION[page] ?? "";
  mount(view, "");
  mount($("#side"), ""); $("#shell").classList.remove("has-side");
  loaderOn();   // the black loading screen appears only if this takes more than a moment
  trackPageView(location.pathname);
  try {
    const [mod, user, site] = await Promise.all([import(`./pages/${page}.js`), getUser(), settings()]);
    document.body.classList.toggle("maintenance", !!site.maintenance_on && !user);
    drawTicker(page === "home" && !(site.maintenance_on && !user));
    if (site.maintenance_on && !user && page !== "login") return holdingPage(view, site);
    takeEditTarget();
    cleanup = await mod.default(view, { params, user, query: new URLSearchParams(location.search) });
    await applyLayout(view, page);
    drawEditButton(user, page);
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    mount(view, html`<div class="wrap"><div class="notice error">Something went wrong: ${err.message}</div></div>`);
  } finally { loaderOff(); }
}

/** Admins and officers get an "Edit this page" button that opens the right part of the dashboard. */
function drawEditButton(user, page) {
  document.querySelector(".edit-page")?.remove();
  const target = takeEditTarget();
  if (!target || !user || ["admin", "scorecard", "cup-scorecard", "login", "my"].includes(page) || !canOpenSection(user, target.section)) return;
  const a = document.createElement("a");
  a.className = "edit-page";
  a.href = target.href;
  mount(a, html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.2V21h3.8L17.9 9.9l-3.8-3.8Zm17.7-10.4a1 1 0 0 0 0-1.4l-2.1-2.1a1 1 0 0 0-1.4 0l-1.7 1.7 3.8 3.8Z"/></svg><span>${target.label ?? "Edit this page"}</span>`);
  document.body.append(a);
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
  if (e.target.closest("[data-to-top]")) return window.scrollTo({ top: 0, behavior: "smooth" });
  const stop = e.target.closest("[data-ticker-stop]");
  if (stop) {
    const paused = stop.closest(".ticker").classList.toggle("paused");
    stop.setAttribute("aria-pressed", String(paused));
    stop.setAttribute("aria-label", paused ? "Start the announcements moving again" : "Stop the announcements moving");
    return;
  }
  const shot = e.target.closest("[data-lightbox]");
  if (shot) return openLightbox(shot.dataset.lightbox);
  if (e.target.closest("[data-search-open]")) { $(".main-nav")?.classList.remove("open"); return openSearch(); }
  if (e.target.closest("[data-bell]")) {
    const on = !notificationsOn();
    setNotifications(on);
    drawBell();
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

// Phones: a "back to top" button once you've scrolled down a screen or so.
const toTop = document.createElement("button");
toTop.type = "button";
toTop.className = "to-top";
toTop.dataset.toTop = "";
toTop.setAttribute("aria-label", "Back to top");
mount(toTop, html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.5 5 14.4l1.4 1.4L12 10.3l5.6 5.5L19 14.4Z"/></svg><span>Top</span>`);
document.body.append(toTop);
window.addEventListener("scroll", () => toTop.classList.toggle("show", window.scrollY > 500), { passive: true });

// Keep the LIVE button current: every minute, and whenever a match changes.
setInterval(refreshLive, 60e3);
subscribe(["fixtures", "competition_matches", "competitions", "live_matches"], refreshLive);
// Always listening: the pop-ups obey the bell, the highest-break celebration obeys Admin → Site settings.
startNotifications();

