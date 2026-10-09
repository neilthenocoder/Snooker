// Public page for one cup match: score, frames, breaks — updates live.
import { html, mount, fmtDate, fmtTime } from "../core/dom.js";
import { loadCompMatch, loadCompetitions, subscribe, table } from "../core/api.js";
import { buildBracket, roundName, winnerSide } from "../core/bracket.js";
import { canEditCompMatch } from "../core/auth.js";
import { breadcrumb, panel, dataTable, cupMatchInfo, urls, badge, handicapText } from "../core/components.js";
import { handicapStarts, handicapMode } from "../core/rules.js";
import { setTitle, adminEdit, sideContext } from "../core/router.js";
import notFound from "./not-found.js";

export default async function cupMatch(view, { params, user }) {
  const draw = async () => {
    const [bundle, compData, players, teams, venues] = await Promise.all([
      loadCompMatch(params.id), loadCompetitions(), table("players", "full_name"), table("teams", "name"), table("venues", "name"),
    ]);
    if (!bundle) return notFound(view);
    const { match, frames, breaks } = bundle;
    const info = cupMatchInfo(compData, match, buildBracket);
    const { c } = info;
    const nameA = info.a?.name ?? "To be decided", nameB = info.b?.name ?? "To be decided";
    setTitle(`${nameA} vs ${nameB}`);
    sideContext({ competition: c });
    if (info.a && info.b) adminEdit("draws", null, { href: `/cup-scorecard/${match.no ?? match.id}`, label: "Edit scorecard" });
    // Handicap competitions: who gets a head start in each frame, and how many.
    const hc = (id) => players.find((p) => p.id === id)?.handicap ?? 0;
    const sideIds = (f, s) => [f[`${s}_player_id`], f[`${s}_player2_id`]].filter(Boolean);
    // Singles and team matches: the higher handicap starts on the difference. Doubles: each pair starts on its own total.
    const mode = handicapMode(c);
    const startText = (f) => {
      const s = handicapStarts(sideIds(f, "a").map(hc), sideIds(f, "b").map(hc), mode);
      if (mode === "each") return `${handicapText(s.a)} v ${handicapText(s.b)}`;
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

    mount(view, html`<div class="wrap stack">
      <div>${breadcrumb([["Home", "/"], ["Competitions", "/competitions"], [c?.name ?? "Competition", c ? urls.competition(c) : null], [`${nameA} vs ${nameB}`]])}</div>
      <div class="match-hero">
        <div class="mh-band">${c?.name} · ${roundName(match.round, info.bracket.totalRounds)}${match.starts_at ? ` · ${fmtDate(match.starts_at)} ${fmtTime(match.starts_at)}` : ""}</div>
        <div class="mh-body">
          <div class="mh-side ${won("a") ? "won" : won("b") ? "lost" : ""}">${teamOf(info.a) ? badge(teamOf(info.a)) : ""}<span>${nameA}</span></div>
          <div class="mh-score"><b>${match.score_a ?? "–"}</b><i>:</i><b>${match.score_b ?? "–"}</b>
            ${live ? html`<span class="live-dot">Live</span>` : match.status === "completed" ? html`<small>Final</small>` : ""}</div>
          <div class="mh-side ${won("b") ? "won" : won("a") ? "lost" : ""}">${teamOf(info.b) ? badge(teamOf(info.b)) : ""}<span>${nameB}</span></div>
        </div>
        ${c?.handicap && scored.length ? html`<div class="mh-foot">Total points: <b>${total.a}</b> to <b>${total.b}</b>${level && match.status === "completed" && winnerSide(match)
          ? html` · level on frames, so <b>${winnerSide(match) === "a" ? nameA : nameB}</b> go through on total points` : level ? " · level on frames — the higher total wins" : ""}</div>` : ""}
        ${venue ? html`<div class="mh-foot"><a href="${urls.venue(venue)}">${venue.name}</a></div>` : ""}
      </div>
      ${info.a && info.b && canEditCompMatch(user, match, [info.a, info.b], players) ? html`<div class="btn-row"><a class="btn" href="/cup-scorecard/${match.no ?? match.id}">${frames.length ? "Update scorecard" : "Start scoring"}</a></div>` : ""}
      ${panel("Frame by frame", dataTable([
        { label: "Frame", cell: (f) => f.frame_no, cls: "num" },
        { label: nameA, cell: (f) => html`<span class="${f.a_points > f.b_points ? "strong" : ""}">${sidePlayers(f, "a")}</span>`, cls: "right" },
        { label: "Score", cell: (f) => `${f.a_points ?? "–"} - ${f.b_points ?? "–"}`, cls: "num" },
        { label: nameB, cell: (f) => html`<span class="${f.b_points > f.a_points ? "strong" : ""}">${sidePlayers(f, "b")}</span>` },
        ...(c?.handicap ? [{ label: "Start", cell: (f) => startText(f), cls: "hide-sm" },
          { label: "Running total", cell: (f) => { const t = running.get(f.frame_no); return t ? `${t.a} - ${t.b}` : "–"; }, cls: "num" }] : []),
        { label: "Breaks", cell: (f) => breaks.filter((b) => b.frame_no === f.frame_no).map((b) => `${pname(b.player_id)} ${b.value}`).join(", ") || "–", cls: "hide-sm" },
      ], scored, { empty: match.status === "completed" ? "Only the final score was entered for this match." : "No frames yet — check back on match night." }))}
    </div>`);
    return match;
  };
  const m = await draw();
  if (m && m.status !== "completed") return subscribe(["competition_matches", "competition_frames", "competition_breaks"], draw);
}
