// ─────────────────────────────────────────────────────────────
//  THE PHONE MENU, APP STYLE (round 111)
//  Rich: "Clicking the More button opens the nav … And then clicking any item
//  slides a new screen in with options within. Just want to make the mobile
//  version as app-like as possible."
//
//  "More" in the bottom bar opens a full-screen list (the bottom bar stays
//  under it). Each part of the site — Fixtures, League, Competitions, News —
//  is a row with ›; tapping it slides in a screen with that part's pages.
//  ‹ (or a swipe to the right) slides back. Pages that are just one page
//  (Home, Live) go straight there. The account is its own screen at the top.
//
//  It follows Admin → Website → Menu: the menu buttons are the rows, and each
//  extra "More" link goes under the part it belongs to (by its address), or
//  under "More pages" when it fits none of them.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$ } from "./dom.js";
import { isOutside } from "./menu.js";

/** Line icons (24 × 24, drawn with a 1.8 stroke) for each kind of page, picked by the address. */
const P = {
  home: "M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z",
  fixtures: "M4 6h16M4 12h16M4 18h10M18 16l2 2 3-4",
  league: "M4 5h16v14H4zM4 10h16M4 15h16M9 5v14",
  comps: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4",
  news: "M5 5h11v14H6a1 1 0 0 1-1-1zM16 9h3v9a1 1 0 0 1-1 1h-2M8 9h5M8 12h5M8 15h3",
  live: "M12 12h.01M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8",
  results: "M5 4h14v16H5zM8 9l2 2 4-4M8 15h8",
  calendar: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4M9 14h2M13 14h2",
  scoreboard: "M3 6h18v11H3zM8 21h8M12 17v4M8 10v3M15 10h2v3h-2",
  handicaps: "M5 8h6M8 5v6M13 17h6M17 5 7 19",
  players: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  form: "M5 20V12M10 20V6M15 20v-9M20 20V4",
  wrapped: "M4 9h16v4H4zM5 13h14v7H5zM12 9v11M12 9c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1",
  seasons: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h3",
  market: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
  fame: "M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM9 14l-2 7 5-2.5 5 2.5-2-7",
  downloads: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14",
  venues: "M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  enter: "M5 19h4L19.5 8.5a2.1 2.1 0 0 0-3-3L6 16zM14.5 7.5l2 2",
  cueview: "M5 5h14v10H10l-4 4v-4H5z",
  rules: "M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM6 18a2 2 0 0 1 2-2h10",
  meetings: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19a5 5 0 0 1 10 0M11 19a5 5 0 0 1 10 0",
  star: "M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z",
  page: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  install: "M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM12 7v7M9.5 11.5 12 14l2.5-2.5M11 19h2",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  more: "M6 12h.01M12 12h.01M18 12h.01",
};
const ICON_FOR = [
  [/^\/$/, "home"], [/^\/fixtures/, "fixtures"], [/^\/league|^\/standings|^\/shield/, "league"], [/^\/competition|^\/draw/, "comps"],
  [/^\/news|^\/archive/, "news"], [/^\/live/, "live"], [/^\/results/, "results"], [/^\/calendar/, "calendar"], [/^\/scoreboard/, "scoreboard"],
  [/^\/handicap/, "handicaps"], [/^\/players|^\/player\/|^\/team/, "players"], [/^\/form/, "form"], [/^\/wrapped|^\/season-review/, "wrapped"],
  [/^\/seasons/, "seasons"], [/^\/market|^\/merch/, "market"], [/^\/hall-of-fame|^\/in-memoriam/, "fame"], [/^\/downloads/, "downloads"],
  [/^\/venue/, "venues"], [/^\/enter/, "enter"], [/^\/cueview/, "cueview"], [/^\/rules/, "rules"], [/^\/meetings/, "meetings"],
  [/^\/presentation|^\/sponsor/, "star"],
];
export const lineIcon = (key, size = 24) => html`<svg class="sbm__ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[key] ?? P.page}"/></svg>`;
const iconFor = (href) => (ICON_FOR.find(([re]) => re.test(href)) ?? [, "page"])[1];
const chev = html`<svg class="sbm__chev" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;
const back = html`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>`;
const cross = html`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

