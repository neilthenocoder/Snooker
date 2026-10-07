// ─────────────────────────────────────────────────────────────
//  LIVE SCOREBOARD — the rules for scoring a match ball by ball.
//  No HTML and no database here: every function takes the match
//  as it is and returns the match as it should be after the press.
//  The control pad (admin/scoreboard.js) saves the result; the
//  public scoreboard (pages/scoreboard.js) just draws it.
//
//  A match row: { best_of, status, frames_a, frames_b, state }
//  state = {
//    frame:  { no, a, b, striker: "a" | "b", brk, pots: [1, 7, 1, …], reds, colours: [2..7],
//              onColour, high_a, high_b, last: "…what just happened…" },
//    frames: [{ no, a, b, winner, high_a, high_b }]     // finished frames
//  }
// ─────────────────────────────────────────────────────────────
export const BALLS = [
  { value: 1, key: "red", name: "Red" }, { value: 2, key: "yellow", name: "Yellow" }, { value: 3, key: "green", name: "Green" },
  { value: 4, key: "brown", name: "Brown" }, { value: 5, key: "blue", name: "Blue" }, { value: 6, key: "pink", name: "Pink" }, { value: 7, key: "black", name: "Black" },
];
export const ballOf = (value) => BALLS.find((b) => b.value === value);
export const MAX_BEST_OF = 9;      // first to 5
export const REDS = 15;

const other = (side) => (side === "a" ? "b" : "a");
const copy = (x) => JSON.parse(JSON.stringify(x));
export const framesToWin = (m) => Math.floor((m.best_of || 1) / 2) + 1;

export const newFrame = (no, striker = "a") => ({ no, a: 0, b: 0, striker, breaker: striker, brk: 0, pots: [], reds: REDS, colours: [2, 3, 4, 5, 6, 7], onColour: false, high_a: 0, high_b: 0, last: "" });

/** Start the match: frame 1, with `breaker` at the table. */
export function start(match, breaker = "a") {
  return { ...match, status: "live", frames_a: 0, frames_b: 0, started_at: new Date().toISOString(), finished_at: null, state: { frame: newFrame(1, breaker), frames: [] } };
}

/** Change the frame being played with `fn(frame)`, returning a new match. */
function inFrame(match, fn) {
  if (match.status !== "live" || !match.state?.frame) return match;
  const next = copy(match);
  fn(next.state.frame);
  return next;
}

/** A ball is potted by the player at the table. */
export const pot = (match, value) => inFrame(match, (f) => {
  const s = f.striker;
  f[s] += value; f.brk += value; f.pots.push(value);
  f[`high_${s}`] = Math.max(f[`high_${s}`], f.brk);
  if (value === 1) { f.reds = Math.max(0, f.reds - 1); f.onColour = true; }
  else if (f.onColour || f.reds > 0) f.onColour = false;                 // a colour after a red goes back on its spot
  else f.colours = f.colours.filter((c) => c !== value);                // the colours at the end stay down
  f.last = `${ballOf(value).name} potted`;
});

/**
 * A free ball (awarded after a foul leaves the player snookered): the ball played counts as the
 * ball that is "on" — one point while there are reds, otherwise the value of the lowest colour left.
 * Nothing leaves the table.
 */
export const freeBall = (match) => inFrame(match, (f) => {
  const s = f.striker, value = f.reds > 0 ? 1 : (f.colours[0] ?? 0);
  if (!value) return;
  f[s] += value; f.brk += value; f.pots.push(value);
  f[`high_${s}`] = Math.max(f[`high_${s}`], f.brk);
  if (f.reds > 0) f.onColour = true;
  f.last = `Free ball potted (${value})`;
});

/** The break is over (a miss or a safety): the other player comes to the table. */
export const endBreak = (match) => inFrame(match, (f) => {
  f.last = f.brk ? `Break of ${f.brk} ends` : "No score";
  f.striker = other(f.striker); f.brk = 0; f.pots = []; f.onColour = false;
});

