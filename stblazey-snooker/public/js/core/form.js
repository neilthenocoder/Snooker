// ─────────────────────────────────────────────────────────────
//  FORM GUIDE (Rich, round 25): a mark out of 10.0 for every player
//  and team, from their last few results this season — league
//  matches and knockout competitions — like the "Form" figure in
//  fantasy football.
//
//  Each match gets a mark out of 10:
//    Players — up to 7 for the share of frames won
//              (won 2 of 2 = 7, won 1 of 2 = 3.5, lost both = 0)
//              + up to 3 for their best break that night
//              (30+ = 1, 50+ = 2, 70+ = 3).
//    Teams   — up to 7 for the share of frames won
//              + 3 for a win, 1.5 for a draw, 0 for a defeat.
//  Form = the average mark of the last FORM.last matches (6), one decimal place.
//  Change a number below and the whole site follows.
// ─────────────────────────────────────────────────────────────
import { html, fmtDate } from "./dom.js";
import { loadCompetitions, competitionBreaks } from "./api.js";
import { frameWinner, isCounted, RULES } from "./rules.js";
import { winnerSide } from "./bracket.js";

export const FORM = {
  last: 6,                         // how many recent matches count
  framesShare: 7,                  // marks for winning every frame
  breakBonus: [[70, 3], [50, 2], [30, 1]], // a player's best break that night → extra marks
  teamResult: { w: 3, d: 1.5, l: 0 },      // a team's extra marks for the result
  good: 7, ok: 4,                  // colour: 7.0+ green, 4.0–6.9 amber, below 4.0 red
};

export const FORM_TEXT = `Form is a mark out of 10, averaged over the last ${FORM.last} matches this season (league and competitions). ` +
  `Players: up to ${FORM.framesShare} for the share of frames won, plus up to 3 for their best break that night (30+ = 1, 50+ = 2, 70+ = 3). ` +
  `Teams: up to ${FORM.framesShare} for the share of frames won, plus ${FORM.teamResult.w} for a win or ${FORM.teamResult.d} for a draw.`;

const round1 = (n) => Math.round(n * 10) / 10;
const bonus = (best) => (FORM.breakBonus.find(([min]) => (Number(best) || 0) >= min)?.[1] ?? 0);
const outcome = (f, a) => (f > a ? "w" : f < a ? "l" : "d");

/** The mark out of 10 for one match. */
export const playerMark = (won, played, best) => (played ? Math.min(10, round1((won / played) * FORM.framesShare + bonus(best))) : null);
export const teamMark = (f, a) => (f + a ? Math.min(10, round1((f / (f + a)) * FORM.framesShare + FORM.teamResult[outcome(f, a)])) : null);

/** Form from a list of results (newest first): { form, n, results, trend, played, won, lost, best }. */
function summarise(list) {
  const sorted = [...list].sort((a, b) => String(b.when ?? "").localeCompare(String(a.when ?? "")));
  const results = sorted.slice(0, FORM.last);
  const avg = (rows) => (rows.length ? round1(rows.reduce((t, r) => t + r.mark, 0) / rows.length) : null);
  const form = avg(results);
  const before = avg(sorted.slice(1, FORM.last + 1));
  const trend = form == null || before == null || sorted.length < 3 ? 0 : Math.sign(round1(form - before));
  return {
    form, n: results.length, results, trend,
    won: results.reduce((t, r) => t + r.f, 0), lost: results.reduce((t, r) => t + r.a, 0),
    best: Math.max(0, ...results.map((r) => r.best || 0)),
  };
}

/**
 * Everyone's form for a season context (see context.js). Loads the competitions too.
 * Returns { player(id), team(id) } — each gives the summary above (form is null with no matches yet).
 */
