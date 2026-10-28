// ─────────────────────────────────────────────────────────────
//  COMPETITION DEADLINES — the warnings a logged-in player (or a
//  captain, for team competitions) gets about their own cup matches:
//  "your round 1 match must be played by …; you are the home player,
//  contact your opponent and arrange it by …" — and for the away
//  player, what they can do if the home player has not been in touch.
//
//  Where the dates come from (Admin → Competitions → Draws & results → 3. Round deadlines):
//    round_deadlines  { "1": "2026-10-20", … }  the day each round must be played by
//    round_contact    { "1": "2026-10-10", … }  the day the home player must have made contact by (optional)
//  Who is at home: the first-named in the draw, unless the league has switched the match
//  (competition_matches.home_switched — the tick box on that match in Draws & results).
//  How long before a deadline the warnings start, and the rule shown to an away player whose
//  opponent has not been in touch: Admin → Site settings → Competitions.
//  Shown in: My area → Competitions, the My Snooker page, and a bar on the home page.
// ─────────────────────────────────────────────────────────────
import { html, fmtDate, fmtTime, todayUK } from "./dom.js";
import { buildBracket, isEntry, roundName } from "./bracket.js";
import { isCaptain } from "./auth.js";
import { urls } from "./components.js";

export const WARN_DAYS = 14;
export const CONTACT_RULE = "If the home player hasn't contacted you by that date, the match is switched to you: you become the home player and you offer your opponent three dates to play it. In a competition where your opponent would get 5 extra points, you get 10. Tell the competition secretary, so the draw can show the change.";

