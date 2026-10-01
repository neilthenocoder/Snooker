// ─────────────────────────────────────────────────────────────
//  SCORECARD EDITOR — one editor for league matches and cup
//  matches (singles, doubles and teams). The page that uses it
//  converts its own rows to/from this simple frame shape:
//
//    { frame_no, a_points, b_points,
//      a: [{ player_id, ext, breaks: "34, 41" }, …],   // 1 slot, or 2 for doubles
//      b: [{ … }] }
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, fmtDate, fmtTime } from "./dom.js";
import { badge } from "./components.js";
import { frameWinner, parseBreaks, breakPoints, RULES, EXT_PER_SEASON } from "./rules.js";

const blankSlot = () => ({ player_id: null, ext: false, breaks: "" });
export const blankFrame = (frame_no, slots = 1, preset = {}) => ({
  frame_no, a_points: null, b_points: null,
  a: Array.from({ length: slots }, (_, i) => ({ ...blankSlot(), player_id: preset.a?.[i] ?? null })),
  b: Array.from({ length: slots }, (_, i) => ({ ...blankSlot(), player_id: preset.b?.[i] ?? null })),
});

/** Running score for the big header. */
const score = (frames) => frames.reduce((s, f) => {
  const w = frameWinner({ home_points: f.a_points, away_points: f.b_points });
  if (w) s[w === "home" ? "a" : "b"]++;
  return s;
}, { a: 0, b: 0 });

/**
 * opts: {
 *   el, title, subtitle, when, venue, notice (html, e.g. shield info),
 *   sides: { a: { name, team, options: [{ id, name, group? }] }, b: { … } },
 *   slots (1|2), allowExt, extUsed: Map(playerId → count before this match),
 *   frames, minFrames, playerName(id),
 *   actions: [{ key, label, cls, final?, confirm? }],
 *   extra (html under the buttons), onSave(frames, breaks, action) → Promise
 * }
 */
