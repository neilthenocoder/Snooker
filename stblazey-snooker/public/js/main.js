// ─────────────────────────────────────────────────────────────
//  APP SHELL — draws the header, footer and sponsors once, then
//  shows the right page for the current URL. Every page lives in
//  js/pages/ and is loaded only when it's needed.
// ─────────────────────────────────────────────────────────────
import { SITE, DEMO_MODE } from "./config.js";
import { html, mount, $ } from "./core/dom.js";
import { getUser, signOut, isAdmin, isCaptain } from "./core/auth.js";
import { table, invalidate } from "./core/api.js";
import { db, run } from "./core/db.js";
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
  ["/live", "live"],
  ["/page/:slug", "page"],
  ["/login", "login"],
  ["/captain", "captain"],
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
const bell = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1Z"/></svg>`;

async function drawHeader() {
  const user = await getUser();
  const live = await run(db.from("fixtures").select("id").eq("status", "in_progress").limit(1)).catch(() => []);
  const account = isAdmin(user)
    ? html`<a class="nav-login" href="/admin">Admin</a>`
    : isCaptain(user) ? html`<a class="nav-login" href="/captain">My Team</a>` : html`<a class="nav-login" href="/login">Login</a>`;
  mount($("#site-header"), html`
    ${DEMO_MODE ? html`<div class="demo-banner">Demo mode — sample data saved in this browser only. Add your Supabase keys in js/config.js to go live.</div>` : ""}
    <header class="site-header"><div class="wrap">
      <a class="logo" href="/" aria-label="${SITE.name} home"><img src="/assets/logo.svg" alt="${SITE.name}"></a>
      <button class="nav-toggle" aria-expanded="false">Menu</button>
      <nav class="main-nav">
        <a class="nav-home" href="/">Home</a>
        <a class="nav-comps" href="/competitions">Competitions</a>
        <a class="nav-fixtures" href="/fixtures">Fixtures</a>
        <a class="nav-league" href="/league">League</a>
        ${account}
        ${user ? html`<button class="nav-live" data-logout>Logout</button>` : ""}
        <a class="nav-live ${live.length ? "is-on" : ""}" href="/live">Live</a>
        <a class="nav-live nav-bell" href="/news" aria-label="Latest news">${bell}</a>
      </nav>
    </div></header>`);
}

async function drawFooter() {
  const sponsors = await table("sponsors", "sort").catch(() => []);
  mount($("#site-footer"), html`
    <div class="sponsors">${sponsors.map((s) => html`<a href="${s.url || "#"}" target="_blank" rel="noopener">${s.image_url ? html`<img src="${s.image_url}" alt="${s.name}">` : s.name}</a>`)}</div>
    <footer class="site-footer"><div class="wrap">
      <span>© ${new Date().getFullYear()} ${SITE.name} - Established ${SITE.established}</span>
      <a href="${SITE.credit.url}">${SITE.credit.text}</a>
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
  mount(view, html`<div class="loading">Loading…</div>`);
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

// Intercept clicks on internal links so pages switch without a full reload.
document.addEventListener("click", async (e) => {
  const a = e.target.closest("a[href]");
  if (e.target.closest("[data-logout]")) {
    await signOut(); await drawHeader(); return navigate("/");
  }
  if (e.target.closest(".nav-toggle")) { $(".main-nav").classList.toggle("open"); return; }
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey) return;
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

