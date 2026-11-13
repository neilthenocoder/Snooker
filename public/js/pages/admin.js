import { html, mount, $, toast, readForm, fmtDate, fmtTime, fromLocalInput, toLocalInput, safeHref } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table, insertMany, setFixtureStatus, save, invalidate, signups, cueviewSubmissions, articleList } from "../core/api.js";
import { isStaff, isMaster, canOpenSection, isMember } from "../core/auth.js";
import { rearrangeBy, POSTPONE_WEEKS, isLiveNow } from "../core/rules.js";
import { resetDemo, databaseVersion, SCHEMA_VERSION } from "../core/db.js";
import { DEMO_MODE } from "../config.js";
import { roundRobin, addDays, londonISO } from "../core/schedule.js";
import { panel, dataTable, statusBadge, urls, breadcrumb } from "../core/components.js";
import { RESOURCES } from "../admin/resources.js";
import { crud } from "../admin/crud.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";
import { mustLogin } from "./scorecard.js";
import { draws } from "../admin/draws.js";
import { compWizardPage } from "../admin/comp-wizard.js";
import { seasonWizardPage } from "../admin/season-wizard.js";
import { mediaPage } from "../admin/picker.js";
import { statsPage } from "../admin/stats.js";
import { importPage } from "../admin/import.js";
import { handicapsPage } from "../admin/handicaps.js";
import { entriesPage } from "../admin/entries.js";
import { rolesPage } from "../admin/roles.js";
import { activityPage } from "../admin/activity.js";
import { backupPage } from "../admin/backup.js";
import { awardsPage } from "../admin/awards.js";
import { scoreboardPage } from "../admin/scoreboard.js";
import { emailsPage } from "../admin/emails.js";
import { newsWizardPage } from "../admin/news-wizard.js";
import { newsApprovePage, waitingNews } from "../admin/news-approve.js";
import { cueviewsPage } from "../admin/cueviews.js";
// Round 22
import { campaignsPage } from "../admin/newsletter.js";
import { subscribersPage } from "../admin/subscribers.js";
import { marketPage, waitingAds } from "../admin/market.js";
import { commentsPage } from "../admin/comments.js";
import { menuPage } from "../admin/menu.js";
import { seoPage } from "../admin/seo.js";
import { linksPage } from "../admin/links.js";
import { performancePage } from "../admin/performance.js";
import { securityPage } from "../admin/security.js";
import { versionsPage } from "../admin/versions.js";
import { SITE_VERSION } from "../core/release.js";
import { tonightPanel, needsYouPanel, recentChangesPanel } from "../admin/overview-plus.js";
import { freeDates } from "../admin/rearrange.js";
import { handicapSuggestPage } from "../admin/handicap-suggest.js";
import { supportPage, supportCategoriesPage, needsAnswer } from "../admin/support.js";
import { icon } from "../admin/icons.js";
const backIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 5.3 8 12l6.7 6.7 1.4-1.4L10.8 12l5.3-5.3Z"/></svg>`;

// Every page of the dashboard, in its group. Each login only sees the pages its role allows
// (see SECTION_AREA and canManage in core/auth.js — the database enforces the same).
const NAV = [
  ["Match nights", [["overview", "Overview"], ["results", "Results to approve"]]],
  ["Fixtures", [["season_wizard", "New season step by step"], ["fixtures", "All fixtures"], ["byes", "Bye weeks"], ["generator", "Fixture generator"], ["import", "Import from CSV"]]],
  ["League", [["leagues", "Leagues"], ["teams", "Teams"], ["players", "Players"], ["cueviews", "CueViews to approve"], ["handicaps", "Handicaps"], ["handicap_suggest", "Suggested handicaps"], ["venues", "Venues"], ["seasons", "Seasons"]]],
  ["Competitions", [["comp_wizard", "Set up step by step"], ["competitions", "Competitions"], ["entries", "Entries to approve"], ["draws", "Draws, results & live scores"], ["scoreboard", "Live scoreboard"], ["awards", "Presentation awards"], ["past_winners", "Past winners"]]],
  ["People", [["accounts", "Logins"]]],
  // Rich, round 24: the long "Website" list split into groups.
  ["News", [["articles", "News articles"], ["approvals", "News to approve"], ["write", "Write news step by step"], ["categories", "News categories"], ["notices", "Notifications"], ["announcements", "Announcements"]]],
  ["Pages & content", [["pages", "Info pages & rules"], ["key_dates", "Key dates"], ["meetings", "Meetings"], ["hall_of_fame", "Hall of Fame"], ["downloads", "Downloads"], ["merchandise", "Merchandise"], ["media", "Image library"]]],
  ["Sponsors & adverts", [["sponsors", "Sponsors"], ["sponsor_packages", "Sponsorship packages"], ["ads", "Side adverts"], ["popups", "Pop-up adverts"]]],
  ["Community", [["market", "Marketplace adverts"], ["market_categories", "Marketplace categories"], ["comments", "Match chat"]]],
  // Round 55: Help & support requests sent from /support, each to the roles its category is given to.
  ["Support", [["support", "Support inbox"], ["support_categories", "Support categories"]]],
  ["Look & settings", [["settings", "Site settings & home page"], ["branding", "Branding"], ["menu", "Menu"], ["page_settings_23", "Page introductions"], ["seo", "SEO"], ["emails", "Emails"]]],
  ["Tools", [["stats", "Statistics"], ["links", "Link checker"], ["performance", "Performance"]]],
  ["Newsletter", [["campaigns", "Campaigns"], ["subscribers", "Subscribers"], ["newsletter_setup", "Sign-up pop-up"]]],
  // Only the Master Admin sees these.
  ["Master Admin", [["roles", "Roles & permissions"], ["security", "Security"], ["versions", "Version history"], ["activity", "Activity log"], ["backup", "Backup"]]],
];

