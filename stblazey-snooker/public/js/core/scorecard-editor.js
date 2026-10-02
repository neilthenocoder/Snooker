// ─────────────────────────────────────────────────────────────
//  SCORECARD EDITOR — one editor for league matches and cup
//  matches (singles, doubles and teams), with two views of the
//  same scorecard:
//    • "guided"  – step by step, made for phones: pick the players,
//                  then score one frame at a time
//    • "classic" – the whole card in one table
//  The page that uses it converts its own rows to/from this shape:
//
//    { frame_no, a_points, b_points,
//      a: [{ player_id, ext, breaks: "34, 41" }, …],   // 1 slot, or 2 for doubles
//      b: [{ … }] }
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, fmtDate, fmtTime } from "./dom.js";
import { badge } from "./components.js";
import { frameWinner, parseBreaks, breakPoints, RULES, EXT_PER_SEASON, MAX_BREAK } from "./rules.js";

const VIEW_KEY = "sbdsl-scorecard-view";
const blankSlot = () => ({ player_id: null, ext: false, breaks: "" });
export const blankFrame = (frame_no, slots = 1, preset = {}) => ({
  frame_no, a_points: null, b_points: null,
  a: Array.from({ length: slots }, (_, i) => ({ ...blankSlot(), player_id: preset.a?.[i] ?? null })),
  b: Array.from({ length: slots }, (_, i) => ({ ...blankSlot(), player_id: preset.b?.[i] ?? null })),
});

const winnerOf = (f) => ({ home: "a", away: "b" })[frameWinner({ home_points: f.a_points, away_points: f.b_points })] ?? null;
const score = (frames) => frames.reduce((s, f) => { const w = winnerOf(f); if (w) s[w]++; return s; }, { a: 0, b: 0 });
const slotsOf = (f) => [...f.a, ...f.b];
const cue = html`<svg class="g-cue" viewBox="0 0 64 16" aria-hidden="true"><path d="M2 8.6 46 6v4L2 9.4Z" fill="#e9c98a"/><path d="M46 6l14-.8v5.6L46 10Z" fill="#5b3a1e"/><rect x="0" y="7.4" width="3" height="1.6" rx=".6" fill="#3aa0e8"/></svg>`;

/** The view this person used last time; otherwise step-by-step on phones, classic on big screens. */
function startingView() {
  try { const v = localStorage.getItem(VIEW_KEY); if (v === "guided" || v === "classic") return v; } catch {}
  return window.matchMedia("(max-width: 760px)").matches ? "guided" : "classic";
}

/**
 * opts: {
 *   el, subtitle, when, venue, notice (html or () => html),
 *   sides: { a: { name, team, options: [{ id, name, group? }] }, b: { … } },
 *   slots (1|2), allowExt, extUsed: Map(playerId → count before this match),
 *   frames, minFrames, preset, playerName(id), person(id) → { name, avatar_url, club },
 *   photo: { required, url: () => string | null },
 *   actions: [{ key, label (text or () => text), cls, final?, confirm?, needsPhoto?, skipChecks?, quiet?, guided? }],
 *   extra (html under the buttons), onSave(frames, breaks, action) → Promise
 * }
 * Returns { destroy(), redraw() }.
 */
