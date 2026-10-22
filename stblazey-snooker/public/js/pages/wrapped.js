// ─────────────────────────────────────────────────────────────
//  "Season wrapped" (round 40): a season in numbers, like the end-of-year round-ups music apps do.
//  The whole league (/wrapped), or one team (/wrapped?team=bethel-a). Any season (?season=…). Worked out from the
//  results, frames and breaks — nothing to set up. Only results that count (approved or submitted) are used.
// ─────────────────────────────────────────────────────────────
import { html, mount, fmtDate, fmtLongDate } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { matchScore, frameWinner, isCounted } from "../core/rules.js";
import { breadcrumb, seasonPicker, urls, badge } from "../core/components.js";
import { setTitle, navigate } from "../core/router.js";

const n = (x) => Number(x || 0).toLocaleString("en-GB");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** Every counted match of the season with its score, from each team's side. */
function results(ctx) {
  return ctx.fixtures.filter((f) => isCounted(f) && (ctx.framesByFixture.get(f.id)?.length ?? 0) > 0).map((f) => {
    const frames = ctx.framesByFixture.get(f.id);
    return { f, frames, s: matchScore(frames) };
  }).sort((a, b) => a.f.starts_at.localeCompare(b.f.starts_at));
}

/** Players: frames played and won (extra players' frames included), breaks. */
function playerStats(ctx, list, teamId = null) {
  const rows = new Map();
  const row = (id) => rows.get(id) ?? rows.set(id, { id, p: ctx.player.get(id), played: 0, won: 0, breaks: [], points: 0 }).get(id);
  const mine = new Map();   // fixture id → the players who played for the team (team view)
  for (const { f, frames } of list) for (const fr of frames) {
    if (fr.legacy) continue;
    const w = frameWinner(fr);
    for (const side of ["home", "away"]) {
      const id = fr[`${side}_player_id`];
      if (!id || (teamId && f[`${side}_team_id`] !== teamId)) continue;
      (mine.get(f.id) ?? mine.set(f.id, new Set()).get(f.id)).add(id);
      const r = row(id); r.played++; r.points += Number(fr[`${side}_points`]) || 0;
      if (w === side) r.won++;
    }
  }
  for (const b of ctx.breaks) if (mine.get(b.fixture_id)?.has(b.player_id)) row(b.player_id).breaks.push(b);
  return [...rows.values()].filter((r) => r.p);
}

/** The longest run of wins for each team. */
function runs(ctx, list) {
  const out = new Map();
  for (const t of ctx.teams) {
    let cur = 0, best = 0;
    for (const { f, s } of list) {
      if (f.home_team_id !== t.id && f.away_team_id !== t.id) continue;
      const us = f.home_team_id === t.id ? s.home : s.away, them = f.home_team_id === t.id ? s.away : s.home;
      cur = us > them ? cur + 1 : 0; best = Math.max(best, cur);
    }
    out.set(t.id, best);
  }
  return out;
}

const card = (cls, big, label, sub = "") => html`<div class="wr-card ${cls}"><b>${big}</b><span>${label}</span>${sub ? html`<small>${sub}</small>` : ""}</div>`;

