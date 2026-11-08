// ─────────────────────────────────────────────────────────────
//  POP-UPS (Rich, round 22)
//   • Pop-up adverts on the home page: promotions and offers laid over the
//     page (Admin → Website → Pop-up adverts) — a heading, text, a picture
//     and a button, or one whole picture that is a link.
//   • The newsletter sign-up (Admin → Newsletter → Sign-up pop-up): after a few
//     seconds on any public page, once per visitor; "✉ Sign up to the newsletter"
//     in the footer opens it any time. Every newsletter has an unsubscribe link.
//  What each visitor has already seen is remembered in their browser only.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, safeHref, ukDay } from "./dom.js";
import { table, newsletterSubscribe } from "./api.js";
import { DEMO_MODE } from "../config.js";

const SEEN_KEY = "sbds-popups-seen";          // { [popupId]: "2026-10-16T…" }
const NL_KEY = "sbds-newsletter";             // "subscribed" | "closed:<ISO>"
const NL_AGAIN_DAYS = 30;                      // after "No thanks", ask again a month later
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not remembered */ } };
let shownThisVisit = false, timer = null;

/** The one overlay box (only ever one at a time). */
function overlay(cls, body, { label, onClose = () => {} } = {}) {
  document.querySelector(".pop-shade")?.remove();
  const el = document.createElement("div");
  el.className = `pop-shade ${cls}`;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", label);
  mount(el, html`<div class="pop-box"><button type="button" class="pop-x" data-pop-close aria-label="Close">×</button>${body}</div>`);
  const close = () => { el.classList.remove("in"); setTimeout(() => el.remove(), 220); document.removeEventListener("keydown", onKey); onClose(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-pop-close]") || e.target.closest("a[href]")) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("in"));
  $(".pop-x", el).focus({ preventScroll: true });
  return { el, close };
}

/** Should this advert show to this visitor now? (once ever / once a day / every visit to the home page) */
function due(p, seen) {
  const last = seen[p.id];
  if (!last || p.frequency === "every") return true;
  if (p.frequency === "daily") return ukDay(last) !== ukDay(new Date().toISOString());
  return Date.parse(last) < Date.parse(p.updated_at ?? 0);      // "once": again only if the advert has been changed since
}

function showAdvert(p) {
  const link = safeHref(p.link_url), outside = /^https?:/i.test(link);
  const go = (inner, cls = "") => (link ? html`<a class="${cls}" href="${link}" ${outside ? html`target="_blank" rel="noopener"` : ""}>${inner}</a>` : inner);
  const body = p.kind === "image"
    ? go(html`<img class="pop-full" src="${p.image_url}" alt="${p.heading || p.name}">`, "pop-full-link")
    : html`${p.image_url ? html`<img class="pop-img" src="${p.image_url}" alt="">` : ""}
      <div class="pop-body">${p.heading ? html`<h2>${p.heading}</h2>` : ""}${p.body ? html`<p>${p.body}</p>` : ""}
        ${link ? go(p.button_text || "Find out more", "btn pop-btn") : ""}</div>`;
  overlay(`pop-advert ${p.kind === "image" ? "is-image" : ""}`, body, { label: p.heading || p.name });
  const seen = read(SEEN_KEY, {});
  seen[p.id] = new Date().toISOString(); write(SEEN_KEY, seen);
}

/** Called after every public page has drawn. */
export async function showPopups(page, site, user) {
  clearTimeout(timer);
  if (document.querySelector(".pop-shade")) return;
  if (page === "home") {
    const today = ukDay(new Date().toISOString()), seen = read(SEEN_KEY, {});
    const list = (await table("popups", "sort").catch(() => []))
      .filter((p) => p.is_active && (!p.starts_on || p.starts_on <= today) && (!p.ends_on || p.ends_on >= today) && (p.kind !== "image" || p.image_url))
      .filter((p) => due(p, seen));
    const p = list[0];
    if (p) {
      shownThisVisit = true;          // the newsletter waits for another page, so two pop-ups never pile up
      timer = setTimeout(() => location.pathname === "/" && !document.querySelector(".pop-shade") && showAdvert(p), Math.max(0, Number(p.delay_seconds) || 0) * 1000);
      return;
    }
  }
  // The newsletter: not for someone who has signed up (or said no thanks lately), and not straight after an advert.
  if (!site?.newsletter_popup_on || shownThisVisit) return;
  const state = read(NL_KEY, "");
  if (state === "subscribed" || (String(state).startsWith("closed:") && Date.now() - Date.parse(state.slice(7)) < NL_AGAIN_DAYS * 864e5)) return;
  timer = setTimeout(() => {
    if (document.querySelector(".pop-shade, dialog[open]") || /^\/(admin|login|my|scorecard)/.test(location.pathname)) return;
    shownThisVisit = true;
    openNewsletter(site, { auto: true, user });
  }, Math.max(3, Number(site.newsletter_delay) || 10) * 1000);
}

/** The newsletter sign-up box (the pop-up, or "✉ Sign up to the newsletter" in the footer). */
export function openNewsletter(site = {}, { auto = false, user = null } = {}) {
  let done = false;
  const box = overlay("pop-news", html`<div class="pop-body">
      <span class="pop-kicker">✉ Newsletter</span>
      <h2>${site.newsletter_title || "Get the league news by email"}</h2>
      <p>${site.newsletter_text || "Results, competition draws, presentation night and league news — straight to your inbox. Unsubscribe any time with the link at the bottom of every email."}</p>
      <form class="form pop-form" data-nl-form>
        <label>Your name <span class="muted">(optional)</span><input name="name" autocomplete="name" maxlength="120" value="${user?.profile?.full_name ?? ""}"></label>
        <label>Email address<input name="email" type="email" autocomplete="email" required maxlength="254" value="${user?.email ?? ""}"></label>
        <div data-nl-error></div>
        <button class="btn green">Sign me up</button>
        <p class="muted pop-small">We only use your email for the league's newsletter, and never share it.${DEMO_MODE ? " (Demo: nothing is sent.)" : ""}</p>
      </form></div>`,
  { label: "Sign up to the newsletter", onClose: () => { if (!done && auto) write(NL_KEY, `closed:${new Date().toISOString()}`); } });
  $("[data-nl-form]", box.el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await newsletterSubscribe(e.target.elements.email.value.trim(), e.target.elements.name.value.trim());
      done = true; write(NL_KEY, "subscribed");
      mount($(".pop-body", box.el), html`<span class="pop-kicker">✉ Newsletter</span><h2>You're signed up — thank you!</h2>
        <p>The next newsletter will come to your inbox. Every email has a link at the bottom to unsubscribe.</p>
        <button type="button" class="btn" data-pop-close>Close</button>`);
    } catch (err) {
      mount($("[data-nl-error]", box.el), html`<div class="notice error">${err.message}</div>`);
      btn.disabled = false;
    }
  });
  setTimeout(() => $("[name=email]", box.el)?.focus(), 60);
  return box;
}