export async function loadForm(ctx) {
  const seasonId = ctx.season?.id;
  const comps = await loadCompetitions().catch(() => ({ competitions: [], entries: [], matches: [] }));
  const compIds = new Set(comps.competitions.filter((c) => !seasonId || c.season_id === seasonId).map((c) => c.id));
  const played = comps.matches.filter((m) => compIds.has(m.competition_id) && winnerSide(m) && m.entry_a && m.entry_b);
  const cBreaks = played.length ? await competitionBreaks(played.map((m) => m.id)).catch(() => []) : [];
  const now = new Date().toISOString();

  const players = new Map(), teams = new Map();
  const add = (map, id, r) => { if (id && r.mark != null) (map.get(id) ?? map.set(id, []).get(id)).push(r); };
  const teamName = (id) => ctx.team.get(id)?.name ?? "?";

  // League matches.
  for (const fx of ctx.fixtures) {
    if (!isCounted(fx) || (fx.starts_at && fx.starts_at > now)) continue;
    const frames = ctx.framesOf(fx.id);
    if (!frames.length) continue;
    const href = `/match/${fx.code || fx.id}`;
    let home = 0, away = 0;
    const per = new Map(); // player → { f, a, side, extFrames }
    for (const fr of frames) {
      const w = frameWinner(fr);
      if (!w) continue;
      w === "home" ? home++ : away++;
      for (const side of ["home", "away"]) {
        const pid = fr[`${side}_player_id`];
        if (!pid || (fr[`${side}_ext`] && !RULES.extCountsForRanking)) continue;
        const p = per.get(pid) ?? per.set(pid, { f: 0, a: 0, side, frames: new Set() }).get(pid);
        side === w ? p.f++ : p.a++;
        p.frames.add(fr.frame_no);
      }
    }
    if (!home && !away) continue;
    const title = `${teamName(fx.home_team_id)} v ${teamName(fx.away_team_id)}`;
    add(teams, fx.home_team_id, { when: fx.starts_at, href, title, opp: teamName(fx.away_team_id), f: home, a: away, o: outcome(home, away), mark: teamMark(home, away) });
    add(teams, fx.away_team_id, { when: fx.starts_at, href, title, opp: teamName(fx.home_team_id), f: away, a: home, o: outcome(away, home), mark: teamMark(away, home) });
    const breaks = ctx.breaksOf(fx.id);
    for (const [pid, p] of per) {
      const best = Math.max(0, ...breaks.filter((b) => b.player_id === pid && p.frames.has(b.frame_no)).map((b) => b.value));
      const oppTeam = p.side === "home" ? fx.away_team_id : fx.home_team_id;
      add(players, pid, { when: fx.starts_at, href, title, opp: teamName(oppTeam), f: p.f, a: p.a, o: outcome(p.f, p.a), best, mark: playerMark(p.f, p.f + p.a, best) });
    }
  }

  // Knockout competitions: singles entries count for the player, team entries for the team.
  const entry = new Map(comps.entries.map((e) => [e.id, e]));
  const compName = new Map(comps.competitions.map((c) => [c.id, c.name]));
  for (const m of played) {
    const A = entry.get(m.entry_a), B = entry.get(m.entry_b);
    if (!A || !B) continue;
    const href = `/cup-match/${m.no ?? m.id}`, title = compName.get(m.competition_id) ?? "Competition";
    const sa = Number(m.score_a) || 0, sb = Number(m.score_b) || 0;
    // Level on frames (a handicap decider on points): the result follows the winner.
    const oa = sa === sb ? (winnerSide(m) === "a" ? "w" : "l") : outcome(sa, sb);
    const sides = [[A, B, sa, sb, oa], [B, A, sb, sa, oa === "w" ? "l" : "w"]];
    for (const [me, them, f, a, o] of sides) {
      if (me.player_id) {
        const best = Math.max(0, ...cBreaks.filter((b) => b.match_id === m.id && b.player_id === me.player_id).map((b) => b.value));
        add(players, me.player_id, { when: m.starts_at, href, title, opp: them.name, f, a, o, best, mark: playerMark(f, f + a, best) });
      } else if (me.team_id) {
        add(teams, me.team_id, { when: m.starts_at, href, title, opp: them.name, f, a, o, mark: f + a ? Math.min(10, round1((f / (f + a)) * FORM.framesShare + FORM.teamResult[o])) : null });
      }
    }
  }

  const memo = new Map();
  const get = (kind, map, id) => memo.get(`${kind}${id}`) ?? memo.set(`${kind}${id}`, summarise(map.get(id) ?? [])).get(`${kind}${id}`);
  return { player: (id) => get("p", players, id), team: (id) => get("t", teams, id) };
}

