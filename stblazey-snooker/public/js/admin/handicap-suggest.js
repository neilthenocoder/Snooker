// ─────────────────────────────────────────────────────────────
//  Admin → League → Suggested handicaps (Rich, round 23: "an algorithm to suggest
//  handicaps go up or down, based on the season's results — for the committee meeting").
//  It only SUGGESTS: nothing changes until someone presses Apply (and every change is logged
//  under Handicaps, like any other). The rule is simple enough to explain at the meeting:
//    • a player needs enough frames in the season to judge (the minimum below);
//    • winning a lot of frames → their handicap comes DOWN one step (two for a lot more);
//    • losing a lot → it goes UP one step (two for a lot more);
//    • a big break (50+) from someone who receives a start nudges it down one step.
//  The step, the thresholds and the minimum can all be changed on the page.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$, toast } from "../core/dom.js";
import { table, setHandicap } from "../core/api.js";
import { seasonContext } from "../core/context.js";
import { panel, dataTable, handicapText } from "../core/components.js";
import { friendly } from "./crud.js";

const DEFAULTS = { step: 7, min: 8, up1: 30, up2: 15, down1: 70, down2: 85, bigBreak: 50 };

/** The suggestion for one player: { change, why } (change in handicap points; 0 = leave it). */
export function suggest(r, best, o = DEFAULTS) {
  if (r.played < o.min) return { change: 0, why: `Only ${r.played} frame${r.played === 1 ? "" : "s"} — not enough to judge` };
  const pct = Math.round((r.won / r.played) * 100);
  let change = 0, why = `Won ${r.won} of ${r.played} (${pct}%)`;
  if (pct >= o.down2) { change = -2 * o.step; why += ` — well above ${o.down2}%`; }
  else if (pct >= o.down1) { change = -o.step; why += ` — above ${o.down1}%`; }
  else if (pct <= o.up2) { change = 2 * o.step; why += ` — well below ${o.up2}%`; }
  else if (pct <= o.up1) { change = o.step; why += ` — below ${o.up1}%`; }
  if (change >= 0 && best >= o.bigBreak && (r.player.handicap ?? 0) > 0) { change -= o.step; why += ` · best break ${best} with a start of ${handicapText(r.player.handicap)}`; }
  return { change, why };
}

