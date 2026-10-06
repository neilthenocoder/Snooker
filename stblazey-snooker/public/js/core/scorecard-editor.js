// ─────────────────────────────────────────────────────────────
//  SCORECARD EDITOR — one editor for league matches and cup
//  matches (singles, doubles and teams), with two views of the
//  same scorecard:
//    • "guided"  – step by step, made for phones:
//                  1 pick the players → 2 score one frame at a time → 3 finish
//                  (photo of the card, then submit)
//    • "classic" – the whole card in one table
//  The page that uses it converts its own rows to/from this shape:
//
//    { frame_no, a_points, b_points,
//      a: [{ player_id, ext, breaks: "34, 41" }, …],   // 1 slot, or 2 for doubles
//      b: [{ … }] }
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, fmtDate, fmtTime, confirmBox } from "./dom.js";
import { badge, handicapText } from "./components.js";
import { frameWinner, parseBreaks, breakPoints, handicapStarts, RULES, EXT_PER_SEASON, MAX_BREAK } from "./rules.js";

const VIEW_KEY = "sbdsl-scorecard-view";
const blankSlot = () => ({ player_id: null, ext: false, breaks: "" });
export const blankFrame = (frame_no, slots = 1, preset = {}) => ({
  frame_no, a_points: null, b_points: null,
  a: Array.from({ length: slots }, (_, i) => ({ ...blankSlot(), player_id: preset?.a?.[i] ?? null })),
  b: Array.from({ length: slots }, (_, i) => ({ ...blankSlot(), player_id: preset?.b?.[i] ?? null })),
});

