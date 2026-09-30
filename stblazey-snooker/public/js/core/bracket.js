// ─────────────────────────────────────────────────────────────
//  KNOCKOUT BRACKETS — pure functions, no database or HTML.
//  Only round-1 pairings and each match's score are stored; who
//  plays in later rounds is worked out here from the winners.
// ─────────────────────────────────────────────────────────────

export const EMPTY = "empty";     // a bye: nobody in this slot
export const PENDING = "pending"; // not decided yet

/** Number of rounds needed for n entrants (2 → 1, 3–4 → 2, 5–8 → 3 …). */
export const roundsFor = (n) => Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));

export function roundName(round, totalRounds) {
  const fromEnd = totalRounds - round;
  return ["Final", "Semi-finals", "Quarter-finals"][fromEnd] ?? `Round ${round}`;
}

/** Standard tournament seeding positions: 8 → [1,8,4,5,2,7,3,6], so seeds 1 and 2 can only meet in the final. */
function seedOrder(size) {
  let order = [1];
  while (order.length < size) { const n = order.length * 2; order = order.flatMap((s) => [s, n + 1 - s]); }
  return order;
}

/**
 * Build the match rows for a fresh draw. Entries are treated as seeds in the
 * order given (shuffle first for a random draw). When the field isn't a power
 * of two, the top seeds get the byes and are kept apart until later rounds.
 */
export function makeDraw(entryIds) {
  const rounds = roundsFor(entryIds.length);
  const size = 2 ** rounds;
  const order = seedOrder(size);
  const rows = [];
  for (let slot = 0; slot < size / 2; slot++) {
    rows.push({ round: 1, slot, entry_a: entryIds[order[slot * 2] - 1] ?? null, entry_b: entryIds[order[slot * 2 + 1] - 1] ?? null });
  }
  for (let round = 2; round <= rounds; round++)
    for (let slot = 0; slot < size / 2 ** round; slot++) rows.push({ round, slot, entry_a: null, entry_b: null });
  return rows;
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Work out the whole bracket.
 * Returns { rounds: [[match…]…], totalRounds, champion, entryById }
 * Each match: { round, slot, row, a, b, winner, loser, isBye, played }
 * where a / b / winner are an entry id, EMPTY or PENDING.
 */
export function buildBracket(entries, matchRows) {
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const rowAt = new Map(matchRows.map((m) => [`${m.round}:${m.slot}`, m]));
  const totalRounds = matchRows.reduce((n, m) => Math.max(n, m.round), 0);
  const rounds = [];

  for (let round = 1; round <= totalRounds; round++) {
    const count = 2 ** (totalRounds - round);
    const list = [];
    for (let slot = 0; slot < count; slot++) {
      const row = rowAt.get(`${round}:${slot}`) ?? { round, slot };
      let a, b;
      if (round === 1) {
        a = row.entry_a && entryById.has(row.entry_a) ? row.entry_a : EMPTY;
        b = row.entry_b && entryById.has(row.entry_b) ? row.entry_b : EMPTY;
      } else {
        a = rounds[round - 2][slot * 2].winner;
        b = rounds[round - 2][slot * 2 + 1].winner;
      }
      list.push({ round, slot, row, a, b, ...decide(a, b, row) });
    }
    rounds.push(list);
  }
  const final = rounds.at(-1)?.[0];
  const champion = final && isEntry(final.winner) ? final.winner : null;
  return { rounds, totalRounds, champion, entryById };
}

export const isEntry = (x) => x !== EMPTY && x !== PENDING && x != null;

function decide(a, b, row) {
  const played = row.score_a != null && row.score_b != null && row.score_a !== row.score_b;
  if (a === EMPTY && b === EMPTY) return { winner: EMPTY, loser: EMPTY, isBye: true, played: false };
  if (a === EMPTY) return { winner: b, loser: EMPTY, isBye: true, played: false };
  if (b === EMPTY) return { winner: a, loser: EMPTY, isBye: true, played: false };
  if (a === PENDING || b === PENDING || !played) return { winner: PENDING, loser: PENDING, isBye: false, played: false };
  const aWins = row.score_a > row.score_b;
  return { winner: aWins ? a : b, loser: aWins ? b : a, isBye: false, played: true };
}

/** Where every entrant got to: furthest round, W/L, frames for/against, status text. */
export function competitionStandings(bracket) {
  const { rounds, totalRounds, champion, entryById } = bracket;
  const rows = new Map([...entryById.keys()].map((id) => [id, { entry: entryById.get(id), reached: 0, lastWon: 0, w: 0, l: 0, f: 0, a: 0, out: false }]));
  for (const list of rounds) for (const m of list) {
    for (const [side, scoreKey, otherKey] of [["a", "score_a", "score_b"], ["b", "score_b", "score_a"]]) {
      const id = m[side];
      if (!isEntry(id)) continue;
      const r = rows.get(id);
      r.reached = Math.max(r.reached, m.round);
      if (m.played) {
        r.f += m.row[scoreKey]; r.a += m.row[otherKey];
        if (m.winner === id) { r.w++; r.lastWon = m.round; } else { r.l++; r.out = true; }
      }
    }
  }
  const status = (r) => {
    if (r.entry.id === champion) return "Winner";
    if (r.out && r.reached === totalRounds) return "Runner-up";
    const name = (round) => roundName(round, totalRounds).replace(/^Round/, "round").replace(/^(Q|S|F)/, (c) => c.toLowerCase());
    if (r.out) return `Out in the ${name(r.reached)}`;
    if (!r.reached) return "Waiting for the draw";
    if (r.lastWon && r.lastWon === r.reached) return `Through to the ${name(r.reached + 1)}`;
    return `Playing in the ${name(r.reached)}`;
  };
  return [...rows.values()]
    .map((r) => ({ ...r, status: status(r), alive: !r.out }))
    .sort((x, y) => (y.entry.id === champion) - (x.entry.id === champion) || y.reached - x.reached || y.alive - x.alive || y.w - x.w || (y.f - y.a) - (x.f - x.a) || x.entry.name.localeCompare(y.entry.name));
}

/** One-line summary, e.g. "Winner: Bethel A" or "Quarter-finals · 2 of 4 played". */
export function progressText(bracket) {
  if (!bracket.totalRounds) return "Draw not made yet";
  if (bracket.champion) return `Winner: ${bracket.entryById.get(bracket.champion).name}`;
  const current = bracket.rounds.find((list) => list.some((m) => !m.isBye && !m.played)) ?? bracket.rounds.at(-1);
  const real = current.filter((m) => !m.isBye);
  return `${roundName(current[0].round, bracket.totalRounds)} · ${real.filter((m) => m.played).length} of ${real.length} played`;
}