// ── Round 120 (Rich: "so much going on in the left column — it might benefit for the main sections to have their
//    own page with all the subtasks within them, with a pull-type scroll along the top of each page, like the website").
//    The long left-hand menu is gone. The dashboard is seven sections; each has a page of its own that lists what is
//    in it, in plain words. Along the top of every page: the sections (a row that slides), and under the page's title
//    the pages of the section you are in. The groups above are unchanged — a section is one or more of them. ──
const SECTIONS = [
  { id: "matches", label: "Matches", icon: "calendar", blurb: "Approve results, and look after the fixtures and bye weeks.", groups: ["Match nights", "Fixtures"] },
  { id: "league", label: "League", icon: "table", blurb: "Leagues, teams, players, handicaps, venues and seasons.", groups: ["League"] },
  { id: "competitions", label: "Competitions", icon: "trophy", blurb: "Cups and singles: entries, draws, live scores and awards.", groups: ["Competitions"] },
  { id: "news", label: "News", icon: "news", blurb: "Write and approve news, notifications and announcements.", groups: ["News"] },
  { id: "website", label: "Website", icon: "monitor", blurb: "Pages, pictures, sponsors, adverts, the menu and how the site looks.", groups: ["Pages & content", "Sponsors & adverts", "Look & settings"] },
  { id: "community", label: "Community", icon: "chat", blurb: "The marketplace, match chat, support requests and the newsletter.", groups: ["Community", "Support", "Newsletter"] },
  { id: "tools", label: "Admin tools", icon: "shield", blurb: "Logins, roles, security, backups and statistics.", groups: ["People", "Tools", "Master Admin"] },
];
// Each page: its icon, what it is for in one line, and (where there is one) the page of the website it looks after.
const ITEM = {
  overview: ["home", "What is on tonight and what is waiting for you."],
  results: ["check", "Check the scorecards captains have sent in, and approve them.", "/results"],
  season_wizard: ["steps", "Set up a whole new season, one step at a time."],
  fixtures: ["calendar", "Every match of the season: dates, venues and scores.", "/fixtures"],
  byes: ["clock", "The weeks a team has no match.", "/fixtures"],
  generator: ["refresh", "Make a full home-and-away fixture list for one league."],
  import: ["upload", "Bring in fixtures, teams or players from a spreadsheet."],
  leagues: ["table", "The leagues, with their promotion and relegation places.", "/tables"],
  teams: ["users", "Teams: their emblems, leagues and home venues.", "/league"],
  players: ["user", "Every player: team, photo, handicap and status.", "/players"],
  cueviews: ["mic", "Player interviews sent in, waiting to be checked."],
  handicaps: ["percent", "Change players' handicaps, team by team.", "/handicaps"],
  handicap_suggest: ["chart", "Handicap changes suggested by this season's results."],
  venues: ["pin", "The clubs: address, tables, map and photos.", "/venues"],
  seasons: ["layers", "Past and present seasons, and which one is current.", "/seasons"],
  comp_wizard: ["steps", "Set up a competition, one step at a time."],
  competitions: ["trophy", "Each competition's details, dates and rules.", "/competitions"],
  entries: ["form", "Entries sent in from the website, waiting for payment.", "/enter"],
  draws: ["bracket", "Entrants, the draw, results and live scoring.", "/competitions"],
  scoreboard: ["scoreboard", "Run the live scoreboard for a match.", "/scoreboard"],
  awards: ["star", "Trophies and winners for presentation night.", "/presentation"],
  past_winners: ["history", "The roll of honour from earlier seasons.", "/archive"],
  accounts: ["key", "Who can log in, and what their role is."],
  articles: ["news", "Every news article: write, edit, schedule and publish.", "/news"],
  approvals: ["done", "Articles written by officers, waiting for your approval."],
  write: ["pencil", "Write an article one question at a time."],
  categories: ["tag", "The categories news is filed under."],
  notices: ["bell", "Messages sent to the bell at the top of the website."],
  announcements: ["megaphone", "The line of announcements on the home page."],
  pages: ["file", "Info pages and the rules.", "/rules"],
  key_dates: ["calendar", "Important dates shown on the calendar.", "/calendar"],
  meetings: ["users", "Meetings, agendas and minutes.", "/meetings"],
  hall_of_fame: ["star", "Hall of Fame entries, and memories sent in.", "/hall-of-fame"],
  downloads: ["download", "Forms and documents people can download.", "/downloads"],
  merchandise: ["bag", "League merchandise and prices.", "/merchandise"],
  media: ["image", "Every picture uploaded to the website."],
  sponsors: ["pound", "The league's sponsors and their logos.", "/sponsorship"],
  sponsor_packages: ["layers", "What each sponsorship package includes and costs.", "/sponsorship"],
  ads: ["image", "Adverts shown at the side of pages."],
  popups: ["popup", "Adverts that pop up over a page."],
  market: ["tag", "Adverts people have placed, waiting for approval.", "/marketplace"],
  market_categories: ["list", "The categories of the marketplace."],
  comments: ["chat", "Messages posted in match chat."],
  support: ["help", "Help requests sent from the website.", "/support"],
  support_categories: ["list", "The kinds of request, and who answers each."],
  settings: ["sliders", "The home page, the match strip and site-wide settings.", "/"],
  branding: ["palette", "Logo, colours, fonts and the loading screen."],
  menu: ["menu", "The buttons of the menu bar, and their order."],
  page_settings_23: ["file", "The introduction at the top of each page."],
  seo: ["search", "How the website appears on Google and when shared."],
  emails: ["mail", "The emails the website sends, and who gets them."],
  stats: ["chart", "Visitor and usage statistics."],
  links: ["link", "Find broken links on the website."],
  performance: ["bolt", "How quickly the website loads."],
  campaigns: ["mail", "Write and send newsletters."],
  subscribers: ["users", "Everyone signed up to the newsletter."],
  newsletter_setup: ["popup", "The newsletter sign-up box and pop-up.", "/newsletter"],
  roles: ["shield", "What each role is allowed to do."],
  security: ["lock", "Two-step login, sign-in history and safety settings."],
  versions: ["history", "Each update of the website, and what changed."],
  activity: ["list", "Who changed what, and when."],
  backup: ["database", "Download a copy of all the league's data."],
};
// "Write news step by step" is only listed for people who can't open News itself (it is the big button at the top of News).
const mayOpen = (user, key) => canOpenSection(user, key) && !(key === "write" && canOpenSection(user, "articles"));
/** The sections this login has, each with its groups and their pages: [{ id, label, icon, blurb, groups: [[group, [[key, label]…]]…] }]. */
function sectionsFor(user) {
  const pagesOf = (group) => (NAV.find(([name]) => name === group)?.[1] ?? []).filter(([key]) => key !== "overview" && mayOpen(user, key));
  return SECTIONS.map((s) => ({ ...s, groups: s.groups.map((g) => [g, pagesOf(g)]).filter(([, items]) => items.length) })).filter((s) => s.groups.length);
}
const pagesIn = (sec) => sec.groups.flatMap(([, items]) => items);
const SPECIAL = { overview, results, generator, draws, media: mediaPage, stats: statsPage, import: importPage, handicaps: handicapsPage, entries: entriesPage,
  roles: rolesPage, activity: activityPage, backup: backupPage, awards: awardsPage, scoreboard: scoreboardPage, emails: emailsPage, cueviews: cueviewsPage, write: newsWizardPage, approvals: newsApprovePage,
  campaigns: campaignsPage, subscribers: subscribersPage, market: marketPage, comments: commentsPage, menu: menuPage, seo: seoPage, links: linksPage, performance: performancePage, security: securityPage, versions: versionsPage, handicap_suggest: handicapSuggestPage,
  support: supportPage, support_categories: supportCategoriesPage, comp_wizard: compWizardPage, season_wizard: seasonWizardPage };
