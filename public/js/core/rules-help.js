// ─────────────────────────────────────────────────────────────
//  RULES HELP (Rich, round 23: "if stuck" on a scorecard — start typing and it finds the rule).
//  A "? Rules help" button on the scorecards and the scoring pads opens a search over:
//    • the league's own rules (the info pages on the Rules page — Admin → Info pages & rules),
//      split into their headed sections;
//    • a short guide to the rules of snooker (below), for the common match-night questions.
//  Nothing is left behind on the scorecard: the answer opens in place, and "Open the rules"
//  opens the full page in a new tab.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, raw, esc } from "./dom.js";
import { table } from "./api.js";
import { markup } from "./markup.js";

/** A short guide to the rules of snooker (the league's own rules come first in the results). */
export const SNOOKER_BASICS = [
  ["Values of the balls", "Red 1, yellow 2, green 3, brown 4, blue 5, pink 6, black 7. While reds are on the table a red must be potted before each colour; the colours go back on their spots. When the reds have gone, the colours are potted in order, yellow to black. The highest possible break is 147."],
  ["Foul: how many points", "A foul gives the opponent at least 4 points — or the value of the ball on, or of the ball wrongly hit or potted, if that is higher (so 5, 6 or 7 when blue, pink or black are involved). The opponent then chooses who plays next."],
  ["Common fouls", "Hitting the wrong ball first, missing every ball, potting the cue ball (an in-off), a ball leaving the table, touching a ball with the cue, hand or clothing, playing a push shot or a jump shot, playing while a ball is still moving, and having no foot on the floor."],
  ["Free ball", "If after a foul you are snookered on every ball on, the referee can call a free ball: you nominate any ball as the ball on and it counts as that ball (1 point while reds remain, otherwise the value of the lowest colour on). Potting it with the reds still on means you then play a colour as usual."],
  ["Miss", "If a player doesn't make a proper attempt to hit the ball on, the referee can call a foul and a miss: the opponent may ask for the balls to be put back and the shot played again. With a clear view of the ball on, three misses in a row can lose the frame."],
  ["Touching ball", "When the cue ball rests against another ball, the player must play away from it without moving it. It is not a foul if the touching ball is the ball on, or could be."],
  ["Re-spotted black", "If the scores are level when the final black is potted (or after a foul on it), the black is put back on its spot. The players toss a coin to decide who plays from the D. The next score — a pot or a foul — ends the frame."],
  ["Snookered", "You are snookered when no part of every ball on can be hit in a straight line by the cue ball. Needing snookers means you are further behind than the points left on the table."],
  ["A ball off the table", "Any ball leaving the table is a foul. A red that goes off stays off; a colour is put back on its spot."],
  ["Conceding a frame", "A player may concede a frame (or the match). The frame goes to the opponent with the score as it stands; agree it with the other team and note it on the scorecard."],
];

let index = null;
const words = (q) => q.toLowerCase().split(/[^a-z0-9£%]+/).filter((w) => w.length > 1);

async function buildIndex() {
  const pages = (await table("pages", "sort").catch(() => [])).filter((p) => p.show_in_rules || /rule|by-?law|constitution|handbook/i.test(p.title));
  const items = [];
  for (const p of pages) {
    const parts = String(p.body ?? "").split(/\n(?=#{1,3}\s)/);
    for (const part of parts) {
      const head = part.match(/^#{1,3}\s+(.+)/)?.[1]?.trim();
      const text = part.replace(/^#{1,3}\s+.+\n?/, "").trim();
      if (!text && !head) continue;
      items.push({ source: p.title, title: head || p.title, text, href: `/rules?p=${p.slug}`, league: true });
    }
  }
  for (const [title, text] of SNOOKER_BASICS) items.push({ source: "Rules of snooker (a short guide)", title, text, href: null, league: false });
  return items;
}
function find(items, q) {
  const ws = words(q);
  if (!ws.length) return [];
  return items.map((it) => {
    const t = it.title.toLowerCase(), b = it.text.toLowerCase();
    let score = 0;
    for (const w of ws) { if (t.includes(w)) score += 5; const n = b.split(w).length - 1; score += Math.min(n, 4); if (!t.includes(w) && !n) score -= 3; }
    return { it, score: score + (it.league ? 1 : 0) };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8).map((x) => x.it);
}
const mark = (text, q) => { let s = esc(text); for (const w of words(q)) s = s.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>"); return raw(s); };

export async function openRulesHelp() {
  if ($("dialog.rules-help")) return;
  const dlg = document.createElement("dialog");
  dlg.className = "rules-help search";
  mount(dlg, html`<div class="search-bar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/></svg>
      <input type="search" placeholder="Stuck? Type a word: foul, free ball, re-spotted black, late, walkover…" aria-label="Search the rules" autocomplete="off">
      <button type="button" data-close aria-label="Close">×</button></div>
    <div class="search-results" data-results><p class="search-hint">Searches the league's own rules and a short guide to the rules of snooker.</p>
      <div class="rh-chips">${["foul", "free ball", "re-spotted black", "miss", "touching ball", "concede"].map((w) => html`<button type="button" data-try="${w}">${w}</button>`)}</div></div>`);
  document.body.append(dlg);
  const input = $("input", dlg), results = $("[data-results]", dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  const draw = async () => {
    index ??= await buildIndex();
    const q = input.value.trim();
    if (q.length < 2) return;
    const hits = find(index, q);
    mount(results, hits.length ? hits.map((h) => html`<details class="rh-hit" ${hits[0] === h ? "open" : ""}><summary><small>${h.source}</small><strong>${mark(h.title, q)}</strong></summary>
        <div class="rh-text">${h.league ? markup(h.text) : html`<p>${mark(h.text, q)}</p>`}</div>
        ${h.href ? html`<a class="btn small ghost" href="${h.href}" target="_blank" rel="noopener">Open the rules</a>` : ""}</details>`)
      : html`<p class="search-hint">Nothing found for “${q}”. Try another word — or ask the captain of the other team or the league secretary.</p>`);
  };
  input.addEventListener("input", draw);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) return close();
    const t = e.target.closest("[data-try]"); if (t) { input.value = t.dataset.try; draw(); }
  });
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dlg.showModal();
  input.focus();
}

/** The floating "? Rules help" button (scorecards and scoring pads). */
export function rulesHelpButton() {
  document.querySelector(".rh-btn")?.remove();
  const b = document.createElement("button");
  b.type = "button"; b.className = "rh-btn"; b.setAttribute("aria-label", "Rules help — search the rules");
  mount(b, html`<span aria-hidden="true">?</span> Rules help`);
  b.addEventListener("click", openRulesHelp);
  document.body.append(b);
}
