// Site search: the magnifying glass in the menu opens an overlay that
// searches players, teams, competitions, venues, news and info pages.
import { html, mount, $, fmtDate, fmtAgo } from "./dom.js";
import { table, articles, loadCompetitions, marketAds } from "./api.js";
import { hiddenFromSearch, isHidden } from "./seo.js";
import { urls, blankAvatar } from "./components.js";
import { navigate } from "./router.js";
import { seasonContext } from "./context.js";

/**
 * Round 53 (Neil): the website's own pages, so people can type where they want to go — "fixtures", "tables",
 * "my snooker" — and jump straight there. [name, address, what it is, other words people might type].
 */
const SITE_PAGES = (season) => [
  ["Home", "/", "The home page", "front start main"],
  ["My Snooker", "/mysnooker", "Your team's stats, table, rankings and breaks", "my team mine star favourite follow"],
  ["My Snooker settings", "/my/snooker", "Who you follow and what you see on My Snooker", "settings follow"],
  ["Fixtures", "/fixtures", "Every team's matches this season", "matches games schedule"],
  ["Results", "/results", "The latest results", "scores scorecards"],
  ["League tables", urls.season(season, "league-tables"), "The tables for every league", "league table standings positions"],
  ["Rankings", urls.season(season, "rankings"), "The player rankings for every league", "ranking points top players"],
  ["Breaks", urls.season(season, "breaks"), "The highest breaks this season", "highest break century"],
  ["Our League", "/league", "Tables, seasons, venues and more", "league"],
  ["Competitions", "/competitions", "Cups and knockouts: draws and results", "cups knockout draw tournament comps"],
  ["Enter a competition", "/enter", "Sign up for a competition", "entry enter sign up"],
  ["Calendar", "/calendar", "Every match and date, month by month", "dates diary"],
  ["Handicaps", "/handicaps", "Every player's handicap", "handicap"],
  ["News", "/news", "The latest news and match reports", "articles reports stories"],
  ["Live", "/live", "Matches being played now", "live now tonight"],
  ["Live scoreboard", "/scoreboard", "Ball-by-ball scoring", "scoreboard ball by ball"],
  ["Our players", "/players", "Every player in the league", "players people"],
  ["Form guide", "/form", "Who's in form: marks out of 10", "form"],
  ["Seasons", "/seasons", "This season and past seasons", "history archive past"],
  ["Season wrapped", "/wrapped", "The season in numbers", "wrapped review"],
  ["Venues", "/venues", "Where the matches are played", "clubs venue address"],
  ["Rules", "/rules", "The league rules", "rules help"],
  ["Help", "/page/help", "Questions and answers about the website and the league", "help faq questions how"],
  ["Contact the league", "/support", "Send the league a question or a problem — and see your requests", "support contact ticket problem question email help request"],
  ["Hall of Fame", "/hall-of-fame", "The league's greats", "fame legends"],
  ["In memoriam", "/in-memoriam", "Remembering players we have lost", "memorial passed away"],
  ["Marketplace", "/marketplace", "Buy and sell snooker things", "buy sell cue"],
  ["Downloads", "/downloads", "Forms and documents", "documents forms files"],
  ["Meetings", "/meetings", "League meetings", "agm meeting"],
  ["Sponsorship", "/sponsorship", "Sponsor the league", "sponsor"],
  ["Newsletter", "/newsletter", "Sign up for the newsletter", "email newsletter"],
  ["Log in", "/login", "Players, captains and officers", "login sign in account password"],
];

const PER_GROUP = 6;
let index = null;

