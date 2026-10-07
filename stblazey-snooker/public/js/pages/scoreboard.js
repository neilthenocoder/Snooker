// /scoreboard      — the matches being scored ball by ball: on now, coming up, finished.
// /scoreboard/<no> — one match's live scoreboard. It redraws by itself every time the
//                    scorer presses a button (Admin → Live scoreboard); nobody has to refresh.
import { html, mount, fmtDate, fmtTime } from "../core/dom.js";
import { table, liveMatches, loadLiveMatch, subscribe } from "../core/api.js";
import { ballOf, framesToWin, situation, highBreaks, matchWinner, sideName, sidePlayer, matchLabel, ballOn } from "../core/live-score.js";
import { breadcrumb, urls, avatar, trophy, panel, dataTable } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

export default async function scoreboard(view, { params }) {
  const [players, competitions, teams, venues] = await Promise.all([table("players", "full_name"), table("competitions", "sort"), table("teams", "name"), table("venues", "name")]);
  const look = { players, competitions, teams, venues };
  if (!params.id) return list(view, look);

  let found = false;
  const draw = async () => {
    const m = await loadLiveMatch(params.id);
    if (!m) return found ? null : notFound(view);
    found = true;
    setTitle(`${sideName(m, "a", players)} v ${sideName(m, "b", players)}`);
    adminEdit("scoreboard", null, { href: `/admin/scoreboard?m=${m.id}`, label: "Score this match" });
    if (String(params.id) !== String(m.no) && m.no != null) history.replaceState(null, "", urls.scoreboard(m));
    view.classList.add("flush");
    mount(view, board(m, look));
  };
  await draw();
  return found ? subscribe(["live_matches"], draw) : undefined;
}

// ── one match ──────────────────────────────────────────────────
export const ballDot = (value, cls = "") => html`<i class="ball b-${ballOf(value)?.key ?? "red"} ${cls}" title="${ballOf(value)?.name ?? ""}"></i>`;

function board(m, { players, competitions, teams, venues }) {
  const f = m.state?.frame, done = m.state?.frames ?? [];
  const live = m.status === "live", finished = m.status === "finished";
  const comp = competitions.find((c) => c.id === m.competition_id);
  const name = { a: sideName(m, "a", players), b: sideName(m, "b", players) };
  const sit = live ? situation(f) : null, high = highBreaks(m), won = matchWinner(m);
  const on = live ? ballOn(f) : null;
  const venue = venues.find((v) => v.id === m.venue)?.name ?? m.venue ?? "";
  const side = (s) => {
    const p = sidePlayer(m, s, players);
    const who = html`${avatar(p, "sb-face")}<span class="sb-name">${name[s]}</span><small>${teams.find((t) => t.id === p?.team_id)?.name ?? ""}</small>`;
    return html`<div class="sb-side ${s} ${live && f.striker === s ? "at-table" : ""} ${won === s ? "won" : ""}">
      ${p ? html`<a class="sb-who" href="${urls.player(p)}">${who}</a>` : html`<div class="sb-who">${who}</div>`}
      <div class="sb-points" aria-label="${name[s]}: ${live ? f[s] : m[`frames_${s}`] ?? 0}">${live ? f[s] : finished ? "" : "0"}</div>
      ${live && f.striker === s ? html`<span class="sb-cue">At the table</span>` : ""}
    </div>`;
  };
  const lead = !sit ? "" : sit.ahead ? `${name[sit.ahead]} leads by ${sit.lead}` : "Level";

  return html`<section class="sb is-${m.status}">
    <div class="wrap">
      ${breadcrumb([["Home", "/"], ["Live scoreboard", "/scoreboard"], [`${name.a} v ${name.b}`]])}
      <div class="sb-head">
        ${comp ? trophy(comp, "sb-trophy", { always: false }) : ""}
        <div><h1>${matchLabel(m, competitions)}</h1>
          <p>Best of ${m.best_of} frames · first to ${framesToWin(m)}${venue ? ` · ${venue}` : ""}${m.starts_at && !live && !finished ? ` · ${fmtDate(m.starts_at)} ${fmtTime(m.starts_at)}` : ""}</p></div>
        ${live ? html`<span class="live-dot">Live</span>` : finished ? html`<span class="status approved">Finished</span>` : html`<span class="status submitted">Not started</span>`}
      </div>
      <div class="sb-table"><div class="sb-board">
        ${side("a")}
        <div class="sb-mid">
          <div class="sb-frames"><b>${m.frames_a ?? 0}</b><span>(${m.best_of})</span><b>${m.frames_b ?? 0}</b></div>
          <small>${live ? `Frame ${f.no}` : finished ? "Final score" : "Frames"}</small>
        </div>
        ${side("b")}
      </div>
      ${live ? html`<div class="sb-now">
        <div class="sb-break"><small>Break</small><b>${f.brk}</b><span class="sb-pots">${f.pots.slice(-24).map((v) => ballDot(v))}</span></div>
        <div class="sb-facts">
          <span><b>${sit.remaining}</b> on the table</span>
          <span><b>${f.reds}</b> red${f.reds === 1 ? "" : "s"} left</span>
          <span>${lead}${sit.snookers ? html` — <em>${name[sit.ahead === "a" ? "b" : "a"]} needs snookers</em>` : ""}</span>
          ${on ? html`<span class="sb-on">Next: ${on === "red" ? html`${ballDot(1)} a red` : on === "colour" ? "a colour" : html`${ballDot(on)} the ${ballOf(on).name.toLowerCase()}`}</span>` : ""}
        </div>
        ${f.last ? html`<p class="sb-last" aria-live="polite">${f.last}</p>` : ""}
      </div>` : finished ? html`<p class="sb-result">${name[won]} wins ${Math.max(m.frames_a, m.frames_b)}–${Math.min(m.frames_a, m.frames_b)}</p>`
        : html`<p class="sb-result wait">${m.starts_at ? `Starts ${fmtDate(m.starts_at)} at ${fmtTime(m.starts_at)}` : "Waiting for the first break"} — this page updates by itself.</p>`}
      </div>
    </div></section>
    <div class="wrap stack sb-under">
      ${done.length ? panel("Frame by frame", dataTable([
        { label: "Frame", cell: (r) => r.no, cls: "num" },
        { label: name.a, cell: (r) => html`<span class="${r.winner === "a" ? "strong" : ""}">${r.a}</span>${r.high_a >= 20 ? html`<span class="break-tag">${r.high_a} break</span>` : ""}`, cls: "right" },
        { label: "", cell: (r) => html`<span class="status ${r.winner === "a" ? "approved" : "in_progress"}">${r.winner === "a" ? name.a : name.b}</span>`, cls: "num hide-sm" },
        { label: name.b, cell: (r) => html`<span class="${r.winner === "b" ? "strong" : ""}">${r.b}</span>${r.high_b >= 20 ? html`<span class="break-tag">${r.high_b} break</span>` : ""}` },
      ], done)) : ""}
      ${high.a || high.b ? html`<div class="stats"><div class="stat"><b>${high.a || "–"}</b>Highest break: ${name.a}</div><div class="stat"><b>${high.b || "–"}</b>Highest break: ${name.b}</div></div>` : ""}
      <div class="btn-row">${comp ? html`<a class="btn secondary" href="${urls.competition(comp)}">${comp.name}</a>` : ""}<a class="btn ghost" href="/scoreboard">All scoreboard matches</a></div>
    </div>`;
}

