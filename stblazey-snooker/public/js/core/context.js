// Turns raw season data into lookups and calculated tables (via rules.js).
import { loadSeason, currentSeason, settings, loadCompetitions } from "./api.js";
import { buildBracket, winnerSide } from "./bracket.js";
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

/** Every finished competition match, newest first: { when, title, home, away, score, href, won }. */
export async function cupResults() {
  const data = await loadCompetitions();
  return data.competitions.flatMap((c) => {
    const b = buildBracket(data.entries.filter((e) => e.competition_id === c.id), data.matches.filter((m) => m.competition_id === c.id));
    const name = (id) => b.entryById.get(id)?.name ?? "?";
    return b.rounds.flat().filter((m) => m.played && !m.isBye).map((m) => ({
      when: m.row.starts_at, title: c.name, season_id: c.season_id, home: name(m.a), away: name(m.b), score: `${m.row.score_a} – ${m.row.score_b}`,
      href: `/cup-match/${m.row.id}`, won: winnerSide(m.row) === "a" ? "h" : "a",
    }));
  }).sort((x, y) => String(y.when ?? "").localeCompare(String(x.when ?? "")));
}

/** What the side column's top box needs (see sideBox() in components.js). */
export async function sideBoxData() {
  const site = await settings();
  const cups = ["cup", "both"].includes(site.side_box_mode) ? await cupResults().catch(() => []) : [];
  return { site, cups };
}
