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

// ── Weekly shield ────────────────────────────────────────────────
/**
 * Who holds each league's shield. The holder at the start of the season is
 * set in Admin → Leagues. Every counted match the holder plays is a shield
 * match: if they lose, the winners take the shield.
 * Returns { holderId, since (fixture or null), history: [{ fixture, from, to }] }.
 */
export function shieldHolder(league, fixtures, framesByFixture) {
  let holderId = league.shield_team_id ?? null;
  let since = null;
  const history = [];
  if (!holderId) return { holderId: null, since, history };
  const played = fixtures.filter((f) => f.league_id === league.id && isCounted(f))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (const fx of played) {
    if (![fx.home_team_id, fx.away_team_id].includes(holderId)) continue;
    const s = matchScore(framesByFixture.get(fx.id));
    const holderIsHome = fx.home_team_id === holderId;
    const challengerWon = holderIsHome ? s.away > s.home : s.home > s.away;
    const to = challengerWon ? (holderIsHome ? fx.away_team_id : fx.home_team_id) : holderId;
    history.push({ fixture: fx, from: holderId, to, defended: !challengerWon });
    if (challengerWon) { holderId = to; since = fx; }
  }
  return { holderId, since, history };
}

/** True when this fixture is a shield match (the holder at that moment is playing). */
export function isShieldMatch(league, fixture, fixtures, framesByFixture) {
  const before = fixtures.filter((f) => f.starts_at < fixture.starts_at || (f.starts_at === fixture.starts_at && f.id < fixture.id));
  const { holderId } = shieldHolder(league, before, framesByFixture);
  return holderId ? { holderId, isShield: [fixture.home_team_id, fixture.away_team_id].includes(holderId) } : { holderId: null, isShield: false };
}

// ── Extra (Ext) players ──────────────────────────────────────────
/** Each player may play as the extra player once a season. */
export const EXT_PER_SEASON = 1;

/** Map of playerId → number of frames played as Ext in the given frames. */
export function extCounts(frames) {
  const counts = new Map();
  for (const f of frames) {
    for (const side of ["home", "away"]) {
      const pid = f[`${side}_player_id`];
      if (pid && f[`${side}_ext`]) counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
  }
  return counts;
}

/** The highest possible break: 147, or 155 when the frame starts with a free ball. */
export const MAX_BREAK = 155;

/** Parse "34, 41 52" → [34, 41, 52]; returns null if anything isn't a valid break. */
export function parseBreaks(text) {
  const parts = String(text ?? "").split(/[\s,;]+/).filter(Boolean);
  const values = parts.map(Number);
  return values.every((v) => Number.isInteger(v) && v >= 1 && v <= MAX_BREAK) ? values : null;
}

// ── LIVE button ──────────────────────────────────────────────────
export const LIVE_SOON_MINUTES = 60;

/**
 * "live"  – a match is in progress, or tonight's matches have started (until midnight)
 * "soon"  – the first match tonight starts within the next hour
 * "idle"  – nothing on today
 * `matches` are fixtures / competition matches with starts_at and status;
 * `ukDay(iso)` gives the UK calendar day (passed in to keep this file DOM-free).
 */
export function liveState(matches, now, ukDay) {
  const active = matches.filter((m) => !["postponed"].includes(m.status) && m.starts_at);
  if (active.some((m) => m.status === "in_progress")) return "live";
  const today = ukDay(new Date(now).toISOString());
  const tonight = active.filter((m) => ukDay(m.starts_at) === today);
  if (tonight.some((m) => now >= Date.parse(m.starts_at))) return "live";
  if (tonight.some((m) => Date.parse(m.starts_at) - now <= LIVE_SOON_MINUTES * 60e3)) return "soon";
  return "idle";
}

// ── Postponed matches ────────────────────────────────────────────
/** A postponed match must be rearranged within this many weeks. */
export const POSTPONE_WEEKS = 3;

/** The date a postponed fixture must be rearranged by (ISO), or null. */
export function rearrangeBy(fixture) {
  const from = fixture.postponed_at || fixture.starts_at;
  return from ? new Date(Date.parse(from) + POSTPONE_WEEKS * 7 * 864e5).toISOString() : null;
}

// ── Old results without a scorecard ──────────────────────────────
/**
 * Results imported from the old website may only have a final score
 * (fixtures.home_score / away_score) and no frames. This turns that score
 * into stand-in frames (no players, 1–0 each) so tables, the shield and the
 * fixture lists count them exactly like any other result.
 */
export function legacyFrames(fixture) {
  const h = Number(fixture.home_score), a = Number(fixture.away_score);
  if (fixture.home_score == null || fixture.away_score == null || !Number.isFinite(h) || !Number.isFinite(a)) return [];
  const frame = (n, homeWon) => ({
    id: `legacy-${fixture.id}-${n}`, fixture_id: fixture.id, frame_no: n, legacy: true,
    home_player_id: null, away_player_id: null, home_points: homeWon ? 1 : 0, away_points: homeWon ? 0 : 1,
  });
  return [...Array.from({ length: h }, (_, i) => frame(i + 1, true)), ...Array.from({ length: a }, (_, i) => frame(h + i + 1, false))];
}

/** Frames for these fixtures, with stand-ins added for score-only results. */
export function withLegacyFrames(fixtures, frames) {
  const have = new Set(frames.map((f) => f.fixture_id));
  return [...frames, ...fixtures.filter((f) => !have.has(f.id)).flatMap(legacyFrames)];
}

// ── Handicap competitions ────────────────────────────────────────
/**
 * The head start in a handicap frame. Each side's handicap is the total of
 * its players' handicaps (one player in singles, two in doubles); the side
 * with the higher total starts the frame with the difference on the board.
 * e.g. 16 against -14 → the first side starts on 30.
 * Returns { side: "a" | "b" | null, points }.
 */
export function handicapStart(handicapsA, handicapsB) {
  const sum = (list) => list.reduce((n, h) => n + (Number(h) || 0), 0);
  const diff = sum(handicapsA) - sum(handicapsB);
  return { side: diff > 0 ? "a" : diff < 0 ? "b" : null, points: Math.abs(diff) };
}