const at = (iso) => Date.parse(`${iso}T12:00:00Z`);
const daysUntil = (iso) => Math.round((at(iso) - at(todayUK())) / 864e5);
const dayText = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).replace(",", "");
const inDays = (n) => (n < 0 ? `${-n} day${n === -1 ? "" : "s"} ago` : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
const roundDate = (map, round) => map?.[round] ?? map?.[String(round)] ?? null;

/** Is this draw entry the logged-in person's own? Their player, their doubles pair, or (captains) their team. */
function ownEntry(user, ctx, c, e) {
  if (!e) return false;
  const me = user?.profile?.player_id ? ctx.player.get(user.profile.player_id) : null;
  if (me && (e.player_id === me.id || e.partner_id === me.id)) return true;
  // A doubles pair is entered under one player's profile, with both names ("Sam Bolitho & Dan Couch").
  if (me && c.kind === "Doubles" && String(e.name ?? "").split("&").map((x) => x.trim().toLowerCase()).includes(me.full_name.toLowerCase())) return true;
  return c.kind === "Team" && !!e.team_id && e.team_id === user?.profile?.team_id && isCaptain(user);
}

/**
 * The warnings for one person, most urgent first:
 * [{ level: "late" | "soon" | "info", c, m, title, lines: [text…], href }]
 */
export function deadlineWarnings(user, ctx, comps, site = {}) {
  if (!user?.profile) return [];
  const warnDays = Number.isFinite(Number(site.comp_warn_days)) && Number(site.comp_warn_days) > 0 ? Number(site.comp_warn_days) : WARN_DAYS;
  const rule = String(site.comp_contact_rule ?? "").trim() || CONTACT_RULE;
  const out = [];
  for (const c of comps.competitions) {
    if (c.season_id && ctx.season?.id && c.season_id !== ctx.season.id) continue;
    const entries = comps.entries.filter((e) => e.competition_id === c.id);
    const b = buildBracket(entries, comps.matches.filter((x) => x.competition_id === c.id));
    for (const m of b.rounds.flat()) {
      if (m.isBye || !isEntry(m.a) || !isEntry(m.b) || !m.row?.id) continue;
      if (m.row.status === "completed" || m.row.score_a != null) continue;
      const ea = b.entryById.get(m.a), eb = b.entryById.get(m.b);
      const side = ownEntry(user, ctx, c, ea) ? "a" : ownEntry(user, ctx, c, eb) ? "b" : null;
      const by = roundDate(c.round_deadlines, m.round);
      if (!side || !by) continue;
      const contact = roundDate(c.round_contact, m.round);
      const left = daysUntil(by), contactLeft = contact ? daysUntil(contact) : null;
      if (left > warnDays && !(contactLeft !== null && contactLeft <= 7)) continue;
      const homeSide = m.row.home_switched ? "b" : "a";
      const home = side === homeSide, opp = (side === "a" ? eb : ea).name;
      const arranged = !!m.row.starts_at;
      const lines = [];
      if (left < 0) lines.push(`The deadline was ${dayText(by)} and there is no result yet. Play it as soon as you can, and tell the competition secretary.`);
      else lines.push(`It must be played by ${dayText(by)} — ${inDays(left)}.`);
      if (m.row.home_switched) lines.push(home ? "The league has switched this match: you are now at home." : `The league has switched this match: ${(homeSide === "a" ? ea : eb).name} are now at home.`);
      if (arranged) lines.push(`Arranged for ${fmtDate(m.row.starts_at)} at ${fmtTime(m.row.starts_at)}.`);
      else if (home) {
        if (contact && contactLeft >= 0) lines.push(`You are at home: contact ${opp} and arrange the match by ${dayText(contact)} (${inDays(contactLeft)}).`);
        else if (contact) lines.push(`You are at home, and the day to have made contact (${dayText(contact)}) has passed. If you have not been in touch with ${opp}, they may now take the match at home.`);
        else lines.push(`You are at home: it is up to you to contact ${opp} and arrange the match.`);
      } else {
        if (contact && contactLeft >= 0) lines.push(`You are away: ${opp} should contact you to arrange it by ${dayText(contact)} (${inDays(contactLeft)}).`);
        else if (contact) lines.push(`You are away. ${opp} should have contacted you by ${dayText(contact)}. ${rule}`);
        else lines.push(`You are away: ${opp} should contact you to arrange it.`);
      }
      const level = left < 0 ? "late" : left <= 7 || (!arranged && contactLeft !== null && contactLeft <= 3) ? "soon" : "info";
      out.push({ level, c, m, left, title: `${c.name} · ${roundName(m.round, b.totalRounds, b)}: ${(side === "a" ? ea : eb).name} v ${opp}`, lines, href: urls.cupMatch(m.row) });
    }
  }
  const rank = { late: 0, soon: 1, info: 2 };
  return out.sort((x, y) => rank[x.level] - rank[y.level] || x.left - y.left);
}

const icon = { late: "!", soon: "⏰", info: "📅" };
/** The list of warnings (nothing at all when there are none). */
export const deadlineList = (warnings, { title = "Competition deadlines" } = {}) => (!warnings.length ? "" : html`<section class="cd-box" aria-label="${title}">
  <h3 class="cd-head">${title}</h3>
  <ul class="cd-list">${warnings.map((w) => html`<li class="cd-item ${w.level}"><span class="cd-ico" aria-hidden="true">${icon[w.level]}</span>
    <div><a href="${w.href}"><b>${w.title}</b></a>${w.lines.map((l) => html`<p>${l}</p>`)}</div></li>`)}</ul></section>`);

/** One line for the home page, when something is due within a week (or overdue). */
export function deadlineBar(warnings) {
  const urgent = warnings.filter((w) => w.level !== "info");
  if (!urgent.length) return "";
  const w = urgent[0];
  return html`<a class="cd-bar ${w.level}" href="/my/competitions"><b>${w.level === "late" ? "Competition match overdue" : "Competition deadline"}</b>
    <span>${w.title} — ${w.left < 0 ? "past its deadline" : `play by ${fmtDate(roundDate(w.c.round_deadlines, w.m.round) + "T12:00:00Z")}`}${urgent.length > 1 ? ` (and ${urgent.length - 1} more)` : ""}</span><i>See what to do →</i></a>`;
}