// Pages that show a red number when something is waiting.
const COUNTS = { players: "Players waiting to be accepted", entries: "Entries waiting for payment", cueviews: "CueViews waiting to be checked", approvals: "News waiting for your approval", market: "Adverts waiting for approval", support: "Support requests waiting for an answer" };
const countBadge = (key) => (COUNTS[key] ? html` <span class="nav-count" data-count="${key}" title="${COUNTS[key]}" hidden></span>` : "");
/** One page of the dashboard as a card: its icon, name, what it is for, and a red number when something is waiting. */
const pageCard = ([key, label]) => html`<a class="adm-card" href="/admin/${key}"><span class="adm-card__ico">${icon(ITEM[key]?.[0])}</span>
  <span class="adm-card__txt"><b>${label}${countBadge(key)}</b><small>${ITEM[key]?.[1] ?? ""}</small></span><span class="adm-card__go">${icon("chevRight", 18)}</span></a>`;
/** A section's own page: everything in it, group by group. */
const sectionCards = (sec) => html`${sec.groups.map(([group, items]) => html`<section class="adm-group">${sec.groups.length > 1 ? html`<h2 class="adm-group__h">${group}</h2>` : ""}
  <div class="adm-cards">${items.map(pageCard)}</div></section>`)}`;

// ── Round 117 (Rich: "when in admin on mobile there is no bottom nav — could we have one, with the core admin tasks?
//    For the Master Admin it would have to be different"). A bar fixed to the bottom of a phone, in the dashboard only:
//      the Master Admin:  Home · Results · Fixtures · News · Menu
//      an officer:        Home · the first two jobs their role includes · My team (if they have one) · Menu
//    Only sections the login can open are offered, so nobody is shown a button that would be refused.
//    Round 120: Menu opens "All of the dashboard" — every section and its pages on one screen. ──
const AB_ICON = {
  home: "M4 4h7v7H4Zm9 0h7v4h-7ZM4 13h7v7H4Zm9-3h7v10h-7Z",
  results: "M9 2h6a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2-2Zm0 2v2h6V4Zm1.6 13.4 6-6L15.2 10l-4.6 4.6-1.8-1.8-1.4 1.4Z",
  fixtures: "M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2Zm12 8H5v10h14ZM7 12h4v4H7Z",
  articles: "M4 4h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Zm15 4h2v10a2 2 0 0 1-2 2 1 1 0 0 1-1-1V8Zm-13 0v3h9V8Zm0 5v2h9v-2Z",
  draws: "M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v2H8v-2h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3Zm0 4H6v1a2 2 0 0 0 1 1.7Zm10 0v2.7A2 2 0 0 0 18 8V7Z",
  players: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7Z",
  entries: "M5 3h14v18H5Zm2 2v14h10V5Zm2 3h6v2H9Zm0 4h6v2H9Z",
  support: "M4 4h16v12H9.5L5 20v-4H4Zm4.2 3.2v2h7.6v-2Zm0 3.6v2h5.2v-2Z",
  team: "m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8Z",
  menu: "M3 6h18v2H3Zm0 5h18v2H3Zm0 5h18v2H3Z",
};
const AB_WORD = { results: "Results", fixtures: "Fixtures", articles: "News", draws: "Comps", players: "Players", entries: "Entries", support: "Support" };
function adminBar(user, mine, section) {
  const can = new Set(mine.map(([k]) => k)), master = isMaster(user), team = isMember(user) && !master;
  const jobs = (master ? ["results", "fixtures", "articles"] : Object.keys(AB_WORD)).filter((k) => can.has(k)).slice(0, master ? 3 : team ? 2 : 3);
  const home = can.has("overview") ? "overview" : mine[0]?.[0];
  const item = (href, key, label, on) => html`<a class="abnav__item ${on ? "on" : ""}" href="${href}" ${on ? html`aria-current="page"` : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${AB_ICON[key]}"/></svg><span>${label}</span></a>`;
  return html`<nav class="abnav" aria-label="Dashboard shortcuts"><div class="abnav__bar" style="--n:${jobs.length + 2 + (team ? 1 : 0)}">
    ${item(home === "overview" ? "/admin" : `/admin/${home}`, "home", "Admin", section === home && !jobs.includes(section))}
    ${jobs.map((k) => item(`/admin/${k}`, k, AB_WORD[k], section === k))}
    ${team ? item("/my", "team", "My team", false) : ""}
    ${item("/admin/hub_all", "menu", "Menu", section.startsWith("hub_"))}
  </div></nav>`;
}

/**
 * A row that slides sideways (the sections, and the pages of a section): a finger swipes it, a mouse can drag it,
 * it fades at whichever end has more to show, and it opens with the page you are on in view.
 */