export async function handicapSuggestPage(el) {
  const seasons = (await table("seasons", "name")).sort((a, b) => String(b.name).localeCompare(String(a.name)));
  let seasonId = seasons.find((s) => s.is_current)?.id ?? seasons[0]?.id, opts = { ...DEFAULTS }, only = true;

  const draw = async () => {
    const ctx = await seasonContext(seasonId);
    const rows = ctx.leagues.flatMap((l) => ctx.rankings(l.id).map((r) => ({ ...r, league: l })));
    const best = (pid) => Math.max(0, ...ctx.breaks.filter((b) => b.player_id === pid && ctx.fixture.get(b.fixture_id)).map((b) => b.value));
    const list = rows.map((r) => ({ ...r, ...suggest(r, best(r.player.id), opts) }))
      .map((r) => ({ ...r, now: r.player.handicap ?? 0, next: Math.max(-200, Math.min(200, (r.player.handicap ?? 0) + r.change)) }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.name.localeCompare(b.name));
    const shown = only ? list.filter((r) => r.change) : list;
    const num = (k, label) => html`<label>${label}<input type="number" data-opt="${k}" value="${opts[k]}" min="0" max="200"></label>`;
    mount(el, html`
      <div class="notice">Suggestions for the yearly handicap review, worked out from a season's league frames. <b>Nothing changes until you press Apply</b> — take the list to the committee meeting, change the figures as you agree, and apply them. Every change is recorded under League → Handicaps.
        Tip: press “Start a new yearly review” there first, so the website shows the arrows for this year's moves.</div>
      ${panel("How it works out the suggestions", html`<div class="hs-explain">
        <p><b>In plain English:</b> for each player it looks at the league frames they played in the season and the share they won.</p>
        <ul>
          <li>Fewer than <b>${opts.min}</b> frames → <b>no suggestion</b> (too few to judge fairly).</li>
          <li>Won <b>${opts.down2}%</b> or more → handicap <b>down two steps</b> (−${2 * opts.step}). Won <b>${opts.down1}%</b> or more → <b>down one step</b> (−${opts.step}).</li>
          <li>Won <b>${opts.up2}%</b> or less → handicap <b>up two steps</b> (+${2 * opts.step}). Won <b>${opts.up1}%</b> or less → <b>up one step</b> (+${opts.step}).</li>
          <li>In between (${opts.up1 + 1}–${opts.down1 - 1}%) → <b>stays the same</b>.</li>
          <li>Someone who <b>receives a start</b> (a + handicap) and made a break of <b>${opts.bigBreak}+</b> comes down one more step — they are better than their handicap says.</li>
        </ul>
        <p class="muted">“Down” means a smaller start (or a bigger penalty): the player has been winning, so the next season is fairer for their opponents. Change any number below and the list updates straight away.${opts.min < 6 ? html` <b class="lk-why">With fewer than 6 frames, one good or bad night decides it — 8 or more is fairer.</b>` : ""}</p></div>
        <div class="form hs-opts">
        <label>Season<select data-season>${seasons.map((s) => html`<option value="${s.id}" ${s.id === seasonId ? "selected" : ""}>${s.name}</option>`)}</select></label>
        <div class="hs-grid">${num("step", "One step (handicap points)")}${num("min", "Frames needed to judge")}${num("down1", "Down one step: won at least %")}${num("down2", "Down two steps: won at least %")}
          ${num("up1", "Up one step: won at most %")}${num("up2", "Up two steps: won at most %")}${num("bigBreak", "Big break (nudges a start down)")}</div>
        <label class="check"><input type="checkbox" data-only ${only ? "checked" : ""}> Show only players with a suggested change</label></div>`, { color: "yellow" })}
      ${panel(`Suggested changes (${list.filter((r) => r.change).length} of ${list.length} players)`, html`<div class="btn-row" style="margin-bottom:10px"><label class="check" style="margin:0"><input type="checkbox" data-all checked> Tick / untick them all</label></div>${dataTable([
        { label: "Apply", cell: (r) => (r.change ? html`<input type="checkbox" data-pick="${r.player.id}" checked aria-label="Apply for ${r.name}">` : "") },
        { label: "Player", cell: (r) => html`<a href="/player/${r.player.slug || r.player.id}" target="_blank" rel="noopener">${r.name}</a><br><small class="muted">${r.league.name}</small>` },
        { label: "Why", cell: (r) => r.why },
        { label: "Now", cell: (r) => handicapText(r.now), cls: "num" },
        { label: "Suggested", cell: (r) => html`<input class="hs-new ${r.change < 0 ? "down" : r.change > 0 ? "up" : ""}" type="number" min="-200" max="200" value="${r.next}" data-new="${r.player.id}" aria-label="New handicap for ${r.name}">`, cls: "num" },
      ], shown, { empty: "No suggestions — nobody is far enough from the middle, or there are no results for this season yet." })}
      <div class="btn-row" style="margin-top:12px"><button type="button" class="btn green" data-apply>Apply the ticked changes</button></div>`)}`);
  };
  el.onchange = (e) => {
    if (e.target.matches("[data-season]")) { seasonId = e.target.value; return draw(); }
    if (e.target.dataset.opt) { opts[e.target.dataset.opt] = Math.max(0, Number(e.target.value) || 0); return draw(); }
    if (e.target.matches("[data-only]")) { only = e.target.checked; return draw(); }
    if (e.target.matches("[data-all]")) $$("[data-pick]", el).forEach((x) => { x.checked = e.target.checked; });
  };
  el.onclick = async (e) => {
    const btn = e.target.closest("[data-apply]");
    if (!btn) return;
    const picks = $$("[data-pick]:checked", el).map((x) => x.dataset.pick);
    if (!picks.length) return toast("Tick at least one player.", "error");
    btn.disabled = true;
    let done = 0;
    try {
      for (const id of picks) { const v = Number($(`[data-new="${id}"]`, el).value); if (Number.isInteger(v)) { await setHandicap(id, v, "Yearly review (suggested)"); done++; } }
      toast(`${done} handicap${done === 1 ? "" : "s"} changed`); await draw();
    } catch (err) { toast(friendly(err), "error"); btn.disabled = false; }
  };
  await draw();
}
