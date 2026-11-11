// ─────────────────────────────────────────────────────────────
//  CROP A PICTURE BEFORE IT IS UPLOADED (round 116)
//  Rich: "people using the site in the future won't understand ratios … edit image, click on the aspect ratios that
//  work, then slide the crop over the image". So: choose a shape (the one the page needs is chosen already), drag
//  the picture until the part you want is in the frame, zoom with the slider — and that part is what is uploaded.
//  Nothing here talks to the database: cropImage(fileOrUrl) → a new File (or null if the box was closed).
// ─────────────────────────────────────────────────────────────
import { html, mount } from "./dom.js";

const RATIOS = [["16:9", "Banner 16:9"], ["4:3", "Photo 4:3"], ["1:1", "Square"], ["3:4", "Portrait 3:4"], ["orig", "Whole picture"]];
const ratioOf = (key, w, h) => { if (key === "orig") return w / h; const [a, b] = String(key).split(":").map(Number); return a > 0 && b > 0 ? a / b : w / h; };
const loadImage = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("That picture couldn't be opened — try another one.")); im.src = src; });

/** Can this be cropped here? (Not SVG drawings or animated GIFs — they are uploaded as they are.) */
export const canCrop = (file) => !!file && /^image\/(jpeg|png|webp)$/i.test(file.type || "");

/**
 * Open the crop box. source: a File, or the address of a picture already on the website.
 * opts.aspect: the shape to start on ("16:9", "1:1", "1200:630" …). Resolves to a File, or null (cancelled).
 */
