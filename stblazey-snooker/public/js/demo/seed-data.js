// ─────────────────────────────────────────────────────────────
//  SAMPLE DATA — placeholder league used in demo mode and by
//  scripts/build-seed.mjs to produce supabase/seed.sql.
//  Player names are imaginary. Replace with real data via the admin.
// ─────────────────────────────────────────────────────────────

import { slugify, londonISO, roundRobin, addDays } from "../core/schedule.js";

const uuid = (() => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, "0")}`;
})();

// Small deterministic random generator so every demo looks the same.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { slugify };

export function buildSeed() {
  const rand = rng(1941);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

  const season = { id: uuid(), name: "2026-2027", is_current: true };
  const prevSeason = { id: uuid(), name: "2025-2026", is_current: false };

  const leagues = [
    { id: uuid(), name: "Victory League", slug: "victory-league", short_name: "Victory", sort: 1 },
    { id: uuid(), name: "Rees Memorial League", slug: "rees-memorial-league", short_name: "Rees", sort: 2 },
  ];

  const venueNames = {
    "Bethel Social Club": "A members club with 2 bars, 2 full size snooker tables, a pool table, dart boards, and entertainment most Saturday nights.",
    "Bugle Working Mens Club": "Friendly working men's club with a full size match table.",
    "Luxulyan Memorial Institute": "Village institute hosting league snooker every week of the season.",
    "Mevagissey Social Club": "Harbour-side social club with two match tables.",
    "Pelynt Social Club": "Community social club welcoming visiting teams.",
    "St Blazey Football Club": "Clubhouse snooker room at the football ground.",
    "St Neot Social Club": "Moorland village club with a single match table.",
    "Tregonissey Social Club": "Long-standing league venue with three tables.",
    "Gorran Haven Club": "Placeholder venue — edit in the admin dashboard.",
    "Lerryn Memorial Hall": "Placeholder venue — edit in the admin dashboard.",
  };
  const venues = Object.entries(venueNames).map(([name, description]) => ({
    id: uuid(), name, slug: slugify(name), description, address: "",
  }));
  const venueBy = (name) => venues.find((v) => v.name.startsWith(name)).id;

  const teamDefs = [
    [0, "Bethel A", "Bethel"], [0, "Bugle", "Bugle"], [0, "Luxulyan A", "Luxulyan"], [0, "Mevagissey A", "Mevagissey"],
    [0, "Mevagissey B", "Mevagissey"], [0, "Pelynt", "Pelynt"], [0, "St Blazey A", "St Blazey"], [0, "St Blazey B", "St Blazey"],
    [0, "St Neot", "St Neot"], [0, "Tregonissey A", "Tregonissey"],
    [1, "Bethel B", "Bethel"], [1, "Bethel C", "Bethel"], [1, "Bethel D", "Bethel"], [1, "Gorran Haven", "Gorran"],
    [1, "Lerryn", "Lerryn"], [1, "Luxulyan B", "Luxulyan"], [1, "Mevagissey C", "Mevagissey"],
    [1, "Tregonissey B", "Tregonissey"], [1, "Tregonissey C", "Tregonissey"],
  ];
  const teams = teamDefs.map(([li, name, venue]) => ({
    id: uuid(), name, slug: slugify(name), league_id: leagues[li].id, venue_id: venueBy(venue), logo_url: "",
  }));

  const first = ["Alan", "Ben", "Callum", "Dave", "Ed", "Frank", "Gary", "Harry", "Ian", "Jack", "Kev", "Liam", "Mark", "Nick", "Owen", "Pete", "Rob", "Sam", "Tom", "Wes", "Josh", "Dan", "Chris", "Matt"];
  const last = ["Trevena", "Penrose", "Nancarrow", "Rowe", "Tonkin", "Pascoe", "Hocking", "Kitto", "Jago", "Carne", "Retallick", "Tregear", "Lobb", "Couch", "Bolitho", "Rundle", "Hawke", "Opie", "Menhenick", "Trewin", "Polglase", "Symons"];
  const usedNames = new Set();
  const players = [];
  for (const team of teams) {
    for (let i = 0; i < 6; i++) {
      let full_name;
      do full_name = `${pick(first)} ${pick(last)}`; while (usedNames.has(full_name));
      usedNames.add(full_name);
      players.push({
        id: uuid(), full_name, team_id: team.id,
        position: i === 0 ? "Team Captain" : i === 1 ? "Vice Captain" : "Player",
        handicap: int(-2, 6) * 5, avatar_url: "",
      });
    }
  }
  const teamPlayers = (teamId) => players.filter((p) => p.team_id === teamId);

  // Fixtures: weekly on Tuesdays from 22 Sep 2026, double round-robin.
  const fixtures = [], frames = [], breaks = [];
  const today = "2026-09-30";
  leagues.forEach((league, li) => {
    const leagueTeams = teams.filter((t) => t.league_id === league.id);
    roundRobin(leagueTeams.map((t) => t.id)).forEach((pairs, round) => {
      const date = addDays("2026-09-22", round * 7 + (round >= 12 ? 14 : 0)); // two-week Christmas break
      pairs.forEach(([home, away], idx) => {
        const played = date < today;
        const fx = {
          id: uuid(), season_id: season.id, league_id: league.id,
          home_team_id: home, away_team_id: away,
          venue_id: teams.find((t) => t.id === home).venue_id,
          starts_at: londonISO(date, "19:30"),
          status: played ? "approved" : "scheduled", notes: "",
        };
        // Make one Rees match from last night "in progress" to demo the live page.
        if (li === 1 && round === 1 && idx === 0) fx.status = "in_progress";
        fixtures.push(fx);
        if (!played) return;
        const hp = teamPlayers(home), ap = teamPlayers(away);
        const framesToPlay = fx.status === "in_progress" ? 3 : 5;
        for (let n = 1; n <= framesToPlay; n++) {
          const homeWins = rand() < 0.5;
          const winPts = int(55, 95), losePts = int(18, winPts - 8);
          const fr = {
            id: uuid(), fixture_id: fx.id, frame_no: n,
            home_player_id: hp[n - 1].id, away_player_id: ap[n - 1].id,
            home_points: homeWins ? winPts : losePts, away_points: homeWins ? losePts : winPts,
          };
          frames.push(fr);
          if (rand() < 0.22) {
            const breaker = homeWins ? fr.home_player_id : fr.away_player_id;
            breaks.push({ id: uuid(), fixture_id: fx.id, frame_no: n, player_id: breaker, value: rand() < 0.1 ? int(50, 72) : int(30, 45) });
          }
        }
      });
    });
  });

  const img = (seed) => `https://picsum.photos/seed/snooker${seed}/800/600`;
  const articles = [
    ["Luxulyan B-rilliant: Rees League newcomers clean up in five-frame masterclass", "Match Reports 2026-2027", "Rees league newcomers Luxulyan B won all 5 frames at home to Tregonissey B.", "2026-09-25"],
    ["Rees Singles", "Competitions", "Latest fixtures & results from the Singles Competition 2026-2027.", "2026-09-29"],
    ["Team Handicap", "Competitions", "Latest fixtures & results from the Team Handicap Competition.", "2026-09-11"],
    ["Shootout", "Competitions", "Latest fixtures & results from the Shootout Competition.", "2026-09-03"],
    ["Bill Toms", "Competitions", "Latest fixtures & results from the Bill Toms Competition.", "2026-08-03"],
    ["Seniors", "Competitions", "Latest fixtures & results from the Seniors Competition.", "2026-08-03"],
    ["Doubles", "Competitions", "Latest fixtures & results from the Doubles Competition.", "2026-08-03"],
    ["Relegation playoff looms", "Match Reports 2025-2026", "Mevagissey B beat Bethel D 3-2 on Monday night to set up a relegation playoff.", "2026-03-18"],
    ["Superb Bethel A clinch Victory League title", "Match Reports 2025-2026", "Bethel A clinched the Victory League title after a 3-2 win at Luxulyan.", "2026-03-16"],
    ["Annual General Meeting 2026 (AGM)", "League Meetings", "St Blazey and District Snooker League AGM held at Bethel Social Club on Tuesday 21st July 2026.", "2026-08-04"],
    ["Annual General Meeting 2025 (AGM)", "League Meetings", "St Blazey and District snooker league AGM was held at Bethel social club.", "2025-07-24"],
    ["CueView – Placeholder Interview", "Cue View", "An exclusive interview placeholder. Replace this with your own CueView article.", "2026-01-01"],
  ].map(([title, category, excerpt, date], i) => ({
    id: uuid(), title, slug: slugify(title), category, excerpt,
    body: `${excerpt}\n\nThis is placeholder article text. Log in as the admin and edit this article in the dashboard to replace it with the real report.`,
    image_url: img(i), published_at: date, is_published: true,
  }));

  const pageDefs = [
    ["History", "A look back to the history of our league"],
    ["Rules", "All you need to know about the rules of snooker"],
    ["Profile", "All you need to know about logging in and using this website"],
    ["Press & Media", "Digital downloads, media, and merchandise to name but a few"],
    ["Help", "Need some help, you have come to the right place!"],
    ["About", "Everything you need to know about our league"],
    ["Meetings", "From Annual General Meetings, to Committee meetings and decision making"],
    ["Website", "Learn more about this website and its features"],
  ];
  const pages = pageDefs.map(([title, summary], i) => ({
    id: uuid(), title, slug: slugify(title), summary, sort: i + 1,
    body: `${summary}.\n\nPlaceholder content — edit this page in the admin dashboard under Pages.`,
  }));

  const sponsors = [1, 2, 3].map((n) => ({ id: uuid(), name: `Sponsor ${n}`, url: "", image_url: "", sort: n }));

  const profiles = [
    { id: uuid(), email: "admin@demo.test", full_name: "League Admin", role: "admin", team_id: null },
    { id: uuid(), email: "captain@demo.test", full_name: "Bethel A Captain", role: "captain", team_id: teams[0].id },
  ];
  const demoUsers = [
    { email: "admin@demo.test", password: "admin123", id: profiles[0].id },
    { email: "captain@demo.test", password: "captain123", id: profiles[1].id },
  ];

  return {
    tables: {
      seasons: [season, prevSeason], leagues, venues, teams, players,
      fixtures, frames, breaks, articles, pages, sponsors, profiles,
    },
    demoUsers,
  };
}