// ── how form looks ────────────────────────────────────────────
const level = (n) => (n == null ? "none" : n >= FORM.good ? "good" : n >= FORM.ok ? "ok" : "low");
const ARROW = { 1: ["▲", "up", "Going up"], "-1": ["▼", "down", "Going down"], 0: ["", "", ""] };

/** The form figure in a coloured pill: 7.3 (or – with no matches yet). */
export function formBadge(f, { big = false, trend = false } = {}) {
  if (!f || f.form == null) return html`<span class="form-badge none ${big ? "big" : ""}" title="No matches yet this season">–</span>`;
  const [sym, cls, word] = ARROW[f.trend] ?? ARROW[0];
  return html`<span class="form-badge ${level(f.form)} ${big ? "big" : ""}" title="Form ${f.form.toFixed(1)} out of 10 — the last ${f.n} match${f.n === 1 ? "" : "es"}">${f.form.toFixed(1)}${trend && sym ? html`<i class="form-trend ${cls}" aria-label="${word}">${sym}</i>` : ""}</span>`;
}

/** The last few results as W / L / D squares, oldest on the left (as in a football form guide). */
export function formChips(f, { links = true } = {}) {
  if (!f?.results.length) return html`<span class="muted">–</span>`;
  const word = { w: "Won", l: "Lost", d: "Drew" };
  return html`<span class="form-chips">${[...f.results].reverse().map((r) => {
    const tip = `${word[r.o]} ${r.f}–${r.a} v ${r.opp}${r.when ? ` · ${fmtDate(r.when)}` : ""} · mark ${r.mark.toFixed(1)}`;
    return links ? html`<a class="fc ${r.o}" href="${r.href}" title="${tip}" aria-label="${tip}">${r.o.toUpperCase()}</a>`
      : html`<span class="fc ${r.o}" title="${tip}">${r.o.toUpperCase()}</span>`;
  })}</span>`;
}

/** The "Form" box for a player or team page: the figure, the arrow, and each of the matches with its mark. */
export function formPanel(f, { name = "", kind = "player" } = {}) {
  const word = { w: "Won", l: "Lost", d: "Drew" };
  return html`<section class="form-box" id="form">
    <div class="form-top">
      <div class="form-score">${formBadge(f, { big: true, trend: true })}<span>out of 10</span></div>
      <div class="form-sum"><h3>Form</h3>
        <p>${f?.n ? html`${name ? `${name}'s` : "The"} last ${f.n} match${f.n === 1 ? "" : "es"} this season: ${f.won} frame${f.won === 1 ? "" : "s"} won, ${f.lost} lost${kind === "player" && f.best ? html`, best break ${f.best}` : ""}.${f.trend > 0 ? " Going up." : f.trend < 0 ? " Going down." : ""}`
          : "No matches played yet this season."}</p>
        ${formChips(f)}
      </div>
    </div>
    ${f?.n ? html`<ol class="form-list">${f.results.map((r) => html`<li><a href="${r.href}">
      <span class="fl-when">${r.when ? fmtDate(r.when) : ""}</span>
      <span class="fl-what"><b class="fc ${r.o}">${r.o.toUpperCase()}</b> ${word[r.o]} ${r.f}–${r.a} v ${r.opp}<small>${r.title}${kind === "player" && r.best >= 30 ? ` · best break ${r.best}` : ""}</small></span>
      <span class="fl-mark"><i class="${level(r.mark)}" style="width:${r.mark * 10}%"></i><b>${r.mark.toFixed(1)}</b></span></a></li>`)}</ol>` : ""}
    <details class="form-how"><summary>How is form worked out?</summary><p>${FORM_TEXT}</p><p><a href="/form">See everyone's form →</a></p></details>
  </section>`;
}
