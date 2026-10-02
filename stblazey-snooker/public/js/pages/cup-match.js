// Public page for one cup match: score, frames, breaks — updates live.
import { html, mount, fmtDate, fmtTime } from "../core/dom.js";
import { loadCompMatch, loadCompetitions, subscribe, table } from "../core/api.js";
import { buildBracket, roundName } from "../core/bracket.js";
import { canEditCompMatch } from "../core/auth.js";
import { breadcrumb, panel, dataTable, cupMatchInfo, urls, badge } from "../core/components.js";
import { breakPoints } from "../core/rules.js";
import { setTitle } from "../core/router.js";
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
    const pname = (id) => players.find((p) => p.id === id)?.full_name;
    const sidePlayers = (f, s) => [f[`${s}_player_id`], f[`${s}_player2_id`]].filter(Boolean).map((id) => html`<a href="/player/${id}">${pname(id) ?? "?"}</a>`)
      .map((x, i) => html`${i ? " & " : ""}${x}`);
    const teamOf = (e) => e && (teams.find((t) => t.id === e.team_id) ?? teams.find((t) => t.id === players.find((p) => p.id === e.player_id)?.team_id));
    const venue = venues.find((v) => v.id === match.venue_id);
    const live = match.status === "in_progress";
    const won = (s) => match.status === "completed" && (s === "a" ? match.score_a > match.score_b : match.score_b > match.score_a);

    mount(view, html`<div class="wrap stack">
      <div>${breadcrumb([["Home", "/"], ["Competitions", "/competitions"], [c?.name ?? "Competition", c ? urls.competition(c) : null], [`${nameA} vs ${nameB}`]])}</div>
      <div class="match-hero">
        <div class="mh-band">${c?.name} · ${roundName(match.round, info.bracket.totalRounds)}${match.starts_at ? ` · ${fmtDate(match.starts_at)} ${fmtTime(match.starts_at)}` : ""}</div>
        <div class="mh-body">
          <div class="mh-side ${won("a") ? "won" : ""}">${teamOf(info.a) ? badge(teamOf(info.a)) : ""}<span>${nameA}</span></div>
          <div class="mh-score"><b>${match.score_a ?? "–"}</b><i>:</i><b>${match.score_b ?? "–"}</b>
            ${live ? html`<span class="live-dot">Live</span>` : match.status === "completed" ? html`<small>Final</small>` : ""}</div>
          <div class="mh-side ${won("b") ? "won" : ""}">${teamOf(info.b) ? badge(teamOf(info.b)) : ""}<span>${nameB}</span></div>
        </div>
        ${venue ? html`<div class="mh-foot"><a href="${urls.venue(venue)}">${venue.name}</a></div>` : ""}
      </div>
      ${info.a && info.b && canEditCompMatch(user, match, [info.a, info.b], players) ? html`<div class="btn-row"><a class="btn" href="/cup-scorecard/${match.id}">${frames.length ? "Update scorecard" : "Start scoring"}</a></div>` : ""}
      ${panel("Frame by frame", dataTable([
        { label: "Frame", cell: (f) => f.frame_no, cls: "num" },
        { label: nameA, cell: (f) => html`<span class="${f.a_points > f.b_points ? "strong" : ""}">${sidePlayers(f, "a")}</span>`, cls: "right" },
        { label: "Score", cell: (f) => `${f.a_points ?? "–"} - ${f.b_points ?? "–"}`, cls: "num" },
        { label: nameB, cell: (f) => html`<span class="${f.b_points > f.a_points ? "strong" : ""}">${sidePlayers(f, "b")}</span>` },
        { label: "Breaks", cell: (f) => breaks.filter((b) => b.frame_no === f.frame_no).map((b) => `${pname(b.player_id)} ${b.value}${breakPoints(b.value) ? "" : ""}`).join(", ") || "–", cls: "hide-sm" },
      ], frames, { empty: match.status === "completed" ? "Only the final score was entered for this match." : "No frames yet — check back on match night." }))}
    </div>`);
    return match;
  };
  const m = await draw();
  if (m && m.status !== "completed") return subscribe(["competition_matches", "competition_frames", "competition_breaks"], draw);
}