/** A foul by the player at the table: the points go to the opponent, who comes to the table. */
export const foul = (match, points) => inFrame(match, (f) => {
  const to = other(f.striker);
  f[to] += points;
  f.last = `Foul — ${points} away`;
  f.striker = to; f.brk = 0; f.pots = []; f.onColour = false;
});

/** Put a named player at the table (to put right a wrong press). */
export const setStriker = (match, side) => inFrame(match, (f) => { if (f.striker !== side) { f.striker = side; f.brk = 0; f.pots = []; f.onColour = false; } });

/** Add or take away points by hand (a free ball, or a correction). */
export const adjust = (match, side, delta) => inFrame(match, (f) => { f[side] = Math.max(0, f[side] + delta); f.last = `${delta > 0 ? "+" : ""}${delta} (correction)`; });

/** A red leaves the table without scoring (potted on a foul), or is put back. */
export const adjustReds = (match, delta) => inFrame(match, (f) => { f.reds = Math.max(0, Math.min(REDS, f.reds + delta)); });

/** Points still on the table. */
export function remaining(frame) {
  if (!frame) return 0;
  if (frame.reds > 0 || frame.onColour) return frame.reds * 8 + 27 + (frame.onColour ? 7 : 0);
  return frame.colours.reduce((n, c) => n + c, 0);
}

/** Who is ahead in the frame, by how much, and whether the other player needs snookers. */
export function situation(frame) {
  if (!frame) return null;
  const lead = frame.a - frame.b, left = remaining(frame);
  const ahead = lead > 0 ? "a" : lead < 0 ? "b" : null;
  return { ahead, lead: Math.abs(lead), remaining: left, snookers: !!ahead && Math.abs(lead) > left };
}

/**
 * The frame is over. `winner` is "a" or "b" (leave it out to give it to whoever has more points).
 * Returns the match with the frame added to the list — finished if that wins the match,
 * otherwise with the next frame set up (the players take turns to break).
 */
export function endFrame(match, winner) {
  if (match.status !== "live" || !match.state?.frame) return match;
  const f = match.state.frame;
  const w = winner ?? (f.a > f.b ? "a" : f.b > f.a ? "b" : null);
  if (!w) return match;                                           // level: play the re-spotted black, or choose a winner
  const next = copy(match);
  next.state.frames.push({ no: f.no, a: f.a, b: f.b, winner: w, high_a: f.high_a, high_b: f.high_b });
  next[`frames_${w}`] = (next[`frames_${w}`] || 0) + 1;
  if (next[`frames_${w}`] >= framesToWin(next)) {
    next.status = "finished"; next.finished_at = new Date().toISOString(); next.state.frame = null;
  } else {
    next.state.frame = newFrame(f.no + 1, other(f.breaker ?? "a"));
  }
  return next;
}

/** The ball the player at the table should play next: "red", "colour" (any colour, after a red) or the next colour's value. */
export function ballOn(frame) {
  if (!frame) return null;
  if (frame.onColour) return "colour";
  if (frame.reds > 0) return "red";
  return frame.colours[0] ?? null;
}

/** A side's name: the league player chosen for it, or the name typed in. */
export const sideName = (match, side, players) =>
  players.find((p) => p.id === match[`player_${side}_id`])?.full_name || match[`name_${side}`] || (side === "a" ? "Player A" : "Player B");
export const sidePlayer = (match, side, players) => players.find((p) => p.id === match[`player_${side}_id`]) ?? null;
/** "Bill Toms · Final" */
export const matchLabel = (match, competitions) =>
  [competitions.find((c) => c.id === match.competition_id)?.name, match.round_name || match.title].filter(Boolean).join(" · ") || match.title || "Match";

/** "a" | "b" | null — who won a finished match. */
export const matchWinner = (m) => (m.status !== "finished" ? null : (m.frames_a || 0) > (m.frames_b || 0) ? "a" : "b");
/** The best break each player has made in the match so far. */
export function highBreaks(match) {
  const all = [...(match.state?.frames ?? []), ...(match.state?.frame ? [match.state.frame] : [])];
  return { a: Math.max(0, ...all.map((f) => f.high_a || 0)), b: Math.max(0, ...all.map((f) => f.high_b || 0)) };
}
