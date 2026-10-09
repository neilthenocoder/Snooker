// ─────────────────────────────────────────────────────────────
//  THE BIG MOMENTS — a few seconds of confetti in the snooker ball
//  colours and a card saying what happened: a new highest break,
//  new league leaders, a new leader of the player rankings, or the
//  winner of a competition. It only ever shows to people who are on
//  the website at that moment, once each, and anyone can close it.
//  No confetti for visitors whose device asks for reduced motion
//  (they still get the card).
//  Which moments are celebrated: Admin → Site settings → Celebrations.
//  Each visitor can switch them off for themselves (the bell → Celebrations).
// ─────────────────────────────────────────────────────────────
import { html, mount } from "./dom.js";

const COLOURS = ["#e8003d", "#fbb61a", "#0b8a12", "#6b3a2a", "#0088e0", "#ff7eb6", "#111111", "#ffffff"];
const SHOW_MS = 6500;
let open = null;

function confetti(canvas, ms) {
  const ctx = canvas.getContext("2d");
  const size = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  size();
  // Balls and paper strips thrown up from the two bottom corners.
  const bits = Array.from({ length: Math.min(220, Math.round(innerWidth / 6)) }, (_, i) => {
    const left = i % 2 === 0;
    return { x: left ? -10 : innerWidth + 10, y: innerHeight * (0.55 + Math.random() * 0.4),
      vx: (left ? 1 : -1) * (4 + Math.random() * 11), vy: -(9 + Math.random() * 13),
      r: 4 + Math.random() * 6, round: Math.random() < 0.45, spin: Math.random() * 6.3, vs: (Math.random() - 0.5) * 0.4,
      c: COLOURS[i % COLOURS.length], delay: Math.random() * 500 };
  });
  const began = performance.now();
  let frame;
  const tick = (now) => {
    const t = now - began;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bits) {
      if (t < b.delay) continue;
      b.vy += 0.32; b.vx *= 0.992; b.x += b.vx; b.y += b.vy; b.spin += b.vs;
      ctx.globalAlpha = Math.max(0, Math.min(1, (ms - t) / 900));
      ctx.fillStyle = b.c;
      if (b.round) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3); ctx.fill(); if (b.c === "#ffffff") { ctx.strokeStyle = "#bbb"; ctx.stroke(); } }
      else { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin); ctx.fillRect(-b.r, -b.r / 2.4, b.r * 2, b.r / 1.2); ctx.restore(); }
    }
    if (t < ms) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  addEventListener("resize", size);
  return () => { cancelAnimationFrame(frame); removeEventListener("resize", size); };
}

/**
 * info: { what ("New highest break of the season"), name, where ("Victory League"), href, hrefLabel,
 *         value (a big number or word beside the picture — a break, "1st"), avatar (a photo or emblem),
 *         trophy (true = show the trophy instead of a photo) }
 */
export function celebrate(info) {
  open?.();
  const box = document.createElement("div");
  box.className = "celebrate";
  mount(box, html`<canvas aria-hidden="true"></canvas>
    <div class="celebrate-card" role="status">
      <button type="button" class="celebrate-x" aria-label="Close">×</button>
      <p class="celebrate-what">${info.what ?? "New highest break"}</p>
      <div class="celebrate-row ${info.trophy ? "is-trophy" : ""}">
        <img src="${info.trophy ? info.avatar || "/assets/trophy.svg" : info.avatar || "/assets/avatar.svg"}" alt="">
        ${info.value != null && info.value !== "" ? html`<b>${info.value}</b>` : ""}
      </div>
      <p class="celebrate-who">${info.name}</p>
      <p class="celebrate-where">${info.where ?? ""}</p>
      ${info.href ? html`<a class="btn small" href="${info.href}">${info.hrefLabel ?? "See the match"}</a>` : ""}
    </div>`);
  document.body.append(box);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stop = still ? () => {} : confetti(box.querySelector("canvas"), SHOW_MS);
  const close = () => { stop(); box.classList.add("out"); setTimeout(() => box.remove(), 400); open = null; };
  const timer = setTimeout(close, SHOW_MS + 600);
  open = () => { clearTimeout(timer); close(); };
  box.addEventListener("click", (e) => { if (e.target.closest(".celebrate-x, a") || e.target === box) open?.(); });
}
/** The older name, kept for anything that still calls it. */
export const celebrateBreak = celebrate;