export function scorecardEditor(opts) {
  const { el, sides, slots = 1, allowExt = false, extUsed = new Map(), playerName } = opts;
  const person = opts.person ?? ((id) => ({ name: playerName(id), avatar_url: "", club: "" }));
  const frames = opts.frames.length ? opts.frames : [];
  while (frames.length < (opts.minFrames ?? RULES.framesPerMatch)) frames.push(blankFrame(frames.length + 1, slots, opts.preset));
  let dirty = false;
  let view = startingView();
  const allPicked = () => frames.every((f) => slotsOf(f).every((s) => s.player_id));
  const firstOpen = () => { const i = frames.findIndex((f) => !winnerOf(f)); return i < 0 ? frames.length - 1 : i; };
  let step = allPicked() ? firstOpen() : "players";   // guided view: "players" or a frame index

  // ── shared pieces ──────────────────────────────────────────
  const playerOptions = (side, slot) => {
    const groups = new Map();
    for (const o of sides[side].options) (groups.get(o.group ?? "") ?? groups.set(o.group ?? "", []).get(o.group ?? "")).push(o);
    const opt = (o, ext) => {
      const selected = slot.player_id === o.id && !!slot.ext === ext;
      return html`<option value="${ext ? `${o.id}|ext` : o.id}" ${selected ? "selected" : ""}>${o.name}${ext ? " (Ext)" : ""}</option>`;
    };
    const list = (items) => html`${items.map((o) => opt(o, false))}${allowExt ? items.map((o) => opt(o, true)) : ""}`;
    return html`<option value="">– player –</option>${[...groups].map(([g, items]) => (g ? html`<optgroup label="${g}">${list(items)}</optgroup>` : list(items)))}`;
  };
  const picker = (f, i, side, j) => html`<select data-i="${i}" data-side="${side}" data-j="${j}" data-k="player" aria-label="${sides[side].name} player, frame ${f.frame_no}">${playerOptions(side, f[side][j])}</select>`;
  const frameButtons = html`<div class="btn-row sc-frame-btns"><button type="button" class="btn small ghost" data-add-frame>+ Add frame</button>
    ${frames.length > 1 ? html`<button type="button" class="btn small ghost" data-remove-frame>Remove last frame</button>` : ""}</div>`;

  // ── classic view: the whole card as a table ────────────────
  const sideCells = (f, i, side) => html`<td class="sc-players">${f[side].map((slot, j) => html`<div class="sc-slot">
      ${picker(f, i, side, j)}
      <input class="sc-breaks" data-i="${i}" data-side="${side}" data-j="${j}" data-k="breaks" value="${slot.breaks}" placeholder="breaks" inputmode="numeric" aria-label="Breaks, e.g. 34, 41">
    </div>`)}</td>
    <td class="sc-points"><input type="number" min="0" max="200" inputmode="numeric" data-i="${i}" data-k="${side}_points" value="${f[`${side}_points`] ?? ""}" aria-label="Points"></td>`;
  const classicBody = () => html`<table class="sc-table">
      <thead><tr><th>Player</th><th>Points</th><th class="sc-no">#</th><th>Player</th><th>Points</th></tr></thead>
      <tbody>${frames.map((f, i) => html`<tr data-row="${i}">
        ${sideCells(f, i, "a")}<td class="sc-no">${f.frame_no}</td>${sideCells(f, i, "b")}</tr>`)}</tbody>
    </table>${frameButtons}`;

  // ── guided view: pick players, then one frame at a time ────
  const playersStep = () => html`<div class="g-step">
    <h3 class="g-h"><span>1</span> Pick your players</h3>
    <p class="muted">Choose who plays each frame. You can come back and change this at any time.</p>
    <div class="g-pick g-pick-head"><span></span><b>${sides.a.name}</b><b>${sides.b.name}</b></div>
    ${frames.map((f, i) => html`<div class="g-pick"><span class="g-no">${f.frame_no}</span>
      <div>${f.a.map((_, j) => picker(f, i, "a", j))}</div><div>${f.b.map((_, j) => picker(f, i, "b", j))}</div></div>`)}
    ${frameButtons}
    <button type="button" class="btn green g-wide" data-go="${firstOpen()}">Next: score the match →</button>
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
        <span><strong>${p.name}${slot.ext ? html` <span class="ext-tag">Ext</span>` : ""}</strong><small>${p.club || sides[side].name}</small></span></div>`;
    })}</div>
    ${cue}
    <label class="g-points">Frame score<input type="number" min="0" max="200" inputmode="numeric" data-i="${i}" data-k="${side}_points" value="${f[`${side}_points`] ?? ""}"></label>
    ${f[side].map((_, j) => breakChips(f, i, side, j))}
  </div>`;
  const frameStep = (i) => {
    const f = frames[i];
    return html`<div class="g-step">
      <div class="g-tabs" role="tablist">${frames.map((x, j) => html`<button type="button" class="g-tab ${j === i ? "on" : ""} ${winnerOf(x) ? "done" : ""}" data-go="${j}" aria-label="Frame ${x.frame_no}">${x.frame_no}</button>`)}
        <button type="button" class="g-tab wide" data-go="players">Players</button></div>
      <div class="g-frame" data-frame="${i}">
        <div class="g-frame-head">Frame ${f.frame_no} of ${frames.length}</div>
        ${card(f, i, "a")}<div class="g-vs">v</div>${card(f, i, "b")}
      </div>
      <div class="g-nav">
        <button type="button" class="btn ghost" data-go="${i - 1}" ${i === 0 ? "disabled" : ""}>‹ Back</button>
        <button type="button" class="btn green" data-save-frame>Save frame</button>
        <button type="button" class="btn ghost" data-go="${i + 1}" ${i === frames.length - 1 ? "disabled" : ""}>Skip ›</button>
      </div>
    </div>`;
  };

  // ── drawing ────────────────────────────────────────────────
  /** Update the running score and "who's ahead" marks without redrawing (keeps the keyboard open). */
  function drawScore() {
    const s = score(frames);
    $("[data-run-a]", el).textContent = s.a;
    $("[data-run-b]", el).textContent = s.b;
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
    mount($("[data-body]", el), view === "classic" ? classicBody() : step === "players" ? playersStep() : frameStep(step));
    drawScore();
  }
  const teamHead = (k) => html`<div class="sc-team">
    <div class="sc-team-name">${sides[k].name}</div>
    ${sides[k].team ? html`<div class="sc-emblem">${badge(sides[k].team)}</div>` : ""}
    <div class="sc-run" data-run-${k}>0</div></div>`;
  const label = (a) => (typeof a.label === "function" ? a.label() : a.label);

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
      <div class="btn-row sc-actions">${opts.actions.filter((a) => view === "classic" || a.guided !== false).map((a) => html`<button type="button" class="btn ${a.cls ?? ""}" data-action="${a.key}">${label(a)}</button>`)}</div>
      ${opts.extra ?? ""}
      <div class="sc-warn orange">Please be certain the scores are correct and in the right columns before saving.</div>
      <div class="sc-warn red">${view === "classic" ? html`Breaks: type each break in the small box next to the player, e.g. <b>34, 41</b>. ` : "A player can have more than one break in a frame — add each one. "}
        Break points: ${RULES.breakMinimum}–39 = 3, 40–49 = 4 … 140+ = ${RULES.maxBreakPoints}.${allowExt ? ` A player picked as "(Ext)" is playing as the extra player — allowed ${EXT_PER_SEASON} time${EXT_PER_SEASON > 1 ? "s" : ""} a season.` : ""}</div>
    </div>`);
    drawBody();
  }
  draw();

  // ── events (on the editor's own element, so they go when the page does) ──
  const goTo = (target) => {
    if (target === "players") step = "players";
    else step = Math.max(0, Math.min(frames.length - 1, Number(target)));
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
    if (k === "player") {
      const [id, ext] = e.target.value.split("|");
      Object.assign(f[sd][Number(j)], { player_id: id || null, ext: ext === "ext" });
    } else if (k === "breaks") f[sd][Number(j)].breaks = e.target.value;
    else f[k] = e.target.value === "" ? null : Number(e.target.value);
    dirty = true;
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
      if (view === "guided") step = allPicked() ? firstOpen() : "players";
      return draw();
    }
    if (t.matches("[data-add-frame]")) { frames.push(blankFrame(frames.length + 1, slots, opts.preset)); dirty = true; return drawBody(); }
    if (t.matches("[data-remove-frame]") && frames.length > 1) {
      frames.pop(); dirty = true;
      if (step !== "players") step = Math.min(step, frames.length - 1);
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
      const progress = opts.actions.find((a) => a.saves);
      if (!(await run(progress, t))) return;
      const next = frames.findIndex((f) => !winnerOf(f));
      if (next < 0) {
        toast(opts.photo?.required && !opts.photo.url() ? "All frames are in — now upload the scorecard photo, then submit." : "All frames are in — submit the result when you're ready.");
        return $(".sc-actions", el).scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return goTo(next);
    }
    const action = opts.actions.find((a) => a.key === t.dataset.action);
    if (action) await run(action, t);
  });

  // ── checks and saving ──────────────────────────────────────
  function validate(final) {
    const errors = [];
    const extNow = new Map();
    for (const f of frames) {
      const used = slotsOf(f).some((s) => s.player_id || s.breaks) || f.a_points != null || f.b_points != null;
      if (!used && !final) continue;
      const scored = f.a_points != null || f.b_points != null || slotsOf(f).some((s) => s.breaks);
      if (!scored && !final) { // players picked for a frame that hasn't been played yet
        for (const s of slotsOf(f)) if (s.ext && s.player_id) extNow.set(s.player_id, (extNow.get(s.player_id) ?? 0) + 1);
        continue;
      }
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
        // Every break is part of the frame score, so together they can't be more than it.
        if (f[`${sd}_points`] != null && total > f[`${sd}_points`]) errors.push(`Frame ${f.frame_no}: ${sides[sd].name}'s breaks add up to ${total}, which is more than their frame score of ${f[`${sd}_points`]}.`);
      }
    }
    for (const [pid, n] of extNow) {
      if ((extUsed.get(pid) ?? 0) + n > EXT_PER_SEASON)
        errors.push(`${playerName(pid)} has already played as the extra (Ext) player ${extUsed.get(pid) ?? 0} time(s) this season — only ${EXT_PER_SEASON} allowed.`);
    }
    return errors;
  }

  /** Check, then hand the scorecard to the page to save. Returns true if it worked. */
  async function run(action, btn) {
    const errors = action.skipChecks ? [] : validate(action.final);
    if (action.needsPhoto && opts.photo?.required && !opts.photo.url())
      errors.push("Take a photo of the paper scorecard and upload it first — a result can't be submitted without it.");
    mount($("[data-errors]", el), errors.length ? html`<div class="notice error">${errors.map((x) => html`<div>${x}</div>`)}</div>` : "");
    if (errors.length) { toast("Please fix the scorecard first", "error"); $("[data-errors]", el).scrollIntoView({ block: "center", behavior: "smooth" }); return false; }
    if (action.confirm && !confirm(action.confirm)) return false;
    btn.disabled = true;
    try {
      // Only frames with something entered are saved, renumbered 1, 2, 3…
      const kept = frames.filter((f) => slotsOf(f).some((s) => s.player_id) || f.a_points != null || f.b_points != null)
        .map((f, idx) => ({ ...f, frame_no: idx + 1 }));
      const breaks = kept.flatMap((f) => ["a", "b"].flatMap((sd) => f[sd].flatMap((s) =>
        (parseBreaks(s.breaks) ?? []).map((value) => ({ frame_no: f.frame_no, player_id: s.player_id, value })))));
      await opts.onSave(kept, breaks, action.key);
      if (!action.quiet) {
        dirty = false;
        const pts = breaks.filter((b) => breakPoints(b.value)).length;
        toast(`${action.done ?? "Saved"}${pts ? ` · ${pts} scoring break${pts > 1 ? "s" : ""}` : ""}`);
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
