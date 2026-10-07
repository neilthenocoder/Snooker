// Admin → Live scoreboard: score a final ball by ball. Set the match up (any two players,
// the competition, best of 1–9 frames), then press a button for every ball potted, foul and
// end of break. Each press is saved straight away and everyone watching /scoreboard/<no>
// sees the score move. The scoring rules are in core/live-score.js; this file is the buttons.
import { html, mount, $, toast, fmtDate, fmtTime, toLocalInput, fromLocalInput, confirmBox } from "../core/dom.js";
import { table, save, remove, liveMatches, loadLiveMatch } from "../core/api.js";
import * as score from "../core/live-score.js";
import { panel, dataTable, urls } from "../core/components.js";
import { ballDot } from "../pages/scoreboard.js";
import { friendly } from "./crud.js";

const BEST_OF = [1, 3, 5, 7, 9].filter((n) => n <= score.MAX_BEST_OF);
/** The parts of a match that a press can change (what Undo puts back). */
const snap = (m) => ({ status: m.status, frames_a: m.frames_a, frames_b: m.frames_b, state: m.state, started_at: m.started_at ?? null, finished_at: m.finished_at ?? null });

export async function scoreboardPage(el, { user } = {}) {
  const [players, competitions, venues] = await Promise.all([table("players", "full_name"), table("competitions", "sort"), table("venues", "name")]);
  const look = { players, competitions };
  const nameOf = (m, s) => score.sideName(m, s, players);
  let stopKeys = () => {};
  const open = (id) => { history.replaceState(null, "", id ? `/admin/scoreboard?m=${id}` : "/admin/scoreboard"); return id ? pad(id) : list(); };

  // ── the list, and the form to set a match up ──────────────────
  async function list(editing = null) {
    stopKeys();
    const all = await liveMatches();
    const form = editing ?? { best_of: 9 };
    const typed = (side) => (form[`player_${side}_id`] ? players.find((p) => p.id === form[`player_${side}_id`])?.full_name : form[`name_${side}`]) ?? "";
    mount(el, html`
      <div class="notice">For finals and big matches: one person sits by the table with a phone or tablet and presses a button for every ball. Visitors watch the score go up on the
        <a href="/scoreboard" style="font-weight:700;color:var(--red)">Live scoreboard</a> — and the Live button in the menu turns green while a match is on.
        League match nights still use the captains' scorecards; this is an extra for the big occasions.</div>
      ${panel(editing ? "Change the match details" : "Set up a match", html`<form class="form" data-sb-form>
        <div class="grid-2">
          <label>Competition <span class="muted" style="font-weight:400">(optional)</span>
            <select name="competition_id"><option value="">– none –</option>${competitions.map((c) => html`<option value="${c.id}" ${c.id === form.competition_id ? "selected" : ""}>${c.name}</option>`)}</select></label>
          <label>Round or title <input type="text" name="round_name" value="${form.round_name ?? ""}" placeholder="Final"></label>
          <label>Player A <span class="muted" style="font-weight:400">(start typing — any player from any team, or type a name that isn't in the list)</span>
            <input type="text" name="a" list="sb-players" value="${typed("a")}" required autocomplete="off"></label>
          <label>Player B
            <input type="text" name="b" list="sb-players" value="${typed("b")}" required autocomplete="off"></label>
          <label>Frames <select name="best_of">${BEST_OF.map((n) => html`<option value="${n}" ${n === form.best_of ? "selected" : ""}>Best of ${n} (first to ${Math.floor(n / 2) + 1})</option>`)}</select></label>
          <label>Date &amp; time <span class="muted" style="font-weight:400">(optional — shows the match as “coming up”)</span>
            <input type="datetime-local" name="starts_at" value="${toLocalInput(form.starts_at)}"></label>
          <label style="grid-column:1/-1">Where <input type="text" name="venue" list="sb-venues" value="${form.venue ?? ""}" placeholder="Bethel Social Club"></label>
        </div>
        <datalist id="sb-players">${players.filter((p) => p.status !== "deceased").map((p) => html`<option value="${p.full_name}">`)}</datalist>
        <datalist id="sb-venues">${venues.map((v) => html`<option value="${v.name}">`)}</datalist>
        <div class="btn-row"><button class="btn green">${editing ? "Save the changes" : "Create the match"}</button>${editing ? html`<button type="button" class="btn ghost" data-sb-cancel>Cancel</button>` : ""}</div>
      </form>`)}
      <div style="height:22px"></div>
      ${panel("Matches", dataTable([
        { label: "No.", cell: (m) => m.no ?? "–", cls: "num" },
        { label: "Match", cell: (m) => html`<b>${nameOf(m, "a")} v ${nameOf(m, "b")}</b><br><small class="muted">${score.matchLabel(m, competitions)} · best of ${m.best_of}</small>` },
        { label: "Score", cell: (m) => `${m.frames_a ?? 0} – ${m.frames_b ?? 0}`, cls: "num strong" },
        { label: "", cell: (m) => (m.status === "live" ? html`<span class="live-dot">Live</span>` : html`<span class="status ${m.status === "finished" ? "approved" : "submitted"}">${m.status === "finished" ? `Finished ${fmtDate(m.finished_at)}` : m.starts_at ? `${fmtDate(m.starts_at)} ${fmtTime(m.starts_at)}` : "Not started"}</span>`) },
        { label: "", cls: "right", cell: (m) => html`<span class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">
          <button type="button" class="btn small green" data-sb-open="${m.id}">${m.status === "finished" ? "Open" : "Score it"}</button>
          <a class="btn small ghost" href="${urls.scoreboard(m)}" target="_blank" rel="noopener">View</a>
          <button type="button" class="btn small secondary" data-sb-edit="${m.id}">Details</button>
          <button type="button" class="btn small" data-sb-delete="${m.id}">Delete</button></span>` },
      ], all, { empty: "No matches yet — set one up above.", rowClass: (m) => (m.status === "live" ? "live-row" : "") }))}`);

    $("[data-sb-form]", el).onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      const pick = (text) => players.find((p) => p.full_name.toLowerCase() === text.trim().toLowerCase());
      const a = pick(f.a.value), b = pick(f.b.value);
      if (a && b && a.id === b.id) return toast("Player A and Player B are the same person", "error");
      const row = {
        ...(editing ? { id: editing.id } : { status: "setup", frames_a: 0, frames_b: 0, state: {}, created_by: user?.profile?.full_name ?? null }),
        competition_id: f.competition_id.value || null, round_name: f.round_name.value.trim() || null,
        player_a_id: a?.id ?? null, name_a: a ? null : f.a.value.trim(), player_b_id: b?.id ?? null, name_b: b ? null : f.b.value.trim(),
        best_of: Number(f.best_of.value), starts_at: fromLocalInput(f.starts_at.value), venue: f.venue.value.trim() || null, updated_at: new Date().toISOString(),
      };
      try { const saved = await save("live_matches", row); toast(editing ? "Saved" : "Match created"); editing ? list() : open(saved.id); }
      catch (err) { toast(friendly(err), "error"); }
    };
    el.onclick = async (e) => {
      const t = e.target;
      if (t.closest("[data-sb-cancel]")) return list();
      if (t.dataset.sbOpen) return open(t.dataset.sbOpen);
      if (t.dataset.sbEdit) { await list(all.find((m) => m.id === t.dataset.sbEdit)); return $("[data-sb-form]", el).scrollIntoView({ behavior: "smooth", block: "start" }); }
      if (t.dataset.sbDelete) {
        const m = all.find((x) => x.id === t.dataset.sbDelete);
        if (!confirm(`Delete ${nameOf(m, "a")} v ${nameOf(m, "b")}? Its scoreboard page goes too. This can't be undone.`)) return;
        try { await remove("live_matches", m.id); sessionStorage.removeItem(`sbdsl-sb-${m.id}`); toast("Deleted"); list(); } catch (err) { toast(friendly(err), "error"); }
      }
    };
  }

  // ── the control pad ───────────────────────────────────────────
  async function pad(id) {
    let m = await loadLiveMatch(id);
    if (!m) { toast("That match has been deleted", "error"); return open(null); }
    const KEY = `sbdsl-sb-${m.id}`;
    let undo = [];
    try { undo = JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch {}
    const remember = () => { try { sessionStorage.setItem(KEY, JSON.stringify(undo.slice(-120))); } catch {} };
    // Presses are saved one after another, in the order they were made.
    let queue = Promise.resolve(), failed = false;
    const push = () => {
      const row = { id: m.id, ...snap(m), updated_at: new Date().toISOString() };
      queue = queue.then(() => save("live_matches", row)).then(() => { failed = false; }, (err) => { if (!failed) toast(`Not saved: ${friendly(err)}`, "error"); failed = true; });
    };
    const apply = (next) => {
      if (next === m) return false;
      undo.push(snap(m)); remember();
      m = next; draw(); push();
      return true;
    };
    const name = { a: nameOf(m, "a"), b: nameOf(m, "b") };

    function draw() {
      const f = m.state?.frame, sit = score.situation(f), on = score.ballOn(f);
      const live = m.status === "live";
      const side = (s) => html`<button type="button" class="pad-side ${live && f.striker === s ? "on" : ""}" data-striker="${s}" ${live ? "" : "disabled"}>
        <small>${live && f.striker === s ? "At the table" : live ? "Tap if at the table" : ""}</small>
        <strong>${name[s]}</strong><span class="pad-frames">${m[`frames_${s}`] ?? 0}</span><b>${live ? f[s] : "–"}</b></button>`;
      const leader = !f ? null : f.a > f.b ? "a" : f.b > f.a ? "b" : null;
      const fixOpen = !!$(".pad-fix", el)?.open;      // the corrections box stays open while it is being used
      mount(el, html`<div class="pad">
        <div class="pad-top"><button type="button" class="btn small ghost" data-pad-back>‹ All matches</button>
          <span><b>${score.matchLabel(m, competitions)}</b> · best of ${m.best_of}</span>
          <a class="btn small secondary" href="${urls.scoreboard(m)}" target="_blank" rel="noopener">Open the public scoreboard</a></div>

        ${m.status === "setup" ? html`<div class="pad-start box">
          <h3 style="margin-top:0">${name.a} v ${name.b}</h3>
          <p>Who breaks off in the first frame? Pressing a name starts the match: it shows as <b>Live</b> on the website straight away. (They then take turns to break.)</p>
          <div class="btn-row"><button type="button" class="btn green" data-start="a">${name.a} breaks</button><button type="button" class="btn green" data-start="b">${name.b} breaks</button></div></div>` : ""}

        ${m.status !== "setup" ? html`<div class="pad-score">${side("a")}
          <div class="pad-mid">${live ? html`<small>Frame ${f.no}</small><b>${f.brk}</b><span>break</span>` : html`<small>Final score</small><b>${m.frames_a}–${m.frames_b}</b><span>${name[score.matchWinner(m)] ?? ""} wins</span>`}</div>
          ${side("b")}</div>` : ""}

        ${live ? html`
          <div class="pad-pots" aria-label="Balls potted in this break">${f.pots.length ? f.pots.slice(-30).map((v) => ballDot(v)) : html`<span class="muted">No balls potted in this visit yet</span>`}</div>
          <div class="pad-balls">${score.BALLS.map((b) => html`<button type="button" class="ball-btn b-${b.key} ${on === b.value || (on === "red" && b.value === 1) || (on === "colour" && b.value > 1) ? "is-on" : ""}"
            data-pot="${b.value}" ${b.value === 1 && f.reds === 0 ? "disabled" : ""} aria-label="${b.name} potted, ${b.value} point${b.value > 1 ? "s" : ""}"><span>${b.value}</span><small>${b.name}</small></button>`)}</div>
          <div class="pad-row">
            <button type="button" class="btn secondary pad-big" data-end-break>End of break <small>miss or safety — ${name[f.striker === "a" ? "b" : "a"]} to play</small></button>
            <button type="button" class="btn ghost pad-big" data-undo ${undo.length ? "" : "disabled"}>Undo <small>the last press</small></button>
          </div>
          <div class="pad-row pad-fouls"><span>Foul by ${name[f.striker]}:</span>${[4, 5, 6, 7].map((n) => html`<button type="button" class="btn small" data-foul="${n}">${n} away</button>`)}
            <button type="button" class="btn small blue" data-free title="After a foul leaves a snooker: the free ball counts as the ball on">Free ball potted</button></div>
          <p class="pad-info"><b>${f.reds}</b> red${f.reds === 1 ? "" : "s"} left · <b>${sit.remaining}</b> on the table · ${sit.ahead ? `${name[sit.ahead]} leads by ${sit.lead}` : "level"}${sit.snookers ? html` · <em>${name[sit.ahead === "a" ? "b" : "a"]} needs snookers</em>` : ""}${f.last ? html` · <span class="muted">${f.last}</span>` : ""}</p>
          <details class="pad-fix" ${fixOpen ? "open" : ""}><summary>Put something right</summary>
            <div class="pad-fix-grid">
              <span>${name.a}'s points</span><span class="btn-row"><button type="button" class="btn small ghost" data-adj="a" data-by="-1">−1</button><button type="button" class="btn small ghost" data-adj="a" data-by="1">+1</button></span>
              <span>${name.b}'s points</span><span class="btn-row"><button type="button" class="btn small ghost" data-adj="b" data-by="-1">−1</button><button type="button" class="btn small ghost" data-adj="b" data-by="1">+1</button></span>
              <span>Reds on the table (a red potted on a foul stays down: −1)</span><span class="btn-row"><button type="button" class="btn small ghost" data-reds="-1">−1</button><button type="button" class="btn small ghost" data-reds="1">+1</button></span>
            </div>
            <p class="muted" style="margin:10px 0 0">Wrong player at the table? Tap the right player's name at the top. Keyboard: 1–7 pot a ball, Space ends the break, Backspace undoes.</p></details>
          <div class="pad-row pad-end">
            <button type="button" class="btn green pad-big" data-end-frame ${leader ? "" : "disabled"}>${leader ? html`End the frame <small>${name[leader]} wins it ${Math.max(f.a, f.b)}–${Math.min(f.a, f.b)}</small>` : html`End the frame <small>level — play the re-spotted black</small>`}</button>
            <span class="pad-concede">Frame conceded: <button type="button" class="btn small ghost" data-give="a">to ${name.a}</button><button type="button" class="btn small ghost" data-give="b">to ${name.b}</button></span>
          </div>` : ""}

        ${m.status === "finished" ? html`<div class="notice ok"><b>${name[score.matchWinner(m)]} wins ${Math.max(m.frames_a, m.frames_b)}–${Math.min(m.frames_a, m.frames_b)}.</b>
            The scoreboard page now shows the final score. ${m.competition_id ? html`To put the result into the competition's draw, enter the frame scores on that match's scorecard as usual (<a href="/admin/draws?c=${m.competition_id}" style="font-weight:700">Draws &amp; results</a>).` : ""}</div>
          <div class="btn-row"><button type="button" class="btn ghost" data-undo ${undo.length ? "" : "disabled"}>Undo — the match isn't over</button></div>` : ""}

        ${(m.state?.frames ?? []).length ? html`<div style="height:18px"></div>${panel("Frames so far", dataTable([
          { label: "Frame", cell: (r) => r.no, cls: "num" }, { label: name.a, cell: (r) => html`<span class="${r.winner === "a" ? "strong" : ""}">${r.a}</span>`, cls: "num" },
          { label: name.b, cell: (r) => html`<span class="${r.winner === "b" ? "strong" : ""}">${r.b}</span>`, cls: "num" },
          { label: "Best breaks", cell: (r) => [r.high_a >= 20 ? `${name.a} ${r.high_a}` : "", r.high_b >= 20 ? `${name.b} ${r.high_b}` : ""].filter(Boolean).join(", ") || "–" },
        ], m.state.frames))}` : ""}
      </div>`);
    }

    const endFrame = async (winner) => {
      const f = m.state.frame;
      const w = winner ?? (f.a > f.b ? "a" : f.b > f.a ? "b" : null);
      if (!w) return toast("The frame is level — play the re-spotted black, or give the frame to a player", "error");
      const wins = (m[`frames_${w}`] ?? 0) + 1 >= score.framesToWin(m);
      const ok = await confirmBox(`Frame ${f.no} to ${name[w]}, ${f[w]}–${f[w === "a" ? "b" : "a"]}${winner && f[w] <= f[w === "a" ? "b" : "a"] ? " (conceded)" : ""}.${wins ? `\n\nThat wins the match for ${name[w]}.` : ""}`,
        { title: wins ? "End the frame and the match?" : "End the frame?", ok: wins ? "Yes — match over" : "Yes — next frame" });
      if (ok) apply(score.endFrame(m, w));
    };
    const press = {
      pot: (v) => apply(score.pot(m, v)), endBreak: () => apply(score.endBreak(m)),
      undo: () => { const prev = undo.pop(); if (!prev) return; remember(); m = { ...m, ...prev }; draw(); push(); },
    };

    el.onclick = (e) => {
      const t = e.target.closest("button");
      if (!t || t.disabled) return;
      const d = t.dataset;
      if ("padBack" in d) return open(null);
      if (d.start) return apply(score.start(m, d.start));
      if (d.pot) return press.pot(Number(d.pot));
      if ("endBreak" in d) return press.endBreak();
      if ("undo" in d) return press.undo();
      if (d.foul) return apply(score.foul(m, Number(d.foul)));
      if ("free" in d) return apply(score.freeBall(m));
      if (d.striker) return apply(score.setStriker(m, d.striker));
      if (d.adj) return apply(score.adjust(m, d.adj, Number(d.by)));
      if (d.reds) return apply(score.adjustReds(m, Number(d.reds)));
      if ("endFrame" in d) return endFrame();
      if (d.give) return endFrame(d.give);
    };
    // Keyboard, for a laptop by the table.
    const onKey = (e) => {
      if (m.status !== "live" || e.target.closest("input, textarea, select, dialog") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-7]$/.test(e.key)) { if (!(e.key === "1" && m.state.frame.reds === 0)) press.pot(Number(e.key)); }
      else if (e.key === " ") { e.preventDefault(); press.endBreak(); }
      else if (e.key === "Backspace") { e.preventDefault(); press.undo(); }
    };
    stopKeys();
    document.addEventListener("keydown", onKey);
    stopKeys = () => { document.removeEventListener("keydown", onKey); stopKeys = () => {}; };
    draw();
  }

  await open(new URLSearchParams(location.search).get("m"));
  return () => stopKeys();
}