/** The pages that belong under each part of the site (the part's own page is added first, as "All …"). */
const FAMILIES = [
  { match: /^\/fixtures/, pages: [["Results", "/results"], ["Calendar", "/calendar"], ["Live scores", "/live"], ["Live scoreboard", "/scoreboard"], ["Venues", "/venues"]], also: /^\/(results|calendar|scoreboard|venue)/ },
  { match: /^\/league/, pages: [["Handicaps", "/handicaps"], ["Form guide", "/form"], ["Our Players", "/players"], ["Seasons", "/seasons"], ["Rules", "/rules"]], also: /^\/(handicap|form|players|seasons|rules|standings|shield)/ },
  { match: /^\/competitions/, pages: [["Enter a competition", "/enter"], ["Hall of Fame", "/hall-of-fame"], ["Presentation night", "/presentation"]], also: /^\/(enter|hall-of-fame|presentation|competition|draw)/ },
  { match: /^\/news/, pages: [["CueViews", "/cueview"], ["Season wrapped", "/wrapped"], ["Downloads", "/downloads"], ["Meetings", "/meetings"]], also: /^\/(cueview|wrapped|season-review|downloads|meetings|archive|in-memoriam)/ },
];
const ALL_WORD = { "/fixtures": "All fixtures", "/league": "League tables", "/competitions": "All competitions", "/news": "All the news" };

/**
 * The menu's markup. `menu` = the menu buttons (Admin → Website → Menu), `more` = the extra links,
 * `acct` = the account rows (already drawn), `extras` = { socials, installable, noLogin, brand }.
 */
export function appMenu({ menu, more, user, name = "", role = "", initials = "", acct = "", logoutIcon = "", socials = [], installable = false, noLogin = false, navSection = () => "" }) {
  // Which extra links go under which part; the rest under "More pages".
  const used = new Set();
  const screens = [];
  const rows = menu.map((item) => {
    const fam = FAMILIES.find((f) => f.match.test(item.href));
    const link = (cls = "") => html`<a class="sbm__row ${cls} ${item.color === "live" ? "sbm__row--live state-idle" : ""}" ${item.color === "live" ? html`data-live-btn` : ""} data-nav-section="${navSection(item.href)}" href="${item.href}" ${isOutside(item.href) ? html`target="_blank" rel="noopener"` : ""}>
        <span class="sbm__icowrap">${lineIcon(iconFor(item.href))}</span><span class="sbm__label">${item.label}</span></a>`;
    if (!fam) return link();
    // The standard pages of this part, plus any extra link (from Admin) that belongs here; skip any the admin removed from More.
    const extra = more.filter((l) => fam.also.test(l.href) && !used.has(l.href));
    const std = fam.pages.filter(([, h]) => !extra.some((l) => l.href === h) && !menu.some((m) => m.href === h));
    const list = [...extra.map((l) => [l.label, l.href]), ...std].filter(([, h], i, a) => a.findIndex(([, x]) => x === h) === i);
    for (const [, h] of list) used.add(h);
    const id = `p${screens.length}`;
    screens.push(html`<section class="sbm__screen" data-sbm-screen="${id}" aria-label="${item.label}" hidden>
      <div class="sbm__head sbm__head--sub"><button type="button" class="sbm__back" data-sbm-back aria-label="Back to the menu">${back}</button><h2>${item.label}</h2>
        <button type="button" class="sbm__btn" data-menu-close aria-label="Close the menu">${cross}</button></div>
      <nav class="sbm__list" aria-label="${item.label}">
        <a class="sbm__row" href="${item.href}" data-nav-section="${navSection(item.href)}"><span class="sbm__icowrap">${lineIcon(iconFor(item.href))}</span><span class="sbm__label">${ALL_WORD[item.href] ?? item.label}</span></a>
        ${list.map(([label, href]) => html`<a class="sbm__row" href="${href}" ${isOutside(href) ? html`target="_blank" rel="noopener"` : ""}><span class="sbm__icowrap">${lineIcon(iconFor(href))}</span><span class="sbm__label">${label}</span></a>`)}
      </nav></section>`);
    return html`<button type="button" class="sbm__row" data-sbm-go="${id}" data-nav-section="${navSection(item.href)}"><span class="sbm__icowrap">${lineIcon(iconFor(item.href))}</span><span class="sbm__label">${item.label}</span>${chev}</button>`;
  });
  const leftovers = more.filter((l) => !used.has(l.href) && !menu.some((m) => m.href === l.href));

  return html`<div class="sbd sbm" data-menu>
    <div class="sbd__scrim" data-menu-close aria-hidden="true"></div>
    <div class="sbd__panel sbm__panel" role="dialog" aria-modal="true" aria-label="Menu">
      <section class="sbm__screen is-on" data-sbm-screen="root" aria-label="Menu">
        <div class="sbm__head"><h2>More</h2>
          <button type="button" class="sbm__btn" data-search-open aria-label="Search">${lineIcon("search")}</button>
          <button type="button" class="sbm__btn" data-menu-close aria-label="Close the menu">${cross}</button></div>
        ${user ? html`<button type="button" class="sbm__me" data-sbm-go="acct"><span class="sbm__initials">${initials}</span><span class="sbm__who"><b>${name}</b><small>${role} · your account</small></span>${chev}</button>`
          : noLogin ? "" : html`<button type="button" class="sbm__login" data-account-open>Log in or create an account</button>`}
        <nav class="sbm__list" aria-label="Main menu">${rows}</nav>
        ${leftovers.length ? html`<p class="sbm__group">More pages</p>
          <nav class="sbm__list" aria-label="More pages">${leftovers.map((l) => html`<a class="sbm__row" href="${l.href}" ${isOutside(l.href) ? html`target="_blank" rel="noopener"` : ""}><span class="sbm__icowrap">${lineIcon(iconFor(l.href))}</span><span class="sbm__label">${l.label}</span></a>`)}</nav>` : ""}
        <p class="sbm__group">Settings</p>
        <div class="sbm__list">
          <button type="button" class="sbm__row" data-bell><span class="sbm__icowrap">${lineIcon("bell")}</span><span class="sbm__label">Notifications</span></button>
          ${installable ? html`<button type="button" class="sbm__row" data-install-app><span class="sbm__icowrap">${lineIcon("install")}</span><span class="sbm__label">Add to home screen</span></button>` : ""}
        </div>
        ${socials.length ? html`<div class="sbd__social sbm__social">${socials}</div>` : ""}
      </section>
      ${screens}
      ${user ? html`<section class="sbm__screen" data-sbm-screen="acct" data-menu-acct aria-label="Your account" hidden>
        <div class="sbm__head sbm__head--sub"><button type="button" class="sbm__back" data-sbm-back aria-label="Back to the menu">${back}</button><h2>Your account</h2>
          <button type="button" class="sbm__btn" data-menu-close aria-label="Close the menu">${cross}</button></div>
        <div class="sbm__acct">${acct}
          <button type="button" class="acct-item acct-out" data-logout><span class="acct-ico">${logoutIcon}</span><span><b>Log out</b></span></button></div>
      </section>` : ""}
    </div>
  </div>`;
}

