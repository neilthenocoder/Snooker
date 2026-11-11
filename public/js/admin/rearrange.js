// ─────────────────────────────────────────────────────────────
//  Rearranging a postponed match (round 40): the free dates before its deadline.
//  Any weeknight (Monday to Friday) before the rearrange-by date when neither team already has a match. Most teams
//  play every league night, so the usual answer is another night of the week; a league night only comes up when
//  both teams have a bye week. Each suggestion says how busy the home venue is that night, and key dates in the
//  calendar (Christmas, presentation night…) are flagged.
// ─────────────────────────────────────────────────────────────
import { ukDay, todayUK, fmtTime } from "../core/dom.js";
import { addDays } from "../core/schedule.js";
import { rearrangeBy } from "../core/rules.js";

/** [{ day: "2026-11-10", score, notes: [text…] }], best first then by date — at most `max`. */
export function freeDates(ctx, f, { max = 8, keyDates = [] } = {}) {
  // Past the deadline already: still look four weeks ahead (the suggestions say so).
  const due = ukDay(rearrangeBy(f)), deadline = [due, addDays(todayUK(), 28)].sort()[1];
  const sameLeague = ctx.fixtures.filter((x) => x.league_id === f.league_id && x.starts_at);
  // The nights the league plays: the weekdays most of its fixtures are on (at least 10% of them).
  const counts = new Map();
  for (const x of sameLeague) { const wd = new Date(`${ukDay(x.starts_at)}T12:00:00Z`).getUTCDay(); counts.set(wd, (counts.get(wd) ?? 0) + 1); }
  const nights = new Set([...counts].filter(([, n]) => n >= Math.max(1, sameLeague.length * 0.1)).map(([wd]) => wd));
  if (!nights.size) nights.add(new Date(`${ukDay(f.starts_at)}T12:00:00Z`).getUTCDay());
  const busy = (teamId, day) => ctx.fixtures.some((x) => x.id !== f.id && x.status !== "postponed" && x.starts_at && ukDay(x.starts_at) === day && (x.home_team_id === teamId || x.away_team_id === teamId));
  const bye = (teamId, day) => (ctx.byes ?? []).some((b) => b.team_id === teamId && b.bye_on === day);
  const venueUse = (day) => ctx.fixtures.filter((x) => x.id !== f.id && x.status !== "postponed" && x.venue_id && x.venue_id === f.venue_id && x.starts_at && ukDay(x.starts_at) === day).length;
  const home = ctx.team.get(f.home_team_id)?.name ?? "Home", away = ctx.team.get(f.away_team_id)?.name ?? "Away";
  const out = [];
  for (let day = addDays(todayUK(), 1); day <= deadline; day = addDays(day, 1)) {
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6 || busy(f.home_team_id, day) || busy(f.away_team_id, day)) continue;
    const notes = [], hb = bye(f.home_team_id, day), ab = bye(f.away_team_id, day), v = venueUse(day);
    let score = 0;
    if (nights.has(wd)) { notes.push(hb && ab ? "league night — both teams have a bye week" : "league night — both teams free"); score += 2; }
    else notes.push("both teams free");
    if ((hb || ab) && !(hb && ab)) notes.push(`${hb ? home : away} has a bye week`);
    if (v) { notes.push(`${v} other match${v > 1 ? "es" : ""} at the venue`); score -= v; }
    const kd = keyDates.find((k) => k.is_active !== false && k.starts_on <= day && (k.ends_on ?? k.starts_on) >= day);
    if (kd) { notes.push(`key date: ${kd.title}`); score -= 2; }
    if (day > due && due >= todayUK()) { notes.push("after the rearrange-by date"); score -= 1; }
    out.push({ day, score, notes, time: fmtTime(f.starts_at) || "19:30" });
  }
  return out.sort((a, b) => b.score - a.score || a.day.localeCompare(b.day)).slice(0, max).sort((a, b) => a.day.localeCompare(b.day));
}