function pullRow(row) {
  if (!row) return;
  // Round 120b (Neil: "how would anyone know they need to scroll sideways?"): a round arrow button on whichever side
  // has more — plain to see on a phone, and a tap moves the row along.
  const wrap = document.createElement("div");
  wrap.className = `adm-pull ${row.classList.contains("adm-tabs") ? "adm-pull--tabs" : "adm-pull--sub"}`;
  row.before(wrap); wrap.append(row);
  for (const [dir, cls, name, label] of [[-1, "prev", "chevLeft", "Show the earlier ones"], [1, "next", "chevRight", "Show more"]]) {
    const b = Object.assign(document.createElement("button"), { type: "button", className: `adm-pull__btn adm-pull__btn--${cls}` });
    b.setAttribute("aria-label", label); mount(b, icon(name, 18));
    b.addEventListener("click", () => row.scrollBy({ left: dir * Math.max(160, row.clientWidth * 0.7), behavior: "smooth" }));
    wrap.append(b);
  }
  const ends = () => {
    const can = row.scrollWidth - row.clientWidth > 4;
    const left = can && row.scrollLeft > 4, right = can && row.scrollLeft + row.clientWidth < row.scrollWidth - 4;
    row.classList.toggle("more-left", left); wrap.classList.toggle("more-left", left);
    row.classList.toggle("more-right", right); wrap.classList.toggle("more-right", right);
  };
  const on = row.querySelector("[aria-current]");
  if (on) row.scrollLeft = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
  row.addEventListener("scroll", ends, { passive: true });
  if (typeof ResizeObserver === "function") new ResizeObserver(ends).observe(row);
  ends();
  let drag = null, dragged = false;
  row.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.button === 0) { drag = { x: e.clientX, left: row.scrollLeft }; dragged = false; } });
  row.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!dragged && Math.abs(dx) < 6) return;
    dragged = true; row.classList.add("is-dragging"); row.scrollLeft = drag.left - dx;
  });
  const stop = () => { drag = null; row.classList.remove("is-dragging"); };
  row.addEventListener("pointerup", stop); row.addEventListener("pointerleave", stop); row.addEventListener("pointercancel", stop);
  row.addEventListener("dragstart", (e) => e.preventDefault());
  row.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
}

