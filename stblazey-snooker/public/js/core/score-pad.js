// ─────────────────────────────────────────────────────────────
//  SCORE PAD — one frame scored ball by ball, for the captains'
//  league scorecard ("Ball by ball" view). A button for every ball
//  potted, foul and end of break; each press is saved straight away,
//  so anyone watching /scoreboard/<no> sees the score move.
//  When the frame ends the pad hands its score and its breaks of 30
//  or more back to the scorecard (onFrameEnd).
//  The scoring rules are in live-score.js. The admin's finals-night
//  pad (admin/scoreboard.js) is the same idea for a whole match, with
//  the draw and the live text around it.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, confirmBox } from "./dom.js";
import * as score from "./live-score.js";
import { linesOf, withLine, sayBox } from "./live-text.js";

const ballDot = (value) => html`<i class="ball b-${score.ballOf(value)?.key ?? "red"}" title="${score.ballOf(value)?.name ?? ""}"></i>`;
/** The parts of the row that a press can change (what Undo puts back). */
const snap = (m) => ({ status: m.status, frames_a: m.frames_a, frames_b: m.frames_b, state: m.state, started_at: m.started_at ?? null, finished_at: m.finished_at ?? null });

/**
 * opts: {
 *   match   — the live_matches row for this frame (status "setup", "live" or "finished"),
 *   name    — { a, b }: the two players' names,
 *   save(row) → Promise — keep a press,
 *   onStart() — the break-off has been chosen: the frame is live,
 *   onFrameEnd(frame) → Promise — the frame is over: { a, b, winner, breaks: [{ s, v }] },
 *   scored  — true when the scorecard already has this frame's score (a finished pad then just says so),
 *   liveText — { href } to show the "Live text" box (what is typed appears under this frame's public scoreboard, at href),
 * }
 * Returns { destroy() }.
 */
