// ─────────────────────────────────────────────────────────────
//  SIDE ADVERTS (Rich, round 22/23: paid advertising). Admin → Website → Side adverts.
//  An advert goes at the top of the side column — everywhere, or only on chosen pages:
//  one venue (an advert for Bethel Social Club on Bethel's page), one team, one competition,
//  one league, or a kind of page (presentation night: the band or the tickets; in memoriam: a florist…).
//  An advert for the page itself comes first. Pages without a side column show it as a strip under the heading.
//  Nothing shows until an advert is added (the slot "doesn't show by default").
// ─────────────────────────────────────────────────────────────
import { html, mount, safeHref, ukDay } from "./dom.js";
import { table } from "./api.js";

/** The kinds of page an advert can be aimed at (Target: "A kind of page"). */
export const AD_PAGES = [["home", "Home page"], ["presentation", "Presentation night"], ["memoriam", "In memoriam"], ["news", "News"], ["article", "A news article"],
  ["fixtures", "Fixtures"], ["results", "Results"], ["league", "League"], ["standings", "League tables"], ["competitions", "Competitions"], ["competition", "A competition"],
  ["venues", "Venues"], ["venue", "A venue"], ["team", "A team"], ["player", "A player"], ["match", "A match"], ["marketplace", "Marketplace"], ["downloads", "Downloads"],
  ["hall-of-fame", "Hall of Fame"], ["calendar", "Calendar"], ["handicaps", "Handicaps"], ["sponsorship", "Sponsorship"]];

const matches = (ad, page, slug) => {
  switch (ad.target) {
    case "all": return true;
    case "page": return String(ad.target_ref ?? "").split(/[\s,]+/).includes(page);
    case "venue": return page === "venue" && slug === ad.target_ref;
    case "team": return page === "team" && slug === ad.target_ref;
    case "competition": return ["competition", "draw"].includes(page) && slug === ad.target_ref;
    case "league": return ["standings", "shield"].includes(page) && slug === ad.target_ref;
    default: return false;
  }
};
const adBox = (ad) => {
  const link = safeHref(ad.link_url), out = /^https?:/i.test(link);
  const a = (inner, cls = "") => (link ? html`<a class="${cls}" href="${link}" ${out ? html`target="_blank" rel="noopener sponsored"` : ""}>${inner}</a>` : html`<span class="${cls}">${inner}</span>`);
  return html`<div class="ad-box"><small class="ad-label">Advert</small>
    ${ad.image_url ? a(html`<img src="${ad.image_url}" alt="${ad.heading || ad.name}" loading="lazy">`, "ad-pic") : ""}
    ${ad.heading || ad.body ? html`<div class="ad-text">${ad.heading ? html`<b>${ad.heading}</b>` : ""}${ad.body ? html`<p>${ad.body}</p>` : ""}
      ${link && ad.button_text ? a(ad.button_text, "btn small") : ""}</div>` : ""}</div>`;
};

/** After a page has drawn: put its advert(s) in place. */
export async function placeAds(view, page, params = {}) {
  const today = ukDay(new Date().toISOString());
  const all = (await table("ads", "sort").catch(() => [])).filter((a) => a.is_active && (!a.starts_on || a.starts_on <= today) && (!a.ends_on || a.ends_on >= today) && (a.image_url || a.heading));
  const slug = params.slug ?? params.id ?? "";
  const mine = all.filter((a) => a.target !== "all" && matches(a, page, slug));
  const list = [...mine, ...all.filter((a) => a.target === "all")].slice(0, 2);
  if (!list.length || !view.isConnected) return;
  const slot = document.createElement("div");
  slot.className = "ad-slot";
  mount(slot, list.map(adBox));
  const side = view.querySelector("aside.sidebar") ?? document.querySelector("#side aside.sidebar, #side .sidebar");
  if (side) return side.prepend(slot);
  // No side column on this page: a strip under the page's heading.
  slot.classList.add("ad-inline");
  const h1 = view.querySelector("h1");
  const hero = h1?.closest("section");                       // a full-width heading band (in memoriam, presentation night)
  if (hero) { slot.classList.add("wrap"); hero.after(slot); }
  else if (h1) (h1.parentElement.matches(".wrap") ? h1 : h1.parentElement).after(slot);
  else view.prepend(slot);
}
