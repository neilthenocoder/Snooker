// Match preview summary (Rich, round 37): a few plain sentences about how these two teams have got on against
// each other in the league before — the last meeting, its score and best break, and the overall record.
// Written from a fixed set of sentence patterns filled in with the real results (no AI, nothing made up):
// a sentence is left out when the data for it isn't there (an old result with only the final score has no
// breaks, for example).
import { matchScore, frameWinner } from "./rules.js";
import { fmtLongDate } from "./dom.js";

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const num = (n) => WORDS[n] ?? String(n);
const plural = (n, word) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;
const year = (iso) => String(iso ?? "").slice(0, 4);

/**
 * fixture — the match the page is about; home / away — its two teams ({ id, name });
 * meetings — earlier league fixtures between the same two teams (either way round);
 * framesBy — Map fixture id → frames; breaks — the breaks of those meetings;
 * playerName(id) — a player's name or null; leagueName(id) — a league's name.
 * Returns { title, sentences: [string] } or null when they have never met.
 */
export function headToHeadSummary({ fixture, home, away, meetings, framesBy, breaks = [], playerName = () => null, leagueName = () => "" }) {
  if (!home || !away) return null;
  const before = meetings
    .filter((f) => f.id !== fixture.id && f.starts_at && (!fixture.starts_at || f.starts_at < fixture.starts_at))
    .map((f) => {
      const frames = framesBy.get(f.id) ?? [];
      const s = matchScore(frames);
      // Scores from this match's point of view: "us" is the page's home team, whichever way round they played.
      const flip = f.home_team_id !== home.id;
      const us = flip ? s.away : s.home, them = flip ? s.home : s.away;
      return { f, frames, us, them, winner: us > them ? home : them > us ? away : null };
    })
    .filter((m) => m.us + m.them > 0)
    .sort((a, b) => b.f.starts_at.localeCompare(a.f.starts_at));
  if (!before.length) return null;

  // Which team a break was made for: the side the player was on in that frame.
  const breakTeam = (b, m) => {
    const fr = m.frames.find((x) => x.frame_no === b.frame_no);
    const side = fr?.home_player_id === b.player_id ? "home" : fr?.away_player_id === b.player_id ? "away" : null;
    if (!side) return null;
    return (side === "home") === (m.f.home_team_id === home.id) ? home : away;
  };
  const topBreak = (list) => list.filter((b) => playerName(b.player_id)).sort((a, b) => b.value - a.value)[0] ?? null;

  const sentences = [];
  const last = before[0];
  const where = last.f.league_id && last.f.league_id !== fixture.league_id && leagueName(last.f.league_id) ? ` in the ${leagueName(last.f.league_id)}` : "";
  const hi = Math.max(last.us, last.them), lo = Math.min(last.us, last.them);
  if (!last.winner) {
    sentences.push(`The last time these two met in the league was on ${fmtLongDate(last.f.starts_at)}${where}, and it finished all square at ${hi}–${lo}.`);
  } else {
    const how = lo === 0 ? `a clean sweep for ${last.winner.name}, ${hi}–0`
      : hi - lo === 1 ? `a close match, with ${last.winner.name} edging it ${hi}–${lo}`
      : `${last.winner.name} won ${hi}–${lo}`;
    sentences.push(`The last time these two met in the league was on ${fmtLongDate(last.f.starts_at)}${where}: ${how}.`);
  }
  // A close finish: the deciding frame.
  if (last.winner && hi - lo === 1 && last.frames.length && last.frames.every((x) => !x.legacy)) {
    const decider = [...last.frames].sort((a, b) => b.frame_no - a.frame_no).find((x) => frameWinner(x));
    const winSide = decider && frameWinner(decider);
    const pid = decider && decider[`${winSide}_player_id`];
    const winnerTeamSide = (last.f.home_team_id === last.winner.id) ? "home" : "away";
    if (pid && playerName(pid) && winSide === winnerTeamSide) sentences.push(`${playerName(pid)} won the last frame to settle it.`);
  }
  const lastBreaks = breaks.filter((b) => b.fixture_id === last.f.id);
  const lb = topBreak(lastBreaks);
  if (lb) {
    const t = breakTeam(lb, last);
    const others = lastBreaks.filter((b) => b !== lb && playerName(b.player_id));
    sentences.push(`${playerName(lb.player_id)}${t ? ` (${t.name})` : ""} made the highest break of the night, a ${lb.value}${others.length ? `, one of ${plural(lastBreaks.length, "break")} in the match` : ""}.`);
  }

  // The overall record.
  if (before.length > 1) {
    const w = before.filter((m) => m.winner === home).length, l = before.filter((m) => m.winner === away).length, d = before.length - w - l;
    const fa = before.reduce((n, m) => n + m.us, 0), fb = before.reduce((n, m) => n + m.them, 0);
    const since = year(before.at(-1).f.starts_at);
    const lead = w === l ? `honours are even, ${w} wins each` : `${w > l ? home.name : away.name} lead ${Math.max(w, l)}–${Math.min(w, l)}`;
    sentences.push(`Across ${plural(before.length, "league meeting")} since ${since}, ${lead}${d ? ` with ${plural(d, "draw")}` : ""} — ${fa}–${fb} in frames (${home.name} first).`);
    // A run of wins for one team.
    let run = 0;
    while (run < before.length && before[run].winner && before[run].winner === last.winner) run++;
    if (run >= 3) sentences.push(`${last.winner.name} have won the last ${num(run)} meetings.`);
    else if (last.winner && before[1].winner && before[1].winner !== last.winner) sentences.push(`${before[1].winner.name} won the meeting before that, so the last two are shared.`);
    // Home record in this fixture.
    const atHome = before.filter((m) => m.f.home_team_id === fixture.home_team_id);
    if (atHome.length >= 2) {
      const hw = atHome.filter((m) => m.winner?.id === fixture.home_team_id).length;
      const hostName = fixture.home_team_id === home.id ? home.name : away.name;
      sentences.push(`At home in this fixture, ${hostName} have won ${num(hw)} of ${num(atHome.length)}.`);
    }
    // The best break in any of these meetings, when it wasn't the one already mentioned.
    const all = topBreak(breaks.filter((b) => before.some((m) => m.f.id === b.fixture_id)));
    if (all && all !== lb) {
      const m = before.find((x) => x.f.id === all.fixture_id);
      const t = breakTeam(all, m);
      sentences.push(`The best break in this fixture is a ${all.value} by ${playerName(all.player_id)}${t ? ` for ${t.name}` : ""}, back in ${fmtLongDate(m.f.starts_at).replace(/^\d+ /, "")}.`);
    }
  }
  return { title: `${home.name} v ${away.name}: head to head`, sentences, meetings: before.length };
}