export default async function admin(view, { params, user, query }) {
  if (!user) return mustLogin(view);
  if (!isStaff(user)) return navigate("/my", { replace: true });
  const nav = NAV.map(([group, items]) => [group, items.filter(([key]) => mayOpen(user, key))]).filter(([, items]) => items.length);
  // Where the dashboard opens: the first section of this login's own area (Handicaps is shared, so it isn't the landing page).
  const mine = nav.flatMap(([, items]) => items);
  const first = (mine.find(([key]) => key !== "handicaps" && key !== "comp_wizard" && key !== "season_wizard") ?? mine[0])[0];
  if (!params.section && first !== "overview") return navigate(`/admin/${first}`, { replace: true });
  const section = params.section || first;
  const sections = sectionsFor(user);
  const hub = section.startsWith("hub_") ? section.slice(4) : null;      // a section's own page, or "all"
  const cur = hub ? sections.find((s) => s.id === hub) : sections.find((s) => pagesIn(s).some(([k]) => k === section));
  const hasOverview = mine.some(([k]) => k === "overview");
  const title = hub === "all" ? "All of the dashboard" : hub ? (cur?.label ?? "Admin") : section === "overview" ? "Dashboard" : NAV.flatMap(([, items]) => items).find(([k]) => k === section)?.[1] ?? "Admin";
  setTitle(`Admin – ${title}`);
  const pub = hub ? null : ITEM[section]?.[2];
  const tab = (href, ico, label, on, id = null) => html`<a class="adm-tab ${on ? "on" : ""}" href="${href}" ${on ? html`aria-current="page"` : ""}>${icon(ico, 18)}<span>${label}</span>${id ? html`<span class="nav-count" data-count-sec="${id}" hidden></span>` : ""}</a>`;

  mount(view, html`<div class="wrap wide adm">
    <div class="adm-bar">
      <div class="adm-find">${icon("search", 18)}
        <input type="search" placeholder="Search the dashboard: a page, a setting, a player, a team, a match…" data-admin-find aria-label="Search the dashboard" autocomplete="off">
        <div class="adm-results" data-admin-records hidden></div></div>
      ${isMember(user) ? html`<a class="adm-barlink" href="/my">${icon("star", 16)}<span>My team</span></a>` : ""}
      <a class="adm-barlink" href="/">${icon("external", 16)}<span>View website</span></a>
      <button type="button" class="adm-barlink" data-logout>${icon("logout", 16)}<span>Log out</span></button>
    </div>
    <nav class="adm-tabs" aria-label="Sections of the dashboard" data-pull>
      ${hasOverview ? tab("/admin", "home", "Dashboard", section === "overview") : ""}
      ${sections.map((s) => tab(`/admin/hub_${s.id}`, s.icon, s.label, cur?.id === s.id, s.id))}
      ${tab("/admin/hub_all", "grid", "Everything", hub === "all")}
    </nav>
    <div class="admin-crumbs"><button type="button" class="back-link admin-back" data-admin-back aria-label="Back to the previous screen">${backIcon}<span>Back</span></button>
    ${breadcrumb([["Home", "/"], ["Admin", "/admin"], ...(cur && !hub ? [[cur.label, `/admin/hub_${cur.id}`]] : []), [title]])}</div>
    <div class="adm-head"><div><h1>${title}</h1>${hub && cur ? html`<p class="adm-lede">${cur.blurb}</p>` : hub === "all" ? html`<p class="adm-lede">Every section of the dashboard and the pages inside it.</p>` : !hub && ITEM[section]?.[1] ? html`<p class="adm-lede">${ITEM[section][1]}</p>` : ""}</div>
      ${pub ? html`<a class="adm-view" href="${pub}">${icon("eye", 16)}<span>View on the website</span></a>` : ""}</div>
    <div data-db-behind></div>
    ${cur ? html`<nav class="adm-sub" aria-label="${cur.label}" data-pull>
      <a class="adm-pill ${hub ? "on" : ""}" href="/admin/hub_${cur.id}" ${hub ? html`aria-current="page"` : ""}>${icon("grid", 16)}<span>All pages</span></a>
      ${cur.groups.map(([group, items]) => html`${cur.groups.length > 1 ? html`<span class="adm-sub__label">${group}</span>` : ""}${items.map(([key, label]) =>
        html`<a class="adm-pill ${key === section ? "on" : ""}" href="/admin/${key}" ${key === section ? html`aria-current="page"` : ""}>${label}${countBadge(key)}</a>`)}`)}
    </nav>` : ""}
    <div class="admin"><div id="admin-body"></div></div>
    <p class="admin-version">Website version ${SITE_VERSION}${DEMO_MODE ? html` · <a href="#" data-reset-demo>Reset sample data</a>` : ""}</p>
    ${adminBar(user, mine, section)}
  </div>`);
  for (const row of view.querySelectorAll("[data-pull]")) pullRow(row);

  // The website files and the database are updated separately. If the database is the older of the two, say so —
  // loudly, on every page of the dashboard — because the newest features cannot work until it has caught up.
  databaseVersion().then((v) => {
    const slot = $("[data-db-behind]", view);
    if (!slot || v === null || v >= SCHEMA_VERSION) return;
    mount(slot, html`<div class="notice error db-behind" role="alert"><b>The database needs updating — the website is newer than its database.</b>
      <span>The website files are version ${SCHEMA_VERSION}; the database is ${v ? `version ${v}` : "an older version"}. Until it is updated, the newest features will not save or will show an error.</span>
      <ol><li>Open <b>Supabase</b> → <b>SQL Editor</b> → New query.</li>
        <li>Paste the <b>whole</b> of the file <code>supabase/schema.sql</code> (it comes in the website's zip) and press <b>Run</b>. It is safe to run it more than once, and no data is lost.</li>
        <li>It should answer “Success. No rows returned”. Reload this page: this message goes away.</li></ol>
      <span>If it shows an error instead, nothing was changed: copy the error and send it to whoever looks after the website.</span></div>`);
  });

  // The search box: type a few letters to find a page of the dashboard, a setting, or (round 40) a player, team, venue,
  // league, competition, news article or one of this season's fixtures — opened ready to edit. Enter opens the first.
  const find = $("[data-admin-find]", view), box = $("[data-admin-records]", view);
  let index = null;
  const buildIndex = async () => {
    const [players, teams, venues, leagues, comps, news] = await Promise.all([
      table("players", "full_name").catch(() => []), table("teams", "name").catch(() => []), table("venues", "name").catch(() => []),
      table("leagues", "sort").catch(() => []), table("competitions", "sort").catch(() => []), articleList().catch(() => [])]);
    const teamName = (id) => teams.find((t) => t.id === id)?.name ?? "?";
    const ctx = await seasonContext().catch(() => null);
    const out = [];
    const push = (section, kind, label, sub, href) => { if (canOpenSection(user, section)) out.push({ kind, label, sub, href, key: `${label} ${sub}`.toLowerCase() }); };
    // Every section and page of the dashboard, found by its name, its group or what it is for.
    for (const s of sections) {
      out.push({ kind: "Section", label: s.label, sub: "", href: `/admin/hub_${s.id}`, key: `${s.label} ${s.blurb}`.toLowerCase() });
      for (const [group, items] of s.groups) for (const [key, label] of items)
        out.push({ kind: "Page", label, sub: s.label, href: `/admin/${key}`, key: `${label} ${group} ${s.label} ${ITEM[key]?.[1] ?? ""} ${RESOURCES[key]?.intro ?? ""}`.toLowerCase() });
    }
    for (const p of players) push("players", "Player", p.full_name, teamName(p.team_id), `/admin/players?edit=${p.id}`);
    for (const t of teams) push("teams", "Team", t.name, "", `/admin/teams?edit=${t.id}`);
    for (const v of venues) push("venues", "Venue", v.name, "", `/admin/venues?edit=${v.id}`);
    for (const l of leagues) push("leagues", "League", l.name, "", `/admin/leagues?edit=${l.id}`);
    for (const c of comps) push("draws", "Competition", c.name, "Draws & results", `/admin/draws?c=${c.id}`);
    for (const a of news) push("articles", "News", a.title, a.published_at ? fmtDate(a.published_at) : "", `/admin/articles?edit=${a.id}`);
    // Round 73: every setting on the settings pages (Branding, Site settings…), found by its name or its
    // explanation — "logo", "loading screen", "banner", "ticker"…
    for (const [key, res] of Object.entries(RESOURCES)) {
      if (!canOpenSection(user, key) || !res.single) continue;
      let tabName = "";
      res.fields.forEach((f, i) => {
        if (f.type === "heading" && f.tab) tabName = f.tab;
        if (f.type === "custom" || !f.label || (f.master && !isMaster(user))) return;
        const label = String(f.type !== "heading" ? f.label.split(/\s[(—]/)[0].trim() || f.label : f.label).slice(0, 90);
        const fk = f.type === "heading" ? `h${i}` : f.name;
        out.push({ kind: f.type === "heading" ? "Settings" : "Setting", label, sub: `${res.label}${tabName ? ` → ${tabName}` : ""}`,
          href: `/admin/${key}?find=${encodeURIComponent(fk)}`, key: `${f.label} ${f.help ?? ""} ${f.short ?? ""} ${res.label} ${tabName}`.toLowerCase() });
      });
    }
    for (const f of ctx?.fixtures ?? []) push("fixtures", "Match", `${teamName(f.home_team_id)} v ${teamName(f.away_team_id)}`, `${fmtDate(f.starts_at)} · scorecard`, urls.scorecard(f));
    return out;
  };
  const findRecords = async (q) => {
    if (q.length < 2) { box.hidden = true; return; }
    index ??= await buildIndex();
    if (find.value.trim().toLowerCase() !== q) return;   // typed on since
    const words = q.split(/\s+/);
    // Best first: a name that starts with what was typed, then a name that contains it, then the rest (a team's players…).
    const KIND = ["Section", "Page", "Settings", "Setting", "Team", "League", "Competition", "Venue", "Player", "Match", "News"];
    const rank = (r) => { const l = r.label.toLowerCase(); return l.startsWith(q) ? 0 : words.every((w) => l.includes(w)) ? 1 : 2; };
    const hits = index.filter((r) => words.every((w) => r.key.includes(w)))
      .sort((a, b) => rank(a) - rank(b) || KIND.indexOf(a.kind) - KIND.indexOf(b.kind) || a.label.localeCompare(b.label)).slice(0, 14);
    box.hidden = false;
    mount(box, hits.length ? hits.map((r) => html`<a href="${r.href}"><i>${r.kind}</i><span>${r.label}${r.sub ? html` <small>${r.sub}</small>` : ""}</span></a>`)
      : html`<small class="ar-head">Nothing in the dashboard matches “${q}”.</small>`);
  };
  find.addEventListener("input", () => findRecords(find.value.trim().toLowerCase()));
  find.addEventListener("focus", () => { if (find.value.trim().length >= 2) findRecords(find.value.trim().toLowerCase()); });
  find.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { box.hidden = true; return; }
    if (e.key !== "Enter") return;
    const hit = box.hidden ? null : box.querySelector("a");
    if (hit && find.value.trim()) { e.preventDefault(); hit.click(); }
  });
  view.addEventListener("click", (e) => { if (!e.target.closest(".adm-find")) box.hidden = true; });

  $("[data-reset-demo]")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("Reset all demo data back to the sample league? You'll be logged out.")) return;
    resetDemo(); await refreshShell(); navigate("/login");
  });

  // Back (Rich, round 54): the screen you were on before, or the dashboard if you came straight here.
  $("[data-admin-back]", view)?.addEventListener("click", () => (history.length > 1 && document.referrer !== location.href ? history.back() : navigate("/admin")));

  // The red numbers: new players still to be checked, competition entries waiting for payment and the rest — beside
  // the page's name wherever it is shown, and added up on its section. Worked out again whenever something is saved,
  // so they go as soon as it's dealt with.
  const drawCounts = async () => {
    invalidate();
    const waiting = {
      players: canOpenSection(user, "players") ? (await table("players", "full_name")).filter((p) => p.needs_review).length : 0,
      entries: canOpenSection(user, "entries") ? (await signups().catch(() => [])).filter((r) => r.status === "pending").length : 0,
      cueviews: canOpenSection(user, "cueviews") ? (await cueviewSubmissions().catch(() => [])).filter((r) => r.status === "pending").length : 0,
      approvals: canOpenSection(user, "approvals") ? (await waitingNews().catch(() => [])).length : 0,
      market: canOpenSection(user, "market") ? (await waitingAds().catch(() => [])).length : 0,
      support: canOpenSection(user, "support") ? (await needsAnswer(user).catch(() => [])).length : 0,
    };
    for (const [key, n] of Object.entries(waiting)) for (const badge of view.querySelectorAll(`[data-count="${key}"]`)) { badge.textContent = n; badge.hidden = !n; }
    for (const s of sections) {
      const n = pagesIn(s).reduce((sum, [key]) => sum + (waiting[key] ?? 0), 0);
      for (const badge of view.querySelectorAll(`[data-count-sec="${s.id}"]`)) { badge.textContent = n; badge.hidden = !n; }
    }
  };

  const body = $("#admin-body");
  // A section's own page, or every section on one page.
  if (hub === "all") { mount(body, html`${sections.map((s) => html`<section class="adm-all"><a class="adm-all__h" href="/admin/hub_${s.id}"><span class="adm-card__ico">${icon(s.icon)}</span><span><b>${s.label}</b><small>${s.blurb}</small></span></a>${sectionCards(s)}</section>`)}`); return void drawCounts(); }
  if (hub) {
    if (!cur) return mount(body, html`<div class="notice error">Your login doesn't include this part of the dashboard. Ask the Master Admin if you need it.</div>`);
    mount(body, sectionCards(cur)); return void drawCounts();
  }
  drawCounts();
  if (!canOpenSection(user, section)) {
    return mount(body, html`<div class="notice error">Your login doesn't include this part of the dashboard. Ask the Master Admin if you need it.</div>`);
  }
  if (SPECIAL[section]) return SPECIAL[section](body, { user, onChange: drawCounts });
  if (RESOURCES[section]) {
    const current = (await table("seasons", "name")).find((s) => s.is_current);
    // News: the easy way in, for anyone who finds the full form a lot.
    let into = body;
    if (section === "articles" && !query.get("edit")) {
      mount(body, html`${isMaster(user) ? "" : html`<div class="notice">Articles you publish go to the Master Admin to approve before they appear on the website (they show as not published until then).</div>`}<a class="nw-invite" href="/admin/write"><b>${icon("pencil", 20)}Write news step by step</b><span>One question at a time: headline, category, story, quote, pictures and this week's tables.</span></a><div></div>`);
      into = body.lastElementChild;
    }
    // Round 75 (Rich): competitions too.
    if (section === "competitions" && !query.get("edit")) {
      mount(body, html`<a class="nw-invite" href="/admin/comp_wizard"><b>${icon("trophy", 20)}Set up a competition step by step</b><span>One step at a time: the competition, the details, entries, entrants, the draw, deadlines and dates.</span></a><div></div>`);
      into = body.lastElementChild;
    }
    return crud(into, RESOURCES[section], {
      // A list can be opened already filtered, e.g. /admin/fixtures?status=approved (the Overview boxes do this).
      preset: { ...(["fixtures", "byes"].includes(section) && current ? { season_id: current.id } : {}),
        ...Object.fromEntries((RESOURCES[section].filters ?? []).filter((f) => query.get(f)).map((f) => [f, query.get(f)])) },
      editId: query.get("edit"), user, onChange: drawCounts, findField: query.get("find"),
    });
  }
  mount(body, html`<div class="notice error">Unknown section.</div>`);
}