/** Everything searchable, loaded the first time the overlay opens. */
async function buildIndex() {
  const [players, teams, venues, pages, news, comps, ads, hidden, ctx] = await Promise.all([
    table("players", "full_name"), table("teams", "name"), table("venues", "name"),
    table("pages", "sort"), articles(), loadCompetitions(), marketAds().catch(() => []), hiddenFromSearch(), seasonContext().catch(() => null),
  ]);
  const team = new Map(teams.map((t) => [t.id, t]));
  // Pages ticked "Leave out of the site search" under Admin → Website → SEO are left out (Rich, round 22).
  return [
    ...SITE_PAGES(ctx?.season).map(([title, href, sub, more]) => ({ group: "Go to", title, sub, more, href })),
    ...players.map((p) => ({ group: "Players", title: p.full_name, sub: team.get(p.team_id)?.name ?? "", href: urls.player(p), img: p.avatar_url || blankAvatar(p) })),
    ...teams.map((t) => ({ group: "Teams", title: t.name, sub: "Fixtures & results", href: urls.team(t), img: t.logo_url })),
    ...comps.competitions.map((c) => ({ group: "Competitions", title: c.name, sub: `${c.kind} competition`, href: urls.competition(c), img: c.image_url })),
    ...venues.map((v) => ({ group: "Venues", title: v.name, sub: v.address ?? "", href: urls.venue(v), img: v.image_url })),
    ...news.map((a) => ({ group: "News", title: a.title, sub: `${a.category} · ${fmtAgo(a.published_at)}`, more: a.excerpt ?? "", href: urls.article(a), img: a.circle_image_url || a.image_url })),
    ...pages.map((p) => ({ group: "Pages", title: p.title, sub: p.summary ?? "", href: urls.page(p) })),
    ...ads.filter((a) => a.status === "approved").map((a) => ({ group: "Marketplace", title: a.title, sub: a.price != null ? `£${Number(a.price).toFixed(2).replace(/\.00$/, "")}` : "Marketplace", more: a.description ?? "", href: `/marketplace/${a.no ?? a.id}`, img: a.image_url })),
  ].filter((it) => !isHidden(hidden, it.href));
}

/** Best matches first: names that start with the search, then names containing it, then descriptions. */
function find(items, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const it of items) {
    const title = it.title.toLowerCase(), rest = `${it.sub} ${it.more ?? ""}`.toLowerCase();
    if (!words.every((w) => title.includes(w) || rest.includes(w))) continue;
    scored.push({ it, rank: title.startsWith(words[0]) ? 0 : words.every((w) => title.includes(w)) ? 1 : 2 });
  }
  return scored.sort((a, b) => a.rank - b.rank || a.it.title.localeCompare(b.it.title)).map((x) => x.it);
}

export async function openSearch() {
  if ($("dialog.search")) return;
  const dlg = document.createElement("dialog");
  dlg.className = "search";
  mount(dlg, html`<div class="search-bar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/></svg>
      <input type="search" placeholder="Search pages, players, teams, news…" aria-label="Search the website" autocomplete="off">
      <button type="button" data-close aria-label="Close search">×</button></div>
    <div class="search-results" data-results><p class="search-hint">Type a page (Fixtures, League tables, My Snooker…), a player, a team or a news story</p></div>`);
  document.body.append(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  const input = $("input", dlg), results = $("[data-results]", dlg);
  let first = null;

  const draw = () => {
    const q = input.value.trim();
    if (q.length < 2) { first = null; return mount(results, html`<p class="search-hint">Type a page (Fixtures, League tables, My Snooker…), a player, a team or a news story</p>`); }
    if (!index) return mount(results, html`<p class="search-hint">Loading…</p>`);
    const hits = find(index, q);
    first = hits.find((h) => h.group === "Go to") ?? hits[0] ?? null;
    const groups = new Map();
    groups.set("Go to", []);   // the website's own pages always come first
    for (const h of hits) (groups.get(h.group) ?? groups.set(h.group, []).get(h.group)).push(h);
    if (!groups.get("Go to").length) groups.delete("Go to");
    mount(results, hits.length ? [...groups].map(([g, items]) => html`<h4>${g}</h4>
      ${items.slice(0, PER_GROUP).map((h) => html`<a class="search-hit" href="${h.href}">
        ${h.img ? html`<img src="${h.img}" alt="" loading="lazy">` : h.group === "Go to" ? html`<span class="search-dot go">→</span>` : html`<span class="search-dot">${String(h.title).trim().charAt(0).toUpperCase()}</span>`}
        <span><strong>${h.title}</strong><small>${h.sub}</small></span></a>`)}
      ${items.length > PER_GROUP ? html`<p class="search-more">+ ${items.length - PER_GROUP} more — keep typing to narrow it down</p>` : ""}`)
      : html`<p class="search-hint">Nothing found for “${q}”.</p>`);
  };

  input.addEventListener("input", draw);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && first) { close(); navigate(first.href); } });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) return close();
    const hit = e.target.closest(".search-hit");
    if (hit) { e.preventDefault(); close(); navigate(hit.getAttribute("href")); }
  });
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dlg.showModal();
  input.focus();
  // The index is rebuilt each time the overlay opens, so new results show up straight away.
  index = await buildIndex().catch(() => []);
  draw();
}
