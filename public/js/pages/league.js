import { html, mount } from "../core/dom.js";
import { table } from "../core/api.js";
import { breadcrumb, urls } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

// Built-in sections first, then every page from the admin "Pages" section.
const BUILT_IN = [
  ["News", "From latest news, to competition results and CueViews", "/news"],
  ["Seasons", "Each season's fixtures, results, tables, rankings and breaks", "/seasons"],
  ["Season archive", "Roll of honour: past seasons' tables, breaks and highest breaks", "/archive"],
  ["Competitions", "Cup competitions, singles, doubles and more", "/competitions"],
  ["Our Players", "Every team's players, past and present", "/players"],
  ["Form guide", "Who's in form: every player and team marked out of 10 from their last 6 matches", "/form"],
  ["Send in your CueView", "Players: answer the CueView questions for your own player page", "/cueview"],
  ["Handicaps", "Every player's current handicap", "/handicaps"],
  ["Venues", "Clubs, venues, and locations, all you need to know", "/venues"],
  ["Rules", "The league's rules and the rules of the game", "/rules"],
  ["Meetings", "The AGM and committee meetings: dates, agendas and minutes", "/meetings"],
  ["Merchandise", "League shirts and more: what there is and how to order", "/merchandise"],
  ["Presentation night", "The trophies, and the winners and runners-up of every league and competition", "/presentation"],
  ["Season review", "The season at a glance: honours, top players and the numbers", "/season-review"],
  ["Live scoreboard", "Finals scored ball by ball, as they happen", "/scoreboard"],
  ["Sadly no longer with us", "Remembering the players and friends the league has lost", "/in-memoriam"],
  ["Hall of Fame", "The players, teams and moments that made the league — and share a memory", "/hall-of-fame"],
  ["Downloads", "Posters, rules for the club wall and competition entry forms", "/downloads"],
  ["Marketplace", "Cues, cases and kit for sale between players", "/marketplace"],
  ["Sponsorship", "Gold, Silver and Bronze packages for businesses", "/sponsorship"],
];

// Round 76 (Neil: "the cards don't feel good — make them look more professional"): each card has an icon for what it
// is, the title and a line about it on the left, and an arrow — the whole card is the link.
const ICON = {
  table: "M3 4h18v16H3Zm2 2v3h14V6Zm0 5v7h4v-7Zm6 0v7h8v-7Z",
  shield: "M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5Zm0 2.2 6 2.3V11c0 3.9-2.5 7.4-6 8.9-3.5-1.5-6-5-6-8.9V6.5Z",
  news: "M4 4h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Zm15 4h2v10a2 2 0 0 1-2 2 1 1 0 0 1-1-1V8Zm-13 0v3h9V8Zm0 5v2h9v-2Zm0 4v1h9v-1Z",
  calendar: "M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2Zm12 8H5v10h14Z",
  trophy: "M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3Zm10 4v3a2 2 0 0 0 1-1.7V7ZM6 7v1.3A2 2 0 0 0 7 10V7Zm-1 14h14v1H5Z",
  people: "M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1Zm17 1v-1c0-1.9-.8-3.6-2.1-4.9 3.6.3 6.1 2.3 6.1 4.9v1Z",
  chart: "M4 20V10h3v10Zm6 0V4h3v16Zm6 0v-7h3v7Z",
  star: "m12 2 3 6.6 7 .7-5.3 4.8 1.6 7-6.3-3.7-6.3 3.7 1.6-7L2 9.3l7-.7Z",
  info: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 8v7h2v-7Zm0-4v2h2V6Z",
  pin: "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z",
  book: "M5 3h11a3 3 0 0 1 3 3v15H7a2 2 0 0 1-2-2Zm2 14v2h10v-2Zm2-11v2h7V6Zm0 4v2h7v-2Z",
  bag: "M6 7V6a6 6 0 0 1 12 0v1h3l-1 15H4L3 7Zm2 0h8V6a4 4 0 0 0-8 0Z",
  download: "M11 3h2v9l3.3-3.3 1.4 1.4L12 15.8l-5.7-5.7 1.4-1.4L11 12ZM4 18h16v3H4Z",
  heart: "M12 21s-8-5.1-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.9-8 11-8 11Z",
  live: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4.2 4.2l1.4 1.4a9 9 0 0 0 0 12.8l-1.4 1.4a11 11 0 0 1 0-15.6Zm15.6 0a11 11 0 0 1 0 15.6l-1.4-1.4a9 9 0 0 0 0-12.8Z",
};
const iconFor = (title, key) => {
  const t = title.toLowerCase();
  if (/shield/.test(t)) return ICON.shield;
  if (/\bleague$/.test(t)) return ICON.table;
  if (/news/.test(t)) return ICON.news;
  if (/season|archive|review/.test(t)) return ICON.calendar;
  if (/competition|presentation|trophy/.test(t)) return ICON.trophy;
  if (/form|handicap/.test(t)) return ICON.chart;
  if (/scoreboard/.test(t)) return ICON.live;
  if (/players|cueview/.test(t)) return ICON.people;
  if (/hall of fame/.test(t)) return ICON.star;
  if (/memoriam|no longer/.test(t)) return ICON.heart;
  if (/venue/.test(t)) return ICON.pin;
  if (/rules|meeting/.test(t)) return ICON.book;
  if (/download/.test(t)) return ICON.download;
  if (/merch|market|sponsor|shop/.test(t)) return ICON.bag;
  return key === "shop" ? ICON.bag : ICON.info;
};
const lgCard = (title, text, href, key) => html`<a class="lg-card" href="${href}">
  <span class="lg-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconFor(title, key)}"/></svg></span>
  <span class="lg-body"><b>${title}</b>${text ? html`<small>${text}</small>` : ""}</span>
  <i class="lg-go" aria-hidden="true">→</i></a>`;