// ── Overview ───────────────────────────────────────────────────
async function overview(el, { user }) {
  const ctx = await seasonContext();
  const unpaid = canOpenSection(user, "entries") ? (await signups().catch(() => [])).filter((r) => r.status === "pending") : [];
  const count = (s) => ctx.fixtures.filter((f) => f.status === s).length;
  // Round 113 (Rich: "shows in admin as live, but not on the scroller"): counted exactly as the match strip counts live.
  const liveNow = ctx.fixtures.filter((f) => isLiveNow(f, Date.now(), ctx.framesOf(f.id).filter((x) => x.home_points != null && x.away_points != null).length)).length;
  // Each box opens the list behind its number (only for the parts of the dashboard this login has).
  const stats = [
    ["Teams", ctx.teams.length, "teams", "/admin/teams"], ["Players", ctx.players.length, "players", "/admin/players"], ["Fixtures", ctx.fixtures.length, "fixtures", "/admin/fixtures"],
    ["Approved", count("approved"), "fixtures", "/admin/fixtures?status=approved"], ["Awaiting approval", count("submitted"), "results", "/admin/results"], ["Live now", liveNow, "results", "/admin/results"],
  ];
  const fresh = ctx.players.filter((p) => p.needs_review);
  const news = canOpenSection(user, "approvals") ? await waitingNews().catch(() => []) : [];
  // Round 40: Tonight (the match night), Needs you (everything waiting, in one list) and, for the Master Admin,
  // the last things they changed with Undo. The old one-line reminders are all in Needs you now.
  mount(el, html`
    <div class="ov-grid"><div data-ov-tonight></div><div data-ov-needs></div></div>
    <div class="stats">${stats.map(([l, n, section, href]) => (canOpenSection(user, section)
      ? html`<a class="stat stat-link" href="${href}" title="Open ${l.toLowerCase()}"><b>${n}</b>${l}<i aria-hidden="true">${icon("arrow", 16)}</i></a>` : html`<div class="stat"><b>${n}</b>${l}</div>`))}</div>
    <p>Season: <b>${ctx.season?.name ?? "none — add one under Seasons"}</b>. Match nights: captains enter frames on their phones,
      press <b>Submit final result</b>, then you approve them under <a href="/admin/results" style="color:var(--red);font-weight:700">Results to approve</a>.
      Approved results are locked for captains; you can still edit them.</p>
    <h2 class="adm-h2">Sections</h2>
    <div class="adm-secs">${sectionsFor(user).map((s) => html`<a class="adm-sec" href="/admin/hub_${s.id}"><span class="adm-card__ico">${icon(s.icon, 22)}</span>
      <b>${s.label}<span class="nav-count" data-count-sec="${s.id}" hidden></span></b><small>${s.blurb}</small>
      <span class="adm-sec__n">${pagesIn(s).length} page${pagesIn(s).length === 1 ? "" : "s"} ${icon("arrow", 16)}</span></a>`)}</div>
    <div data-ov-recent style="margin-top:26px"></div>`);
  const waiting = {
    players: fresh, entries: unpaid, news,
    cueviews: canOpenSection(user, "cueviews") ? (await cueviewSubmissions().catch(() => [])).filter((r) => r.status === "pending") : [],
    ads: canOpenSection(user, "market") ? (await waitingAds().catch(() => [])) : [],
  };
  await Promise.all([
    tonightPanel($("[data-ov-tonight]", el), user).then((stop) => { overviewStop = stop; }).catch((err) => console.warn("Tonight:", err)),
    needsYouPanel($("[data-ov-needs]", el), user, ctx, waiting).catch((err) => console.warn("Needs you:", err)),
    recentChangesPanel($("[data-ov-recent]", el), user).catch(() => {}),
  ]);
  return () => overviewStop?.();
}
let overviewStop = null;   // the Tonight box's live updates, stopped when the Overview is left

