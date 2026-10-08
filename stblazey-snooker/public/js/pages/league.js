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
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League"]])}
    <h1>Our League</h1>
    <div class="cards">${tiles.map(([t, text, href]) => tile(t, text, href, "tall"))}</div>
  </div>`);
}
