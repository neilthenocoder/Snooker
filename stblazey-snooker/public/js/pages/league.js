import { html, mount } from "../core/dom.js";
import { table } from "../core/api.js";
import { breadcrumb, tile, urls } from "../core/components.js";
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
      <div class="cards">${list.map(([t, text, href]) => tile(t, text, href, "tall"))}</div></section>`)}
  </div>`);
}
