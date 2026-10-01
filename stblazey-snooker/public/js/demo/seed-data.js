// ─────────────────────────────────────────────────────────────
//  SAMPLE DATA — placeholder league used in demo mode and by
//  scripts/build-seed.mjs to produce supabase/seed.sql.
//  Player names are imaginary. Replace with real data via the admin.
// ─────────────────────────────────────────────────────────────

import { slugify, londonISO, roundRobin, addDays } from "../core/schedule.js";
import { makeDraw, buildBracket } from "../core/bracket.js";

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
    { id: uuid(), name: "Victory League", slug: "victory-league", short_name: "Victory", sort: 1, shield_name: "Victory Shield", shield_team_id: null },
    { id: uuid(), name: "Rees Memorial League", slug: "rees-memorial-league", short_name: "Rees", sort: 2, shield_name: "Rees Shield", shield_team_id: null },
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
    id: uuid(), name, slug: slugify(name), description,
    address: `${name}, Placeholder Road, Cornwall`, phone: "", email: "", contact_name: "", map_url: "",
    quote: "", image_url: "", gallery: [],
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
  for (const l of leagues) l.shield_team_id = teams.find((t) => t.league_id === l.id).id;

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
        handicap: int(-2, 6) * 5, avatar_url: "", birth_date: null, cueview: {}, cueview_featured: false,
      });
    }
  }
  const teamPlayers = (teamId) => players.filter((p) => p.team_id === teamId);
  const sampleAnswers = [
    { hand: "Right", started: "14 — my dad had a table in the garage", first_memory: "Watching the 1985 black-ball final on TV", highest_break: "92",
      achievement: "Winning the league singles", ambition: "To make a century in a league match", favourite_pro: "Ronnie O'Sullivan — just the best",
      commentator: "John Virgo", bogey: "Anyone on a Tuesday", funniest: "Ironing the cloth before a match", biography: "Placeholder biography — edit in Admin → Players → CueView." },
    { hand: "Left", started: "16", first_memory: "TV", highest_break: "118", achievement: "Winning every league in Cornwall",
      ambition: "To win the Cornwall county singles title", memorable_match: "Loads", favourite_pro: "Judd Trump", commentator: "Joe Perry",
      famous_met: "Ronnie", best_player: "Me", underrated: "Me", biography: "Placeholder biography — edit in Admin → Players → CueView." },
    { hand: "Right", started: "12, at the youth club", highest_break: "64", ambition: "A 70 break in the league", favourite_pro: "Mark Selby — never gives up",
      bogey: "My own team-mate", funniest: "Potting the white three times in one frame" },
  ];
  sampleAnswers.forEach((a, i) => Object.assign(players[i * 7], { cueview: a, cueview_featured: true, birth_date: ["1971-10-09", "1984-03-22", "1990-06-15"][i] }));

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
          status: played ? "approved" : "scheduled", notes: "", scorecard_url: null,
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
            home_ext: false, away_ext: false,
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

  // One player plays an extra frame as the Ext player.
  const extFrame = frames.find((f) => f.frame_no === 5);
  if (extFrame) {
    const first = frames.find((f) => f.fixture_id === extFrame.fixture_id && f.frame_no === 1);
    Object.assign(extFrame, { home_player_id: first.home_player_id, home_ext: true });
  }

  const img = (seed) => `https://picsum.photos/seed/snooker${seed}/800/600`;
  const articles = [
    ["Luxulyan B-rilliant: Rees League newcomers clean up in five-frame masterclass", "Match Reports", "Rees league newcomers Luxulyan B won all 5 frames at home to Tregonissey B.", "2026-09-30"],
    ["Bethel A hold firm to keep the Victory Shield", "Match Reports", "Bethel A edged a tense 3-2 win to stay top of the Victory League.", "2026-09-23"],
    ["Rees Singles", "Competitions", "Latest fixtures & results from the Singles Competition 2026-2027.", "2026-09-29"],
    ["Team Handicap", "Competitions", "Latest fixtures & results from the Team Handicap Competition.", "2026-09-11"],
    ["Shootout", "Competitions", "Latest fixtures & results from the Shootout Competition.", "2026-09-03"],
    ["Bill Toms", "Competitions", "Latest fixtures & results from the Bill Toms Competition.", "2026-08-03"],
    ["Seniors", "Competitions", "Latest fixtures & results from the Seniors Competition.", "2026-08-03"],
    ["Doubles", "Competitions", "Latest fixtures & results from the Doubles Competition.", "2026-08-03"],
    ["Relegation playoff looms", "Match Reports", "Mevagissey B beat Bethel D 3-2 on Monday night to set up a relegation playoff.", "2026-03-18"],
    ["Superb Bethel A clinch Victory League title", "Match Reports", "Bethel A clinched the Victory League title after a 3-2 win at Luxulyan.", "2026-03-16"],
    ["Annual General Meeting 2026 (AGM)", "League Meetings", "St Blazey and District Snooker League AGM held at Bethel Social Club on Tuesday 21st July 2026.", "2026-08-04"],
    ["Annual General Meeting 2025 (AGM)", "League Meetings", "St Blazey and District snooker league AGM was held at Bethel social club.", "2025-07-24"],
    ["CueView – Placeholder Interview", "Cue View", "An exclusive interview placeholder. Replace this with your own CueView article.", "2026-01-01"],
  ].map(([title, category, excerpt, date], i) => ({
    id: uuid(), title, slug: slugify(title), category, excerpt,
    body: `${excerpt}\n\nThis is placeholder article text. Log in as the admin and edit this article in the dashboard to replace it with the real report.`,
    image_url: img(i), circle_image_url: "", published_at: date, is_published: true,
    lead: "", quote_text: "", quote_author: "", league_id: null, week_ending: null,
    show_breaks: false, show_results: false, show_standings: false, featured: i < 4 || category === "Match Reports",
  }));
  // The two match reports show off the weekly round-up sections.
  [[0, 1, "2026-09-30"], [1, 0, "2026-09-23"]].forEach(([ai, li, week]) => Object.assign(articles[ai], {
    league_id: leagues[li].id, week_ending: week, show_breaks: true, show_results: true, show_standings: true,
    lead: "A night of big breaks and close finishes across the league. Placeholder lead text — edit in Admin → News.",
    quote_text: "We knew we had to start fast, and the lads delivered from the first frame.",
    quote_author: "Team captain",
    body: `${articles[ai].excerpt}\n\nPlaceholder match report paragraph one. Tell the story of the night here.\n\n[quote]\n\nPlaceholder paragraph two — type [quote] on its own line anywhere in the text to move the quote box there.`,
  }));
  const categories = ["Match Reports", "Competitions", "League News", "League Meetings", "Cue View"]
    .map((name, i) => ({ id: uuid(), name, sort: i + 1 }));

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
    gallery: title === "History" ? [11, 12, 13, 14, 15, 16].map(img) : [],
  }));

  // Knockout competitions: a draw, with some rounds already played.
  const competitions = [], competition_entries = [], competition_matches = [];
  const shuffled = (list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const compDefs = [
    // name, kind, entrant names/links, rounds fully played, extra matches played in next round, first date
    ["Team Handicap", "Team", teams.slice(0, 16).map((t) => ({ name: t.name, team_id: t.id })), 0, 5, "2026-09-15"],
    ["Rees Singles", "Singles", shuffled(players.filter((p) => teams.find((t) => t.id === p.team_id).league_id === leagues[1].id)).slice(0, 12).map((p) => ({ name: p.full_name, player_id: p.id })), 1, 2, "2026-09-08"],
    ["Bill Toms", "Singles", shuffled(players).slice(0, 8).map((p) => ({ name: p.full_name, player_id: p.id })), 3, 0, "2026-08-04"],
  ];
  compDefs.forEach(([name, kind, entrants, fullRounds, extra, firstDate], ci) => {
    const comp = {
      id: uuid(), name, slug: slugify(name), season_id: season.id, kind, sort: ci + 1, image_url: "", draw_mode: "bracket", best_of: 5,
      info: `All matches to be played on the dates shown at the first-named venue. Placeholder text — edit in Admin → Competitions.`,
    };
    competitions.push(comp);
    const entries = shuffled(entrants).map((e, i) => ({ id: uuid(), competition_id: comp.id, team_id: null, player_id: null, seed: i + 1, ...e }));
    competition_entries.push(...entries);
    const rows = makeDraw(entries.map((e) => e.id)).map((r) => ({
      id: uuid(), competition_id: comp.id, score_a: null, score_b: null, notes: "",
      starts_at: londonISO(addDays(firstDate, (r.round - 1) * 14), "19:30"), venue_id: pick(venues).id, ...r,
    }));
    // Play matches in bracket order so later rounds have real entrants.
    for (let round = 1; round <= fullRounds + 1; round++) {
      const list = rows.filter((r) => r.round === round);
      list.forEach((r, i) => {
        if (round > 1) {
          const [p1, p2] = [rows.find((x) => x.round === round - 1 && x.slot === i * 2), rows.find((x) => x.round === round - 1 && x.slot === i * 2 + 1)];
          r._a = p1.winner; r._b = p2.winner;
        } else { r._a = r.entry_a; r._b = r.entry_b; }
        const playNow = round <= fullRounds || i < extra;
        if (r._a && !r._b) r.winner = r._a;
        else if (!r._a && r._b) r.winner = r._b;
        else if (r._a && r._b && playNow) {
          const aWins = rand() < 0.5, lose = int(0, 2);
          r.score_a = aWins ? 3 : lose; r.score_b = aWins ? lose : 3;
          r.winner = aWins ? r._a : r._b;
        }
      });
    }
    // Like the live site: winners are written into their next-round match.
    for (const r of rows) {
      const next = r.winner && rows.find((x) => x.round === r.round + 1 && x.slot === Math.floor(r.slot / 2));
      if (next) next[r.slot % 2 ? "entry_b" : "entry_a"] = r.winner;
    }
    rows.forEach((r) => { r.status = r.score_a != null ? "completed" : "scheduled"; delete r._a; delete r._b; delete r.winner; });
    competition_matches.push(...rows);
  });

  // Frame-by-frame scorecards for every played singles match, so the
  // competition pages can show highest breaks and match scorecards.
  const competition_frames = [], competition_breaks = [];
  const brackets = new Map(competitions.map((c) => [c.id, buildBracket(
    competition_entries.filter((e) => e.competition_id === c.id), competition_matches.filter((m) => m.competition_id === c.id))]));
  for (const m of competition_matches) {
    if (m.score_a == null) continue;
    const comp = competitions.find((c) => c.id === m.competition_id);
    if (comp.kind !== "Singles") continue;
    // Later rounds aren't stored, so ask the bracket who played.
    const bm = brackets.get(comp.id).rounds[m.round - 1][m.slot];
    const pa = competition_entries.find((e) => e.id === bm.a)?.player_id;
    const pb = competition_entries.find((e) => e.id === bm.b)?.player_id;
    const order = [...Array(m.score_a).fill("a"), ...Array(m.score_b).fill("b")].sort(() => rand() - 0.5);
    order.forEach((w, n) => {
      const win = int(55, 90), lose = int(15, win - 10);
      competition_frames.push({ id: uuid(), match_id: m.id, frame_no: n + 1, a_player_id: pa ?? null, a_player2_id: null, b_player_id: pb ?? null, b_player2_id: null,
        a_points: w === "a" ? win : lose, b_points: w === "b" ? win : lose });
      const who = w === "a" ? pa : pb;
      if (who && rand() < 0.3) competition_breaks.push({ id: uuid(), match_id: m.id, frame_no: n + 1, player_id: who, value: int(30, 68) });
    });
  }

  // Link competition news to its competition, and give articles an empty link otherwise.
  for (const a of articles) a.competition_id = competitions.find((c) => c.name === a.title)?.id ?? null;

  const sponsors = [1, 2, 3].map((n) => ({ id: uuid(), name: `Sponsor ${n}`, url: "", image_url: "", sort: n }));

  const settings = [{
    id: 1, logo_url: "", favicon_url: "", hero_image_url: "", hero_count: 4,
    player_of_week_id: players[7].id, player_of_week_text: "Two frames won and a 44 break on Tuesday night.", player_of_week_show: true,
    team_of_week_id: teams[15].id, team_of_week_text: "A five-frame whitewash in their first home match.", team_of_week_show: true,
    cueviews_show: true, shields_show: true,
  }];
  const media = [0, 1, 2, 3, 4, 5, 11, 12].map((n) => ({ id: uuid(), url: img(n), path: null, name: `Sample photo ${n + 1}`, created_at: `2026-09-${String(10 + n).padStart(2, "0")}T12:00:00Z` }));

  // 30 days of made-up page views so the Statistics page has something to show.
  const page_views = [];
  const paths = ["/", "/", "/", "/fixtures", "/live", "/standings/victory-league", "/competition/team-handicap", "/news", "/team/bethel-a"];
  for (let d = 29; d >= 0; d--) {
    const day = addDays("2026-09-30", -d);
    const tuesday = new Date(`${day}T12:00:00Z`).getUTCDay() === 2;
    for (let v = 0, n = int(20, 45) * (tuesday ? 3 : 1); v < n; v++) {
      page_views.push({ id: page_views.length + 1, path: pick(paths), referrer: rand() < 0.2 ? pick(["www.facebook.com", "www.google.com", "l.instagram.com"]) : null,
        device: rand() < 0.65 ? "mobile" : rand() < 0.5 ? "tablet" : "desktop", new_session: rand() < 0.4,
        created_at: `${day}T${String(int(9, 22)).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}:00Z` });
    }
  }

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
      competitions, competition_entries, competition_matches, competition_frames, competition_breaks,
      categories, settings, media, page_views,
    },
    demoUsers,
  };
}