export default async function league(view) {
  setTitle("Our League");
  adminEdit("pages", null, { label: "Edit info pages" });
  const [pages, leagues] = await Promise.all([table("pages", "sort"), table("leagues", "sort")]);
  const builtIn = new Set(BUILT_IN.map(([title]) => title.toLowerCase()));
  const tiles = [
    ...BUILT_IN,
    ...leagues.map((l) => [l.name, "Full table, player rankings and breaks", urls.standings(l)]),
    ...leagues.filter((l) => l.shield_team_id).map((l) => [l.shield_name || `${l.name} Runabout Shield`, "Who holds it, who has won it most, and where it has been", urls.shield(l)]),
    // Info pages — except the sets of rules (they are the tabs of the Rules page) and any with the same name as a built-in tile.
    ...pages.filter((p) => p.show_in_league !== false && !p.show_in_rules && !builtIn.has(p.title.trim().toLowerCase())).map((p) => [p.title, p.summary, urls.page(p)]),
  ];
  // Rich, round 53: "a lot on here and you need to scroll" — the tiles in groups, like the admin menu, with a row of
  // buttons at the top to jump to each group. Anything not named below (new info pages) goes under League information.
  const GROUPS = [
    ["season", "This season", ["News", "Seasons", "Competitions", "Form guide", "Handicaps", "Live scoreboard"]],
    ["players", "Players", ["Our Players", "Send in your CueView", "Hall of Fame", "Sadly no longer with us"]],
    ["history", "Honours & history", ["Season archive", "Presentation night", "Season review"]],
    ["info", "League information", ["Rules", "Venues", "Meetings", "Downloads"]],
    ["shop", "Shop & support", ["Merchandise", "Marketplace", "Sponsorship"]],
  ];
  const named = new Map(GROUPS.flatMap(([key, , list]) => list.map((t) => [t, key])));
  const leagueKeys = new Set([...leagues.map((l) => l.name), ...leagues.filter((l) => l.shield_team_id).map((l) => l.shield_name || `${l.name} Runabout Shield`)]);
  const groupOf = ([t]) => (leagueKeys.has(t) ? "season" : named.get(t) ?? "info");
  // The leagues' own tables and shields lead "This season" — they are what people come for.
  const sections = GROUPS.map(([key, name]) => [key, name, tiles.filter((x) => groupOf(x) === key).sort((x, y) => leagueKeys.has(y[0]) - leagueKeys.has(x[0]))])
    .filter(([, , list]) => list.length);
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League"]])}
    <h1>Our League</h1>
    <nav class="league-jump" aria-label="Jump to">${sections.map(([key, name]) => html`<a href="#lg-${key}">${name}</a>`)}</nav>
    ${sections.map(([key, name, list]) => html`<section class="league-group" id="lg-${key}"><h2 class="league-group-h">${name}</h2>
      <div class="lg-cards">${list.map(([t, text, href]) => lgCard(t, text, href, key))}</div></section>`)}
  </div>`);
}
