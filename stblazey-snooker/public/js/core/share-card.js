// ─────────────────────────────────────────────────────────────
//  Shareable result pictures (round 40): a square picture of a result, ready for Facebook, Instagram or WhatsApp.
//  Drawn in the browser (no server), then shared straight from a phone or downloaded as a PNG.
//  card = { title ("Victory League"), sub ("Tuesday 20 October 2026"), home: { name, logo }, away: { name, logo },
//           score: [3, 2], footer: ["Best break: 54 — Ryan Bilson", …], tag ("Result" / "Walkover"), file ("bethel-a-v-bugle") }
// ─────────────────────────────────────────────────────────────
import { html, mount, toast } from "./dom.js";
import { SITE } from "../config.js";

const SIZE = 1080;

/** Load a picture for the canvas. Pictures from another site that don't allow it are skipped (initials instead). */
function load(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    setTimeout(() => resolve(null), 6000);
  });
}
const initials = (name) => String(name ?? "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

/** Fit text into a width by shrinking it (down to `min` px). */
function fitText(ctx, text, maxWidth, size, weight, family, min = 26) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxWidth) break; s -= 2; } while (s > min);
  return s;
}

/** Wrap a name onto at most two lines. */
function twoLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  if (ctx.measureText(text).width <= maxWidth || words.length < 2) return [text];
  for (let i = words.length - 1; i > 0; i--) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    if (ctx.measureText(a).width <= maxWidth) return [a, b];
  }
  return [text];
}

export async function drawResultCard(card) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const head = (css.getPropertyValue("--font-head").trim() || "Arial Black, Arial, sans-serif");
  const body = (css.getPropertyValue("--font-body").trim() || "Arial, sans-serif");
  const red = css.getPropertyValue("--red").trim() || "#e8003d";
  try { await document.fonts?.ready; } catch { /* draw with what there is */ }

  // The baize: a deep green with a soft light in the middle, a black band top and bottom.
  const g = ctx.createRadialGradient(SIZE / 2, SIZE * 0.48, 80, SIZE / 2, SIZE * 0.48, SIZE * 0.75);
  g.addColorStop(0, "#1f8a3a"); g.addColorStop(1, "#0a3d19");
  ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "#0d0d0d"; ctx.fillRect(0, 0, SIZE, 170); ctx.fillRect(0, SIZE - 150, SIZE, 150);
  ctx.fillStyle = red; ctx.fillRect(0, 170, SIZE, 10); ctx.fillRect(0, SIZE - 160, SIZE, 10);

  const [siteLogo, homeLogo, awayLogo] = await Promise.all([
    load(document.querySelector("header .logo img")?.src || "/assets/logo.svg"), load(card.home.logo), load(card.away.logo)]);
  // Top band: the league's logo and name, the competition and the date.
  if (siteLogo) ctx.drawImage(siteLogo, 50, 30, 110, 110);
  ctx.fillStyle = "#FFB81C"; ctx.textBaseline = "alphabetic";
  fitText(ctx, card.title, SIZE - 260, 50, 800, head); ctx.fillText(card.title.toUpperCase(), 190, 88);
  ctx.fillStyle = "#ddd"; ctx.font = `500 32px ${body}`; ctx.fillText(card.sub ?? "", 190, 134);

  // The tag ("RESULT") above the score.
  const tag = (card.tag ?? "Result").toUpperCase();
  ctx.font = `800 30px ${head}`;
  const tw = ctx.measureText(tag).width + 48;
  ctx.fillStyle = red; roundRect(ctx, (SIZE - tw) / 2, 232, tw, 56, 10); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(tag, SIZE / 2, 271);

  // Each side: emblem (or initials) and name.
  const side = (team, cx, img, won) => {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, 440, 108, 0, Math.PI * 2); ctx.fillStyle = img ? "#fff" : "#111"; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = won ? "#FFB81C" : "rgba(255,255,255,.35)"; ctx.stroke();
    if (img) { ctx.clip(); const s = 180; ctx.drawImage(img, cx - s / 2, 440 - s / 2, s, s); }
    else { ctx.fillStyle = "#fff"; ctx.font = `800 70px ${head}`; ctx.textAlign = "center"; ctx.fillText(initials(team.name), cx, 466); }
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";
    const s = fitText(ctx, team.name, 380, 52, 800, head, 34);
    const lines = twoLines(ctx, team.name, 380);
    lines.forEach((l, i) => ctx.fillText(l, cx, 620 + i * (s + 6)));
  };
  const [h, a] = card.score ?? [null, null];
  side(card.home, 250, homeLogo, h != null && h > a);
  side(card.away, SIZE - 250, awayLogo, a != null && a > h);

  // The score in the middle.
  ctx.fillStyle = "rgba(0,0,0,.55)"; roundRect(ctx, SIZE / 2 - 120, 375, 240, 130, 18); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `900 96px ${head}`; ctx.textAlign = "center";
  ctx.fillText(card.scoreText ?? `${h ?? "–"}–${a ?? "–"}`, SIZE / 2, 475);

  // Lines underneath: best break, man of the match…
  ctx.font = `600 36px ${body}`; ctx.fillStyle = "#f3f3f3";
  (card.footer ?? []).slice(0, 3).forEach((line, i) => { fitText(ctx, line, SIZE - 140, 36, 600, body, 24); ctx.fillText(line, SIZE / 2, 770 + i * 50); });

  // Bottom band: the website.
  ctx.fillStyle = "#fff"; ctx.font = `800 34px ${head}`; ctx.fillText(SITE.name.toUpperCase(), SIZE / 2, SIZE - 82);
  ctx.fillStyle = "#aaa"; ctx.font = `500 28px ${body}`; ctx.fillText(location.host, SIZE / 2, SIZE - 38);
  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Show the picture with Share / Download buttons. */
export async function openShareCard(card) {
  const box = document.createElement("dialog");
  box.className = "share-card-box";
  mount(box, html`<p class="muted">Making the picture…</p>`);
  document.body.append(box); box.showModal();
  const close = () => { box.close(); box.remove(); };
  box.addEventListener("click", (e) => { if (e.target === box || e.target.closest("[data-close]")) close(); });
  let canvas;
  try { canvas = await drawResultCard(card); } catch (err) { close(); return toast("The picture couldn't be made on this device.", "error"); }
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  const file = new File([blob], `${card.file ?? "result"}.png`, { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const canShare = !!navigator.canShare?.({ files: [file] });
  mount(box, html`<img src="${url}" alt="The result as a picture">
    <div class="btn-row">${canShare ? html`<button type="button" class="btn green" data-share>Share</button>` : ""}
      <a class="btn ${canShare ? "secondary" : "green"}" href="${url}" download="${file.name}">Download picture</a>
      <button type="button" class="btn ghost" data-close>Close</button></div>
    <p class="muted">Post it on Facebook, Instagram or WhatsApp. ${canShare ? "" : "On a phone, “Share” sends it straight to an app."}</p>`);
  box.querySelector("[data-share]")?.addEventListener("click", async () => {
    try { await navigator.share({ files: [file], title: card.title, text: `${card.home.name} ${card.scoreText ?? card.score.join("–")} ${card.away.name}` }); }
    catch (err) { if (err?.name !== "AbortError") toast("Sharing didn't work — use Download instead.", "error"); }
  });
  box.addEventListener("close", () => URL.revokeObjectURL(url));
}
