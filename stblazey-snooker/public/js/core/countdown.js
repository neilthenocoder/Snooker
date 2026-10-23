// ─────────────────────────────────────────────────────────────
//  COUNTDOWN (Rich, round 44): a match that hasn't started yet shows how long until it does —
//  days, hours, minutes and seconds — on its preview page. It ticks every second and stops by
//  itself once the page is left. At the start time it says "Starting now".
// ─────────────────────────────────────────────────────────────
import { html } from "./dom.js";

/** The countdown block for a match starting at `iso` ("" when there is no date or it has started). */
export function countdown(iso) {
  if (!iso || Date.parse(iso) <= Date.now()) return "";
  return html`<div class="countdown" data-countdown="${iso}" aria-label="Time until the match starts">
    ${["days", "hours", "mins", "secs"].map((k) => html`<span><b data-cd="${k}">–</b><small>${k}</small></span>`)}</div>`;
}

/** Start every countdown inside `root`. */
export function startCountdowns(root) {
  const boxes = [...root.querySelectorAll("[data-countdown]")];
  if (!boxes.length) return;
  const tick = () => {
    for (const box of boxes) {
      if (!box.isConnected) continue;
      let left = Math.max(0, Math.floor((Date.parse(box.dataset.countdown) - Date.now()) / 1000));
      if (!left) { box.innerHTML = "<p class=\"countdown-now\">Starting now</p>"; continue; }
      const parts = { days: Math.floor(left / 86400), hours: Math.floor(left / 3600) % 24, mins: Math.floor(left / 60) % 60, secs: left % 60 };
      for (const [k, v] of Object.entries(parts)) { const b = box.querySelector(`[data-cd="${k}"]`); if (b) b.textContent = String(v).padStart(k === "days" ? 1 : 2, "0"); }
    }
    if (!boxes.some((b) => b.isConnected && b.querySelector("[data-cd]"))) clearInterval(timer);
  };
  const timer = setInterval(tick, 1000);
  tick();
}
