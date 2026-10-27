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

/**
 * A web address typed in the dashboard, made safe to use as a link: only http(s), mailto, tel, a page of
 * this site (/…) or a place on the page (#…) is allowed. Anything else (a "javascript:" address, say)
 * gives "" — so a link that could run code in a visitor's browser is never drawn. (Pictures and PDFs that the
 * demo keeps inside the browser are let through too: they cannot run anything.)
 */
export const safeHref = (u) => { const v = String(u ?? "").trim(); return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|data:(image\/(png|jpe?g|webp|gif)|application\/pdf)[;,])/i.test(v) ? v : ""; };

/** Plain text → escaped paragraphs (blank line = new paragraph). */
export const paragraphs = (text = "") =>
  html`${String(text).split(/\n\s*\n/).filter(Boolean).map((p) => html`<p>${raw(esc(p).replace(/\n/g, "<br>"))}</p>`)}`;

// ── dates and times ───────────────────────────────────────────
// Match times are saved as exact moments, entered in UK time (GMT in winter, BST in summer).
// Visitors see each moment in THEIR OWN time zone — the browser knows it, and it knows when
// every country's clocks go forward and back — so 19:30 in St Blazey shows as 14:30 in New York.
// The admin dashboard keeps UK time, because that is what officers type into its forms.
// Dates with no time (a deadline, a season start: "2026-10-20") are a day on the calendar,
// not a moment, so they are shown exactly as written wherever the visitor is.
const fmtCache = new Map();
const fmtIn = (zone, opts) => {
  const key = zone + JSON.stringify(opts);
  if (!fmtCache.has(key)) fmtCache.set(key, new Intl.DateTimeFormat("en-GB", { timeZone: zone, ...opts }));
  return fmtCache.get(key);
};
let visitorZone = SITE.timeZone;
try { visitorZone = Intl.DateTimeFormat().resolvedOptions().timeZone || SITE.timeZone; } catch { /* old browser: UK time */ }
const inDashboard = () => typeof location !== "undefined" && /^\/admin(\/|$)/.test(location.pathname);
/** The time zone times are shown in on this page. */
export const shownZone = () => (inDashboard() ? SITE.timeZone : visitorZone);
const dateOnly = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const show = (iso, opts) => (iso ? fmtIn(dateOnly(iso) ? "UTC" : shownZone(), opts).format(new Date(iso)) : "");
const DATE = { day: "2-digit", month: "2-digit", year: "numeric" };
const TIME = { hour: "2-digit", minute: "2-digit", hour12: false };
const LONG = { day: "numeric", month: "long", year: "numeric" };
// Round 53 (Rich: "the date scenario… across the whole site"): "28th Oct 2026" instead of 28/10/2026, everywhere.
export const fmtDate = (iso) => (iso ? fmtDay(iso, { withYear: true }) : "");
/** "12 November 2024" — for dates inside sentences (the match preview summary). */
export const fmtLongDate = (iso) => show(iso, LONG);
export const fmtTime = (iso) => show(iso, TIME);
/** "27th Oct" (Rich, round 49: instead of 27/10/2026 in the Live & upcoming strip); withYear: "27th Oct 2026". */
const ORD = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
export const fmtDay = (iso, { withYear = false } = {}) => {
  if (!iso) return "";
  const parts = Object.fromEntries(fmtIn(dateOnly(iso) ? "UTC" : shownZone(), { day: "numeric", month: "short", year: "numeric" }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${ORD(Number(parts.day))} ${parts.month.replace(".", "").slice(0, 3)}${withYear ? ` ${parts.year}` : ""}`;
};
/** How long ago (Rich, round 49 — the banner's news date): today "26th Oct 2026", then "1 day ago", "3 days ago",
 *  "1 week ago", "2 months ago", "1 year ago". Counted in whole days on the visitor's calendar. */
export const fmtAgo = (iso) => {
  if (!iso) return "";
  const dayNo = (d) => { const p = Object.fromEntries(fmtIn(shownZone(), { year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d).map((x) => [x.type, x.value])); return Date.UTC(p.year, p.month - 1, p.day) / 864e5; };
  const days = Math.round(dayNo(new Date()) - dayNo(new Date(iso)));
  if (days <= 0) return fmtDay(iso, { withYear: true });
  const say = (n, unit) => `${n} ${unit}${n > 1 ? "s" : ""} ago`;
  return days < 7 ? say(days, "day") : days < 30 ? say(Math.floor(days / 7), "week") : days < 365 ? say(Math.floor(days / 30), "month") : say(Math.floor(days / 365), "year");
};
/** "19:30" in UK time, whoever is looking (forms and anything officers type in). */
export const fmtTimeUK = (iso) => (iso ? fmtIn(SITE.timeZone, TIME).format(new Date(iso)) : "");
/** True when this visitor's clock differs from UK time at that moment (or now). */
export const notUKTime = (iso = new Date().toISOString()) => fmtTime(iso) !== fmtTimeUK(iso);
/** "14:30 your time (19:30 UK)" for visitors abroad; just "19:30" in the UK. */
export const fmtTimeBoth = (iso) => (iso && notUKTime(iso) ? `${fmtTime(iso)} your time (${fmtTimeUK(iso)} UK)` : fmtTime(iso));
/** "New York" from "America/New_York" — for the note that times are in the visitor's own time. */
export const zoneName = () => String(shownZone().split("/").pop() || "").replace(/_/g, " ");
const dayF = fmtIn(SITE.timeZone, { year: "numeric", month: "2-digit", day: "2-digit" });
/** "YYYY-MM-DD" of an ISO timestamp in UK time. */
export const ukDay = (iso) => dayF.format(new Date(iso)).split("/").reverse().join("-");
export const todayUK = () => ukDay(new Date().toISOString());

/** Value for <input type="datetime-local"> in UK time, and back again. */
export function toLocalInput(iso) {
  if (!iso) return "";
  return `${ukDay(iso)}T${fmtTimeUK(iso)}`;
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

/**
 * A yes/no question in the site's own style (instead of the browser's grey box).
 * Resolves true when the green button is pressed.
 */
export function confirmBox(message, { ok = "Yes", cancel = "Cancel", title = "" } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "confirm-box";
    mount(dlg, html`${title ? html`<h3>${title}</h3>` : ""}<div class="confirm-text">${paragraphs(message)}</div>
      <div class="btn-row"><button type="button" class="btn ghost" data-no>${cancel}</button><button type="button" class="btn green" data-yes>${ok}</button></div>`);
    const done = (answer) => { dlg.close(); dlg.remove(); resolve(answer); };
    dlg.addEventListener("click", (e) => {
      if (e.target.closest("[data-yes]")) done(true);
      else if (e.target.closest("[data-no]") || e.target === dlg) done(false);
    });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); done(false); });
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector("[data-yes]").focus();
  });
}
