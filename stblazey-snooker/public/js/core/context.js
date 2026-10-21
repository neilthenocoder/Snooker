// Turns raw season data into lookups and calculated tables (via rules.js).
import { loadSeason, currentSeason, settings, loadCompetitions, currentCompetitions } from "./api.js";
import { buildBracket, winnerSide, compScoreText } from "./bracket.js";
import { leagueTable, playerRankings, matchScore, isCounted, isProvisional, isNotUpdated } from "./rules.js";
import { ukDay } from "./dom.js";

/** The Monday (YYYY-MM-DD, UK) of the week an ISO date and time falls in. */
function weekStart(iso) {
  const [y, m, d] = ukDay(iso).split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) (m.get(r[key]) ?? m.set(r[key], []).get(r[key])).push(r);
  return m;
}

export async function seasonContext(seasonId) {
  const id = seasonId || (await currentSeason())?.id;
  const raw = await loadSeason(id);
  const framesByFixture = groupBy(raw.frames, "fixture_id");
  const memo = new Map();
  const once = (key, fn) => (memo.has(key) ? memo.get(key) : memo.set(key, fn()).get(key));

  const ctx = {
    ...raw,
    team: byId(raw.teams), league: byId(raw.leagues), venue: byId(raw.venues),
    player: byId(raw.players), fixture: byId(raw.fixtures),
    framesByFixture,
    framesOf: (fixtureId) => (framesByFixture.get(fixtureId) ?? []).slice().sort((a, b) => a.frame_no - b.frame_no),
    breaksOf: (fixtureId) => raw.breaks.filter((b) => b.fixture_id === fixtureId),
    scoreOf: (fx) => ({ ...matchScore(framesByFixture.get(fx.id)), counted: isCounted(fx) }),
    hasResult: (fx) => ["in_progress", "submitted", "approved"].includes(fx.status) && (framesByFixture.get(fx.id)?.length ?? 0) > 0,
    // Played, but its result isn't on the website yet ("Not updated yet").
    notUpdated: (fx) => isNotUpdated(fx, (framesByFixture.get(fx.id)?.length ?? 0) > 0),

    // A league's teams for THIS season: the ones with fixtures in it, plus (in the
    // current season) every active team placed in the league. Past seasons keep
    // their own line-up, even when teams have since folded or changed league.
    teamsIn: (leagueId) => once(`tm:${leagueId}`, () => {
      const played = new Set(raw.fixtures.filter((f) => f.league_id === leagueId).flatMap((f) => [f.home_team_id, f.away_team_id]));
      const isPast = raw.season && !raw.season.is_current && played.size > 0;
      return raw.teams.filter((t) => played.has(t.id) || (!isPast && t.league_id === leagueId && t.active !== false));
    }),
    fixturesIn: (leagueId) => raw.fixtures.filter((f) => f.league_id === leagueId),
    fixturesFor: (teamId) => raw.fixtures.filter((f) => f.home_team_id === teamId || f.away_team_id === teamId),
    // The weeks a team sits out (a league with an odd number of teams). Not matches: they count for nothing.
    byesFor: (teamId) => (raw.byes ?? []).filter((b) => b.team_id === teamId),
    playersIn: (leagueId) => { const t = new Set(ctx.teamsIn(leagueId).map((x) => x.id)); return raw.players.filter((p) => t.has(p.team_id)); },
    // A team's squad today: not those who have stopped playing or are no longer with us (their results still count above).
    playersOf: (teamId) => raw.players.filter((p) => p.team_id === teamId && !["not_playing", "deceased"].includes(p.status)),

    standings: (leagueId) => once(`st:${leagueId}`, () =>
      leagueTable(ctx.teamsIn(leagueId), ctx.fixturesIn(leagueId), framesByFixture)),
    // The table as it stood before the latest week that has a result: what the "moved since last week"
    // arrows are measured against. A week runs Monday to Sunday (UK). Null in the first week of results.
    previousStandings: (leagueId) => once(`pv:${leagueId}`, () => {
      const fx = ctx.fixturesIn(leagueId), counted = fx.filter(isCounted);
      if (!counted.length) return null;
      const monday = weekStart(counted.reduce((latest, f) => (f.starts_at > latest ? f.starts_at : latest), ""));
      const before = fx.filter((f) => ukDay(f.starts_at) < monday);
      return before.some(isCounted) ? leagueTable(ctx.teamsIn(leagueId), before, framesByFixture) : null;
    }),
    rankings: (leagueId) => once(`rk:${leagueId}`, () =>
      playerRankings(ctx.playersIn(leagueId), ctx.fixturesIn(leagueId), framesByFixture, raw.breaks)),
    // Does this league's table include any result that isn't approved yet? (Rich, round 23: the note under the tables.)
    provisionalIn: (leagueId) => ctx.fixturesIn(leagueId).some((f) => isProvisional(f) && (framesByFixture.get(f.id)?.length ?? 0) > 0),
    breaksIn: (leagueId) => once(`br:${leagueId}`, () => {
      const fx = new Set(ctx.fixturesIn(leagueId).filter(isCounted).map((f) => f.id));
      return raw.breaks.filter((b) => fx.has(b.fixture_id))
        .map((b) => ({ ...b, player: ctx.player.get(b.player_id), fixture: ctx.fixture.get(b.fixture_id) }))
        .sort((a, b) => b.value - a.value);
    }),
  };
  return ctx;
}

/** Every finished competition match, newest first: { when, title, home, away, score, href, won }. */
export async function cupResults() {
  const data = await currentCompetitions();
  return data.competitions.flatMap((c) => {
    const b = buildBracket(data.entries.filter((e) => e.competition_id === c.id), data.matches.filter((m) => m.competition_id === c.id));
    const name = (id) => b.entryById.get(id)?.name ?? "?";
    return b.rounds.flat().filter((m) => m.played && !m.isBye).map((m) => ({
      when: m.row.starts_at ?? m.row.result_at, title: c.name, season_id: c.season_id, home: name(m.a), away: name(m.b), score: compScoreText(m.row, " – "),
      href: `/cup-match/${m.row.no ?? m.row.id}`, won: winnerSide(m.row) === "a" ? "h" : "a",
      // Round 38: when the result went in — a result typed in late still counts as one of the latest.
      entered: [m.row.starts_at, m.row.result_at].filter(Boolean).sort().at(-1) ?? null,
    }));
  }).sort((x, y) => String(y.when ?? "").localeCompare(String(x.when ?? "")));
}

/** What the side column's top box needs (see sideBox() in components.js). */
export async function sideBoxData() {
  const site = await settings();
  const cups = ["cup", "both"].includes(site.side_box_mode) ? await cupResults().catch(() => []) : [];
  return { site, cups };
}
