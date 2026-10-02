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
  // Entrants with a bye are written straight into round 2, so the database
  // always knows who is in each match (captains' permissions rely on it).
  for (const r of rows.filter((x) => x.round === 1)) {
    const through = r.entry_a && !r.entry_b ? r.entry_a : !r.entry_a && r.entry_b ? r.entry_b : null;
    if (!through || rounds < 2) continue;
    const next = rows.find((x) => x.round === 2 && x.slot === Math.floor(r.slot / 2));
    next[r.slot % 2 ? "entry_b" : "entry_a"] = through;
  }
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
      const pick = (id) => (id && entryById.has(id) ? id : null);
      if (round === 1) {
        a = pick(row.entry_a) ?? EMPTY;
        b = pick(row.entry_b) ?? EMPTY;
      } else {
        // Later rounds follow the bracket, unless the admin set the pairing
        // (a manual change, or a fresh random draw for this round).
        a = pick(row.entry_a) ?? rounds[round - 2][slot * 2].winner;
        b = pick(row.entry_b) ?? rounds[round - 2][slot * 2 + 1].winner;
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

/**
 * "Redraw every round": once every match in `round` has a winner, pair the
 * winners at random for the next round. Returns [{ slot, entry_a, entry_b }]
 * for the next round's rows, or throws if the round isn't finished.
 */
export function redrawNextRound(bracket, round) {
  const list = bracket.rounds[round - 1];
  if (!list || round >= bracket.totalRounds) throw new Error("There's no next round to draw.");
  const winners = list.map((m) => m.winner);
  if (winners.some((w) => w === PENDING)) throw new Error(`Finish every ${roundName(round, bracket.totalRounds).toLowerCase()} match first.`);
  const real = shuffle(winners.filter(isEntry));
  const byes = winners.length - real.length;
  // Any byes left over (from empty slots) are spread across different matches.
  const order = [];
  for (let i = 0; i < winners.length / 2; i++) order.push(real.shift() ?? null, i < byes ? null : real.shift() ?? null);
  return Array.from({ length: winners.length / 2 }, (_, slot) => ({ slot, entry_a: order[slot * 2], entry_b: order[slot * 2 + 1] }));
}

/**
 * After a match is decided, write the winner into the next round's match
 * (bracket draws only). Returns { id, entry_a | entry_b } to save, or null.
 */
export function winnerAdvance(bracket, round, slot) {
  const m = bracket.rounds[round - 1]?.[slot];
  const next = bracket.rounds[round]?.[Math.floor(slot / 2)];
  if (!m || !next?.row?.id || !isEntry(m.winner)) return null;
  return { id: next.row.id, [slot % 2 ? "entry_b" : "entry_a"]: m.winner };
}

/**
 * Who goes into a plate competition: every entrant that lost its FIRST match —
 * a first-round loser, or (after a first-round bye) a second-round loser.
 * Returns the entry rows, in bracket order.
 */
export function firstMatchLosers(bracket) {
  const [r1 = [], r2 = []] = bracket.rounds;
  const ids = r1.filter((m) => m.played && isEntry(m.loser)).map((m) => m.loser);
  for (const m of r2) {
    if (m.played && isEntry(m.loser) && r1.some((x) => x.isBye && x.winner === m.loser)) ids.push(m.loser);
  }
  return ids.map((id) => bracket.entryById.get(id)).filter(Boolean);
}