// ─────────────────────────────────────────────────────────────
//  Round 111 (Rich: "add a newsletter signup box to the homepage (not as a link pop) but as a physical box at the
//  bottom (just home)"). The same sign-up as the pop-up, built into the page. Admin → Newsletter sign-up → "Show the
//  sign-up box at the bottom of the home page".
// ─────────────────────────────────────────────────────────────
const NL_ICON = html`<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>`;
const nlDone = () => html`<div class="sb-nlbox__done" role="status"><b>You're signed up — thank you!</b><span>The next newsletter will come to your inbox. Every email has a link at the bottom to unsubscribe.</span></div>`;

export function newsletterBox(site = {}, user = null) {
  if (site.home_sections?.newsletter_box === false) return "";
  const signed = read(NL_KEY, "") === "subscribed";
  return html`<section class="sb-nlbox" aria-labelledby="sb-nlbox-h" data-nlbox>
    <div class="sb-nlbox__text"><span class="sb-nlbox__icon">${NL_ICON}</span>
      <div><h2 id="sb-nlbox-h">${site.newsletter_title || "Get the league news by email"}</h2>
      <p>${site.newsletter_text || "Results, competition draws, presentation night and league news — straight to your inbox. Unsubscribe any time with the link at the bottom of every email."}</p></div></div>
    ${signed ? nlDone() : html`<form class="sb-nlbox__form" data-nlbox-form novalidate>
      <label class="sb-nlbox__field"><span class="sr-only">Your name (optional)</span><input name="name" autocomplete="name" maxlength="120" placeholder="Your name (optional)" value="${user?.profile?.full_name ?? ""}"></label>
      <label class="sb-nlbox__field"><span class="sr-only">Email address</span><input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="Email address" value="${user?.email ?? ""}"></label>
      <button class="sb-nlbox__btn">Sign me up</button>
      <p class="sb-nlbox__small" data-nl-error>We only use your email for the league's newsletter, and never share it.${DEMO_MODE ? " (Demo: nothing is sent.)" : ""}</p>
    </form>`}
  </section>`;
}

/** Makes the home page box work (called after the page has drawn). */
export function wireNewsletterBox(root) {
  const form = root?.querySelector("[data-nlbox-form]");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim(), msg = $("[data-nl-error]", form), btn = form.querySelector("button");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Please type your email address, like name@example.com."; msg.classList.add("is-error"); form.elements.email.focus(); return; }
    btn.disabled = true; btn.textContent = "Signing you up…";
    try {
      await newsletterSubscribe(email, form.elements.name.value.trim());
      write(NL_KEY, "subscribed");
      const box = document.createElement("div"); mount(box, nlDone()); form.replaceWith(box.firstElementChild);
    } catch (err) {
      msg.textContent = err.message || "That didn't work — please try again."; msg.classList.add("is-error");
      btn.disabled = false; btn.textContent = "Sign me up";
    }
  });
}
