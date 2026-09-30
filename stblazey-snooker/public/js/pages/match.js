import { html, mount, fmtDate, fmtTime } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadFixture, headToHead, subscribe } from "../core/api.js";
import { matchScore, frameWinner, breakPoints } from "../core/rules.js";
import { canEditFixture } from "../core/auth.js";
import { breadcrumb, panel, dataTable, resultsList, statusBadge, urls, teamLink } from "../core/components.js";
import { setTitle } from "../core/router.js";
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
    const score = matchScore(frames);
    const played = frames.length > 0;
    const sides = [["home", home], ["away", away]];

    // Per-player lines for each side, in frame order.
    const lines = (side) => {
      const rows = new Map();
      for (const fr of frames) {
        const pid = fr[`${side}_player_id`];
        if (!pid) continue;
        const r = rows.get(pid) ?? rows.set(pid, { player: ctx.player.get(pid), points: 0, wins: 0, loss: 0, brks: 0 }).get(pid);
        r.points += Number(fr[`${side}_points`]) || 0;
        const w = frameWinner(fr);
        if (w) w === side ? r.wins++ : r.loss++;
      }
      for (const b of breaks) if (rows.has(b.player_id)) rows.get(b.player_id).brks = Math.max(rows.get(b.player_id).brks, b.value);
      return [...rows.values()];
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

    mount(view, html`
      <div class="wrap">${breadcrumb([["Home", "/"], [title]])}</div>
      <div class="title-band"><h1>${title} ${fx.status === "in_progress" ? html`<span class="live-dot">Live</span>` : ""}</h1></div>
      <div class="wrap stack">
        ${canEditFixture(user, fx) ? html`<div class="btn-row"><a class="btn" href="${urls.scorecard(fx)}">${played ? "Edit scorecard" : "Enter scorecard"}</a></div>` : ""}
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
        ${played ? html`
          ${sides.map(([s, t]) => panel(t?.name ?? "", dataTable([
            { label: "Player", cell: (r) => r.player?.full_name ?? "–" },
            { label: "Position", cell: (r) => r.player?.position ?? "", cls: "hide-sm" },
            { label: "Points", cell: (r) => r.points },
            { label: "Wins", cell: (r) => r.wins },
            { label: "Loss", cell: (r) => r.loss },
            { label: "Brks", cell: (r) => r.brks },
          ], sideLines[s])))}
          ${panel("Frame by frame", dataTable([
            { label: "Frame", cell: (f) => f.frame_no, cls: "num" },
            { label: home?.name, cell: (f) => html`<span class="${frameWinner(f) === "home" ? "strong" : ""}">${playerName(f.home_player_id)}</span>`, cls: "right" },
            { label: "Score", cell: (f) => `${f.home_points ?? "–"} - ${f.away_points ?? "–"}`, cls: "num" },
            { label: away?.name, cell: (f) => html`<span class="${frameWinner(f) === "away" ? "strong" : ""}">${playerName(f.away_player_id)}</span>` },
            { label: "Breaks", cell: (f) => breaks.filter((b) => b.frame_no === f.frame_no).map((b) => `${playerName(b.player_id)} ${b.value}${breakPoints(b.value) ? ` (+${breakPoints(b.value)})` : ""}`).join(", ") || "–", cls: "hide-sm" },
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
