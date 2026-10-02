import { html, mount } from "../core/dom.js";
import { table } from "../core/api.js";
import { breadcrumb, tile, urls } from "../core/components.js";
import { setTitle } from "../core/router.js";

// Built-in sections first, then every page from the admin "Pages" section.
const BUILT_IN = [
  ["News", "From latest news, to competition results and CueViews", "/news"],
  ["Seasons", "Latest season, and season archives", "/fixtures"],
  ["Competitions", "Cup competitions, singles, doubles and more", "/competitions"],
  ["Our Players", "Every team's players, past and present", "/players"],
  ["Handicaps", "Every player's current handicap", "/handicaps"],
  ["Venues", "Clubs, venues, and locations, all you need to know", "/venues"],
];

export default async function league(view) {
  setTitle("Our League");
  const [pages, leagues] = await Promise.all([table("pages", "sort"), table("leagues", "sort")]);
  const tiles = [
    ...BUILT_IN,
    ...leagues.map((l) => [l.name, "Full table, player rankings and breaks", urls.standings(l)]),
    ...pages.filter((p) => p.show_in_league !== false).map((p) => [p.title, p.summary, urls.page(p)]),
  ];
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League"]])}
    <h1>Our League</h1>
    <div class="cards">${tiles.map(([t, text, href]) => tile(t, text, href, "tall"))}</div>
  </div>`);
}
