// ─────────────────────────────────────────────────────────────
//  PRESENTATION AWARDS — the league's end-of-season honours.
//  An award is a row in the `awards` table (Admin → Presentation
//  awards): a name, a trophy picture, a winner and a runner-up.
//  This file knows the standard list, how an award is tied to a
//  league or competition, and what the results say the answer is —
//  shared by the public page and the admin tools.
// ─────────────────────────────────────────────────────────────
import { buildBracket, isEntry } from "./bracket.js";
import { urls } from "./components.js";

/** The league's awards, in the order they are presented. "Add the standard list" in the admin creates these. */
export const STANDARD_AWARDS = [
  "Victory League", "Rees Memorial League", "Bill Toms", "Doubles", "Singles", "Rees Singles", "Handicap Doubles", "Seniors",
  "Team Handicap", "Team Pairs", "Willie Thomas", "Gordon Boynton Trophy", "Shootout",
  "Rees Memorial League Highest Break", "Victory League Highest Break", "Melville Mills Award",
  "Rees Memorial League Player of the Year", "Victory League Player of the Year",
  "Rees Memorial League Rankings Winner", "Victory League Rankings Winner",
  "Rest of the League (Victory)", "Rest of the League (Rees)",
];

const low = (s) => String(s ?? "").trim().toLowerCase();

/**
 * Which competition or league an award belongs to, worked out from its name:
 * a competition with exactly that name, otherwise the league the name starts with
 * ("Victory League Highest Break") or carries in brackets ("Rest of the League (Rees)").
 */
export function linkAward(name, leagues, competitions) {
  const n = low(name);
  const comp = competitions.find((c) => low(c.name) === n);
  if (comp) return { competition_id: comp.id, league_id: null };
  const league = leagues.find((l) => n.startsWith(low(l.name)) || (l.short_name && n.includes(`(${low(l.short_name)})`)));
  return { competition_id: null, league_id: league?.id ?? null };
}

/** "league" (the title itself), "break", "rankings", "competition" — or "manual" for awards only the committee can decide. */
export function awardKind(award, leagues) {
  if (award.competition_id) return "competition";
  const league = leagues.find((l) => l.id === award.league_id);
  if (!league) return "manual";
  const n = low(award.name);
  if (/highest break/.test(n)) return "break";
  if (/ranking/.test(n)) return "rankings";
  return n === low(league.name) ? "league" : "manual";
}

/** The winner and beaten finalist of a knockout competition: { winner, runnerUp } (entries), or null until the final is played. */
export function competitionFinal(comp, data) {
  const b = buildBracket(data.entries.filter((e) => e.competition_id === comp.id), data.matches.filter((m) => m.competition_id === comp.id));
  if (!b.champion) return null;
  const final = b.rounds.at(-1)?.[0];
  return { winner: b.entryById.get(b.champion), runnerUp: isEntry(final?.loser) ? b.entryById.get(final.loser) : null };
}

/**
 * What the results say an award's answer is — the fields to save, or null when it can't be worked out
 * (a committee award, or nothing played yet). `ctx` is that season's seasonContext, `data` loadCompetitions().
 */
export function awardFromResults(award, ctx, data) {
  const side = (prefix, who) => ({ [`${prefix}_name`]: who?.name ?? null, [`${prefix}_player_id`]: who?.player_id ?? null, [`${prefix}_team_id`]: who?.team_id ?? null });
  const both = (first, second, note = null) => (first ? { ...side("winner", first), ...side("runner_up", second), ...(note ? { note } : {}) } : null);
  const ofPlayer = (p) => (p ? { name: p.full_name, player_id: p.id } : null);
  const ofTeam = (t) => (t ? { name: t.name, team_id: t.id } : null);
  switch (awardKind(award, ctx.leagues)) {
    case "league": {
      const rows = ctx.standings(award.league_id).filter((r) => r.p > 0);
      return both(ofTeam(rows[0]?.team), ofTeam(rows[1]?.team), rows[0] ? `${rows[0].pts} points from ${rows[0].p} matches` : null);
    }
    case "rankings": {
      const rows = ctx.rankings(award.league_id);
      return both(ofPlayer(rows[0]?.player), ofPlayer(rows[1]?.player), rows[0] ? `${rows[0].pts} ranking points` : null);
    }
    case "break": {
      const all = ctx.breaksIn(award.league_id).filter((b) => b.player);
      const next = all.find((b) => b.player_id !== all[0]?.player_id);
      return both(ofPlayer(all[0]?.player), ofPlayer(next?.player), all[0] ? `A break of ${all[0].value}` : null);
    }
    case "competition": {
      const comp = data.competitions.find((c) => c.id === award.competition_id);
      const final = comp && competitionFinal(comp, data);
      const ofEntry = (e) => (e ? { name: e.name, player_id: e.name?.includes("&") ? null : e.player_id, team_id: e.team_id } : null);
      return final ? both(ofEntry(final.winner), ofEntry(final.runnerUp)) : null;
    }
    default: return null;
  }
}

/**
 * One side of an award, ready to show: { name, image, href, team (for an emblem), sub } — or null when not decided.
 * `prefix` is "winner" or "runner_up"; `look` = { players: Map, teams: Map }.
 * The picture is the one uploaded for the award, else the player's photo, else the team's emblem.
 */
export function awardSide(award, prefix, look) {
  const p = look.players.get(award[`${prefix}_player_id`]), t = look.teams.get(award[`${prefix}_team_id`]);
  const name = award[`${prefix}_name`] || p?.full_name || t?.name;
  if (!name) return null;
  const own = award[`${prefix}_image_url`] || "";
  return { name, own, image: own || p?.avatar_url || "", team: !own && !p ? t : null, href: p ? urls.player(p) : t ? urls.team(t) : "",
    sub: p ? look.teams.get(p.team_id)?.name ?? "" : "" };
}

/** The trophy picture for an award: its own, else its competition's or league's. */
export function awardTrophy(award, leagues, competitions) {
  return award.trophy_url
    || competitions.find((c) => c.id === award.competition_id)?.trophy_url
    || leagues.find((l) => l.id === award.league_id)?.trophy_url || "";
}