export function scorecardEditor(opts) {
  const { el, sides, slots = 1, allowExt = false, extUsed = new Map(), playerName } = opts;
  const frames = opts.frames.length ? opts.frames : [];
  while (frames.length < (opts.minFrames ?? RULES.framesPerMatch)) frames.push(blankFrame(frames.length + 1, slots, opts.preset));
  let dirty = false;

  const playerOptions = (side, slot) => {
    const groups = new Map();
    for (const o of sides[side].options) (groups.get(o.group ?? "") ?? groups.set(o.group ?? "", []).get(o.group ?? "")).push(o);
    const opt = (o, ext) => {
      const val = ext ? `${o.id}|ext` : o.id;
      const selected = slot.player_id === o.id && !!slot.ext === ext;
      return html`<option value="${val}" ${selected ? "selected" : ""}>${o.name}${ext ? " (Ext)" : ""}</option>`;
    };
    const list = (items) => html`${items.map((o) => opt(o, false))}${allowExt ? items.map((o) => opt(o, true)) : ""}`;
    return html`<option value="">– player –</option>${[...groups].map(([g, items]) => (g ? html`<optgroup label="${g}">${list(items)}</optgroup>` : list(items)))}`;
  };

  const sideCells = (f, i, side) => html`<td class="sc-players">${f[side].map((slot, j) => html`<div class="sc-slot">
      <select data-i="${i}" data-side="${side}" data-j="${j}" data-k="player">${playerOptions(side, slot)}</select>
      <input class="sc-breaks" data-i="${i}" data-side="${side}" data-j="${j}" data-k="breaks" value="${slot.breaks}" placeholder="breaks" inputmode="numeric" aria-label="Breaks, e.g. 34, 41">
    </div>`)}</td>
    <td class="sc-points"><input type="number" min="0" max="200" inputmode="numeric" data-i="${i}" data-k="${side}_points" value="${f[`${side}_points`] ?? ""}" aria-label="Points"></td>`;

  function drawScore() {
    const s = score(frames);
    $("[data-run-a]", el).textContent = s.a;
    $("[data-run-b]", el).textContent = s.b;
    frames.forEach((f, i) => {
      const w = frameWinner({ home_points: f.a_points, away_points: f.b_points });
      const row = $(`[data-row="${i}"]`, el);
      row?.classList.toggle("won-a", w === "home");
      row?.classList.toggle("won-b", w === "away");
    });
  }

  function drawFrames() {
    mount($("[data-frames]", el), html`<table class="sc-table">
      <thead><tr><th>Player</th><th>Points</th><th class="sc-no">#</th><th>Player</th><th>Points</th></tr></thead>
      <tbody>${frames.map((f, i) => html`<tr data-row="${i}">
        ${sideCells(f, i, "a")}<td class="sc-no">${f.frame_no}</td>${sideCells(f, i, "b")}</tr>`)}</tbody>
    </table>
    <div class="btn-row sc-frame-btns"><button type="button" class="btn small ghost" data-add-frame>+ Add frame</button>
      ${frames.length > 1 ? html`<button type="button" class="btn small ghost" data-remove-frame>Remove last frame</button>` : ""}</div>`);
    drawScore();
  }

  const side = (k) => html`<div class="sc-team">
    <div class="sc-team-name">${sides[k].name}</div>
    ${sides[k].team ? html`<div class="sc-emblem">${badge(sides[k].team)}</div>` : ""}
    <div class="sc-run" data-run-${k}>0</div></div>`;

  mount(el, html`<div class="sc-card" id="sc">
    <h1 class="sc-title">Update ${html`<span>${sides.a.name}</span>`} vs. ${html`<span>${sides.b.name}</span>`} scores</h1>
    <div class="sc-band">${opts.subtitle}${opts.when ? ` - ${fmtDate(opts.when)}` : ""}</div>
    <div class="sc-head">
      ${side("a")}
      <div class="sc-v"><b>V</b>${opts.when ? html`<span>${fmtTime(opts.when)}</span>` : ""}${opts.venue ? html`<span>${opts.venue}</span>` : ""}</div>
      ${side("b")}
    </div>
    ${opts.notice ?? ""}
    <div class="sc-frames" data-frames></div>
    <div data-errors></div>
    <div class="btn-row sc-actions">${opts.actions.map((a) => html`<button type="button" class="btn ${a.cls ?? ""}" data-action="${a.key}">${a.label}</button>`)}</div>
    ${opts.extra ?? ""}
    <div class="sc-warn orange">Please be certain the scores are correct and in the right columns before saving.</div>
    <div class="sc-warn red">Breaks: type each break in the small box next to the player, e.g. <b>34, 41</b>. Break points: ${RULES.breakMinimum}–39 = 3, 40–49 = 4 … 140+ = ${RULES.maxBreakPoints}.${allowExt ? ` A player picked as "(Ext)" is playing as the extra player — allowed ${EXT_PER_SEASON} time${EXT_PER_SEASON > 1 ? "s" : ""} a season.` : ""}</div>
  </div>`);
  drawFrames();

  const root = $("#sc", el);
  root.addEventListener("input", (e) => {
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
  root.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.matches("[data-add-frame]")) { frames.push(blankFrame(frames.length + 1, slots, opts.preset)); dirty = true; drawFrames(); }
    if (t.matches("[data-remove-frame]") && frames.length > 1) { frames.pop(); dirty = true; drawFrames(); }
    const action = opts.actions.find((a) => a.key === t.dataset.action);
    if (action) await run(action, t);
  });

  function validate(final) {
    const errors = [];
    const extNow = new Map();
    for (const f of frames) {
      const used = [...f.a, ...f.b].some((s) => s.player_id || s.breaks) || f.a_points != null || f.b_points != null;
      if (!used && !final) continue;
      if ([...f.a, ...f.b].some((s) => !s.player_id)) errors.push(`Frame ${f.frame_no}: choose all the players.`);
      if (f.a_points == null || f.b_points == null) errors.push(`Frame ${f.frame_no}: enter both scores.`);
      else if (f.a_points === f.b_points) errors.push(`Frame ${f.frame_no}: a frame can't be tied.`);
      for (const sd of ["a", "b"]) {
        for (const s of f[sd]) {
          const values = parseBreaks(s.breaks);
          if (values === null) errors.push(`Frame ${f.frame_no}: breaks must be numbers from 1 to 147, separated by commas.`);
          else if (values.some((v) => f[`${sd}_points`] != null && v > f[`${sd}_points`])) errors.push(`Frame ${f.frame_no}: a break by ${playerName(s.player_id)} is bigger than their score.`);
          if (s.ext && s.player_id) extNow.set(s.player_id, (extNow.get(s.player_id) ?? 0) + 1);
        }
      }
    }
    for (const [pid, n] of extNow) {
      if ((extUsed.get(pid) ?? 0) + n > EXT_PER_SEASON)
        errors.push(`${playerName(pid)} has already played as the extra (Ext) player ${extUsed.get(pid) ?? 0} time(s) this season — only ${EXT_PER_SEASON} allowed.`);
    }
    return errors;
  }

  async function run(action, btn) {
    const errors = action.skipChecks ? [] : validate(action.final);
    mount($("[data-errors]", el), errors.length ? html`<div class="notice error">${errors.map((x) => html`<div>${x}</div>`)}</div>` : "");
    if (errors.length) return toast("Please fix the scorecard first", "error");
    if (action.confirm && !confirm(action.confirm)) return;
    btn.disabled = true;
    try {
      // Only frames with something entered are saved, renumbered 1, 2, 3…
      const kept = frames.filter((f) => [...f.a, ...f.b].some((s) => s.player_id) || f.a_points != null || f.b_points != null)
        .map((f, idx) => ({ ...f, frame_no: idx + 1 }));
      const breaks = kept.flatMap((f) => ["a", "b"].flatMap((sd) => f[sd].flatMap((s) =>
        (parseBreaks(s.breaks) ?? []).map((value) => ({ frame_no: f.frame_no, player_id: s.player_id, value })))));
      await opts.onSave(kept, breaks, action.key);
      if (!action.quiet) dirty = false;
      const pts = breaks.filter((b) => breakPoints(b.value)).length;
      if (!action.quiet) toast(`${action.done ?? "Saved"}${pts ? ` · ${pts} scoring break${pts > 1 ? "s" : ""}` : ""}`);
    } catch (err) {
      toast(err.message, "error");
    } finally { btn.disabled = false; }
  }

  const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}

/** Group saved breaks onto the editor's slots as "34, 41" text. */
export function breaksText(breaks, frameNo, playerId) {
  return breaks.filter((b) => b.frame_no === frameNo && b.player_id === playerId).map((b) => b.value).join(", ");
}
