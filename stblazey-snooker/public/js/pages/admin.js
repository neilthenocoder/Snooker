import { html, mount, $, toast, readForm, fmtDate, fmtTime, fromLocalInput, toLocalInput, safeHref } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table, insertMany, setFixtureStatus, save, invalidate, signups, cueviewSubmissions, articleList } from "../core/api.js";
import { isStaff, isMaster, canOpenSection, isMember } from "../core/auth.js";
import { rearrangeBy, POSTPONE_WEEKS } from "../core/rules.js";
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
const backIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 5.3 8 12l6.7 6.7 1.4-1.4L10.8 12l5.3-5.3Z"/></svg>`;


/** Watches the height of the dashboard menu (see where the menu is drawn). */
let navWatch = null;
// The dashboard menu. Each login only sees the sections its role allows
// (see SECTION_AREA and canManage in core/auth.js — the database enforces the same).
const NAV = [
  ["Match nights", [["overview", "Overview"], ["results", "Results to approve"]]],
  ["Fixtures", [["fixtures", "All fixtures"], ["byes", "Bye weeks"], ["generator", "Fixture generator"], ["import", "Import from CSV"]]],
  ["League", [["leagues", "Leagues"], ["teams", "Teams"], ["players", "Players"], ["cueviews", "CueViews to approve"], ["handicaps", "Handicaps"], ["handicap_suggest", "Suggested handicaps"], ["venues", "Venues"], ["seasons", "Seasons"]]],
  ["Competitions", [["comp_wizard", "Set up step by step"], ["competitions", "Competitions"], ["entries", "Entries to approve"], ["draws", "Draws, results & live scores"], ["scoreboard", "Live scoreboard"], ["awards", "Presentation awards"]]],
  ["People", [["accounts", "Logins"]]],
  // Rich, round 24: the long "Website" list split into groups.
  ["News", [["articles", "News"], ["approvals", "News to approve"], ["write", "Write news step by step"], ["categories", "News categories"], ["notices", "Notifications"], ["announcements", "Announcements"]]],
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
const SPECIAL = { overview, results, generator, draws, media: mediaPage, stats: statsPage, import: importPage, handicaps: handicapsPage, entries: entriesPage,
  roles: rolesPage, activity: activityPage, backup: backupPage, awards: awardsPage, scoreboard: scoreboardPage, emails: emailsPage, cueviews: cueviewsPage, write: newsWizardPage, approvals: newsApprovePage,
  campaigns: campaignsPage, subscribers: subscribersPage, market: marketPage, comments: commentsPage, menu: menuPage, seo: seoPage, links: linksPage, performance: performancePage, security: securityPage, versions: versionsPage, handicap_suggest: handicapSuggestPage,
  support: supportPage, support_categories: supportCategoriesPage, comp_wizard: compWizardPage };
// Menu items that show a red number when something is waiting.
const COUNTS = { players: "Players waiting to be accepted", entries: "Entries waiting for payment", cueviews: "CueViews waiting to be checked", approvals: "News waiting for your approval", market: "Adverts waiting for approval", support: "Support requests waiting for an answer" };
const COUNT_WORD = { players: "new", entries: "waiting", cueviews: "waiting", approvals: "waiting", market: "waiting", support: "to answer" };
// A small picture for each group of the menu.
const ico = (d) => html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const GROUP_ICON = {
  "Match nights": ico("M9 2h6a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2-2Zm0 2v2h6V4Zm1.6 13.4 6-6L15.2 10l-4.6 4.6-1.8-1.8-1.4 1.4Z"),
  Fixtures: ico("M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2Zm12 8H5v10h14ZM7 12h4v4H7Z"),
  League: ico("M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 5v3h5V9Zm7 0v3h7V9Zm-7 5v4h5v-4Zm7 0v4h7v-4Z"),
  Competitions: ico("M7 3h10v2h4v3a4 4 0 0 1-4.2 4A5 5 0 0 1 13 15.9V19h3v2H8v-2h3v-3.1A5 5 0 0 1 7.2 12 4 4 0 0 1 3 8V5h4Zm0 4H5v1a2 2 0 0 0 2 2Zm10 3a2 2 0 0 0 2-2V7h-2Z"),
  People: ico("M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z"),
  Website: ico("M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6v2h3v2H7v-2h3v-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v10h16V6Z"),
  News: ico("M4 4h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Zm2 2v4h9V6Zm0 6v2h9v-2Zm0 4v2h6v-2Zm13-8h2v10a2 2 0 0 1-4 0V8Z"),
  "Pages & content": ico("M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5ZM7 11v2h10v-2Zm0 4v2h10v-2Z"),
  "Sponsors & adverts": ico("M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Zm13-3.5v11a6 6 0 0 0 0-11Zm0-4v2.1a8 8 0 0 1 0 14.8v2.1a10 10 0 0 0 0-19Z"),
  Support: ico("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 15.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm1.2-4.6v.6h-2.4v-1c0-1.3.8-2 1.6-2.6.7-.5 1.2-.9 1.2-1.6a1.6 1.6 0 0 0-3.2.1H8a4 4 0 0 1 8 0c0 1.6-1 2.4-1.8 3-.6.4-1 .8-1 1.5Z"),
  Community: ico("M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"),
  "Look & settings": ico("m19.4 13 .1-1-.1-1 2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4L10.7 6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11l-.1 1 .1 1-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"),
  Tools: ico("M21 18.6 13.4 11a5 5 0 0 0-6.5-6.5L10.2 8 8 10.2 4.5 6.9A5 5 0 0 0 11 13.4l7.6 7.6Z"),
  Newsletter: ico("M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2.4V17h16V7.4l-8 5.2Zm1.4-.4L12 10.4 18.6 7Z"),
  "Master Admin": ico("M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5Zm-1.2 13.4-3.3-3.3 1.4-1.4 1.9 1.9 4.3-4.3 1.4 1.4Z"),
  "My team": ico("m12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9Z"),
  Demo: ico("M12 5V2L7.5 6.5 12 11V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z"),
};
const logoutIcon = ico("M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5Zm6.6 4.6-1.4 1.4 2 2H9v2h8.2l-2 2 1.4 1.4L21 12Z");
// Which groups of the menu are folded away (remembered on this device).
const FOLD_KEY = "sbdsl-admin-folded";
const folded = () => { try { return new Set(JSON.parse(localStorage.getItem(FOLD_KEY) || "[]")); } catch { return new Set(); } };

export default async function admin(view, { params, user, query }) {
  if (!user) return mustLogin(view);
  if (!isStaff(user)) return navigate("/my", { replace: true });
  // "Write news step by step" is only listed for people who can't open News itself (it is the big button at the top of News).
  const nav = NAV.map(([group, items]) => [group, items.filter(([key]) => canOpenSection(user, key) && !(key === "write" && canOpenSection(user, "articles")))]).filter(([, items]) => items.length);
  // Where the dashboard opens: the first section of this login's own area (Handicaps is shared, so it isn't the landing page).
  const mine = nav.flatMap(([, items]) => items);
  const first = (mine.find(([key]) => key !== "handicaps" && key !== "comp_wizard") ?? mine[0])[0];
  if (!params.section && first !== "overview") return navigate(`/admin/${first}`, { replace: true });
  const section = params.section || first;
  const title = NAV.flatMap(([, items]) => items).find(([k]) => k === section)?.[1] ?? "Admin";
  setTitle(`Admin – ${title}`);
  const closed = folded();
  const count = (key) => (COUNTS[key] ? html` <span class="nav-count" data-count="${key}" title="${COUNTS[key]}" hidden></span>` : "");

  mount(view, html`<div class="wrap wide">
    <div class="admin-crumbs"><button type="button" class="back-link admin-back" data-admin-back aria-label="Back to the previous screen">${backIcon}<span>Back</span></button>
    ${breadcrumb([["Home", "/"], ["Admin", "/admin"], [title]])}</div>
    <h1>${title}</h1>
    <div data-db-behind></div>
    <label class="admin-jump">Admin menu
      <select data-admin-jump>${nav.map(([group, items]) => html`<optgroup label="${group}">
        ${items.map(([key, label]) => html`<option value="${key}" data-label="${label}" ${key === section ? "selected" : ""}>${label}</option>`)}</optgroup>`)}</select></label>
    <div class="admin">
      <nav class="admin-nav" aria-label="Admin menu">
        <label class="admin-find">${ico("M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z")}
          <input type="search" placeholder="Find a page, player, team, match…" data-admin-find aria-label="Find in the dashboard" autocomplete="off"></label>
        ${[...nav, ...(isMember(user) ? [["My team", [["/my", "My Team area"]]]] : []), ...(DEMO_MODE ? [["Demo", [["#reset", "Reset sample data"]]]] : [])].map(([group, items]) => {
          const here = items.some(([key]) => key === section), shut = !here && closed.has(group);
          return html`<section class="nav-group ${here ? "has-active" : ""} ${shut ? "shut" : ""}" data-group="${group}">
            <button type="button" class="nav-group-head" aria-expanded="${shut ? "false" : "true"}"><span class="nav-ico">${GROUP_ICON[group] ?? ""}</span><span>${group}</span><small>${items.length}</small><i class="chev" aria-hidden="true"></i></button>
            <div class="nav-items">${items.map(([key, label]) => (key === "#reset" ? html`<a href="#" data-reset-demo>${label}</a>`
              : key.startsWith("/") ? html`<a href="${key}">${label}</a>`
              : html`<a href="/admin/${key}" class="${key === section ? "active" : ""}" ${key === section ? html`aria-current="page"` : ""}>${label}${count(key)}</a>`))}</div>
          </section>`; })}
        <p class="admin-none" hidden>Nothing in the menu matches.</p>
        <div class="admin-records" data-admin-records hidden></div>
        <button type="button" class="admin-logout" data-logout>${logoutIcon}<span>Log out</span></button>
        <p class="admin-version">Website version ${SITE_VERSION}</p>
      </nav>
      <div id="admin-body"></div>
    </div>
    <button type="button" class="admin-logout admin-logout-m" data-logout>${logoutIcon}<span>Log out</span></button>
  </div>`);

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

  // Fold a group away or open it again (the group you are in always starts open).
  const menu = $(".admin-nav", view);
  // The menu never scrolls inside: it is as long as its items. The stylesheet is told how tall that is, so a menu
  // taller than the screen can follow the page down to its last item (style.css: .admin-nav).
  navWatch?.disconnect();
  if (typeof ResizeObserver === "function") {
    navWatch = new ResizeObserver(() => menu.style.setProperty("--admin-nav-h", `${menu.offsetHeight}px`));
    navWatch.observe(menu);
  }
  menu.addEventListener("click", (e) => {
    const head = e.target.closest(".nav-group-head");
    if (!head) return;
    const group = head.parentElement, shut = group.classList.toggle("shut");
    head.setAttribute("aria-expanded", String(!shut));
    const now = folded(); now[shut ? "add" : "delete"](group.dataset.group);
    try { localStorage.setItem(FOLD_KEY, JSON.stringify([...now])); } catch { /* not remembered */ }
  });
  // Type a few letters to find a page of the dashboard; Enter opens the first one found.
  const find = $("[data-admin-find]", view);
  find.addEventListener("input", () => {
    const q = find.value.trim().toLowerCase();
    let any = false;
    for (const group of menu.querySelectorAll(".nav-group")) {
      const whole = !q || group.dataset.group.toLowerCase().includes(q);
      let shown = 0;
      for (const a of group.querySelectorAll(".nav-items a")) { const hit = whole || a.textContent.toLowerCase().includes(q); a.classList.toggle("nav-hide", !hit); if (hit) shown++; }
      group.classList.toggle("nav-hide", !shown);
      group.classList.toggle("finding", !!q);
      any ||= shown > 0;
    }
    $(".admin-none", view).hidden = any || q.length >= 2;
    menu.classList.toggle("finding", !!q);   // on phones the results only show while searching
    findRecords(q);
  });
  // Round 40: the search also finds players, teams, venues, leagues, competitions, news and this season's fixtures,
  // and opens them ready to edit (only the parts of the dashboard this login has).
  let index = null;
  const buildIndex = async () => {
    const [players, teams, venues, leagues, comps, news] = await Promise.all([
      table("players", "full_name").catch(() => []), table("teams", "name").catch(() => []), table("venues", "name").catch(() => []),
      table("leagues", "sort").catch(() => []), table("competitions", "sort").catch(() => []), articleList().catch(() => [])]);
    const teamName = (id) => teams.find((t) => t.id === id)?.name ?? "?";
    const ctx = await seasonContext().catch(() => null);
    const out = [];
    const push = (section, kind, label, sub, href) => { if (canOpenSection(user, section)) out.push({ kind, label, sub, href, key: `${label} ${sub}`.toLowerCase() }); };
    for (const p of players) push("players", "Player", p.full_name, teamName(p.team_id), `/admin/players?edit=${p.id}`);
    for (const t of teams) push("teams", "Team", t.name, "", `/admin/teams?edit=${t.id}`);
    for (const v of venues) push("venues", "Venue", v.name, "", `/admin/venues?edit=${v.id}`);
    for (const l of leagues) push("leagues", "League", l.name, "", `/admin/leagues?edit=${l.id}`);
    for (const c of comps) push("draws", "Competition", c.name, "Draws & results", `/admin/draws?c=${c.id}`);
    for (const a of news) push("articles", "News", a.title, a.published_at ? fmtDate(a.published_at) : "", `/admin/articles?edit=${a.id}`);
    // Round 73: every page of the dashboard, and every setting on the settings pages (Branding, Site settings…),
    // found by its name or its explanation — "logo", "loading screen", "banner", "ticker"…
    const groupOf = (key) => NAV.find(([, items]) => items.some(([k]) => k === key))?.[0] ?? "Dashboard";
    for (const [key, res] of Object.entries(RESOURCES)) {
      if (!canOpenSection(user, key)) continue;
      out.push({ kind: "Page", label: res.label, sub: groupOf(key), href: `/admin/${key}`, key: `${res.label} ${groupOf(key)} ${res.intro ?? ""}`.toLowerCase() });
      if (!res.single) continue;
      let tab = "";
      res.fields.forEach((f, i) => {
        if (f.type === "heading" && f.tab) tab = f.tab;
        if (f.type === "custom" || !f.label) return;
        const label = String(f.type !== "heading" ? f.label.split(/\s[(—]/)[0].trim() || f.label : f.label).slice(0, 90);
        const fk = f.type === "heading" ? `h${i}` : f.name;
        out.push({ kind: f.type === "heading" ? "Settings" : "Setting", label, sub: `${res.label}${tab ? ` → ${tab}` : ""}`,
          href: `/admin/${key}?find=${encodeURIComponent(fk)}`, key: `${f.label} ${f.help ?? ""} ${f.short ?? ""} ${res.label} ${tab}`.toLowerCase() });
      });
    }
    for (const f of ctx?.fixtures ?? []) push("fixtures", "Match", `${teamName(f.home_team_id)} v ${teamName(f.away_team_id)}`, `${fmtDate(f.starts_at)} · scorecard`, urls.scorecard(f));
    return out;
  };
  const findRecords = async (q) => {
    const box = $("[data-admin-records]", view);
    if (q.length < 2) { box.hidden = true; return; }
    index ??= await buildIndex();
    if (find.value.trim().toLowerCase() !== q) return;   // typed on since
    const words = q.split(/\s+/);
    // Best first: a name that starts with what was typed, then a name that contains it, then the rest (a team's players…).
    const KIND = ["Settings", "Setting", "Page", "Team", "League", "Competition", "Venue", "Player", "Match", "News"];
    const rank = (r) => { const l = r.label.toLowerCase(); return l.startsWith(q) ? 0 : words.every((w) => l.includes(w)) ? 1 : 2; };
    const hits = index.filter((r) => words.every((w) => r.key.includes(w)))
      .sort((a, b) => rank(a) - rank(b) || KIND.indexOf(a.kind) - KIND.indexOf(b.kind) || a.label.localeCompare(b.label)).slice(0, 16);
    box.hidden = false;
    mount(box, hits.length ? html`<small class="ar-head">Settings, players, teams, matches…</small>${hits.map((r) => html`<a href="${r.href}"><i>${r.kind}</i><span>${r.label}${r.sub ? html` <small>${r.sub}</small>` : ""}</span></a>`)}`
      : html`<small class="ar-head">Nothing in the dashboard matches “${q}”.</small>`);
  };
  find.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const first = menu.querySelector(".nav-group:not(.nav-hide) .nav-items a:not(.nav-hide)") ?? menu.querySelector("[data-admin-records]:not([hidden]) a");
    if (first && find.value.trim()) { e.preventDefault(); first.click(); }
  });

  $("[data-reset-demo]")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("Reset all demo data back to the sample league? You'll be logged out.")) return;
    resetDemo(); await refreshShell(); navigate("/login");
  });

  $("[data-admin-jump]").addEventListener("change", (e) => navigate(`/admin/${e.target.value}`));
  // Back (Rich, round 54): the screen you were on before, or the dashboard if you came straight here.
  $("[data-admin-back]", view)?.addEventListener("click", () => (history.length > 1 && document.referrer !== location.href ? history.back() : navigate("/admin")));

  // The red numbers in the menu: new players still to be checked, and competition entries
  // waiting for payment. Worked out again whenever something is saved, so they go as soon as it's dealt with.
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
    for (const [key, n] of Object.entries(waiting)) {
      const badge = $(`[data-count="${key}"]`, view);
      if (badge) { badge.textContent = n; badge.hidden = !n; }
      const opt = $(`[data-admin-jump] option[value="${key}"]`, view);
      if (opt) opt.textContent = `${opt.dataset.label}${n ? ` (${n} ${COUNT_WORD[key]})` : ""}`;
    }
  };
  drawCounts();

  const body = $("#admin-body");
  if (!canOpenSection(user, section)) {
    return mount(body, html`<div class="notice error">Your login doesn't include this part of the dashboard. Ask the Master Admin if you need it.</div>`);
  }
  if (SPECIAL[section]) return SPECIAL[section](body, { user, onChange: drawCounts });
  if (RESOURCES[section]) {
    const current = (await table("seasons", "name")).find((s) => s.is_current);
    // News: the easy way in, for anyone who finds the full form a lot.
    let into = body;
    if (section === "articles" && !query.get("edit")) {
      mount(body, html`${isMaster(user) ? "" : html`<div class="notice">Articles you publish go to the Master Admin to approve before they appear on the website (they show as not published until then).</div>`}<a class="nw-invite" href="/admin/write"><b>✎ Write news step by step</b><span>One question at a time: headline, category, story, quote, pictures and this week's tables.</span></a><div></div>`);
      into = body.lastElementChild;
    }
    // Round 75 (Rich): competitions too.
    if (section === "competitions" && !query.get("edit")) {
      mount(body, html`<a class="nw-invite" href="/admin/comp_wizard"><b>🏆 Set up a competition step by step</b><span>One step at a time: the competition, the details, entries, entrants, the draw, deadlines and dates.</span></a><div></div>`);
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
  // Each box opens the list behind its number (only for the parts of the dashboard this login has).
  const stats = [
    ["Teams", ctx.teams.length, "teams", "/admin/teams"], ["Players", ctx.players.length, "players", "/admin/players"], ["Fixtures", ctx.fixtures.length, "fixtures", "/admin/fixtures"],
    ["Approved", count("approved"), "fixtures", "/admin/fixtures?status=approved"], ["Awaiting approval", count("submitted"), "results", "/admin/results"], ["Live now", count("in_progress"), "results", "/admin/results"],
  ];
  const fresh = ctx.players.filter((p) => p.needs_review);
  const news = canOpenSection(user, "approvals") ? await waitingNews().catch(() => []) : [];
  // Round 40: Tonight (the match night), Needs you (everything waiting, in one list) and, for the Master Admin,
  // the last things they changed with Undo. The old one-line reminders are all in Needs you now.
  mount(el, html`
    <div class="ov-grid"><div data-ov-tonight></div><div data-ov-needs></div></div>
    <div class="stats">${stats.map(([l, n, section, href]) => (canOpenSection(user, section)
      ? html`<a class="stat stat-link" href="${href}" title="Open ${l.toLowerCase()}"><b>${n}</b>${l}<i aria-hidden="true">→</i></a>` : html`<div class="stat"><b>${n}</b>${l}</div>`))}</div>
    <p>Season: <b>${ctx.season?.name ?? "none — add one under Seasons"}</b>. Match nights: captains enter frames on their phones,
      press <b>Submit final result</b>, then you approve them under <a href="/admin/results" style="color:var(--red);font-weight:700">Results to approve</a>.
      Approved results are locked for captains; you can still edit them.</p>
    <div class="btn-row"><a class="btn" href="/admin/results">Results to approve</a>
      ${[["accounts", "secondary", "Manage logins"], ["generator", "blue", "Generate a season's fixtures"], ["leagues", "green", "Add a league"], ["draws", "ghost", "Competition draws"], ["roles", "ghost", "Roles & permissions"]]
        .filter(([key]) => canOpenSection(user, key)).map(([key, cls, label]) => html`<a class="btn ${cls}" href="/admin/${key}">${label}</a>`)}</div>
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
  mount(el, html`<div class="notice">Creates a full round-robin for one league: every team plays every other team, home and away.
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
