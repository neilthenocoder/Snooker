// ─────────────────────────────────────────────────────────────
//  LEAGUE RULES — every scoring calculation lives in this one file.
//  Change a number here and the whole site (tables, rankings,
//  scorecards, live pages) follows automatically.
// ─────────────────────────────────────────────────────────────

export const RULES = {
  framesPerMatch: 5,          // default number of frame rows on a scorecard
  frameWinPoints: 5,          // ranking points a player earns per frame won
  breakMinimum: 30,           // breaks below this earn no ranking points
  maxBreakPoints: 14,         // 140–147 = 14 points
  // Which fixture statuses count towards tables and rankings.
  // Add "in_progress" here if you want tables to move live during the evening.
  countedStatuses: ["submitted", "approved"],
};

/** Every status a fixture can have, in match-night order. */
export const STATUSES = ["scheduled", "in_progress", "submitted", "approved", "postponed"];

/** 30–39 = 3, 40–49 = 4 … 140–147 = 14. */
export function breakPoints(value) {
  const v = Number(value) || 0;
  if (v < RULES.breakMinimum) return 0;
  return Math.min(Math.floor(v / 10), RULES.maxBreakPoints);
}

/** Team league points for one match. Current rule: 1 point per frame won
 *  (matches the existing site: a 3-2 win = 3 pts, a 2-3 loss = 2 pts). */
export function teamMatchPoints({ framesFor }) {
  return framesFor;
}

/** Plain-English summary shown on the standings page — update it if you change the rules. */
export const RULES_TEXT = `Team points: 1 per frame won. Player ranking: ${RULES.frameWinPoints} points per frame won, ` +
  `plus break points (${RULES.breakMinimum}–39 = 3, 40–49 = 4 … up to ${RULES.maxBreakPoints} for 140+). ` +
  `Only ${RULES.countedStatuses.join(" and ")} results count.`;

/** "home" | "away" | null (frame not finished / not entered). */
export function frameWinner(frame) {
  const h = Number(frame.home_points), a = Number(frame.away_points);
  if (!Number.isFinite(h) || !Number.isFinite(a) || h === a) return null;
  return h > a ? "home" : "away";
}

/** Frames won by each side, from a fixture's frames. */
export function matchScore(frames = []) {
  const score = { home: 0, away: 0, framesPlayed: 0 };
  for (const f of frames) {
    const w = frameWinner(f);
    if (w) { score[w]++; score.framesPlayed++; }
  }
  return score;
}

export const isCounted = (fixture) => RULES.countedStatuses.includes(fixture.status);

// Sort helpers shared by the tables ------------------------------------------------
const tableOrder = (a, b) =>
  b.pts - a.pts || b.w - a.w || (b.f - b.a) - (a.f - a.a) || a.name.localeCompare(b.name);
const sameTableRank = (a, b) => a.pts === b.pts && a.w === b.w && a.f - a.a === b.f - b.a;

/** League table: [{team, name, p, w, d, l, f, a, pts, pos}] — tied teams share a position. */
export function leagueTable(teams, fixtures, framesByFixture) {
  const rows = new Map(teams.map((t) => [t.id, { team: t, name: t.name, p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, pts: 0 }]));
  for (const fx of fixtures) {
    if (!isCounted(fx)) continue;
    const s = matchScore(framesByFixture.get(fx.id));
    const sides = [[fx.home_team_id, s.home, s.away], [fx.away_team_id, s.away, s.home]];
    for (const [teamId, forF, againstF] of sides) {
      const r = rows.get(teamId);
      if (!r) continue;
      r.p++; r.f += forF; r.a += againstF;
      if (forF > againstF) r.w++; else if (forF < againstF) r.l++; else r.d++;
      r.pts += teamMatchPoints({ framesFor: forF, framesAgainst: againstF });
    }
  }
  return assignPositions([...rows.values()].sort(tableOrder), sameTableRank);
}

/** Player rankings: frameWinPoints per frame won + break points. */
export function playerRankings(players, fixtures, framesByFixture, breaks) {
  const counted = new Set(fixtures.filter(isCounted).map((f) => f.id));
  const rows = new Map(players.map((p) => [p.id, { player: p, name: p.full_name, played: 0, won: 0, lost: 0, breakPts: 0, pts: 0 }]));
  for (const [fixtureId, frames] of framesByFixture) {
    if (!counted.has(fixtureId)) continue;
    for (const fr of frames) {
      const w = frameWinner(fr);
      if (!w) continue;
      for (const side of ["home", "away"]) {
        const r = rows.get(fr[`${side}_player_id`]);
        if (!r) continue;
        r.played++;
        side === w ? r.won++ : r.lost++;
      }
    }
  }
  for (const b of breaks) {
    const r = rows.get(b.player_id);
    if (r && counted.has(b.fixture_id)) r.breakPts += breakPoints(b.value);
  }
  for (const r of rows.values()) r.pts = r.won * RULES.frameWinPoints + r.breakPts;
  return [...rows.values()]
    .filter((r) => r.played > 0)
    .sort((a, b) => b.pts - a.pts || b.won - a.won || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

function assignPositions(sorted, same) {
  return sorted.map((row, i) => ({
    ...row,
    pos: i > 0 && same(row, sorted[i - 1]) ? null : i + 1,
  })).map((row, i, arr) => {
    if (row.pos === null) { let j = i; while (arr[j].pos === null) j--; row.pos = arr[j].pos; }
    return row;
  });
}
