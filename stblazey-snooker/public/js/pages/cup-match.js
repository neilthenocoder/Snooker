// Public page for one cup match: score, frames, breaks — updates live.
import { safeHref, html, mount, fmtDate, fmtTime, fmtTimeBoth, fmtLongDate } from "../core/dom.js";
import { countdown, startCountdowns } from "../core/countdown.js";
import { loadCompMatch, loadCompetitions, subscribe, table } from "../core/api.js";
import { buildBracket, roundName, winnerSide, walkoverSide, placeLabel } from "../core/bracket.js";
import { canEditCompMatch } from "../core/auth.js";
import { breadcrumb, panel, dataTable, cupMatchInfo, urls, badge, handicapText, breakList } from "../core/components.js";
import { handicapStarts, handicapMode, pairsEquation } from "../core/rules.js";
import { setTitle, adminEdit, sideContext } from "../core/router.js";
import notFound from "./not-found.js";
import { matchChat } from "../core/comments.js";
import { openShareCard } from "../core/share-card.js";

export default async function cupMatch(view, { params, user }) {
  let chat = null;      // match night chat (Rich, round 24): a button near the top, kept across redraws
  const draw = async () => {
    const [bundle, compData, players, teams, venues] = await Promise.all([
      loadCompMatch(params.id), loadCompetitions(), table("players", "full_name"), table("teams", "name"), table("venues", "name"),
    ]);
    if (!bundle) return notFound(view);
    const { match, frames, breaks } = bundle;
    const info = cupMatchInfo(compData, match, buildBracket);
    const { c } = info;
    const nameA = info.a?.name ?? (info.bm && placeLabel(info.bracket, info.bm, "a")) ?? "To be decided", nameB = info.b?.name ?? (info.bm && placeLabel(info.bracket, info.bm, "b")) ?? "To be decided";
    setTitle(`${nameA} vs ${nameB}`);
    sideContext({ competition: c });
    if (info.a && info.b) adminEdit("draws", null, { href: `/cup-scorecard/${match.no ?? match.id}`, label: "Edit scorecard" });
    // Handicap competitions: who gets a head start in each frame, and how many.
    const hc = (id) => players.find((p) => p.id === id)?.handicap ?? 0;
    const sideIds = (f, s) => [f[`${s}_player_id`], f[`${s}_player2_id`]].filter(Boolean);
    // Singles and team matches: the higher handicap starts on the difference. Doubles (round 72): the pairs' totals, and the higher pair starts on the difference.
    const mode = handicapMode(c);
    // Round 73 (Rich): the away player's extra points in some competitions (Bill Toms, Willie Thomas: 5).
    const awaySide = match.home_switched ? "a" : "b", awayExtra = c?.handicap ? Number(c.away_start) || 0 : 0;
    const startText = (f) => {
      const s = handicapStarts(sideIds(f, "a").map(hc), sideIds(f, "b").map(hc), mode);
      if (awayExtra) { s[awaySide] += awayExtra; return `${nameA} ${s.a} · ${nameB} ${s.b} (incl. +${awayExtra} away)`; }
      if (mode === "each") return `${handicapText(s.a)} v ${handicapText(s.b)}`;
      // Round 72 (Rich): doubles show the sum — "+58 − (−19) = 77" — then who starts on it (the other pair on 0).
      if (mode === "pairs") return `${pairsEquation(sideIds(f, "a").map(hc), sideIds(f, "b").map(hc)).text} · ${s.a ? `${nameA} start on ${s.a}, ${nameB} 0` : s.b ? `${nameB} start on ${s.b}, ${nameA} 0` : "Level"}`;
      return s.a ? `${nameA} +${s.a}` : s.b ? `${nameB} +${s.b}` : "Level";
    };
    // Running totals (points, handicap starts included): they decide a handicap match that is level on frames.
    const scored = frames.filter((f) => f.a_points != null || f.b_points != null);
    const running = new Map();
    scored.reduce((t, f) => { const n = { a: t.a + (f.a_points ?? 0), b: t.b + (f.b_points ?? 0) }; running.set(f.frame_no, n); return n; }, { a: 0, b: 0 });
    const total = [...running.values()].at(-1) ?? { a: 0, b: 0 };
    const level = match.score_a != null && match.score_a === match.score_b;
    const pname = (id) => players.find((p) => p.id === id)?.full_name;
    const sidePlayers = (f, s) => sideIds(f, s).map((id) => html`<a href="/player/${id}">${pname(id) ?? "?"}</a>${c?.handicap ? html` <small class="muted">(${handicapText(hc(id))})</small>` : ""}`)
      .map((x, i) => html`${i ? " & " : ""}${x}`);
    const teamOf = (e) => e && (teams.find((t) => t.id === e.team_id) ?? teams.find((t) => t.id === players.find((p) => p.id === e.player_id)?.team_id));
    const venue = venues.find((v) => v.id === match.venue_id);
    const live = match.status === "in_progress";
    const won = (s) => match.status === "completed" && winnerSide(match) === s;
    const wo = walkoverSide(match);   // round 37: a walkover — no frames, one side goes through

    mount(view, html`<div class="wrap stack">
      <div class="cm-row">${breadcrumb([["Home", "/"], ["Competitions", "/competitions"], [c?.name ?? "Competition", c ? urls.competition(c) : null], [`${nameA} vs ${nameB}`]])}<span data-chat-slot></span></div>
      <div class="match-hero">
        <div class="mh-band">${c?.name} · ${roundName(match.round, info.bracket.totalRounds, info.bracket)}${match.starts_at ? ` · ${fmtDate(match.starts_at)} ${fmtTimeBoth(match.starts_at)}` : ""}</div>
        <div class="mh-body">
          <div class="mh-side ${won("a") ? "won" : won("b") ? "lost" : ""}">${teamOf(info.a) ? badge(teamOf(info.a)) : ""}<span>${nameA}</span></div>
          <div class="mh-score">${wo ? html`<b>W/O</b>` : html`<b>${match.score_a ?? "–"}</b><i>:</i><b>${match.score_b ?? "–"}</b>`}
            ${wo ? html`<small>Walkover</small>` : match.status === "postponed" ? html`<small class="pp-tag">Postponed</small>` : live ? html`<span class="live-dot">Live</span>` : match.status === "completed" ? html`<small>Final</small>` : ""}</div>
          <div class="mh-side ${won("b") ? "won" : won("a") ? "lost" : ""}">${teamOf(info.b) ? badge(teamOf(info.b)) : ""}<span>${nameB}</span></div>
        </div>
        ${!wo && !live && !["completed", "postponed"].includes(match.status) && match.score_a == null ? countdown(match.starts_at) : ""}
        ${c?.handicap && scored.length ? html`<div class="mh-foot">Total points: <b>${total.a}</b> to <b>${total.b}</b>${level && match.status === "completed" && winnerSide(match)
          ? html` · level on frames, so <b>${winnerSide(match) === "a" ? nameA : nameB}</b> go through on total points` : level ? " · level on frames — the higher total wins" : ""}</div>` : ""}
        ${wo ? html`<div class="mh-foot">Walkover to <b>${wo === "a" ? nameA : nameB}</b> — the match wasn't played.</div>` : ""}
        ${venue ? html`<div class="mh-foot"><a href="${urls.venue(venue)}">${venue.name}</a></div>` : ""}
      </div>
      <div class="btn-row">${safeHref(match.scorecard_url) ? html`<a class="btn ghost" href="${safeHref(match.scorecard_url)}" target="_blank" rel="noopener">Photo of the paper scorecard</a>` : ""}${info.a && info.b && canEditCompMatch(user, match, [info.a, info.b], players) ? html`<a class="btn" href="/cup-scorecard/${match.no ?? match.id}">${frames.length ? "Update scorecard" : "Start scoring"}</a>` : ""}
        ${match.status === "completed" && info.a && info.b ? html`<button type="button" class="btn blue" data-share-card>Share the result</button>` : ""}</div>
      ${wo ? "" : panel("Frame by frame", dataTable([
        { label: "Frame", cell: (f) => f.frame_no, cls: "num" },
        { label: nameA, cell: (f) => html`<span class="${f.a_points > f.b_points ? "strong" : ""}">${sidePlayers(f, "a")}</span>`, cls: "right" },
        { label: "Score", cell: (f) => `${f.a_points ?? "–"} - ${f.b_points ?? "–"}`, cls: "num" },
        { label: nameB, cell: (f) => html`<span class="${f.b_points > f.a_points ? "strong" : ""}">${sidePlayers(f, "b")}</span>` },
        ...(c?.handicap ? [{ label: "Start", cell: (f) => startText(f), cls: "hide-sm" },
          { label: "Running total", cell: (f) => { const t = running.get(f.frame_no); return t ? `${t.a} - ${t.b}` : "–"; }, cls: "num" }] : []),
        { label: "Breaks", cell: (f) => breakList(breaks.filter((b) => b.frame_no === f.frame_no).map((b) => ({ name: pname(b.player_id), value: b.value }))), cls: "hide-sm" },
      ], scored, { empty: match.status === "completed" ? "Only the final score was entered for this match." : "No frames yet — check back on match night." }))}
    </div>`);
    startCountdowns(view);
    if (chat) view.querySelector("[data-chat-slot]")?.replaceWith(chat.button);
    // Round 40: the result as a square picture for social media.
    view.querySelector("[data-share-card]")?.addEventListener("click", () => {
      const best = [...breaks].sort((a, b) => b.value - a.value)[0];
      const logo = (e) => teamOf(e)?.logo_url ?? players.find((p) => p.id === e?.player_id)?.avatar_url;
      openShareCard({
        title: c?.name ?? "Competition", sub: `${roundName(match.round, info.bracket.totalRounds, info.bracket)}${match.starts_at ? ` · ${fmtLongDate(match.starts_at)}` : ""}`,
        home: { name: nameA, logo: logo(info.a) }, away: { name: nameB, logo: logo(info.b) },
        score: wo ? [wo === "a" ? 1 : 0, wo === "b" ? 1 : 0] : [match.score_a, match.score_b], scoreText: wo ? "W/O" : undefined,
        tag: wo ? "Walkover" : match.round === info.bracket.totalRounds ? "Final result" : "Result",
        footer: [wo ? `${wo === "a" ? nameA : nameB} go through` : `${winnerSide(match) === "a" ? nameA : nameB} through to the ${match.round === info.bracket.totalRounds ? "title" : roundName(match.round + 1, info.bracket.totalRounds, info.bracket).toLowerCase()}`,
          best ? `Highest break: ${best.value} — ${pname(best.player_id) ?? ""}` : ""].filter(Boolean),
        file: `${nameA}-v-${nameB}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      });
    });
    return match;
  };
  const m = await draw();
  if (m) { chat = await matchChat({ comp_match_id: m.id }, m, user, { title: document.title.split(" | ")[0] }); view.querySelector("[data-chat-slot]")?.replaceWith(chat.button); }
  const stopChat = () => chat?.stop();
  const stop = m && m.status !== "completed" ? subscribe(["competition_matches", "competition_frames", "competition_breaks"], draw) : () => {};
  return () => { stop(); stopChat(); };
}
