// Image uploads: shrinks the picture in the browser first (fast pages, small
// storage), then stores it in the Supabase "images" bucket and returns its URL.
// In demo mode the picture is kept inside the browser instead.
import { db } from "./db.js";
import { DEMO_MODE } from "../config.js";

const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadImage(file, { folder = "misc", maxSize = 1600 } = {}) {
  if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("Please choose a JPG, PNG, WebP or GIF image.");
  // Animated GIFs are kept as they are; everything else is resized and converted to WebP.
  const blob = file.type === "image/gif" ? file : await resize(file, DEMO_MODE ? Math.min(maxSize, 800) : maxSize);
  if (blob.size > MAX_BYTES) throw new Error("That image is over 5 MB even after shrinking — please use a smaller one.");
  if (DEMO_MODE) return toDataUrl(blob);

  const ext = blob.type.split("/")[1];
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await db.storage.from("images").upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (error) throw new Error(/row-level|unauthori/i.test(error.message) ? "Only the admin can upload images." : error.message);
  return db.storage.from("images").getPublicUrl(path).data.publicUrl;
}

async function resize(file, maxSize) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.85));
  return blob ?? new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
}

const toDataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(new Error("Couldn't read that image."));
  r.readAsDataURL(blob);
});
