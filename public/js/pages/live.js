import { html, mount, fmtTime, fmtDay, todayUK, ukDay } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { subscribe, table, liveMatches } from "../core/api.js";
import { sideName, matchLabel, onTable as isOnTable } from "../core/live-score.js";
import { breadcrumb, dataTable, statusBadge, urls, badge } from "../core/components.js";
import { frameWinner, isLiveNow } from "../core/rules.js";
import { setTitle, adminEdit } from "../core/router.js";
import { getUser, canEditFixture } from "../core/auth.js";

export default async function live(view) {
  setTitle("Live scores");
  adminEdit("results");
  const draw = async () => {
    const [ctx, competitions, boards, everyone, user] = await Promise.all([seasonContext(), table("competitions", "sort"), liveMatches().catch(() => []), table("players", "full_name"), getUser().catch(() => null)]);
    const onTable = boards.filter((m) => isOnTable(m));
    const liveDraws = competitions.filter((c) => c.draw_live?.status === "live");
    const today = todayUK();
    const games = ctx.fixtures.filter((f) => isLiveNow(f) || ukDay(f.starts_at) === today);
    const name = (id) => ctx.player.get(id)?.full_name ?? "–";
    // A player's name with any breaks they made in that frame: "Gary Lobb · 125 break".
    const who = (fx, f, side) => {
      const made = ctx.breaksOf(fx.id).filter((b) => b.frame_no === f.frame_no && b.player_id === f[`${side}_player_id`]).map((b) => b.value).sort((a, b) => b - a);
      return html`<span class="${frameWinner(f) === side ? "strong" : ""}">${name(f[`${side}_player_id`])}</span>${made.length ? html`<span class="break-tag" title="Break${made.length > 1 ? "s" : ""} in this frame">${made.join(", ")} break${made.length > 1 ? "s" : ""}</span>` : ""}`;
    };
    // ── Round 116 (Rich: "we can do something more with the live scores page — add team logos, maybe a background
    //    colour"): a dark header block that says what is on, each match as a card with both crests and the score on
    //    tiles, and — when nothing is being played — the next match night and the latest results, so the page is never empty. ──
    const liveCount = games.filter((fx) => { const s = ctx.scoreOf(fx); return isLiveNow(fx, Date.now(), (Number(s.home) || 0) + (Number(s.away) || 0)); }).length + onTable.length;
    const now = Date.now() - 3 * 3600e3;
    const coming = ctx.fixtures.filter((f) => f.starts_at && Date.parse(f.starts_at) >= now && !ctx.hasResult(f) && f.status !== "postponed" && ukDay(f.starts_at) !== today).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const nextDay = coming[0] ? ukDay(coming[0].starts_at) : null, nextNight = coming.filter((f) => ukDay(f.starts_at) === nextDay);
    const done = ctx.fixtures.filter((f) => ctx.hasResult(f) && f.status !== "in_progress" && ukDay(f.starts_at) !== today).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    const lastDay = done[0] ? ukDay(done[0].starts_at) : null, lastNight = done.filter((f) => ukDay(f.starts_at) === lastDay);
    const side = (t, cls = "") => html`<span class="lv-side ${cls}"><span class="lv-crest">${badge(t)}</span><b>${t?.name ?? "TBC"}</b></span>`;
    const mini = (fx, played) => { const s = played ? ctx.scoreOf(fx) : null;
      return html`<a class="lv-mini" href="${urls.match(fx)}">${side(ctx.team.get(fx.home_team_id), "is-home")}
        ${played ? html`<span class="lv-score lv-score--sm"><i>${s.home}</i><i>${s.away}</i></span>` : html`<span class="lv-time">${fmtTime(fx.starts_at)}</span>`}
        ${side(ctx.team.get(fx.away_team_id))}</a>`; };
    mount(view, html`<div class="wrap stack lv-page">
      <div>${breadcrumb([["Home", "/"], ["Live"]])}
      <header class="lv-hero ${liveCount ? "is-live" : ""}">
        <div><h1>Live scores</h1>
          <p>Scores update on their own as captains save each frame — no need to refresh.</p></div>
        <span class="lv-hero__state">${liveCount ? html`<span class="lv-pulse" aria-hidden="true"></span>${liveCount} live now` : games.length ? html`${games.length} match${games.length === 1 ? "" : "es"} today` : nextDay ? html`Next: ${fmtDay(coming[0].starts_at)} · ${fmtTime(coming[0].starts_at)}` : "Nothing on just now"}</span>
      </header></div>
      ${liveDraws.map((c) => html`<a class="live-draw-note" href="/draw/${c.slug}"><span class="live-dot">Live</span> The <b>${c.name}</b> draw is being made now — watch it →</a>`)}
      ${onTable.map((m) => html`<a class="live-draw-note" href="${urls.scoreboard(m)}"><span class="live-dot">Live</span> <b>${sideName(m, "a", everyone)} ${m.fixture_id ? m.state?.frame?.a ?? 0 : m.frames_a ?? 0} – ${m.fixture_id ? m.state?.frame?.b ?? 0 : m.frames_b ?? 0} ${sideName(m, "b", everyone)}</b> (${matchLabel(m, competitions)}) — ball by ball on the scoreboard →</a>`)}
      ${games.length ? html`<div class="lv-grid">${games.map((fx) => {
        const s = ctx.scoreOf(fx);
        const home = ctx.team.get(fx.home_team_id), away = ctx.team.get(fx.away_team_id);
        const isLive = isLiveNow(fx, Date.now(), (Number(s.home) || 0) + (Number(s.away) || 0));
        const frames = ctx.framesOf(fx.id).filter((f) => !f.legacy);
        return html`<article class="lv-card ${isLive ? "is-live" : ""}">
          <div class="lv-card__top"><span class="lv-league">${ctx.league.get(fx.league_id)?.name ?? ""}</span>
            ${isLive ? html`<span class="live-dot">Live</span>` : fx.status === "in_progress" ? html`<span class="lv-chip">Awaiting result</span>` : frames.length ? statusBadge(fx.status) : html`<span class="lv-chip">${fmtTime(fx.starts_at)}</span>`}</div>
          <a class="lv-match" href="${urls.match(fx)}">${side(home, "is-home")}<span class="lv-score"><i>${s.home}</i><i>${s.away}</i></span>${side(away)}</a>
          ${frames.length ? dataTable([
            { label: "#", cell: (f) => f.frame_no, cls: "num" },
            { label: "Home", cell: (f) => who(fx, f, "home"), cls: "right live-name" },
            { label: "", cell: (f) => `${f.home_points ?? ""}-${f.away_points ?? ""}`, cls: "num" },
            { label: "Away", cell: (f) => who(fx, f, "away"), cls: "live-name" },
          ], frames) : html`<p class="lv-wait">Waiting for the first frame…</p>`}
          ${/* Round 117 (Rich): the match's own captains and vice captains, and the league's officers, go straight to the
               card from here. Everyone else sees no button — and the database refuses them anyway. */ ""}
          ${user && canEditFixture(user, fx) ? html`<a class="lv-edit" href="${urls.scorecard(fx)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16Zm12.5-13.5 1 1"/></svg>Edit the scorecard</a>` : ""}
        </article>`;
      })}</div>` : onTable.length ? "" : html`<div class="lv-none">No matches being played right now.${nextDay ? "" : " Match nights are usually Tuesdays from 19:30."}</div>`}
      ${!games.length && nextNight.length ? html`<section class="lv-sec"><div class="lv-sec__head"><h2>Next match night</h2><span class="sb-chip sb-chip--date lv-date">${fmtDay(nextNight[0].starts_at, { withYear: true })}</span></div>
        <div class="lv-minis">${nextNight.map((f) => mini(f, false))}</div></section>` : ""}
      ${lastNight.length ? html`<section class="lv-sec"><div class="lv-sec__head"><h2>Latest results</h2><a class="sb-pill-link" href="/results">All results</a></div>
        <div class="lv-minis">${lastNight.map((f) => mini(f, true))}</div></section>` : ""}
    </div>`);
  };
  await draw();
  return subscribe(["frames", "breaks", "fixtures", "competitions", "live_matches"], draw);
}
