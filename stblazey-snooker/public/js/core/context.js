// Turns raw season data into lookups and calculated tables (via rules.js).
import { loadSeason, currentSeason } from "./api.js";
import { leagueTable, playerRankings, matchScore, isCounted } from "./rules.js";

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

    teamsIn: (leagueId) => raw.teams.filter((t) => t.league_id === leagueId),
    fixturesIn: (leagueId) => raw.fixtures.filter((f) => f.league_id === leagueId),
    fixturesFor: (teamId) => raw.fixtures.filter((f) => f.home_team_id === teamId || f.away_team_id === teamId),
    playersIn: (leagueId) => { const t = new Set(ctx.teamsIn(leagueId).map((x) => x.id)); return raw.players.filter((p) => t.has(p.team_id)); },
    playersOf: (teamId) => raw.players.filter((p) => p.team_id === teamId),

    standings: (leagueId) => once(`st:${leagueId}`, () =>
      leagueTable(ctx.teamsIn(leagueId), ctx.fixturesIn(leagueId), framesByFixture)),
    rankings: (leagueId) => once(`rk:${leagueId}`, () =>
      playerRankings(ctx.playersIn(leagueId), ctx.fixturesIn(leagueId), framesByFixture, raw.breaks)),
    breaksIn: (leagueId) => once(`br:${leagueId}`, () => {
      const fx = new Set(ctx.fixturesIn(leagueId).filter(isCounted).map((f) => f.id));
      return raw.breaks.filter((b) => fx.has(b.fixture_id))
        .map((b) => ({ ...b, player: ctx.player.get(b.player_id), fixture: ctx.fixture.get(b.fixture_id) }))
        .sort((a, b) => b.value - a.value);
    }),
  };
  return ctx;
}
