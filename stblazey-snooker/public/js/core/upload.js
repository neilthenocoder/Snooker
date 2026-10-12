// Image uploads: shrinks the picture in the browser first (fast pages, small
// storage), then stores it in the Supabase "images" bucket and returns its URL.
// In demo mode the picture is kept inside the browser instead.
import { db } from "./db.js";
import { DEMO_MODE } from "../config.js";
import { addToLibrary } from "./api.js";

const MAX_BYTES = 5 * 1024 * 1024;

/** Image library categories, and which one each upload folder files into. */
export const MEDIA_CATEGORIES = ["General", "News", "Players", "Emblems & logos", "Trophies", "Venues", "Competitions", "Sponsors", "Galleries"];
const FOLDER_CATEGORY = { news: "News", players: "Players", teams: "Emblems & logos", branding: "Emblems & logos", venues: "Venues", competitions: "Competitions", sponsors: "Sponsors", gallery: "Galleries", trophies: "Trophies", awards: "Trophies" };

/**
 * library: true adds the picture to the admin's image library (admins only);
 * pass false for uploads by captains and players.
 */
export async function uploadImage(file, { folder = "misc", maxSize = 1600, library = folder !== "scorecards", category = FOLDER_CATEGORY[folder] ?? "General", format = "webp" } = {}) {
  if (!file || !/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.type)) throw new Error("Please choose a JPG, PNG, WebP, GIF or SVG image.");
  // SVG logos and animated GIFs are kept as they are; everything else is resized and converted to WebP.
  const asIs = file.type === "image/gif" || file.type === "image/svg+xml";
  // format: "webp" (small — most pictures), "png" (the favicon: every browser shows it) or "jpeg" (social previews: Facebook, WhatsApp and the rest all read it).
  const blob = asIs ? file : await resize(file, DEMO_MODE ? Math.min(maxSize, 800) : maxSize, format);
  if (blob.size > MAX_BYTES) throw new Error("That image is over 5 MB even after shrinking — please use a smaller one.");
  let url, path = null;
  if (DEMO_MODE) url = await toDataUrl(blob);
  else {
    const ext = blob.type === "image/svg+xml" ? "svg" : blob.type.split("/")[1];
    path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.storage.from("images").upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
    if (error) throw new Error(/row-level|unauthori/i.test(error.message) ? "You don't have permission to upload images." : error.message);
    url = db.storage.from("images").getPublicUrl(path).data.publicUrl;
  }
  // Everything except scorecard photos goes into the image library for re-use.
  if (library) await addToLibrary({ url, path, name: file.name.slice(0, 120), category });
  return url;
}

/**
 * A document (PDF) — meeting minutes, an agenda. Kept as it is, 5 MB at most.
 * Returns its public link. In demo mode it is kept inside the browser, so only small files fit.
 */
export async function uploadFile(file, { folder = "files" } = {}) {
  if (!file || file.type !== "application/pdf") throw new Error("Please choose a PDF file.");
  if (file.size > MAX_BYTES) throw new Error("That PDF is over 5 MB — please save a smaller copy (most scanners have a “low quality” setting).");
  if (DEMO_MODE) {
    if (file.size > 400 * 1024) throw new Error("The demo keeps files in this browser, so it can only take a PDF under 400 KB. The live site takes up to 5 MB.");
    return toDataUrl(file);
  }
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const { error } = await db.storage.from("images").upload(path, file, { contentType: "application/pdf", cacheControl: "31536000" });
  if (error) throw new Error(/row-level|unauthori/i.test(error.message) ? "You don't have permission to upload documents." : /mime|not supported/i.test(error.message) ? "The file store isn't set up for PDFs yet — run supabase/schema.sql again in Supabase." : error.message);
  return db.storage.from("images").getPublicUrl(path).data.publicUrl;
}

async function resize(file, maxSize, format = "webp") {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = { png: "image/png", jpeg: "image/jpeg" }[format] ?? "image/webp";
  const blob = await new Promise((res) => canvas.toBlob(res, type, 0.85));
  return blob ?? new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
}

const toDataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(new Error("Couldn't read that image."));
  r.readAsDataURL(blob);
});

/**
 * The app icon — what a phone shows on its home screen, and a computer for the installed app — made from one
 * square picture (Admin → Branding → App icon). Phones and browsers each ask for a particular size, always PNG:
 *   apple     180 × 180  iPhone and iPad "Add to Home Screen" (filled with the background colour: iOS shows no see-through)
 *   i192/i512            Android and installed apps (the picture as it is)
 *   maskable  512 × 512  Android's round or squircle icons crop the edges, so the picture sits in the middle 70%, on the background colour
 * Returns { apple, i192, i512, maskable } — the four links.
 */
export async function makeAppIcons(file, { background = "#000000" } = {}) {
  if (!file || !/^image\/(jpeg|png|webp|svg\+xml)$/.test(file.type)) throw new Error("Please choose a PNG, JPG, WebP or SVG picture (square works best).");
  const img = await new Promise((res, rej) => {
    const url = URL.createObjectURL(file), el = new Image();
    el.onload = () => { URL.revokeObjectURL(url); res(el); };
    el.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Couldn't read that picture.")); };
    el.src = url;
  });
  const w = img.naturalWidth || 512, h = img.naturalHeight || 512;
  const draw = (size, { fill = null, pad = 0 }) => new Promise((res) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d");
    if (fill) { g.fillStyle = fill; g.fillRect(0, 0, size, size); }
    const box = size * (1 - 2 * pad), scale = Math.min(box / w, box / h);
    const dw = w * scale, dh = h * scale;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    canvas.toBlob(res, "image/png");
  });
  const bg = /^#[0-9a-f]{6}$/i.test(background) ? background : "#000000";
  const specs = { apple: [180, { fill: bg, pad: 0.1 }], i192: [192, { pad: 0.02 }], i512: [512, { pad: 0.02 }], maskable: [512, { fill: bg, pad: 0.15 }] };
  const out = {};
  const stamp = Date.now();
  for (const [key, [size, opts]] of Object.entries(specs)) {
    const blob = await draw(size, opts);
    if (!blob) throw new Error("This browser couldn't make the icon — try another browser, or a PNG picture.");
    if (DEMO_MODE) { out[key] = await toDataUrl(blob); continue; }
    const path = `branding/app-icon-${key}-${stamp}.png`;
    const { error } = await db.storage.from("images").upload(path, blob, { contentType: "image/png", cacheControl: "31536000" });
    if (error) throw new Error(/row-level|unauthori/i.test(error.message) ? "You don't have permission to upload images." : error.message);
    out[key] = db.storage.from("images").getPublicUrl(path).data.publicUrl;
  }
  return out;
}