// ── the list ───────────────────────────────────────────────────
async function list(view, look) {
  setTitle("Live scoreboard");
  adminEdit("scoreboard", null, { label: "Score a match" });
  const draw = async () => {
    const all = await liveMatches().catch(() => []);
    const card = (m) => {
      const f = m.state?.frame, won = matchWinner(m);
      return html`<a class="sb-card is-${m.status}" href="${urls.scoreboard(m)}">
        <small>${matchLabel(m, look.competitions)}${m.status === "live" ? html` <span class="live-dot">Live</span>` : ""}</small>
        <div class="sb-card-row"><span class="${won === "a" ? "strong" : ""}">${sideName(m, "a", look.players)}</span>
          <b>${m.frames_a ?? 0} <i>(${m.best_of})</i> ${m.frames_b ?? 0}</b>
          <span class="${won === "b" ? "strong" : ""}">${sideName(m, "b", look.players)}</span></div>
        <em>${m.status === "live" ? `Frame ${f?.no ?? 1}: ${f?.a ?? 0} – ${f?.b ?? 0}` : m.status === "finished" ? `Finished ${fmtDate(m.finished_at)}` : m.starts_at ? `${fmtDate(m.starts_at)} at ${fmtTime(m.starts_at)}` : "Not started yet"}</em></a>`;
    };
    const group = (title, rows) => (rows.length ? html`<div><h3 style="margin-top:0">${title}</h3><div class="sb-cards">${rows.map(card)}</div></div>` : "");
    const by = (s) => all.filter((m) => m.status === s);
    mount(view, html`<div class="wrap stack">
      <div>${breadcrumb([["Home", "/"], ["Live scoreboard"]])}
        <h1>Live scoreboard</h1>
        <p class="muted" style="max-width:720px">Finals and big matches are scored here ball by ball. Open a match and the score moves as each ball is potted — no need to refresh.</p></div>
      ${group("On the table now", by("live"))}${group("Coming up", by("setup").sort((a, b) => String(a.starts_at ?? "9").localeCompare(String(b.starts_at ?? "9"))))}${group("Finished", by("finished").slice(0, 24))}
      ${all.length ? "" : html`<div class="empty box">No matches are being scored ball by ball at the moment. League match nights are on the <a href="/live">Live scores</a> page.</div>`}
    </div>`);
  };
  await draw();
  return subscribe(["live_matches"], draw);
}
