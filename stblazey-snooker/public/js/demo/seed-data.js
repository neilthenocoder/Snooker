// ─────────────────────────────────────────────────────────────
//  SAMPLE DATA — placeholder league used in demo mode and by
//  scripts/build-seed.mjs to produce supabase/seed.sql.
//  Player names are imaginary. Replace with real data via the admin.
// ─────────────────────────────────────────────────────────────

import { slugify, londonISO, roundRobin, addDays } from "../core/schedule.js";
import { makeDraw, buildBracket } from "../core/bracket.js";
import { leagueTable, withLegacyFrames } from "../core/rules.js";
import { STANDARD_AWARDS, linkAward, competitionFinal } from "../core/awards.js";
import * as board from "../core/live-score.js";

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
    { id: uuid(), name: "Victory League", slug: "victory-league", short_name: "Victory", sort: 1, shield_name: "Victory League Runabout Shield", shield_team_id: null, logo_url: "" },
    { id: uuid(), name: "Rees Memorial League", slug: "rees-memorial-league", short_name: "Rees", sort: 2, shield_name: "Rees Memorial League Runabout Shield", shield_team_id: null, logo_url: "" },
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
    quote: "", image_url: "", logo_url: "", gallery: [],
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
    id: uuid(), name, slug: slugify(name), league_id: leagues[li].id, venue_id: venueBy(venue), logo_url: "", active: true,
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
        bio: "", career_history: "", past_teams: "", gallery: [], needs_review: false,
      });
    }
  }
  const teamPlayers = (teamId) => players.filter((p) => p.team_id === teamId);
  const sampleAnswers = [
    { hand: "Right", started: "14 — my dad had a table in the garage", first_memory: "Watching the 1985 black-ball final on TV", highest_break: "92",
      achievement: "Winning the league singles", ambition: "To make a century in a league match", favourite_pro: "Ronnie O'Sullivan — just the best",
      commentator: "John Virgo", bogey: "Anyone on a Tuesday", funniest: "Ironing the cloth before a match" },
    { hand: "Left", started: "16", first_memory: "TV", highest_break: "118", achievement: "Winning every league in Cornwall",
      ambition: "To win the Cornwall county singles title", memorable_match: "Loads", favourite_pro: "Judd Trump", commentator: "Joe Perry",
      famous_met: "Ronnie", best_player: "Me", underrated: "Me" },
    { hand: "Right", started: "12, at the youth club", highest_break: "64", ambition: "A 70 break in the league", favourite_pro: "Mark Selby — never gives up",
      bogey: "My own team-mate", funniest: "Potting the white three times in one frame" },
  ];
  sampleAnswers.forEach((a, i) => Object.assign(players[i * 7], {
    cueview: a, cueview_featured: true, birth_date: ["1971-10-09", "1984-03-22", "1990-06-15"][i],
    bio: "Placeholder biography. Players can write this themselves under My Team → Profile, or the admin can under Players.",
    career_history: "2019 — League singles champion\n2022 — Victory League winners\n2024 — Highest break of the season (92)",
    past_teams: i === 1 ? "St Blazey A (2018–2021)" : "",
    gallery: [21 + i, 24 + i, 27 + i].map((n) => `https://picsum.photos/seed/snooker${n}/800/600`),
  }));

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
          postponed_at: null, home_score: null, away_score: null,
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

  // One of Bethel A's matches has been postponed, to show how that looks.
  const off = fixtures.filter((f) => f.status === "scheduled" && [f.home_team_id, f.away_team_id].includes(teams[0].id))[1];
  if (off) Object.assign(off, { status: "postponed", postponed_at: "2026-09-29T10:00:00.000Z" });
  // …and a captain has just added a player, who is waiting for the admin to check them.
  players[11].needs_review = true;

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
    lead: "", quote_text: "", quote_author: "", league_id: null, week_ending: null, player_ids: [],
    cueview: {}, cueview_name: "", cueview_extra: "", cueview_featured: false,
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
  // Tag two articles with players, so their pages show "Player news".
  articles[0].player_ids = [players[7].id, players[0].id];
  articles[1].player_ids = [players[0].id];
  // A CueView with someone who isn't a league player (e.g. a professional).
  Object.assign(articles.find((a) => a.category === "Cue View"), {
    cueview_name: "A. Professional (placeholder)", cueview_featured: true,
    cueview: { hand: "Right", started: "8 — on a six-foot table at home", highest_break: "147", favourite_pro: "Steve Davis, growing up" },
    cueview_extra: "What advice would you give a club player?\nPlay the shot you know, not the shot you saw on TV.\n\nBest venue you've played at?\nThe Crucible — nothing else comes close.",
  });
  const categories = ["Match Reports", "Competitions", "League News", "League Meetings", "Cue View"]
    .map((name, i) => ({ id: uuid(), name, sort: i + 1, columns: 4 }));

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
  pageDefs.push(
    ["Privacy Policy", "How we look after your information"], ["Terms of Use", "The rules for using this website"],
    ["Accessibility", "Making this website usable for everyone"], ["Contact Us", "How to get in touch"]);
  const footerOnly = ["Privacy Policy", "Terms of Use", "Accessibility", "Contact Us"];
  const pages = pageDefs.map(([title, summary], i) => ({
    id: uuid(), title, slug: slugify(title), summary, sort: i + 1,
    show_in_footer: footerOnly.includes(title) || title === "About", show_in_league: !footerOnly.includes(title),
    body: `${summary}.\n\nPlaceholder content — edit this page in the admin dashboard under Pages.`,
    gallery: title === "History" ? [11, 12, 13, 14, 15, 16].map(img) : [],
  }));

  // Knockout competitions: a draw, with some rounds already played.
  const competitions = [], competition_entries = [], competition_matches = [];
  const shuffled = (list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const reesPlayers = players.filter((p) => teams.find((t) => t.id === p.team_id).league_id === leagues[1].id);
  const pairs = teams.slice(0, 8).map((t) => { const [a, b] = teamPlayers(t.id); return { name: `${a.full_name} & ${b.full_name}`, player_id: a.id }; });
  const compDefs = [
    // name, kind, entrant names/links, rounds fully played, extra matches played in next round, first date, options
    ["Team Handicap", "Team", teams.slice(0, 16).map((t) => ({ name: t.name, team_id: t.id })), 0, 5, "2026-09-15", { handicap: true }],
    ["Rees Singles", "Singles", shuffled(reesPlayers).slice(0, 12).map((p) => ({ name: p.full_name, player_id: p.id })), 1, 2, "2026-09-08", { league_ids: [leagues[1].id] }],
    ["Bill Toms", "Singles", shuffled(players).slice(0, 8).map((p) => ({ name: p.full_name, player_id: p.id })), 3, 0, "2026-08-04", {}],
    ["Handicap Doubles", "Doubles", pairs, 0, 0, "2026-10-13", { handicap: true }],
    ["Willie Thomas", "Singles", shuffled(reesPlayers).slice(0, 8).map((p) => ({ name: p.full_name, player_id: p.id })), 3, 0, "2026-02-03", { league_ids: [leagues[1].id], season_id: prevSeason.id }],
  ];
  compDefs.forEach(([name, kind, entrants, fullRounds, extra, firstDate, opts], ci) => {
    const comp = {
      id: uuid(), name, slug: slugify(name), season_id: season.id, kind, sort: ci + 1, image_url: "", draw_mode: "bracket", best_of: 5,
      info: `All matches to be played on the dates shown at the first-named venue. Placeholder text — edit in Admin → Competitions.`,
      league_ids: [], round_deadlines: {}, handicap: false, parent_id: null,
      entries_open: false, entry_fee: "", entry_closes: null, draw_at: null, draw_live: null, ...opts,
    };
    competitions.push(comp);
    const entries = shuffled(entrants).map((e, i) => ({ id: uuid(), competition_id: comp.id, team_id: null, player_id: null, seed: i + 1, ...e }));
    competition_entries.push(...entries);
    const rows = makeDraw(entries.map((e) => e.id)).map((r) => ({
      id: uuid(), competition_id: comp.id, score_a: null, score_b: null, points_a: null, points_b: null, notes: "",
      starts_at: londonISO(addDays(firstDate, (r.round - 1) * 14), "19:30"), venue_id: pick(venues).id, ...r,
    }));
    // Each round has to be played by the Sunday after its match night.
    for (const round of new Set(rows.map((r) => r.round))) comp.round_deadlines[round] = addDays(firstDate, (round - 1) * 14 + 5);
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
          r.loser = aWins ? r._b : r._a;
        }
      });
    }
    // Like the live site: winners are written into their next-round match.
    for (const r of rows) {
      const next = r.winner && rows.find((x) => x.round === r.round + 1 && x.slot === Math.floor(r.slot / 2));
      if (next) next[r.slot % 2 ? "entry_b" : "entry_a"] = r.winner;
    }
    // The Team Handicap has a plate competition for the teams knocked out in round one.
    if (name === "Team Handicap") {
      const plate = { ...comp, id: uuid(), name: `${name} Plate`, slug: slugify(`${name} Plate`), sort: 20, parent_id: comp.id, round_deadlines: {},
        info: "For the teams knocked out in the first round of the Team Handicap. Placeholder text — edit in Admin → Competitions." };
      competitions.push(plate);
      rows.filter((r) => r.round === 1 && r.loser).forEach((r, i) => {
        const e = entries.find((x) => x.id === r.loser);
        competition_entries.push({ id: uuid(), competition_id: plate.id, name: e.name, team_id: e.team_id, player_id: e.player_id, seed: i + 1 });
      });
    }
    rows.forEach((r) => { r.status = r.score_a != null ? "completed" : "scheduled"; delete r._a; delete r._b; delete r.winner; delete r.loser; });
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
    feature_show: true, feature_label: "NEW", feature_text: "Try our step-by-step scorecard — log in to find out more", feature_url: "/login", feature_bg: "#0b84e0",
    latest_news_mode: "not_banner", latest_news_category: "", latest_news_ids: [], latest_news_count: 1,
    entry_intro: "Enter this season's competitions here. It takes a minute: choose your name, tick the competitions you want, then pay the entry fee by bank transfer.",
    section_colors: true, sidebar_layout: "right", page_layouts: {}, font_embed: "", loader_show: true, loader_seconds: 0,
    side_box_mode: "results", side_box_title: "", side_box_count: 5, side_box_league: null,
    ticker_show: true, ticker_speed: "normal", ticker_pace: 3, maintenance_on: false, maintenance_text: "",
    text_sizes: {}, celebrate_breaks: "season", feature_announcements: true, feature_style: "scroll", key_dates_show: true, key_dates_count: 5,
    bacs_details: "Account name: St Blazey & District Snooker League (placeholder)\nSort code: 00-00-00\nAccount number: 00000000", entry_pay_days: 7,
    facebook_url: "https://www.facebook.com/", x_url: "https://x.com/", instagram_url: "https://www.instagram.com/", youtube_url: "https://www.youtube.com/",
  }];
  const media = [0, 1, 2, 3, 4, 5, 11, 12].map((n) => ({ id: uuid(), url: img(n), path: null, name: `Sample photo ${n + 1}`, category: n > 10 ? "Galleries" : "News", created_at: `2026-09-${String(10 + n).padStart(2, "0")}T12:00:00Z` }));

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
    { id: uuid(), email: "admin@demo.test", full_name: "Master Admin", role: "admin", team_role: null, team_id: null, player_id: null },
    { id: uuid(), email: "captain@demo.test", full_name: players[0].full_name, role: "captain", team_role: null, team_id: teams[0].id, player_id: players[0].id },
    { id: uuid(), email: "player@demo.test", full_name: players[7].full_name, role: "player", team_role: null, team_id: players[7].team_id, player_id: players[7].id },
    // An officer who also plays: competitions in the admin, plus captain rights for Bugle.
    { id: uuid(), email: "compsec@demo.test", full_name: players[6].full_name, role: "competition_secretary", team_role: "captain", team_id: players[6].team_id, player_id: players[6].id },
    { id: uuid(), email: "committee@demo.test", full_name: "Committee Member", role: "committee_member", team_role: null, team_id: null, player_id: null },
    // A Player login that isn't linked to anyone: it only has My Snooker, and chooses its own team.
    { id: uuid(), email: "fan@demo.test", full_name: "Sam Follower", role: "player", team_role: null, team_id: null, player_id: null },
  ];
  const demoUsers = [
    { email: "admin@demo.test", password: "admin123", id: profiles[0].id },
    { email: "captain@demo.test", password: "captain123", id: profiles[1].id },
    { email: "player@demo.test", password: "player123", id: profiles[2].id },
    { email: "compsec@demo.test", password: "compsec123", id: profiles[3].id },
    { email: "committee@demo.test", password: "committee123", id: profiles[4].id },
    { email: "fan@demo.test", password: "fan12345", id: profiles[5].id },
  ];

  // ── Wave 4 samples ──
  // Two competitions that are open for entries on the website, not drawn yet. The first has a live draw booked.
  const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString();
  const openComp = (name, kind, fee, extra = {}) => {
    const c = { ...competitions[0], id: uuid(), name, slug: slugify(name), kind, sort: 30 + competitions.length, handicap: true, league_ids: [], parent_id: null, round_deadlines: {},
      info: "Enter on the website: choose your name, tick the competition and pay the entry fee by bank transfer. Placeholder text — edit in Admin → Competitions.",
      entries_open: true, entry_fee: fee, entry_closes: inDays(14).slice(0, 10), draw_at: null, draw_live: null, ...extra };
    competitions.push(c);
    return c;
  };
  const xmas = openComp("Christmas Handicap Singles", "Singles", "£5", { draw_at: londonISO(inDays(16).slice(0, 10), "19:30") });
  const pairsComp = openComp("New Year Doubles", "Doubles", "£10 per pair");
  // Six players have paid and are in; three more entries are waiting for the competition secretary.
  players.slice(12, 18).forEach((p, i) => competition_entries.push({ id: uuid(), competition_id: xmas.id, team_id: null, player_id: p.id, seed: i + 1, name: p.full_name }));
  const signup = (c, p, partner, daysAgo) => ({ id: uuid(), competition_id: c.id, player_id: p.id, partner_id: partner?.id ?? null, team_id: null,
    name: partner ? `${p.full_name} & ${partner.full_name}` : p.full_name, contact: "07700 900000 (placeholder)", status: "pending",
    pay_by: inDays(7 - daysAgo), created_at: inDays(-daysAgo), decided_at: null, entry_id: null });
  const competition_signups = [signup(xmas, players[20], null, 1), signup(xmas, players[25], null, 3), signup(pairsComp, players[30], players[31], 2)];

  // Yearly handicap review: a few players have moved since last year (shown as arrows on the Handicaps page).
  players.forEach((p, i) => { p.last_handicap = p.handicap + (i % 6 === 2 ? 5 : i % 9 === 4 ? -5 : 0); });

  // Last season, brought in the way old results are: final scores only (no frame-by-frame cards),
  // plus the season's best breaks. This is what fills the Season archive / roll of honour.
  leagues.forEach((league) => {
    const ids = teams.filter((t) => t.league_id === league.id).map((t) => t.id);
    const rounds = roundRobin(ids);
    rounds.slice(0, rounds.length / 2).forEach((pairs, round) => pairs.forEach(([home, away]) => {
      // Last season's champions (the first team in each league) rarely slipped up.
      const champ = home === ids[0] ? "home" : away === ids[0] ? "away" : null;
      const homeWins = champ ? (champ === "home") !== (rand() < 0.12) : rand() < 0.55, lose = int(0, 2);
      const fx = { id: uuid(), season_id: prevSeason.id, league_id: league.id, home_team_id: home, away_team_id: away,
        venue_id: teams.find((t) => t.id === home).venue_id, starts_at: londonISO(addDays("2025-09-23", round * 7), "19:30"),
        status: "approved", notes: "", scorecard_url: null, postponed_at: null, home_score: homeWins ? 5 - lose : lose, away_score: homeWins ? lose : 5 - lose };
      fixtures.push(fx);
      if (rand() < 0.3) breaks.push({ id: uuid(), fixture_id: fx.id, frame_no: 1, player_id: pick(teamPlayers(rand() < 0.5 ? home : away)).id, value: int(30, 87) });
    }));
  });

  // Match night photos: one of last week's Rees matches has pictures from the home captain,
  // so they show on the match page and in that week's news report.
  for (const f of fixtures) f.gallery = [];
  const photoMatch = fixtures.find((f) => f.league_id === leagues[1].id && f.status === "approved" && f.starts_at.slice(0, 10) > "2026-09-24" && f.starts_at.slice(0, 10) <= "2026-09-30");
  if (photoMatch) photoMatch.gallery = [21, 22, 23].map(img);
  for (const a of articles) a.show_photos = true;

  // Announcements for the ticker along the top of the home page.
  const announcements = [
    ["Entries are open for the Christmas Handicap Singles and the New Year Doubles — enter on the website", "/enter"],
    ["The Christmas Handicap draw will be made live on this website — keep an eye on the Live button", "/competitions"],
    ["Captains: remember to add your match night photos after each home match", ""],
  ].map(([text, url], i) => ({ id: uuid(), text, url, sort: i + 1, is_active: true, starts_on: null, ends_on: null, created_at: "2026-10-01T09:00:00.000Z",
    label: i === 0 ? "Entries open" : "", show_in_feature: i < 2 }));
  // What each officer role may use in the dashboard (the Master Admin can change it under Roles & permissions).
  const role_permissions = [
    ["league_admin", ["matchnights", "fixtures", "league", "handicaps", "competitions", "website", "settings", "people"]],
    ["competition_secretary", ["handicaps", "competitions"]], ["league_secretary", ["league", "handicaps"]],
    ["committee_member", ["website", "settings"]], ["president", ["website", "settings"]], ["vice_chairman", ["website", "settings"]], ["chairman", ["website", "settings"]],
  ].map(([role, areas]) => ({ role, areas }));

  // ── Wave 6 samples ──
  const day = (n) => inDays(n).slice(0, 10);
  // Short web addresses: /match/2627-14, /player/sam-bolitho, /cup-match/27, /sponsor/…
  for (const s of [season, prevSeason]) {
    const prefix = s.name.match(/\d{4}/g).map((y) => y.slice(2)).join("");
    fixtures.filter((f) => f.season_id === s.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id))
      .forEach((f, i) => Object.assign(f, { code: `${prefix}-${String(i + 1).padStart(2, "0")}`, submitted_email_at: null }));
  }
  competition_matches.forEach((m, i) => { m.no = i + 1; });
  players.forEach((p) => Object.assign(p, { status: "playing", died_on: null, memorial: "", slug: slugify(p.full_name) }));
  sponsors.forEach((sp, i) => Object.assign(sp, { slug: slugify(sp.name), phone: "", email: "", address: "", photo_url: "",
    about: i ? "" : "## About Sponsor 1\n\nPlaceholder text about this sponsor — who they are, what they do and how they support the league. Write it in Admin → Sponsors.\n\n- Family-run business in St Blazey\n- Sponsor of the Victory League since 2019\n\n**Mention the league** when you call in." }));
  for (const row of [...leagues, ...competitions]) row.trophy_url = "";

  // Player statuses: one who has stopped playing, one without a team, and two who are remembered on /in-memoriam.
  players[40].status = "not_playing";
  const extraPlayer = (full_name, team_id, more) => { const p = { id: uuid(), full_name, team_id, position: "Player", handicap: 10, avatar_url: "", birth_date: null, cueview: {}, cueview_featured: false,
    bio: "", career_history: "", past_teams: "", gallery: [], needs_review: false, last_handicap: 10, status: "playing", died_on: null, memorial: "", slug: slugify(full_name), ...more }; players.push(p); return p; };
  extraPlayer("Jim Polkinghorne (placeholder)", null, { status: "no_team", past_teams: JSON.stringify(["Pelynt (2019–2025)"]) });
  extraPlayer("Bill Trevaskis (placeholder)", teams[0].id, { status: "deceased", birth_date: "1948-03-02", died_on: "2024-11-18",
    memorial: "A league stalwart for over forty years, a fine break-builder and a gentleman at the table. Placeholder tribute — edit in Admin → Players." });
  extraPlayer("Arthur Penhale (placeholder)", teams[12].id, { status: "deceased", died_on: "2023-06-05", past_teams: JSON.stringify(["Bethel B", "Luxulyan A"]) });

  // The rules: two info pages ticked "Show on the Rules page" become the tabs of /rules.
  for (const pg of pages) pg.show_in_rules = false;
  Object.assign(pages.find((pg) => pg.slug === "rules"), { title: "League Rules", slug: "league-rules", summary: "How the league is run: matches, points, postponements and handicaps", show_in_rules: true, show_in_league: false,
    body: `Placeholder rules — replace them with the league's own in Admin → Info pages & rules.

# 1. Match nights
- League matches are played on **Tuesday evenings**, starting at 7.30pm.
- A match is **five frames**, each between one player from each team.
  - A player plays one frame only.
  - The home captain names their first player; the away captain replies.
- A team that is a player short may use an **extra (Ext) player** — each player may do this once a season.

# 2. Points
## 2.1 Team points
The league table is decided on frames won: one point for every frame.

## 2.2 Player rankings
| Achievement | Ranking points |
| Frame won | 5 |
| Break of 30–39 | 3 |
| Break of 40–49 | 4 |
| Break of 50–59 | 5 |
| Each further 10 | +1, up to 14 |

# 3. Results
1. The home captain enters the scorecard on the website on the night.
2. A photo of the signed paper card must be added before the result is submitted.
3. The results secretary approves each result. Until then it does not count in the tables.

# 4. Postponements
- A captain may postpone a match **before it starts** by telling the opposing captain and the league secretary.
- A postponed match must be re-arranged **within three weeks**.
  - Both captains see the date it must be played by on their My Team page.
  - Matches not played in time are referred to the committee.

# 5. Handicaps
- Handicaps are reviewed once a year by the handicap committee.
- In handicap singles and team competitions, the player with the higher handicap starts the frame with the difference.
- In handicap doubles, each pair starts on the total of its two handicaps.` });
  pages.push({ id: uuid(), title: "Rules of the Game", slug: "rules-of-the-game", summary: "The rules of snooker in brief", sort: pages.length + 1, show_in_footer: false, show_in_league: false, show_in_rules: true, gallery: [],
    body: `A short guide — placeholder text. The full rules are published by the [WPBSA](https://wpbsa.com/rules/).

# The balls
| Ball | Points |
| Red | 1 |
| Yellow | 2 |
| Green | 3 |
| Brown | 4 |
| Blue | 5 |
| Pink | 6 |
| Black | 7 |

# A break
1. Pot a red, then a colour, then a red, and so on.
2. While reds remain, each colour goes back on its spot.
3. When the last red has gone, the colours are potted in order: yellow to black.

# Fouls
- A foul gives the opponent **at least four points**.
  - More if the ball “on”, or the ball hit or potted by mistake, is worth more: blue 5, pink 6, black 7.
- Common fouls:
  - Missing the ball “on”
  - Potting the white
  - Touching a ball with anything other than the tip of the cue
- After a foul that leaves a snooker, the player may be given a **free ball**.

# The end of a frame
- A frame ends when the black is potted or fouled with the scores different, or when a player concedes.
- If the scores are level after the black, the black is **re-spotted**.` });

  // Meetings (/meetings): past ones with minutes, and the next one.
  const meetings = [
    ["AGM", "2026-07-21", "7.30pm", "Annual General Meeting 2026", "Bethel Social Club", "The league's annual general meeting: officers' reports, election of officers and proposals for the 2026-27 season.",
      "## Present\n32 members, representing 17 of the 19 teams.\n\n## 1. Apologies\nReceived from two clubs.\n\n## 2. Officers' reports\n- **Chairman:** thanked the clubs for a well-run season.\n- **Treasurer:** the accounts were presented and accepted.\n  - Entry fees stay the same for 2026-27.\n\n## 3. Election of officers\n| Post | Elected |\n| Chairman | Placeholder Name |\n| League Secretary | Placeholder Name |\n| Competition Secretary | Placeholder Name |\n\n## 4. Proposals\n1. Results to be entered on the website on the night — **carried**.\n2. Postponed matches to be played within three weeks — **carried**.\n\nPlaceholder minutes — replace them in Admin → Meetings."],
    ["Committee Meeting", "2026-09-08", "7.30pm", "", "St Blazey Football Club", "Fixtures for 2026-27 approved; competition dates agreed.", "- Fixtures for both leagues approved.\n- Competition entry forms to open on the website.\n- Presentation night: date to be confirmed."],
    ["AGM", "2025-07-22", "7.30pm", "Annual General Meeting 2025", "Bethel Social Club", "Officers' reports and elections for the 2025-26 season.", ""],
    ["Committee Meeting", day(20), "7.30pm", "", "St Blazey Football Club", "- Christmas Handicap: the draw\n- Presentation night: date and venue\n- Any other business", ""],
  ].map(([kind, held_on, time_text, title, venue, summary, minutes]) => ({ id: uuid(), kind, held_on, time_text, title, venue, summary, minutes, document_url: "", is_published: true, created_at: "2026-10-01T09:00:00.000Z" }));

  // Key dates for the home page (always a few days ahead, so the demo never runs out).
  const key_dates = [
    [4, null, "Team Handicap: round 1 starts", "Matches to be played by the following Sunday", competitions[0].id, ""],
    [14, null, "Entries close: Christmas Handicap Singles and New Year Doubles", "", null, "/enter"],
    [16, null, "Christmas Handicap draw — live on this website, 7.30pm", "", xmas.id, ""],
    [20, null, "Committee meeting", "St Blazey Football Club, 7.30pm", null, "/meetings"],
    [70, 84, "Mid-season break: no league matches", "", null, ""],
  ].map(([from, to, title, details, competition_id, url]) => ({ id: uuid(), starts_on: day(from), ends_on: to ? day(to) : null, title, details, url, competition_id, is_active: true, created_at: "2026-10-01T09:00:00.000Z" }));

  // Presentation night for last season: the standard awards, with the winners the results give and placeholders for the rest.
  const prevFx = fixtures.filter((f) => f.season_id === prevSeason.id);
  const prevFrames = new Map();
  for (const fr of withLegacyFrames(prevFx, [])) (prevFrames.get(fr.fixture_id) ?? prevFrames.set(fr.fixture_id, []).get(fr.fixture_id)).push(fr);
  const prevComps = competitions.filter((c) => c.season_id === prevSeason.id);
  const inLeague = (l) => players.filter((p) => p.status === "playing" && teams.find((t) => t.id === p.team_id)?.league_id === l.id);
  const blank = { winner_name: null, winner_player_id: null, winner_team_id: null, winner_image_url: "", runner_up_name: null, runner_up_player_id: null, runner_up_team_id: null, runner_up_image_url: "", note: "" };
  const ofP = (prefix, p) => (p ? { [`${prefix}_name`]: p.full_name, [`${prefix}_player_id`]: p.id } : {});
  const ofT = (prefix, t) => (t ? { [`${prefix}_name`]: t.name, [`${prefix}_team_id`]: t.id } : {});
  const awards = STANDARD_AWARDS.map((name, i) => {
    const link = linkAward(name, leagues, prevComps), league = leagues.find((l) => l.id === link.league_id), comp = prevComps.find((c) => c.id === link.competition_id);
    const pool = league ? inLeague(league) : players.filter((p) => p.status === "playing");
    const a = pool[(i * 7 + 3) % pool.length], b = pool[(i * 11 + 20) % pool.length], c = pool[(i * 5 + 31) % pool.length], d = pool[(i * 13 + 44) % pool.length];
    let who;
    if (comp) { const f = competitionFinal(comp, { entries: competition_entries, matches: competition_matches });
      who = { ...ofP("winner", players.find((p) => p.id === f?.winner?.player_id)), ...ofP("runner_up", players.find((p) => p.id === f?.runnerUp?.player_id)) }; }
    else if (league && name === league.name) {
      const rows = leagueTable(teams.filter((t) => t.league_id === league.id), prevFx.filter((f) => f.league_id === league.id), prevFrames);
      who = { ...ofT("winner", rows[0].team), ...ofT("runner_up", rows[1].team), note: `${rows[0].pts} points from ${rows[0].p} matches`, winner_image_url: img(31 + i) };
    } else if (league && /Highest Break/.test(name)) {
      const ids = new Set(prevFx.filter((f) => f.league_id === league.id).map((f) => f.id));
      const best = breaks.filter((x) => ids.has(x.fixture_id)).sort((x, y) => y.value - x.value);
      const second = best.find((x) => x.player_id !== best[0]?.player_id);
      who = { ...ofP("winner", players.find((p) => p.id === best[0]?.player_id)), ...ofP("runner_up", players.find((p) => p.id === second?.player_id)), note: best[0] ? `A break of ${best[0].value}` : "" };
    } else if (/Doubles|Pairs/.test(name) && !/Team/.test(name)) who = { winner_name: `${a.full_name} & ${b.full_name}`, runner_up_name: `${c.full_name} & ${d.full_name}` };
    else if (/Team|Rest of the League/.test(name)) { const ts = teams.filter((t) => !league || t.league_id === league.id); who = { ...ofT("winner", ts[(i + 2) % ts.length]), ...ofT("runner_up", ts[(i + 5) % ts.length]) }; }
    else who = { ...ofP("winner", a), ...ofP("runner_up", c) };
    return { id: uuid(), season_id: prevSeason.id, name, sort: i + 1, trophy_url: "", ...link, ...blank, ...who, created_at: "2026-06-01T09:00:00.000Z" };
  });

  // Live scoreboard: last season's Bill Toms final (finished), a match on the table right now, and a final still to come.
  const playFrame = (m, want) => {
    for (let tries = 0; tries < 80; tries++) {
      let x = m;
      for (let visit = 0; visit < 500; visit++) {
        const f = x.state.frame, sit = board.situation(f);
        if (sit.remaining === 0 || (sit.snookers && sit.ahead === want && sit.lead - sit.remaining > 14)) break;
        if (rand() < (f.striker === want ? 0.74 : 0.5)) { const on = board.ballOn(f); x = board.pot(x, on === "red" ? 1 : on === "colour" ? pick([7, 7, 6, 5, 5, 4, 2]) : on); }
        else x = board.endBreak(x);
      }
      const f = x.state.frame;
      if (want === "a" ? f.a > f.b : f.b > f.a) return board.endFrame(x, want);
    }
    return board.endFrame(m, want);
  };
  const liveRow = (no, more) => ({ id: uuid(), no, title: null, competition_id: null, round_name: null, player_a_id: null, player_b_id: null, name_a: null, name_b: null, best_of: 9,
    status: "setup", frames_a: 0, frames_b: 0, state: {}, venue: null, starts_at: null, started_at: null, finished_at: null, created_by: "Master Admin", updated_at: new Date().toISOString(), ...more });
  const billToms = competitions.find((c) => c.name === "Bill Toms");
  const btFinal = competitionFinal(billToms, { entries: competition_entries, matches: competition_matches });
  const btRow = competition_matches.filter((m) => m.competition_id === billToms.id).sort((x, y) => y.round - x.round)[0];
  // Side "a" on the scoreboard is the winner; they take the last frame.
  let done = board.start(liveRow(1, { competition_id: billToms.id, round_name: "Final", player_a_id: btFinal.winner.player_id, player_b_id: btFinal.runnerUp.player_id, best_of: 5,
    venue: "Bethel Social Club", starts_at: btRow.starts_at }), "a");
  const need = Math.max(btRow.score_a, btRow.score_b), lost = Math.min(btRow.score_a, btRow.score_b);
  for (const w of [...shuffled([...Array(need - 1).fill("a"), ...Array(lost).fill("b")]), "a"]) done = playFrame(done, w);
  Object.assign(done, { started_at: btRow.starts_at, finished_at: new Date(Date.parse(btRow.starts_at) + 2.5 * 3600e3).toISOString(), updated_at: btRow.starts_at });
  let now = board.start(liveRow(2, { title: "Champion of Champions", round_name: "Champion of Champions", player_a_id: players[0].id, player_b_id: players[13].id, best_of: 9, venue: "Bethel Social Club" }), "a");
  for (const w of ["a", "b", "a"]) now = playFrame(now, w);
  for (let visit = 0; visit < 17; visit++) { const f = now.state.frame; if (rand() < 0.62) { const on = board.ballOn(f); now = board.pot(now, on === "red" ? 1 : on === "colour" ? pick([7, 6, 5, 7, 4]) : on); } else now = board.endBreak(now); }
  Object.assign(now, { started_at: inDays(-0.035), finished_at: null });
  const reesSingles = competitions.find((c) => c.name === "Rees Singles");
  const live_matches = [done, now, liveRow(3, { competition_id: reesSingles.id, round_name: "Final", player_a_id: reesPlayers[2].id, player_b_id: reesPlayers[9].id, best_of: 7,
    venue: "Tregonissey Social Club", starts_at: londonISO(day(9), "19:30") })];

  return {
    tables: {
      seasons: [season, prevSeason], leagues, venues, teams, players,
      fixtures, frames, breaks, articles, pages, sponsors, profiles,
      competitions, competition_entries, competition_matches, competition_frames, competition_breaks, competition_signups,
      handicap_changes: [], categories, settings, media, page_views, announcements, role_permissions, audit_log: [],
      key_dates, awards, meetings, live_matches, private_settings: [{ id: 1, results_email_on: false, results_email_to: "" }],
      byes: [], cueview_submissions: [],
      merchandise: [
        { id: uuid(), name: "League polo shirt", price: "£18", description: "Black polo with the league badge on the chest. A sample item: change or remove it under Admin → Website → Merchandise.", options: "S, M, L, XL, XXL", image_url: "", url: "", sort: 1, is_active: true },
        { id: uuid(), name: "Cue towel", price: "£6", description: "Microfibre towel with the league badge. A sample item.", options: "", image_url: "", url: "", sort: 2, is_active: true },
      ],
    },
    demoUsers,
  };
}