// ── Sliding between the screens ─────────────────────────────────
const panel = () => $(".sbm__panel");
let current = "root";
const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Slide to a screen ("root", "acct" or a part of the site). */
export function sbmGo(id, { instant = false } = {}) {
  const box = panel(); if (!box) return;
  const from = $(`[data-sbm-screen="${current}"]`, box), to = $(`[data-sbm-screen="${id}"]`, box);
  if (!to || to === from) return;
  const forward = id !== "root";
  to.hidden = false;
  to.classList.remove("is-on", "is-left", "is-right");
  to.classList.add(forward ? "is-right" : "is-left");
  if (instant || reduce()) {
    to.classList.remove("is-right", "is-left"); to.classList.add("is-on");
    if (from) { from.classList.remove("is-on"); from.hidden = true; }
  } else {
    void to.offsetWidth;                                   // start from the side…
    to.classList.add("sbm--anim"); from?.classList.add("sbm--anim");
    to.classList.remove("is-right", "is-left"); to.classList.add("is-on");
    if (from) { from.classList.remove("is-on"); from.classList.add(forward ? "is-left" : "is-right"); }
    const done = () => { from?.classList.remove("sbm--anim", "is-left", "is-right"); to.classList.remove("sbm--anim"); if (from && current !== from.dataset.sbmScreen) from.hidden = true; };
    setTimeout(done, 340);
  }
  current = id;
  to.scrollTop = 0;
  requestAnimationFrame(() => $(forward ? ".sbm__back" : `[data-sbm-go]`, to)?.focus({ preventScroll: true }));
}
/** Back to the first screen at once (when the menu closes). */
export function sbmReset() {
  const box = panel(); if (!box) return;
  for (const s of $$("[data-sbm-screen]", box)) { const root = s.dataset.sbmScreen === "root"; s.hidden = !root; s.classList.toggle("is-on", root); s.classList.remove("is-left", "is-right", "sbm--anim"); }
  current = "root";
}

let wired = false;
/** Taps on › and ‹, and a swipe to the right to go back (once, for the whole site). */
export function wireAppMenu() {
  if (wired) return; wired = true;
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-sbm-go]"); if (go) { e.preventDefault(); return sbmGo(go.dataset.sbmGo); }
    if (e.target.closest("[data-sbm-back]")) { e.preventDefault(); return sbmGo("root"); }
  });
  let sx = 0, sy = 0, track = false;
  document.addEventListener("touchstart", (e) => { if (!e.target.closest(".sbm__panel") || current === "root") return; const t = e.touches[0]; sx = t.clientX; sy = t.clientY; track = true; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!track) return; track = false;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dx > 70 && dy < 50) sbmGo("root");
  }, { passive: true });
}