export function scorePad(el, { match, name, save, onStart = () => {}, onFrameEnd, scored = false, liveText = null }) {
  let m = match;
  const KEY = `sbdsl-sb-${m.id}`;
  let undo = [];
  try { undo = JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { /* start with nothing to undo */ }
  const remember = () => { try { sessionStorage.setItem(KEY, JSON.stringify(undo.slice(-120))); } catch { /* not remembered */ } };
  // Presses are saved one after another, in the order they were made.
  let queue = Promise.resolve(), failed = false, alive = true;
  const push = () => {
    const row = { id: m.id, ...snap(m), updated_at: new Date().toISOString() };
    queue = queue.then(() => save(row)).then(() => { failed = false; }, (err) => { if (!failed) toast(`Not saved: ${err.message}`, "error"); failed = true; });
    return queue;
  };
  const apply = (next) => {
    if (next === m) return false;
    undo.push(snap(m)); remember();
    m = next; draw(); push();
    return true;
  };
  // Live text: kept apart from the score, so Undo never takes a line of text away.
  const saveLines = (list) => {
    m = { ...m, commentary: list };
    queue = queue.then(() => save({ id: m.id, commentary: list, updated_at: new Date().toISOString() })).then(() => {}, (err) => toast(`The live text was not saved: ${err.message}`, "error"));
    draw();
  };
  const textBox = () => (liveText ? sayBox(linesOf(m), { publicHref: liveText.href }) : "");

  function draw() {
    if (!alive) return;
    const f = m.state?.frame, live = m.status === "live";
    const sit = score.situation(f), on = score.ballOn(f);
    const last = (m.state?.frames ?? []).at(-1);
    const side = (s) => html`<button type="button" class="pad-side ${live && f.striker === s ? "on" : ""}" data-striker="${s}" ${live ? "" : "disabled"}>
      <small>${live && f.striker === s ? "At the table" : live ? "Tap if at the table" : ""}</small>
      <strong>${name[s]}</strong><b>${live ? f[s] : last ? last[s] : "–"}</b></button>`;
    const leader = !f ? null : f.a > f.b ? "a" : f.b > f.a ? "b" : null;
    const fixOpen = !!$(".pad-fix", el)?.open;      // the corrections box stays open while it is being used
    const typing = $("[data-say-text]", el), typed = typing?.value ?? "", wasTyping = typing && document.activeElement === typing;
    mount(el, html`<div class="pad pad-frame">
      ${m.status === "setup" ? html`<div class="pad-start box">
        <p style="margin-top:0"><b>Who breaks off?</b> Pressing a name starts the frame: it shows as live on the website straight away.</p>
        <div class="btn-row"><button type="button" class="btn green" data-start="a">${name.a} breaks</button><button type="button" class="btn green" data-start="b">${name.b} breaks</button></div></div>` : ""}

      ${m.status !== "setup" ? html`<div class="pad-score">${side("a")}
        <div class="pad-mid">${live ? html`<small>Break</small><b>${f.brk}</b><span>${name[f.striker].split(" ")[0]}</span>` : html`<small>Frame over</small><b>${last ? `${last.a}–${last.b}` : ""}</b><span>${last ? name[last.winner] : ""}</span>`}</div>
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
        ${textBox()}
        <details class="pad-fix" ${fixOpen ? "open" : ""}><summary>Put something right</summary>
          <div class="pad-fix-grid">
            <span>${name.a}'s points</span><span class="btn-row"><button type="button" class="btn small ghost" data-adj="a" data-by="-1">−1</button><button type="button" class="btn small ghost" data-adj="a" data-by="1">+1</button></span>
            <span>${name.b}'s points</span><span class="btn-row"><button type="button" class="btn small ghost" data-adj="b" data-by="-1">−1</button><button type="button" class="btn small ghost" data-adj="b" data-by="1">+1</button></span>
            <span>Reds on the table (a red potted on a foul stays down: −1)</span><span class="btn-row"><button type="button" class="btn small ghost" data-reds="-1">−1</button><button type="button" class="btn small ghost" data-reds="1">+1</button></span>
          </div>
          <p class="muted" style="margin:10px 0 0">Wrong player at the table? Tap the right player's name at the top.</p></details>
        <div class="pad-row pad-end">
          <button type="button" class="btn green pad-big" data-end-frame ${leader ? "" : "disabled"}>${leader ? html`End the frame <small>${name[leader]} wins it ${Math.max(f.a, f.b)}–${Math.min(f.a, f.b)} — it goes onto the scorecard</small>` : html`End the frame <small>level — play the re-spotted black</small>`}</button>
        </div>` : ""}

      ${m.status === "finished" ? html`<div class="notice ${scored ? "ok" : "todo"}">${scored ? html`<b>This frame is on the scorecard.</b>` : html`<b>The frame is over but it is not on the scorecard yet.</b>`}
          ${last?.breaks?.length ? html`<br>Breaks: ${last.breaks.map((x) => `${name[x.s]} ${x.v}`).join(", ")}` : ""}</div>
        <div class="btn-row">${scored ? "" : html`<button type="button" class="btn green" data-hand-over>Put it on the scorecard</button>`}
          <button type="button" class="btn ghost" data-undo ${undo.length ? "" : "disabled"}>Undo — the frame isn't over</button>
          <button type="button" class="btn ghost" data-again>Score this frame again from the start</button></div>` : ""}
      ${live ? "" : textBox()}
    </div>`);
    // A press on the pad redraws it: what was being typed in the live text box is kept.
    const box = $("[data-say-text]", el);
    if (box && typed) box.value = typed;
    if (box && wasTyping) box.focus();
  }

  const handOver = async () => {
    const rec = (m.state?.frames ?? []).at(-1);
    if (!rec) return;
    await queue;                      // the last press is saved before the scorecard is
    if (alive) await onFrameEnd(rec);
  };
  const endFrame = async () => {
    const f = m.state.frame, w = f.a > f.b ? "a" : f.b > f.a ? "b" : null;
    if (!w) return toast("The frame is level — play the re-spotted black", "error");
    const ok = await confirmBox(`Frame to ${name[w]}, ${f[w]}–${f[w === "a" ? "b" : "a"]}.\n\nThe score and any breaks of ${score.BREAK_MIN} or more go onto the scorecard.`, { title: "End the frame?", ok: "Yes — frame over" });
    if (!ok || !alive) return;
    if (apply(score.endFrame(m, w))) await handOver();
  };

  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled || !el.contains(t)) return;
    const d = t.dataset;
    if (d.unsay) return saveLines(linesOf(m).filter((l) => l.id !== d.unsay));
    if (t.closest("[data-say]")) return;                 // "Post" is the form's own button
    if (d.start) { if (apply(score.start(m, d.start))) { await queue; if (alive) onStart(); } return; }
    if (d.pot) return apply(score.pot(m, Number(d.pot)));
    if ("endBreak" in d) return apply(score.endBreak(m));
    if ("undo" in d) { const prev = undo.pop(); if (!prev) return; remember(); m = { ...m, ...prev }; draw(); return push(); }
    if (d.foul) return apply(score.foul(m, Number(d.foul)));
    if ("free" in d) return apply(score.freeBall(m));
    if (d.striker) return apply(score.setStriker(m, d.striker));
    if (d.adj) return apply(score.adjust(m, d.adj, Number(d.by)));
    if (d.reds) return apply(score.adjustReds(m, Number(d.reds)));
    if ("endFrame" in d) return endFrame();
    if ("handOver" in d) { t.disabled = true; return handOver(); }
    if ("again" in d) {
      if (!(await confirmBox("The ball-by-ball score of this frame is wiped and you start again from the break-off.", { title: "Score this frame again?", ok: "Yes — start again" }))) return;
      undo = []; remember();
      m = { ...m, status: "setup", frames_a: 0, frames_b: 0, state: {}, started_at: null, finished_at: null };
      draw(); push();
    }
  };
  el.onsubmit = (e) => {
    if (!e.target.matches("[data-say]")) return;
    e.preventDefault();
    const now = linesOf(m), next = withLine(now, $("[data-say-text]", el)?.value, m.frame_no ?? m.state?.frame?.no ?? null);
    if (next === now) return;
    const box = $("[data-say-text]", el); if (box) box.value = "";
    saveLines(next);
    $("[data-say-text]", el)?.focus();
  };
  draw();
  return { destroy() { alive = false; el.onclick = null; el.onsubmit = null; } };
}
