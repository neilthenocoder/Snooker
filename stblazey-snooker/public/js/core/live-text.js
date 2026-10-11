// ─────────────────────────────────────────────────────────────
//  LIVE TEXT — the lines the scorer types while a match is being
//  scored ball by ball ("Great long red to get in"). They appear under
//  the public scoreboard (/scoreboard/<no>) for everyone watching,
//  newest first, the moment "Post" is pressed.
//  The box is on the admin's pad (Admin → Live scoreboard → Score it)
//  and, for an admin, on a league scorecard's "Ball by ball" view.
//  A match keeps its lines in live_matches.commentary:
//    [{ id, at, frame, text }, …]  (oldest first)
// ─────────────────────────────────────────────────────────────
import { html, fmtTime } from "./dom.js";

export const SAY_MAX = 200;      // letters in one line
export const SAY_KEEP = 150;     // lines a match keeps

/** The lines a match has so far. */
export const linesOf = (m) => (Array.isArray(m?.commentary) ? m.commentary : []);
/** The list with one more line on the end (nothing is added for empty text). */
export function withLine(list, text, frame = null) {
  const t = String(text ?? "").trim().slice(0, SAY_MAX);
  return t ? [...list, { id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), frame, text: t }].slice(-SAY_KEEP) : list;
}

/**
 * The box itself: where to type, "Post", and the last few lines with × to take one back.
 * The pad it sits in handles the form being sent ([data-say]) and the × buttons ([data-unsay]).
 */
export const sayBox = (list, { publicHref = "" } = {}) => html`<form class="pad-say" data-say autocomplete="off">
  <label for="pad-say-text"><b>Live text</b> <small>Say what is happening. It appears under the scoreboard for everyone watching${publicHref ? html` — <a href="${publicHref}" target="_blank" rel="noopener">see it</a>` : ""}.</small></label>
  <div class="pad-say-row"><input id="pad-say-text" type="text" maxlength="${SAY_MAX}" placeholder="e.g. Great long red to get in — he's on the black" data-say-text enterkeyhint="send">
    <button class="btn secondary">Post</button></div>
  ${list.length ? html`<ul class="pad-said">${list.slice(-4).reverse().map((l) => html`<li><time>${fmtTime(l.at)}</time><span>${l.text}</span>
    <button type="button" data-unsay="${l.id}" aria-label="Remove this line" title="Remove">×</button></li>`)}</ul>` : ""}
</form>`;