const winnerOf = (f) => ({ home: "a", away: "b" })[frameWinner({ home_points: f.a_points, away_points: f.b_points })] ?? null;
const score = (frames) => frames.reduce((s, f) => { const w = winnerOf(f); if (w) s[w]++; return s; }, { a: 0, b: 0 });
const slotsOf = (f) => [...f.a, ...f.b];
const cue = html`<svg class="g-cue" viewBox="0 0 64 16" aria-hidden="true"><path d="M2 8.6 46 6v4L2 9.4Z" fill="#e9c98a"/><path d="M46 6l14-.8v5.6L46 10Z" fill="#5b3a1e"/><rect x="0" y="7.4" width="3" height="1.6" rx=".6" fill="#3aa0e8"/></svg>`;
const camera = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 7.2 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.2L15 4Zm3 4.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/></svg>`;

/** The view this person used last time; otherwise step-by-step on phones, classic on big screens. */
function startingView() {
  try { const v = localStorage.getItem(VIEW_KEY); if (v === "guided" || v === "classic") return v; } catch {}
  return window.matchMedia("(max-width: 760px)").matches ? "guided" : "classic";
}

/**
 * opts: {
 *   el, subtitle, when, venue, notice (html or () => html, shown above the card),
 *   sides: { a: { name, team, options: [{ id, name, group? }] }, b: { … } },
 *   slots (1|2), allowExt, extUsed: Map(playerId → count before this match),
 *   unique: "match" (a player plays one frame — twice only as Ext) | "frame" (the same players every frame),
 *   handicap: (playerId) → number    — give this for handicap competitions: starts are worked out and checked,
 *   handicapMode: "difference" (the higher handicap starts on the difference) | "each" (doubles: each pair starts on its own total),
 *   runningTotal: true shows each side's total points so far (handicap matches level on frames are decided on them),
 *   frames, minFrames, preset, playerName(id), person(id) → { name, avatar_url, club },
 *   photo: { required, url: () => string | null, pick: () => void },
 *   addPlayer: { label, run: () => void },
 *   actions: [{ key, label, cls, saves?, final?, confirm?, needsPhoto?, skipChecks?, quiet?, done? }]
 *            ("saves" marks the plain save-progress action: it runs behind "Save frame" in the guided view),
 *   onSave(frames, breaks, actionKey) → Promise
 * }
 * Returns { destroy(), redraw() }.
 */
export function scorecardEditor(opts) {
  const { el, sides, slots = 1, allowExt = false, extUsed = new Map(), playerName, unique = "match" } = opts;
  const person = opts.person ?? ((id) => ({ name: playerName(id), avatar_url: "", club: "" }));
  const samePlayers = unique === "frame";           // singles & doubles: one line-up for the whole match
  const hcap = opts.handicap ? (id) => Number(opts.handicap(id)) || 0 : null;
  const eachStart = opts.handicapMode === "each";
  const frames = opts.frames.length ? opts.frames : [];
  const lineUp = () => { const last = frames.at(-1); return samePlayers && last ? { a: last.a.map((s) => s.player_id), b: last.b.map((s) => s.player_id) } : opts.preset; };
  const addFrame = () => frames.push(blankFrame(frames.length + 1, slots, lineUp()));
  while (frames.length < (opts.minFrames ?? RULES.framesPerMatch)) addFrame();
  let dirty = false;
  let view = startingView();
  const allPicked = () => frames.every((f) => slotsOf(f).every((s) => s.player_id));
  const firstOpen = () => frames.findIndex((f) => !winnerOf(f));
  const startStep = () => (!allPicked() ? "players" : firstOpen() < 0 ? "finish" : firstOpen());
  let step = startStep();   // guided view: "players", a frame index or "finish"
  const saveAction = opts.actions.find((a) => a.saves);
  const finalActions = opts.actions.filter((a) => !a.saves);
  const label = (a) => (typeof a.label === "function" ? a.label() : a.label);

  // ── handicap starts ────────────────────────────────────────
  /** What each side starts a frame on — { a, b } — only once every player in it is known. */
  const startOf = (f) => (hcap && slotsOf(f).every((s) => s.player_id)
    ? handicapStarts(f.a.map((s) => hcap(s.player_id)), f.b.map((s) => hcap(s.player_id)), opts.handicapMode) : { a: 0, b: 0 });
  const startFor = (f, side) => startOf(f)[side];
  /** Doubles show every pair's start (even 0); otherwise only the side that gets one. */
  const showsStart = (f, side) => (eachStart ? !!hcap && slotsOf(f).every((s) => s.player_id) : startFor(f, side) !== 0);
  const startText = (n) => (eachStart ? handicapText(n) : n);
  // A pair that starts below zero can finish a frame below zero, so doubles handicap scores may be negative.
  const pointAttrs = html([eachStart ? 'min="-200" max="300"' : 'min="0" max="200" inputmode="numeric"']);
  /** Total points so far for each side (frame scores as entered, so handicap starts are in). */
  const totals = () => frames.reduce((t, f) => ({ a: t.a + (Number(f.a_points) || 0), b: t.b + (Number(f.b_points) || 0) }), { a: 0, b: 0 });
  const totalsLine = () => (opts.runningTotal ? html`<p class="sc-totals">Running total (points): ${sides.a.name} <b data-total-a>${totals().a}</b> v <b data-total-b>${totals().b}</b> ${sides.b.name}
    <small>If the match finishes level on frames, the higher total wins.</small></p>` : "");

  // ── who can still be picked ────────────────────────────────
  /** Why this choice isn't allowed in frame i (text), or "" when it's fine. */
  function clash(i, side, j, id, ext) {
    const here = frames[i];
    for (const sd of ["a", "b"]) for (let k = 0; k < here[sd].length; k++)
      if (!(sd === side && k === j) && here[sd][k].player_id === id) return "already in this frame";
    if (samePlayers) return "";
    for (let n = 0; n < frames.length; n++) {
      if (n === i) continue;
      if (slotsOf(frames[n]).some((s) => s.player_id === id && !!s.ext === !!ext)) return `already playing in frame ${frames[n].frame_no}`;
    }
    return "";
  }

  // ── shared pieces ──────────────────────────────────────────
  const optionName = (o) => (hcap ? `${o.name} (${handicapText(hcap(o.id))})` : o.name);
  const playerOptions = (i, side, j) => {
    const slot = frames[i][side][j];
    const groups = new Map();
    for (const o of sides[side].options) (groups.get(o.group ?? "") ?? groups.set(o.group ?? "", []).get(o.group ?? "")).push(o);
    const opt = (o, ext) => {
      const selected = slot.player_id === o.id && !!slot.ext === ext;
      const taken = !selected && clash(i, side, j, o.id, ext);
      return html`<option value="${ext ? `${o.id}|ext` : o.id}" ${selected ? "selected" : ""} ${taken ? "disabled" : ""}>${optionName(o)}${ext ? " (Ext)" : ""}${taken ? ` — ${taken}` : ""}</option>`;
    };
    const list = (items) => html`${items.map((o) => opt(o, false))}${allowExt ? items.map((o) => opt(o, true)) : ""}`;
    return html`<option value="">– player –</option>${[...groups].map(([g, items]) => (g ? html`<optgroup label="${g}">${list(items)}</optgroup>` : list(items)))}`;
  };
  const picker = (f, i, side, j) => html`<select data-i="${i}" data-side="${side}" data-j="${j}" data-k="player" aria-label="${sides[side].name} player, frame ${f.frame_no}">${playerOptions(i, side, j)}</select>`;
  const frameButtons = () => html`<div class="btn-row sc-frame-btns"><button type="button" class="btn small ghost" data-add-frame>+ Add frame</button>
    ${frames.length > 1 ? html`<button type="button" class="btn small ghost" data-remove-frame>Remove last frame</button>` : ""}</div>`;
  const addPlayerButton = () => (opts.addPlayer ? html`<button type="button" class="btn small ghost" data-add-player>${opts.addPlayer.label}</button>` : "");
  const help = () => html`<details class="sc-help"><summary>Help: breaks${allowExt ? ", Ext players" : ""}${hcap ? ", handicap starts" : ""}</summary>
    <p>${view === "classic" ? html`Type each break in the small box next to the player, e.g. <b>34, 41</b>.` : "A player can have more than one break in a frame — add each one."}
      Break points: ${RULES.breakMinimum}–39 = 3, 40–49 = 4 … 140+ = ${RULES.maxBreakPoints}. The highest possible break is ${MAX_BREAK}.</p>
    ${allowExt ? html`<p>A player picked as “(Ext)” is playing a second frame as the team's extra player — allowed ${EXT_PER_SEASON} time${EXT_PER_SEASON > 1 ? "s" : ""} a season. Otherwise each player can only be picked once.</p>` : ""}
    ${hcap ? html`<p>${eachStart
      ? "Handicap doubles: each pair's two handicaps are added together, and that total is what the pair starts every frame on (+20 and -14 start on 6). Enter the scores as they finish on the scoreboard, start included — a pair that starts on 6 and scores 85 has a frame score of 91."
      : "Handicap match: the side with the higher handicap starts each frame with the difference already on the board. Enter the scores as they finish on the scoreboard, start included."}</p>` : ""}
  </details>`;
  const photoBlock = () => {
    if (!opts.photo) return "";
    const url = opts.photo.url();
    return html`<div class="sc-photo-box ${url ? "ok" : ""}">
      ${url ? html`<a class="sc-photo-thumb" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Photo of the paper scorecard"></a>` : html`<span class="sc-photo-icon">${camera}</span>`}
      <div><strong>${url ? "✓ Scorecard photo uploaded" : "Photo of the paper scorecard"}</strong>
        <small>${url ? "Tap the picture to check it." : opts.photo.required ? "Needed before the result can be submitted." : "Optional."}</small></div>
      <button type="button" class="btn ${url ? "small ghost" : "secondary"}" data-photo-pick>${url ? "Replace" : "Take or upload photo"}</button>
    </div>`;
  };
  const actionButtons = (list) => html`${list.map((a) => html`<button type="button" class="btn ${a.cls ?? ""}" data-action="${a.key}">${label(a)}</button>`)}`;

  // ── classic view: the whole card as a table ────────────────
  const sideCells = (f, i, side) => html`<td class="sc-players">${f[side].map((slot, j) => html`<div class="sc-slot">
      ${picker(f, i, side, j)}
      <input class="sc-breaks" data-i="${i}" data-side="${side}" data-j="${j}" data-k="breaks" value="${slot.breaks}" placeholder="breaks" inputmode="numeric" aria-label="Breaks, e.g. 34, 41">
    </div>`)}${showsStart(f, side) ? html`<small class="sc-start">starts on ${startText(startFor(f, side))}</small>` : ""}</td>
    <td class="sc-points"><input type="number" ${pointAttrs} data-i="${i}" data-k="${side}_points" value="${f[`${side}_points`] ?? ""}" aria-label="Points"></td>`;
  const classicBody = () => html`
    ${opts.photo || opts.addPlayer ? html`<div class="sc-tools">${photoBlock()}${addPlayerButton()}</div>` : ""}
    <table class="sc-table">
      <thead><tr><th>Player</th><th>Points</th><th class="sc-no">#</th><th>Player</th><th>Points</th></tr></thead>
      <tbody>${frames.map((f, i) => html`<tr data-row="${i}">
        ${sideCells(f, i, "a")}<td class="sc-no">${f.frame_no}</td>${sideCells(f, i, "b")}</tr>`)}</tbody>
      ${opts.runningTotal ? html`<tfoot><tr class="sc-total-row"><td>Running total</td><td class="sc-points"><b data-total-a>${totals().a}</b></td><td class="sc-no">=</td><td>Running total</td><td class="sc-points"><b data-total-b>${totals().b}</b></td></tr></tfoot>` : ""}
    </table>${opts.runningTotal ? html`<p class="sc-totals"><small>Total points, handicap starts included. If the match finishes level on frames, the higher total wins.</small></p>` : ""}${frameButtons()}`;

  // ── guided view ────────────────────────────────────────────
  // Three steps across the top; the frame numbers appear under them while scoring.
  const frameTarget = () => (firstOpen() < 0 ? 0 : firstOpen());
  const steps = () => html`<div class="g-steps" role="tablist">
    <button type="button" class="${step === "players" ? "on" : ""} ${allPicked() ? "done" : ""}" data-go="players"><b>1</b> Players</button>
    <button type="button" class="${typeof step === "number" ? "on" : ""} ${firstOpen() < 0 ? "done" : ""}" data-go="${frameTarget()}"><b>2</b> Frames</button>
    <button type="button" class="${step === "finish" ? "on" : ""}" data-go="finish"><b>3</b> Finish</button></div>`;
  const tabs = () => html`<div class="g-tabs">
    ${frames.map((x, j) => html`<button type="button" class="g-tab ${j === step ? "on" : ""} ${winnerOf(x) ? "done" : ""}" data-go="${j}" aria-label="Frame ${x.frame_no}">${x.frame_no}</button>`)}
    <button type="button" class="g-tab add" data-add-frame data-then-go aria-label="Add another frame" title="Add another frame">+</button></div>`;

  const playersStep = () => html`<div class="g-step">
    <h3 class="g-h"><span>1</span> Pick ${samePlayers ? "the players" : "your players"}</h3>
    <p class="muted">${samePlayers ? "Choose who is playing — they stay the same for every frame." : "Choose who plays each frame. You can come back and change this at any time."}</p>
    <div class="g-pick g-pick-head"><span></span><b>${sides.a.name}</b><b>${sides.b.name}</b></div>
    ${(samePlayers ? frames.slice(0, 1) : frames).map((f, i) => html`<div class="g-pick ${samePlayers ? "one" : ""}"><span class="g-no">${samePlayers ? "" : f.frame_no}</span>
      <div>${f.a.map((_, j) => picker(f, i, "a", j))}</div><div>${f.b.map((_, j) => picker(f, i, "b", j))}</div></div>`)}
    ${samePlayers ? "" : frameButtons()}
    ${opts.addPlayer ? html`<div class="g-extra">${addPlayerButton()}<small class="muted">Someone new? Add them, then pick them above.</small></div>` : ""}
    <button type="button" class="btn green g-wide" data-go="${firstOpen() < 0 ? "finish" : firstOpen()}">Next: score the match →</button>
  </div>`;

  const breakChips = (f, i, side, j) => {
    const list = parseBreaks(f[side][j].breaks) ?? [];
    const who = slots > 1 && f[side][j].player_id ? ` – ${person(f[side][j].player_id).name}` : "";
    return html`<div class="g-breaks"><span class="g-breaks-label">Breaks${who}</span>
      ${list.map((v, k) => html`<span class="chip">${v}${breakPoints(v) ? html` <small>+${breakPoints(v)}</small>` : ""}<button type="button" data-del-break="${side}:${j}:${k}" aria-label="Remove break of ${v}">×</button></span>`)}
      <span class="g-break-add"><input type="number" min="1" max="${MAX_BREAK}" inputmode="numeric" placeholder="e.g. 34" data-break-input="${side}:${j}" aria-label="Break">
        <button type="button" class="btn small ghost" data-add-break="${side}:${j}">+ Add break</button></span></div>`;
  };
  const card = (f, i, side) => html`<div class="g-card" data-card="${side}">
    <div class="g-people">${f[side].map((slot) => {
      if (!slot.player_id) return html`<button type="button" class="g-person empty" data-go="players"><span class="avatar"></span><span><strong>Pick a player</strong><small>${sides[side].name}</small></span></button>`;
      const p = person(slot.player_id);
      return html`<div class="g-person"><img class="avatar" src="${p.avatar_url || "/assets/avatar.svg"}" alt="">
        <span><strong>${p.name}${slot.ext ? html` <span class="ext-tag">Ext</span>` : ""}</strong>
          <small>${p.club || sides[side].name}${hcap ? ` · handicap ${handicapText(hcap(slot.player_id))}` : ""}</small></span></div>`;
    })}</div>
    ${cue}
    <label class="g-points">Frame score<input type="number" ${pointAttrs} data-i="${i}" data-k="${side}_points" value="${f[`${side}_points`] ?? ""}" placeholder="${showsStart(f, side) ? startFor(f, side) : ""}"></label>
    ${showsStart(f, side) ? html`<div class="g-start">Starts on <b>${startText(startFor(f, side))}</b> (${eachStart ? "the pair's handicaps added together" : "handicap"})</div>` : ""}
    ${f[side].map((_, j) => breakChips(f, i, side, j))}
  </div>`;
  const frameStep = (i) => {
    const f = frames[i];
    return html`<div class="g-step">
      ${tabs()}
      <div class="g-frame" data-frame="${i}">
        <div class="g-frame-head">Frame ${f.frame_no} of ${frames.length}</div>
        ${card(f, i, "a")}<div class="g-vs">v</div>${card(f, i, "b")}
      </div>
      ${totalsLine()}
      <div class="g-nav">
        <button type="button" class="btn ghost" data-go="${i === 0 ? "players" : i - 1}">‹ Back</button>
        <button type="button" class="btn green" data-save-frame>Save frame</button>
        <button type="button" class="btn ghost" data-go="${i === frames.length - 1 ? "finish" : i + 1}">Skip ›</button>
      </div>
    </div>`;
  };
  const names = (f, side) => f[side].map((s) => (s.player_id ? person(s.player_id).name : "–")).join(" & ");
  const finishStep = () => {
    const s = score(frames), left = frames.filter((f) => !winnerOf(f)).length;
    return html`<div class="g-step">
      <h3 class="g-h"><span>3</span> Finish</h3>
      <div class="g-sum">${frames.map((f, i) => { const w = winnerOf(f); return html`<button type="button" class="g-sum-row ${w ? "" : "open"}" data-go="${i}">
        <span class="g-no">${f.frame_no}</span>
        <span class="${w === "a" ? "won" : ""}">${names(f, "a")}</span>
        <b>${f.a_points ?? "–"} – ${f.b_points ?? "–"}</b>
        <span class="${w === "b" ? "won" : ""}">${names(f, "b")}</span></button>`; })}</div>
      <p class="g-total">${sides.a.name} <b>${s.a} – ${s.b}</b> ${sides.b.name}${left ? html`<small>${left} frame${left > 1 ? "s" : ""} not scored yet — tap a frame to fill it in.</small>` : ""}</p>
      ${totalsLine()}
      ${photoBlock()}
      <div class="g-final">${actionButtons(finalActions)}</div>
    </div>`;
  };

  // ── drawing ────────────────────────────────────────────────
  /** Update the running score and "who's ahead" marks without redrawing (keeps the keyboard open). */
  function drawScore() {
    const s = score(frames);
    $("[data-run-a]", el).textContent = s.a;
    $("[data-run-b]", el).textContent = s.b;
    if (opts.runningTotal) { const t = totals(); for (const k of ["a", "b"]) for (const x of el.querySelectorAll(`[data-total-${k}]`)) x.textContent = t[k]; }
    frames.forEach((f, i) => {
      const w = winnerOf(f);
      const row = $(`[data-row="${i}"]`, el);
      row?.classList.toggle("won-a", w === "a");
      row?.classList.toggle("won-b", w === "b");
    });
    const shown = $("[data-frame]", el);
    if (shown) {
      const w = winnerOf(frames[Number(shown.dataset.frame)]);
      for (const side of ["a", "b"]) $(`[data-card="${side}"]`, shown).classList.toggle("ahead", w === side);
    }
  }
  function drawBody() {
    const guided = () => html`${steps()}${step === "players" ? playersStep() : step === "finish" ? finishStep() : frameStep(step)}`;
    mount($("[data-body]", el), view === "classic" ? classicBody() : guided());
    drawScore();
  }
  const teamHead = (k) => html`<div class="sc-team">
    <div class="sc-team-name">${sides[k].name}</div>
    ${sides[k].team ? html`<div class="sc-emblem">${badge(sides[k].team)}</div>` : ""}
    <div class="sc-run" data-run-${k}>0</div></div>`;

  function draw() {
    mount(el, html`<div class="sc-card view-${view}" id="sc">
      <h1 class="sc-title">Update ${html`<span>${sides.a.name}</span>`} vs. ${html`<span>${sides.b.name}</span>`} scores</h1>
      <div class="sc-band">${opts.subtitle}${opts.when ? ` - ${fmtDate(opts.when)}` : ""}</div>
      <div class="sc-head">
        ${teamHead("a")}
        <div class="sc-v"><b>V</b>${opts.when ? html`<span>${fmtTime(opts.when)}</span>` : ""}${opts.venue ? html`<span>${opts.venue}</span>` : ""}</div>
        ${teamHead("b")}
      </div>
      ${typeof opts.notice === "function" ? opts.notice() : opts.notice ?? ""}
      <div class="sc-views" role="group" aria-label="Scorecard view"><span>Scorecard view:</span>
        <button type="button" class="${view === "guided" ? "on" : ""}" data-view="guided">Step by step</button>
        <button type="button" class="${view === "classic" ? "on" : ""}" data-view="classic">Classic card</button></div>
      <div class="sc-frames" data-body></div>
      <div data-errors></div>
      ${view === "classic" ? html`<div class="btn-row sc-actions">${actionButtons(opts.actions)}</div>` : ""}
      ${help()}
    </div>`);
    drawBody();
  }
  draw();

  // ── events (on the editor's own element, so they go when the page does) ──
  const goTo = (target) => {
    if (target === "players" || target === "finish") step = target;
    else step = Math.max(0, Math.min(frames.length - 1, Number(target)));
    mount($("[data-errors]", el), "");
    drawBody();
    $(".sc-views", el)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const slotAt = (ref) => { const [side, j] = ref.split(":"); return frames[step][side][Number(j)]; };
  function addBreak(ref) {
    const input = $(`[data-break-input="${ref}"]`, el);
    const v = Number(input.value);
    if (!Number.isInteger(v) || v < 1 || v > MAX_BREAK) return toast(`A break is a whole number from 1 to ${MAX_BREAK}`, "error");
    const slot = slotAt(ref);
    slot.breaks = [...(parseBreaks(slot.breaks) ?? []), v].join(", ");
    dirty = true; drawBody();
    $(`[data-break-input="${ref}"]`, el)?.focus();
  }

  el.addEventListener("input", (e) => {
    const { i, k, side: sd, j } = e.target.dataset;
    if (i === undefined) return;
    const f = frames[Number(i)];
    dirty = true;
    if (k === "player") {
      const [id, ext] = e.target.value.split("|");
      Object.assign(f[sd][Number(j)], { player_id: id || null, ext: ext === "ext" });
      // Singles and doubles: the same line-up plays every frame.
      if (samePlayers) for (const other of frames) Object.assign(other[sd][Number(j)], { player_id: id || null, ext: false });
      return drawBody();   // the other lists need to grey this player out
    }
    if (k === "breaks") f[sd][Number(j)].breaks = e.target.value;
    else f[k] = e.target.value === "" ? null : Number(e.target.value);
    drawScore();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("[data-break-input]")) { e.preventDefault(); addBreak(e.target.dataset.breakInput); }
  });
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t || !el.contains(t)) return;
    if (t.matches("[data-view]")) {
      view = t.dataset.view;
      try { localStorage.setItem(VIEW_KEY, view); } catch {}
      if (view === "guided") step = startStep();
      return draw();
    }
    if (t.matches("[data-photo-pick]")) return opts.photo.pick();
    if (t.matches("[data-add-player]")) return opts.addPlayer.run();
    if (t.matches("[data-add-frame]")) {
      addFrame(); dirty = true;
      if ("thenGo" in t.dataset) return goTo(slotsOf(frames.at(-1)).every((s) => s.player_id) ? frames.length - 1 : "players");
      return drawBody();
    }
    if (t.matches("[data-remove-frame]") && frames.length > 1) {
      frames.pop(); dirty = true;
      if (typeof step === "number") step = Math.min(step, frames.length - 1);
      return drawBody();
    }
    if (t.dataset.go !== undefined) return goTo(t.dataset.go);
    if (t.dataset.addBreak) return addBreak(t.dataset.addBreak);
    if (t.dataset.delBreak) {
      const [side, j, k] = t.dataset.delBreak.split(":");
      const slot = frames[step][side][Number(j)];
      const list = parseBreaks(slot.breaks) ?? [];
      list.splice(Number(k), 1);
      slot.breaks = list.join(", "); dirty = true;
      return drawBody();
    }
    if (t.matches("[data-save-frame]")) {
      const now = frames[step];
      if (now.a_points == null || now.b_points == null) return toast("Enter both frame scores first — or press Skip to leave this frame for later.", "error");
      if (!(await run(saveAction, t, `Frame ${now.frame_no} saved`))) return;
      const next = firstOpen();
      if (next < 0) toast(opts.photo?.required && !opts.photo.url() ? "All frames are in — now add the scorecard photo." : "All frames are in — finish when you're ready.");
      return goTo(next < 0 ? "finish" : next);
    }
    const action = opts.actions.find((a) => a.key === t.dataset.action);
    if (action) await run(action, t);
  });

  // ── checks and saving ──────────────────────────────────────
  function validate(final) {
    const errors = [];
    const extNow = new Map();
    frames.forEach((f, i) => {
      const used = slotsOf(f).some((s) => s.player_id || s.breaks) || f.a_points != null || f.b_points != null;
      if (!used && !final) return;
      // The same player can't be picked twice (apart from one frame as Ext).
      for (const sd of ["a", "b"]) f[sd].forEach((s, j) => {
        const why = s.player_id && clash(i, sd, j, s.player_id, s.ext);
        if (why && !errors.some((x) => x.startsWith(`${playerName(s.player_id)} is picked`)))
          errors.push(`${playerName(s.player_id)} is picked more than once (${why})${allowExt ? " — pick them as “(Ext)” if they are playing a second frame as the extra player." : "."}`);
      });
      const scored = f.a_points != null || f.b_points != null || slotsOf(f).some((s) => s.breaks);
      if (!scored && !final) { // players picked for a frame that hasn't been played yet
        for (const s of slotsOf(f)) if (s.ext && s.player_id) extNow.set(s.player_id, (extNow.get(s.player_id) ?? 0) + 1);
        return;
      }
      if (!scored && samePlayers) return;   // spare frame rows in a "best of" match aren't an error
      if (slotsOf(f).some((s) => !s.player_id)) errors.push(`Frame ${f.frame_no}: choose all the players.`);
      if (f.a_points == null || f.b_points == null) errors.push(`Frame ${f.frame_no}: enter both scores.`);
      else if (f.a_points === f.b_points) errors.push(`Frame ${f.frame_no}: a frame can't be tied.`);
      for (const sd of ["a", "b"]) {
        let total = 0;
        for (const s of f[sd]) {
          const values = parseBreaks(s.breaks);
          if (values === null) errors.push(`Frame ${f.frame_no}: breaks must be whole numbers from 1 to ${MAX_BREAK}, separated by commas.`);
          else total += values.reduce((n, v) => n + v, 0);
          if (s.ext && s.player_id) extNow.set(s.player_id, (extNow.get(s.player_id) ?? 0) + 1);
        }
        const pts = f[`${sd}_points`], start = startFor(f, sd);
        if (pts != null && start && pts < start) errors.push(`Frame ${f.frame_no}: ${sides[sd].name} started on ${startText(start)} (handicap), so their score can't be less than ${start}.`);
        // Every break is part of the frame score (less any handicap start), so together they can't be more than it.
        else if (pts != null && total > pts - start) errors.push(`Frame ${f.frame_no}: ${sides[sd].name}'s breaks add up to ${total}, which is more than ${start ? `the ${pts - start} they scored (${pts} ${start > 0 ? `less the ${start} start` : `plus the ${-start} they started behind`})` : `their frame score of ${pts}`}.`);
      }
    });
    for (const [pid, n] of extNow) {
      if ((extUsed.get(pid) ?? 0) + n > EXT_PER_SEASON)
        errors.push(`${playerName(pid)} has already played as the extra (Ext) player ${extUsed.get(pid) ?? 0} time(s) this season — only ${EXT_PER_SEASON} allowed.`);
    }
    return errors;
  }

  /** Check, then hand the scorecard to the page to save. Returns true if it worked. */
  async function run(action, btn, doneText = action.done ?? "Saved") {
    const errors = action.skipChecks ? [] : validate(action.final);
    if (action.needsPhoto && opts.photo?.required && !opts.photo.url())
      errors.push("Take a photo of the paper scorecard and upload it first — a result can't be submitted without it.");
    mount($("[data-errors]", el), errors.length ? html`<div class="notice error">${errors.map((x) => html`<div>${x}</div>`)}</div>` : "");
    if (errors.length) { toast("Please fix the scorecard first", "error"); $("[data-errors]", el).scrollIntoView({ block: "center", behavior: "smooth" }); return false; }
    if (action.confirm && !(await confirmBox(action.confirm, { ok: label(action), title: action.confirmTitle ?? "" }))) return false;
    btn.disabled = true;
    try {
      // Only frames with something entered are saved, renumbered 1, 2, 3…
      // (When the line-up is the same every frame, an unplayed spare frame isn't saved.)
      const entered = (f) => f.a_points != null || f.b_points != null || slotsOf(f).some((s) => s.breaks);
      let kept = frames.filter((f) => (samePlayers ? entered(f) : entered(f) || slotsOf(f).some((s) => s.player_id)));
      if (samePlayers && !kept.length && slotsOf(frames[0]).some((s) => s.player_id)) kept = [frames[0]];   // remember the line-up
      kept = kept.map((f, idx) => ({ ...f, frame_no: idx + 1 }));
      const breaks = kept.flatMap((f) => ["a", "b"].flatMap((sd) => f[sd].flatMap((s) =>
        (parseBreaks(s.breaks) ?? []).map((value) => ({ frame_no: f.frame_no, player_id: s.player_id, value })))));
      await opts.onSave(kept, breaks, action.key);
      if (!action.quiet) {
        dirty = false;
        const pts = breaks.filter((b) => breakPoints(b.value)).length;
        toast(`${doneText}${pts && doneText === (action.done ?? "Saved") ? ` · ${pts} scoring break${pts > 1 ? "s" : ""}` : ""}`);
      }
      return true;
    } catch (err) {
      toast(err.message, "error");
      return false;
    } finally { btn.disabled = false; }
  }

  const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", warn);
  return { destroy: () => window.removeEventListener("beforeunload", warn), redraw: draw };
}

/** Group saved breaks onto the editor's slots as "34, 41" text. */
export function breaksText(breaks, frameNo, playerId) {
  return breaks.filter((b) => b.frame_no === frameNo && b.player_id === playerId).map((b) => b.value).join(", ");
}
