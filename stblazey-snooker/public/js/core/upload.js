// Image uploads: shrinks the picture in the browser first (fast pages, small
// storage), then stores it in the Supabase "images" bucket and returns its URL.
// In demo mode the picture is kept inside the browser instead.
import { db } from "./db.js";
import { DEMO_MODE } from "../config.js";
import { addToLibrary } from "./api.js";
import { getUser } from "./auth.js";

const MAX_BYTES = 5 * 1024 * 1024;
/** What a phone photo can be when it is chosen (it is made much smaller before it is stored). */
const MAX_PICKED = 40 * 1024 * 1024;
/** The size a stored picture aims for: about 300 KB, however big the photo that was chosen (Neil, round 20). */
export const TARGET_BYTES = 300 * 1024;

/** Image library categories, and which one each upload folder files into. */
export const MEDIA_CATEGORIES = ["General", "News", "Players", "Emblems & logos", "Trophies", "Venues", "Competitions", "Sponsors", "Galleries"];
const FOLDER_CATEGORY = { news: "News", players: "Players", teams: "Emblems & logos", branding: "Emblems & logos", venues: "Venues", competitions: "Competitions", sponsors: "Sponsors", gallery: "Galleries", trophies: "Trophies", awards: "Trophies" };

/**
 * library: true adds the picture to the admin's image library (admins only);
 * pass false for uploads by captains and players.
 */
export async function uploadImage(file, { folder = "misc", maxSize = 1600, library = folder !== "scorecards", category = FOLDER_CATEGORY[folder] ?? "General", format = "webp", target = TARGET_BYTES } = {}) {
  // HEIC/HEIF is what iPhones take photos in: tried too (Safari can read them), and turned into WebP/JPEG like the rest.
  if (!file || !/^image\/(jpeg|png|webp|gif|svg\+xml|heic|heif)$/.test(file.type)) throw new Error("Please choose a JPG, PNG, WebP, GIF or SVG image.");
  if (file.size > MAX_PICKED) throw new Error("That picture is over 40 MB — please choose a smaller one.");
  // SVG logos and animated GIFs are kept as they are; everything else is made smaller and turned into WebP.
  const asIs = file.type === "image/gif" || file.type === "image/svg+xml";
  // format: "webp" (small — most pictures), "png" (the favicon: every browser shows it) or "jpeg" (social previews: Facebook, WhatsApp and the rest all read it).
  const blob = asIs ? file : await shrink(file, DEMO_MODE ? Math.min(maxSize, 800) : maxSize, format, target);
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
  // It goes into the uploader's own pictures (only they and the Master Admin can see them there).
  if (library) {
    const me = await getUser().catch(() => null);
    await addToLibrary({ url, path, name: file.name.slice(0, 120), category, ...(me ? { owner_id: me.id, owner_name: me.profile?.full_name || me.email || "" } : {}) });
  }
  return url;
}

/**
 * A document (PDF) — meeting minutes, an agenda. Kept as it is, 5 MB at most.
 * Returns its public link. In demo mode it is kept inside the browser, so only small files fit.
 */
/** Documents the League downloads page can hold (Rich, round 23): PDFs, Word, Excel, PowerPoint and pictures. */
export const DOC_TYPES = {
  "application/pdf": "pdf", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};
export const DOC_ACCEPT = Object.keys(DOC_TYPES).join(",");
export async function uploadFile(file, { folder = "files", any = false } = {}) {
  if (any) return uploadDocument(file, folder);
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

/** Any of DOC_TYPES, kept exactly as it is (a poster, a Word entry form, a spreadsheet…). */
async function uploadDocument(file, folder) {
  const ext = file && DOC_TYPES[file.type];
  if (!ext) throw new Error("Please choose a PDF, Word, Excel, PowerPoint or picture file.");
  if (file.size > MAX_BYTES) throw new Error("That file is over 5 MB — please save a smaller copy.");
  if (DEMO_MODE) {
    if (file.size > 400 * 1024) throw new Error("The demo keeps files in this browser, so it can only take a file under 400 KB. The live site takes up to 5 MB.");
    return toDataUrl(file);
  }
  const safe = String(file.name || "file").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "file";
  const path = `${folder}/${Date.now()}-${safe}.${ext}`;
  const { error } = await db.storage.from("images").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(/row-level|unauthori/i.test(error.message) ? "You don't have permission to upload documents." : /mime|not supported/i.test(error.message) ? "The file store isn't set up for this kind of file yet — run supabase/schema.sql again in Supabase." : error.message);
  return db.storage.from("images").getPublicUrl(path).data.publicUrl;
}

/**
 * Make a picture ready for the website, whatever was chosen (a 10 MB phone photo included):
 *   - at most `maxSize` pixels on its longest side (1600 for most pictures — sharp on any screen);
 *   - WebP, the small modern format. iPhones and Macs (Safari) cannot make WebP in the browser,
 *     so there it becomes a JPEG instead, made to the same size;
 *   - about 300 KB at most (`target`; a photo of a paper scorecard may be bigger, to stay readable): the quality is stepped down until it fits, and if a very detailed photo
 *     still doesn't, it is made a little smaller (never under 1000 pixels).
 * PNG (the favicon) is only resized.
 */
export async function shrink(file, maxSize, format = "webp", target = TARGET_BYTES) {
  const source = await decode(file);
  const type = format === "png" ? "image/png" : format === "jpeg" || !(await canMakeWebp()) ? "image/jpeg" : "image/webp";
  const [w, h] = dims(source);
  let size = Math.min(maxSize, Math.max(w, h));
  for (;;) {
    const canvas = draw(source, size, type);
    if (type === "image/png") return toBlob(canvas, type);
    let blob = null;
    for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5]) {
      blob = await toBlob(canvas, type, quality);
      if (blob.size <= target) return blob;
    }
    if (size <= 1000) return blob;              // as small as it should go: keep the best of it
    size = Math.max(1000, Math.round(size * 0.8));
  }
}

const dims = (source) => [source.naturalWidth || source.width, source.naturalHeight || source.height];

function draw(source, longest, type) {
  const [w, h] = dims(source);
  const scale = Math.min(1, longest / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const g = canvas.getContext("2d");
  // A JPEG has no see-through parts: a logo with a transparent background goes on white, not black.
  if (type === "image/jpeg") { g.fillStyle = "#fff"; g.fillRect(0, 0, canvas.width, canvas.height); }
  g.imageSmoothingQuality = "high";
  g.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas, type, quality) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("This browser couldn't process that picture — try another one."))), type, quality));

/** Read the picture (the right way up: phone photos carry their turn in the file). */
async function decode(file) {
  try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch {
    // Some browsers can only read some formats (e.g. an iPhone's HEIC) through an <img>.
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That picture couldn't be read — please choose a JPG or PNG.")); };
      img.src = url;
    });
  }
}

/** Can this browser make WebP? (Chrome, Edge, Firefox, Android: yes. Safari: no — it quietly makes a PNG instead.) */
let webp;
function canMakeWebp() {
  if (webp === undefined) {
    const c = document.createElement("canvas"); c.width = c.height = 2;
    webp = toBlob(c, "image/webp", 0.8).then((b) => b.type === "image/webp").catch(() => false);
  }
  return webp;
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