export default async function wrapped(view, { query }) {
  const ctx = await seasonContext(query.get("season"));
  const team = query.get("team") ? ctx.teams.find((t) => t.slug === query.get("team") || t.id === query.get("team")) : null;
  const season = ctx.season?.name ?? "This season";
  setTitle(team ? `${team.name}: ${season} wrapped` : `${season} wrapped`);
  const all = results(ctx);
  const list = team ? all.filter(({ f }) => f.home_team_id === team.id || f.away_team_id === team.id) : all;
  const players = playerStats(ctx, list, team?.id);
  const frames = list.reduce((s, x) => s + x.frames.filter((fr) => frameWinner(fr)).length, 0);
  const breaks = players.flatMap((r) => r.breaks);
  const best = [...breaks].sort((a, b) => b.value - a.value)[0];
  const bestFx = best && ctx.fixture.get(best.fixture_id);
  const mostWins = [...players].sort((a, b) => b.won - a.won || a.played - b.played)[0];
  const qualified = players.filter((r) => r.played >= Math.max(6, Math.round(list.length / 4)));
  const bestPct = [...qualified].sort((a, b) => b.won / b.played - a.won / a.played || b.played - a.played)[0];
  const mostBreaks = [...players].sort((a, b) => b.breaks.length - a.breaks.length)[0];
  const mostPoints = [...players].sort((a, b) => b.points - a.points)[0];
  const whitewash = list.filter(({ s }) => (s.home === 0 || s.away === 0) && s.home + s.away >= 5);
  const close = list.filter(({ s }) => Math.abs(s.home - s.away) === 1);
  const bigWin = [...list].sort((a, b) => Math.abs(b.s.home - b.s.away) - Math.abs(a.s.home - a.s.away))[0];
  const runMap = runs(ctx, list);
  const bestRun = [...runMap].filter(([id]) => !team || id === team.id).sort((a, b) => b[1] - a[1])[0];
  const pname = (r) => r?.p?.full_name ?? "–";
  const tname = (id) => ctx.team.get(id)?.name ?? "?";
  const fxText = (x) => `${tname(x.f.home_team_id)} ${x.s.home}–${x.s.away} ${tname(x.f.away_team_id)}`;

  // The team's own record.
  let record = null;
  if (team) {
    record = list.reduce((r, { f, s }) => {
      const us = f.home_team_id === team.id ? s.home : s.away, them = f.home_team_id === team.id ? s.away : s.home;
      r.p++; r.f += us; r.a += them; if (us > them) r.w++; else if (us < them) r.l++; else r.d++;
      if (f.home_team_id === team.id && us > them) r.homeW++;
      return r;
    }, { p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, homeW: 0 });
  }
  // League winners / leaders.
  const leaders = team ? [] : ctx.leagues.map((l) => ({ l, top: ctx.standings(l.id)?.[0] })).filter((x) => x.top?.p);

  const done = ctx.season && !ctx.season.is_current;
  mount(view, html`<div class="wrap stack wrapped">
    ${breadcrumb([["Home", "/"], ["League", "/league"], [team ? `${team.name} wrapped` : "Season wrapped"]])}
    <div class="wr-hero">
      <small>${done ? "The season in numbers" : "The season so far"}</small>
      <h1>${team ? html`${badge(team)} ${team.name}` : "St Blazey & District"}<br><em>${season} wrapped</em></h1>
      <div class="wr-tools">${seasonPicker(ctx)}
        <label class="toolbar" style="font-weight:700">Team <select data-wr-team><option value="">The whole league</option>${[...ctx.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => html`<option value="${t.slug ?? t.id}" ${t.id === team?.id ? "selected" : ""}>${t.name}</option>`)}</select></label></div>
    </div>
    ${!list.length ? html`<div class="notice">No results yet ${team ? `for ${team.name} ` : ""}in ${season} — come back once the first matches are in.</div>` : html`
    <div class="wr-grid">
      ${record ? html`
        ${card("wr-red wr-wide", `${record.w}–${record.d ? `${record.d}–` : ""}${record.l}`, `won${record.d ? "–drawn" : ""}–lost`, `${record.p} matches · ${record.f}–${record.a} in frames`)}
        ${card("wr-green", `${pct(record.w, record.p)}%`, "of matches won", `${record.homeW} at home`)}`
      : card("wr-red wr-wide", n(list.length), "matches played", `${n(frames)} frames · ${n(new Set(list.flatMap(({ f }) => [f.home_team_id, f.away_team_id])).size)} teams`)}
      ${card("wr-gold", n(frames), "frames played", `${n(breaks.length)} breaks of 30 or more`)}
      ${best ? card("wr-black wr-wide", best.value, "the highest break", html`<a href="/player/${best.player_id}">${ctx.player.get(best.player_id)?.full_name ?? ""}</a>${bestFx ? html` · ${tname(bestFx.home_team_id)} v ${tname(bestFx.away_team_id)}, ${fmtLongDate(bestFx.starts_at)}` : ""}`) : ""}
      ${mostWins ? card("wr-blue", mostWins.won, "frames won — the most", html`<a href="/player/${mostWins.id}">${pname(mostWins)}</a> (${mostWins.played} played)`) : ""}
      ${bestPct ? card("wr-green", `${pct(bestPct.won, bestPct.played)}%`, "the best win rate", html`<a href="/player/${bestPct.id}">${pname(bestPct)}</a> · ${bestPct.won} of ${bestPct.played} frames`) : ""}
      ${mostBreaks?.breaks.length ? card("wr-gold", mostBreaks.breaks.length, mostBreaks.breaks.length === 1 ? "break — the most" : "breaks — the most", html`<a href="/player/${mostBreaks.id}">${pname(mostBreaks)}</a>`) : ""}
      ${mostPoints ? card("wr-black", n(mostPoints.points), "points scored — the most", html`<a href="/player/${mostPoints.id}">${pname(mostPoints)}</a>`) : ""}
      ${bestRun?.[1] >= 2 ? card("wr-red", bestRun[1], "wins in a row", team ? "the best run" : html`<a href="${urls.team(ctx.team.get(bestRun[0]))}">${tname(bestRun[0])}</a> — the best run`) : ""}
      ${card("wr-blue", close.length, close.length === 1 ? "match decided by one frame" : "matches decided by one frame", close.length ? `${pct(close.length, list.length)}% of them` : "")}
      ${whitewash.length ? card("wr-green", whitewash.length, whitewash.length === 1 ? "clean sweep" : "clean sweeps", "won without dropping a frame") : ""}
      ${bigWin ? card("wr-gold wr-wide", `${Math.max(bigWin.s.home, bigWin.s.away)}–${Math.min(bigWin.s.home, bigWin.s.away)}`, "the biggest win", html`<a href="${urls.match(bigWin.f)}">${fxText(bigWin)}</a> · ${fmtDate(bigWin.f.starts_at)}`) : ""}
      ${leaders.map(({ l, top }) => card("wr-black", top.pts, `points — ${done ? "champions" : "top"} of the ${l.name}`, html`<a href="${urls.team(top.team)}">${top.name}</a> · ${top.w} won of ${top.p}`))}
    </div>
    <p class="muted">From ${n(list.length)} result${list.length === 1 ? "" : "s"} ${done ? "" : "so far "}this season — results waiting for approval included. Old results with only the final score count towards the matches, not the players.</p>`}
  </div>`);
  view.querySelector("[data-wr-team]")?.addEventListener("change", (e) => {
    const q = new URLSearchParams(location.search);
    if (e.target.value) q.set("team", e.target.value); else q.delete("team");
    navigate(`/wrapped${q.toString() ? `?${q}` : ""}`);
  });
}