// ── Results awaiting approval ──────────────────────────────────
async function results(el) {
  const ctx = await seasonContext();
  const pending = ctx.fixtures.filter((f) => ["submitted", "in_progress"].includes(f.status));
  const overdue = ctx.fixtures.filter((f) => f.status === "scheduled" && new Date(f.starts_at) < Date.now() - 86400000);
  const postponed = ctx.fixtures.filter((f) => f.status === "postponed");
  const cols = (withApprove) => [
    { label: "Date", cell: (f) => `${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)}` },
    { label: "Match", cell: (f) => html`<a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} vs ${ctx.team.get(f.away_team_id)?.name}</a>` },
    { label: "Score", cell: (f) => { const s = ctx.scoreOf(f); return ctx.hasResult(f) ? `${s.home} - ${s.away}` : "–"; } },
    { label: "Status", cell: (f) => statusBadge(f.status) },
    { label: "Card photo", cell: (f) => (safeHref(f.scorecard_url) ? html`<a href="${safeHref(f.scorecard_url)}" target="_blank" rel="noopener" style="color:var(--red);font-weight:700">View photo</a>` : "–") },
    { label: "", cls: "right", cell: (f) => html`<span class="btn-row" style="justify-content:flex-end">
      <a class="btn small secondary" href="${urls.scorecard(f)}">Check / edit</a>
      ${withApprove && f.status === "submitted" ? html`<button class="btn small green" data-approve="${f.id}">Approve</button>` : ""}</span>` },
  ];
  mount(el, html`<div id="results-root">${panel("Submitted & live results", dataTable(cols(true), pending, { empty: "Nothing waiting — all caught up." }))}
    <div style="height:26px"></div>
    ${panel("Played but no result entered", dataTable(cols(false), overdue, { empty: "No overdue scorecards." }))}
    <div style="height:26px"></div>
    <div id="postponed"></div>
    ${panel("Postponed — waiting for a new date", dataTable([
      { label: "Was due", cell: (f) => `${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)}` },
      { label: "Match", cell: (f) => html`<a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} vs ${ctx.team.get(f.away_team_id)?.name}</a>` },
      { label: "Rearrange by", cell: (f) => { const by = rearrangeBy(f); return html`<span class="${Date.parse(by) < Date.now() ? "overdue" : ""}">${fmtDate(by)}</span>`; } },
      { label: "New date & time", cell: (f) => html`<input type="datetime-local" data-new-date="${f.id}" style="margin:0;width:auto">` },
      { label: "", cls: "right", cell: (f) => html`<span class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn small ghost" data-suggest="${f.id}">Suggest dates</button><button class="btn small green" data-reschedule="${f.id}">Rearrange</button></span>` },
    ], postponed, { empty: "No postponed matches." }))}
    <div data-suggestions></div>
    <p class="muted"><b>How to postpone a match:</b> a captain or vice captain presses <b>Postpone</b> next to the match under My Team → Fixtures (before it starts),
      or you open its scorecard and press <b>Mark postponed</b>. It shows as “P - P” on the site, is left out of the tables, and waits here.
      It should be re-arranged within ${POSTPONE_WEEKS} weeks: both captains see a reminder with the date on their My Team page. Give it a new date above and it goes back on the fixture list.</p></div>`);
  $("#results-root").addEventListener("click", async (e) => {
    // Round 40: the free nights before the deadline (both teams free; bye weeks first; venue and key dates noted).
    if (e.target.dataset.suggest) {
      const f = ctx.fixtures.find((x) => x.id === e.target.dataset.suggest);
      const keyDates = await table("key_dates", "starts_on").catch(() => []);
      const list = freeDates(ctx, f, { keyDates });
      const box = $("[data-suggestions]", el);
      mount(box, panel(`Free dates: ${ctx.team.get(f.home_team_id)?.name} v ${ctx.team.get(f.away_team_id)?.name}`, list.length
        ? html`<ul class="sug-list">${list.map((d) => html`<li><b>${new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })}</b> ${d.time}
            <small>${d.notes.join(" · ")}</small><button type="button" class="btn small" data-use-date="${f.id}" data-day="${d.day}" data-time="${d.time}">Use this date</button></li>`)}</ul>
          <p class="muted" style="padding:0 14px 10px;margin:0">Weeknights up to ${Date.parse(rearrangeBy(f)) < Date.now() ? "four weeks ahead (the rearrange-by date has passed)" : fmtDate(rearrangeBy(f))}, when neither team already has a match. Check with both captains before saving.</p>`
        : html`<p style="padding:14px;margin:0">No free weeknight in the next four weeks or before the deadline (${fmtDate(rearrangeBy(f))}). Pick a date by hand.</p>`));
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (e.target.dataset.useDate) {
      const input = $(`[data-new-date="${e.target.dataset.useDate}"]`);
      input.value = toLocalInput(londonISO(e.target.dataset.day, e.target.dataset.time));
      input.scrollIntoView({ behavior: "smooth", block: "center" }); input.focus();
      return toast("Date filled in — press Rearrange to save it");
    }
    const fid = e.target.dataset.reschedule;
    if (fid) {
      const when = fromLocalInput($(`[data-new-date="${fid}"]`).value);
      if (!when) return toast("Choose the new date and time first", "error");
      try { await save("fixtures", { id: fid, starts_at: when, status: "scheduled" }); toast("Match rearranged"); results(el); }
      catch (err) { toast(err.message, "error"); }
      return;
    }
    const id = e.target.dataset.approve;
    if (!id) return;
    e.target.disabled = true;
    try { await setFixtureStatus(id, "approved"); toast("Result approved"); results(el); }
    catch (err) { toast(err.message, "error"); e.target.disabled = false; }
  });
}

// ── Fixture generator ──────────────────────────────────────────
async function generator(el) {
  const ctx = await seasonContext();
  const nextTuesday = (() => { const d = new Date(); d.setDate(d.getDate() + ((9 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
  mount(el, html`<a class="nw-invite" href="/admin/season_wizard"><b>${icon("calendar", 20)}Set up a new season step by step</b><span>The season, leagues, promotion and relegation, teams, players, every league's fixtures and a venue check — in order.</span></a>
  <div class="notice">Creates a full round-robin for one league: every team plays every other team, home and away.
    Venues come from each home team. You can edit or postpone any fixture afterwards.
    A league with an odd number of teams gets a <b>bye week</b> for the team left without a match each night (Fixtures → Bye weeks).</div>
  <form class="form" id="gen-form"><div class="grid-2">
    <label>Season<select name="season_id">${[...ctx.seasons].reverse().map((s) => html`<option value="${s.id}" ${s.id === ctx.season?.id ? "selected" : ""}>${s.name}</option>`)}</select></label>
    <label>League<select name="league_id">${ctx.leagues.map((l) => html`<option value="${l.id}">${l.name} (${ctx.teamsIn(l.id).length} teams)</option>`)}</select></label>
    <label>First match night<input type="date" name="start" value="${nextTuesday}" required></label>
    <label>Start time<input type="time" name="time" value="19:30" required></label>
    <label>Days between rounds<input type="number" name="gap" value="7" min="1" required></label>
    <label>Skip these dates (e.g. Christmas) — one per line, YYYY-MM-DD<textarea name="skip" style="min-height:70px"></textarea></label>
    <label class="check"><input type="checkbox" name="double" checked> Home and away (double round-robin)</label>
  </div>
  <div class="btn-row"><button type="button" class="btn secondary" data-preview>Preview</button><button class="btn green">Create fixtures</button></div></form>
  <div id="gen-preview" style="margin-top:22px"></div>`);

  const build = () => {
    const v = readForm($("#gen-form"));
    const teams = ctx.teamsIn(v.league_id);
    if (teams.length < 2) throw new Error("This league needs at least two teams.");
    const skip = new Set(String(v.skip ?? "").split(/\s+/).filter(Boolean));
    const rounds = roundRobin(teams.map((t) => t.id));
    const used = v.double ? rounds : rounds.slice(0, rounds.length / 2);
    let date = v.start;
    const byes = [];
    const list = used.flatMap((pairs, i) => {
      if (i > 0) date = addDays(date, v.gap);
      while (skip.has(date)) date = addDays(date, v.gap);
      // With an odd number of teams, whoever isn't in a pair that night has a bye week.
      const playing = new Set(pairs.flat());
      for (const t of teams) if (!playing.has(t.id)) byes.push({ season_id: v.season_id, league_id: v.league_id, team_id: t.id, bye_on: date });
      return pairs.map(([home, away]) => ({
        season_id: v.season_id, league_id: v.league_id, home_team_id: home, away_team_id: away,
        venue_id: ctx.team.get(home)?.venue_id ?? null, starts_at: londonISO(date, v.time), status: "scheduled", notes: "",
      }));
    });
    return Object.assign(list, { byes });
  };

  const preview = () => {
    const list = build();
    const v = readForm($("#gen-form"));
    const existing = v.season_id === ctx.season?.id ? ctx.fixturesIn(v.league_id).length : 0;
    mount($("#gen-preview"), html`${existing ? html`<div class="notice error">This league already has ${existing} fixtures this season — creating more will add duplicates.</div>` : ""}
      ${list.byes.length ? html`<div class="notice">An odd number of teams: ${list.byes.length} bye weeks will be added too, one team each night.</div>` : ""}
      ${panel(`Preview: ${list.length} fixtures`, dataTable([
        { label: "Date", cell: (f) => `${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)}` },
        { label: "Home", cell: (f) => ctx.team.get(f.home_team_id)?.name },
        { label: "Away", cell: (f) => ctx.team.get(f.away_team_id)?.name },
        { label: "Venue", cell: (f) => ctx.venue.get(f.venue_id)?.name ?? "–" },
      ], list))}`);
    return list;
  };

  el.addEventListener("click", (e) => { if (e.target.matches("[data-preview]")) { try { preview(); } catch (err) { toast(err.message, "error"); } } });
  $("#gen-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const list = preview();
      if (!confirm(`Create ${list.length} fixtures?`)) return;
      await insertMany("fixtures", [...list]);
      if (list.byes.length) await insertMany("byes", list.byes);
      toast(`${list.length} fixtures created${list.byes.length ? ` and ${list.byes.length} bye weeks` : ""}`);
      navigate("/admin/fixtures");
    } catch (err) { toast(err.message, "error"); }
  });
}