export async function cropImage(source, { aspect = "16:9", name = "picture" } = {}) {
  let blob = source;
  if (typeof source === "string") {
    const r = await fetch(source, { mode: "cors" }).catch(() => null);
    if (!r?.ok) throw new Error("This picture can't be cropped here (it is kept on another website). Upload it again and crop it then.");
    blob = await r.blob();
  }
  const url = URL.createObjectURL(blob);
  let img;
  try { img = await loadImage(url); } catch (e) { URL.revokeObjectURL(url); throw e; }
  const W = img.naturalWidth, H = img.naturalHeight;
  const list = RATIOS.some(([k]) => k === aspect) ? RATIOS : [[aspect, `This page's shape (${aspect.replace(":", " × ")})`], ...RATIOS];

  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "crop-dlg";
    mount(dlg, html`<form method="dialog" class="crop-box">
      <div class="crop-head"><h3>Crop the picture</h3><button type="button" class="crop-x" data-crop-cancel aria-label="Close">×</button></div>
      <p class="crop-help">Choose a shape, then <b>drag the picture</b> until the part you want is in the frame. Use the slider to zoom in.</p>
      <div class="crop-ratios" role="group" aria-label="Shape">${list.map(([k, label]) => html`<button type="button" data-crop-ratio="${k}" aria-pressed="${String(k === aspect)}">${label}</button>`)}</div>
      <div class="crop-stage" data-crop-stage tabindex="0" aria-label="The part of the picture that will be kept. Drag to move it; arrow keys also move it."><img src="${url}" alt="" draggable="false" data-crop-img><span class="crop-grid" aria-hidden="true"></span></div>
      <label class="crop-zoom"><span>Zoom</span><input type="range" min="1" max="4" step="0.01" value="1" data-crop-zoom aria-label="Zoom"></label>
      <div class="btn-row crop-actions"><button type="button" class="btn ghost" data-crop-cancel>Cancel</button><button type="button" class="btn ghost" data-crop-whole>Use the whole picture</button><button type="button" class="btn green" data-crop-ok>Use this crop</button></div>
    </form>`);
    document.body.append(dlg);
    const stage = dlg.querySelector("[data-crop-stage]"), pic = dlg.querySelector("[data-crop-img]"), zoomEl = dlg.querySelector("[data-crop-zoom]");
    let key = aspect, zoom = 1, x = 0, y = 0, sw = 0, sh = 0, scale = 1;

    const layout = (keepCentre = true) => {
      const r = ratioOf(key, W, H);
      const maxW = Math.min(640, dlg.querySelector(".crop-box").clientWidth), maxH = Math.max(180, Math.min(innerHeight * 0.5, 460));
      const before = scale ? { cx: (sw / 2 - x) / scale, cy: (sh / 2 - y) / scale } : null;
      sw = Math.min(maxW, maxH * r); sh = sw / r;
      stage.style.width = `${sw}px`; stage.style.height = `${sh}px`;
      scale = Math.max(sw / W, sh / H) * zoom;
      if (keepCentre && before && sw) { x = sw / 2 - before.cx * scale; y = sh / 2 - before.cy * scale; } else { x = (sw - W * scale) / 2; y = (sh - H * scale) / 2; }
      place();
    };
    const place = () => {
      x = Math.min(0, Math.max(sw - W * scale, x)); y = Math.min(0, Math.max(sh - H * scale, y));
      pic.style.width = `${W * scale}px`; pic.style.height = `${H * scale}px`; pic.style.transform = `translate(${x}px, ${y}px)`;
    };
    const finish = (file) => { try { dlg.close(); } catch { /* already closed */ } dlg.remove(); URL.revokeObjectURL(url); removeEventListener("resize", onResize); resolve(file); };
    const onResize = () => layout(true);
    const output = (whole) => {
      const sx = whole ? 0 : -x / scale, sy = whole ? 0 : -y / scale, cw = whole ? W : sw / scale, ch = whole ? H : sh / scale;
      const k = Math.min(1, 2400 / Math.max(cw, ch));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(cw * k)); c.height = Math.max(1, Math.round(ch * k));
      c.getContext("2d").drawImage(img, sx, sy, cw, ch, 0, 0, c.width, c.height);
      const png = /png/i.test(blob.type), type = png ? "image/png" : "image/jpeg";
      c.toBlob((b) => finish(b ? new File([b], `${String(blob.name || name).replace(/\.[a-z0-9]+$/i, "")}-crop.${png ? "png" : "jpg"}`, { type }) : null), type, 0.92);
    };

    // Drag (mouse, finger or pen), the wheel to zoom, the arrow keys to nudge.
    let drag = null;
    stage.addEventListener("pointerdown", (e) => { drag = { px: e.clientX, py: e.clientY, x, y }; stage.setPointerCapture(e.pointerId); stage.classList.add("dragging"); });
    stage.addEventListener("pointermove", (e) => { if (!drag) return; x = drag.x + e.clientX - drag.px; y = drag.y + e.clientY - drag.py; place(); });
    const drop = (e) => { drag = null; stage.classList.remove("dragging"); try { if (e?.pointerId != null && stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId); } catch { /* nothing held */ } };
    stage.addEventListener("pointerup", drop); stage.addEventListener("pointercancel", drop);
    stage.addEventListener("wheel", (e) => { e.preventDefault(); zoom = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.06 : 0.94))); zoomEl.value = String(zoom); layout(true); }, { passive: false });
    stage.addEventListener("keydown", (e) => { const d = { ArrowLeft: [12, 0], ArrowRight: [-12, 0], ArrowUp: [0, 12], ArrowDown: [0, -12] }[e.key]; if (!d) return; e.preventDefault(); x += d[0]; y += d[1]; place(); });
    zoomEl.addEventListener("input", () => { zoom = Number(zoomEl.value) || 1; layout(true); });
    dlg.addEventListener("click", (e) => {
      const r = e.target.closest("[data-crop-ratio]");
      if (r) { key = r.dataset.cropRatio; for (const b of dlg.querySelectorAll("[data-crop-ratio]")) b.setAttribute("aria-pressed", String(b === r)); layout(false); }
      else if (e.target.closest("[data-crop-ok]")) output(false);
      else if (e.target.closest("[data-crop-whole]")) output(true);
      else if (e.target.closest("[data-crop-cancel]")) finish(null);
    });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });
    addEventListener("resize", onResize);
    dlg.showModal();
    layout(false);
  });
}
