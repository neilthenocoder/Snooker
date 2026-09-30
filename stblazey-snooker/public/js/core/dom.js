// Tiny HTML helpers. `html` escapes every value you drop into it,
// so text typed by users can never inject scripts into the page.
import { SITE } from "../config.js";

class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s));
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function render(v) {
  if (v == null || v === false) return "";
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(render).join("");
  return esc(v);
}
export function html(strings, ...values) {
  return new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? render(values[i]) : ""), ""));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function mount(el, content) { el.innerHTML = render(content); return el; }

/** Safe CSS url() for inline styles. */
export const cssUrl = (u) => `url("${encodeURI(u).replace(/["'()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}")`;

/** Plain text → escaped paragraphs (blank line = new paragraph). */
export const paragraphs = (text = "") =>
  html`${String(text).split(/\n\s*\n/).filter(Boolean).map((p) => html`<p>${raw(esc(p).replace(/\n/g, "<br>"))}</p>`)}`;

// ── dates (always shown in UK time) ───────────────────────────
const fmt = (opts) => new Intl.DateTimeFormat("en-GB", { timeZone: SITE.timeZone, ...opts });
const dateF = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const timeF = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
const dayF = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });
export const fmtDate = (iso) => (iso ? dateF.format(new Date(iso)) : "");
export const fmtTime = (iso) => (iso ? timeF.format(new Date(iso)) : "");
/** "YYYY-MM-DD" of an ISO timestamp in UK time. */
export const ukDay = (iso) => dayF.format(new Date(iso)).split("/").reverse().join("-");
export const todayUK = () => ukDay(new Date().toISOString());

/** Value for <input type="datetime-local"> in UK time, and back again. */
export function toLocalInput(iso) {
  if (!iso) return "";
  return `${ukDay(iso)}T${fmtTime(iso)}`;
}
export function fromLocalInput(value) {
  if (!value) return null;
  const [date, time] = value.split("T");
  const guess = new Date(`${date}T${time}:00Z`);
  const offsetMin = (new Date(guess.toLocaleString("en-US", { timeZone: SITE.timeZone })) - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }))) / 60000;
  return new Date(guess.getTime() - offsetMin * 60000).toISOString();
}

export function toast(message, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  let box = document.querySelector(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.append(box); }
  box.append(el);
  setTimeout(() => el.remove(), type === "error" ? 6000 : 2800);
}

/** Collect a form's fields into an object (checkboxes → booleans, numbers → numbers). */
export function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type === "number") out[el.name] = el.value === "" ? null : Number(el.value);
    else out[el.name] = el.value.trim() === "" ? null : el.value.trim();
  }
  return out;
}
