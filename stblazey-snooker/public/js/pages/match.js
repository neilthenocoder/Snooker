import { html, mount, fmtDate, fmtTime } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadFixture, headToHead, subscribe } from "../core/api.js";
import { matchScore, frameWinner, breakPoints, isShieldMatch, RULES } from "../core/rules.js";
import { canEditFixture } from "../core/auth.js";
import { breadcrumb, panel, dataTable, resultsList, statusBadge, urls, teamLink, playerLink, badge } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

export default async function match(view, { params, user }) {
  const draw = async () => {
    const bundle = await loadFixture(params.id);
    if (!bundle) return notFound(view);
    const { fixture: fx, frames, breaks } = bundle;
    const ctx = await seasonContext(fx.season_id);
    const home = ctx.team.get(fx.home_team_id), away = ctx.team.get(fx.away_team_id);
    const title = `${home?.name} vs ${away?.name}`;
    setTitle(title);
    adminEdit("fixtures", null, { href: urls.scorecard(fx), label: "Edit scorecard" });
    const score = matchScore(frames);
    const played = frames.length > 0;
    // An old result brought in with only its final score has no frame details to show.
    const scoreOnly = played && frames.every((f) => f.legacy);
    const sides = [["home", home], ["away", away]];

    // Per-player lines for each side, in frame order.
    const lines = (side) => {
      const rows = new Map();
      for (const fr of frames) {
        const pid = fr[`${side}_player_id`];
        if (!pid) continue;
        const r = rows.get(pid) ?? rows.set(pid, { player: ctx.player.get(pid), points: 0, wins: 0, loss: 0, brks: 0, breakPts: 0 }).get(pid);
        r.points += Number(fr[`${side}_points`]) || 0;
        const w = frameWinner(fr);
        if (w) w === side ? r.wins++ : r.loss++;
      }
      for (const b of breaks) {
        const r = rows.get(b.player_id);
        if (!r) continue;
        r.brks = Math.max(r.brks, b.value);
        r.breakPts += breakPoints(b.value);
      }
      // Ranking points earned in this match: 5 for each frame won, plus break points.
      return [...rows.values()].map((r) => ({ ...r, winPts: r.wins * RULES.frameWinPoints, rankPts: r.wins * RULES.frameWinPoints + r.breakPts }));
    };
    const sideLines = Object.fromEntries(sides.map(([s]) => [s, lines(s)]));
    const total = (side, key) => sideLines[side].reduce((n, r) => n + r[key], 0);

    const h2h = await headToHead(fx.home_team_id, fx.away_team_id);
    const h2hFrames = new Map();
    for (const f of h2h.frames) (h2hFrames.get(f.fixture_id) ?? h2hFrames.set(f.fixture_id, []).get(f.fixture_id)).push(f);
    const past = h2h.fixtures.filter((f) => f.id !== fx.id && h2hFrames.has(f.id));

    const outcome = (side) => {
      if (!played) return "–";
      const other = side === "home" ? "away" : "home";
      const verdict = score[side] > score[other] ? "Win" : score[side] < score[other] ? "Loss" : "Draw";
      return fx.status === "in_progress" ? `${verdict} (so far)` : verdict;
    };
    const bar = (label, key) => {
      const h = total("home", key), a = total("away", key), sum = h + a || 1;
      return html`<h4>${label}</h4><div class="bar"><span>${h}</span>
        <div class="track"><i style="width:${(h / sum) * 100}%"></i></div><span>${a}</span></div>`;
    };
    const playerName = (id) => ctx.player.get(id)?.full_name ?? "–";
    const nameLink = (id, ext) => { const p = ctx.player.get(id); return p ? html`<a href="${urls.player(p)}">${p.full_name}</a>${ext ? html` <span class="ext-tag" title="Extra player">Ext</span>` : ""}` : "–"; };
    const league = ctx.league.get(fx.league_id);
    const shield = league?.shield_team_id ? isShieldMatch(league, fx, ctx.fixtures, ctx.framesByFixture) : { isShield: false };
    const won = (s) => played && fx.status !== "in_progress" && score[s] > score[s === "home" ? "away" : "home"];

    mount(view, html`
      <div class="wrap">${breadcrumb([["Home", "/"], [title]])}</div>
      <div class="wrap"><div class="match-hero">
        <div class="mh-band">${league?.name ?? ""} · ${fmtDate(fx.starts_at)} ${fmtTime(fx.starts_at)}</div>
        <div class="mh-body">
          <a class="mh-side ${won("home") ? "won" : ""}" href="${home ? urls.team(home) : "#"}">${badge(home)}<span>${home?.name}</span></a>
          <div class="mh-score"><b>${played ? score.home : "–"}</b><i>:</i><b>${played ? score.away : "–"}</b>
            ${fx.status === "in_progress" ? html`<span class="live-dot">Live</span>` : played ? html`<small>${fx.status === "approved" ? "Final" : fx.status.replace("_", " ")}</small>` : html`<small>${fmtTime(fx.starts_at)}</small>`}</div>
          <a class="mh-side ${won("away") ? "won" : ""}" href="${away ? urls.team(away) : "#"}">${badge(away)}<span>${away?.name}</span></a>
        </div>
        ${shield.isShield ? html`<div class="mh-foot">🛡 ${league.shield_name || "Shield"} match — ${ctx.team.get(shield.holderId)?.name} defending</div>` : ""}
      </div></div>
      <div class="wrap stack" style="margin-top:24px">
        <div class="btn-row">
          ${canEditFixture(user, fx) ? html`<a class="btn" href="${urls.scorecard(fx)}">${played ? "Edit scorecard" : "Enter scorecard"}</a>` : ""}
          ${fx.scorecard_url ? html`<a class="btn ghost" href="${fx.scorecard_url}" target="_blank" rel="noopener">Photo of the paper scorecard</a>` : ""}
        </div>
        ${panel("Results", dataTable([
          { label: "Team", cell: ([, t]) => teamLink(t) },
          { label: "Score", cell: ([s]) => (played ? score[s] : "–") },
          { label: "Outcome", cell: ([s]) => outcome(s) },
        ], sides))}
        ${panel("Details", dataTable([
          { label: "Date", cell: () => `${fmtDate(fx.starts_at)} ${fmtTime(fx.starts_at)}` },
          { label: "League", cell: () => ctx.league.get(fx.league_id)?.name },
          { label: "Season", cell: () => ctx.season?.name },
          { label: "Venue", cell: () => { const v = ctx.venue.get(fx.venue_id); return v ? html`<a href="${urls.venue(v)}">${v.name}</a>` : "–"; } },
          { label: "Status", cell: () => statusBadge(fx.status) },
        ], [fx]))}
        ${fx.notes ? html`<div class="notice">${fx.notes}</div>` : ""}
        ${scoreOnly ? html`<div class="notice">Only the final score was recorded for this match — there's no frame-by-frame scorecard.</div>` : played ? html`
          ${sides.map(([s, t]) => panel(t?.name ?? "", html`${dataTable([
            { label: "Player", cell: (r) => playerLink(r.player) },
            { label: "Position", cell: (r) => r.player?.position ?? "", cls: "hide-sm" },
            { label: "Points", cell: (r) => r.points, cls: "num" },
            { label: "Wins", cell: (r) => html`<span class="tally ${r.wins ? "win" : ""}">${r.wins}</span>`, cls: "num" },
            { label: "Loss", cell: (r) => html`<span class="tally ${r.loss ? "loss" : ""}">${r.loss}</span>`, cls: "num" },
            { label: "Best break", cell: (r) => r.brks || "–", cls: "num" },
            { label: "Win pts", cell: (r) => r.winPts, cls: "num hide-sm" },
            { label: "Break pts", cell: (r) => r.breakPts, cls: "num hide-sm" },
            { label: "Ranking pts", cell: (r) => r.rankPts, cls: "num strong" },
          ], sideLines[s])}<p class="table-note">Ranking points: ${RULES.frameWinPoints} for each frame won, plus break points (${RULES.breakMinimum}–39 = 3, 40–49 = 4 … 140+ = ${RULES.maxBreakPoints}).</p>`))}
          ${panel("Frame by frame", dataTable([
            { label: "Frame", cell: (f) => f.frame_no, cls: "num" },
            { label: home?.name, cell: (f) => html`<span class="${frameWinner(f) === "home" ? "strong" : ""}">${nameLink(f.home_player_id, f.home_ext)}</span>`, cls: "right" },
            { label: "Score", cell: (f) => `${f.home_points ?? "–"} - ${f.away_points ?? "–"}`, cls: "num" },
            { label: away?.name, cell: (f) => html`<span class="${frameWinner(f) === "away" ? "strong" : ""}">${nameLink(f.away_player_id, f.away_ext)}</span>` },
            { label: "Breaks", cell: (f) => breaks.filter((b) => b.frame_no === f.frame_no).map((b) => `${playerName(b.player_id)} ${b.value}${breakPoints(b.value) ? ` (+${breakPoints(b.value)} ranking pts)` : ""}`).join(", ") || "–", cls: "hide-sm" },
          ], frames))}
          <div class="compare">${bar("Points", "points")}${bar("Wins", "wins")}${bar("Loss", "loss")}${bar("Brks", "brks")}</div>
        ` : html`<div class="notice">No frames entered yet${fx.status === "scheduled" ? " — check back on match night." : "."}</div>`}
        ${panel("Past Meetings", resultsList(ctx, past, { scoreFn: (f) => { const s = matchScore(h2hFrames.get(f.id)); return `${s.home} - ${s.away}`; } }))}
      </div>`);
    return fx;
  };

  const fx = await draw();
  // Keep the page updating while a match is being played.
  if (fx && ["scheduled", "in_progress", "submitted"].includes(fx.status)) return subscribe(["frames", "breaks", "fixtures"], draw);
}
