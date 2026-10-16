// ─────────────────────────────────────────────────────────────
//  SEO (Rich, round 22: "the Framer way" — site settings and page settings).
//  Admin → Website → SEO. The site's title, language, description and preview
//  picture are in settings (social_title, site_language, social_description,
//  social_image_url); each page can have its own in seo_pages, by its address.
//  Search engines and link previews read them from the page Netlify sends
//  (netlify/edge-functions/social.js); this file keeps the open page in step
//  as people move around the site, and tells the site search what to leave out.
// ─────────────────────────────────────────────────────────────
import { SITE } from "../config.js";
import { seoPages } from "./api.js";

/** The standard pages that can have their own settings (address → name in the dashboard). */
export const SEO_PAGES = [
  ["/", "Home page"], ["/news", "News"], ["/fixtures", "Fixtures"], ["/results", "Results"], ["/league", "League"], ["/competitions", "Competitions"],
  ["/live", "Live"], ["/calendar", "Calendar"], ["/players", "Our players"], ["/seasons", "Seasons"], ["/archive", "Archive"], ["/handicaps", "Handicaps"],
  ["/venues", "Venues"], ["/rules", "Rules"], ["/meetings", "Meetings"], ["/presentation", "Presentation night"], ["/in-memoriam", "In memoriam"],
  ["/merchandise", "Merchandise"], ["/marketplace", "Marketplace"], ["/enter", "Competition entry form"], ["/cueview", "CueView form"], ["/scoreboard", "Live scoreboard"],
];

const norm = (path) => (String(path || "/").replace(/\/+$/, "") || "/").toLowerCase();
/** This page's own settings, if it has any. */
export async function seoFor(path) {
  const rows = await seoPages().catch(() => []);
  return rows.find((r) => norm(r.path) === norm(path)) ?? null;
}
/** Addresses left out of the site's own search. */
export async function hiddenFromSearch() {
  const rows = await seoPages().catch(() => []);
  return new Set(rows.filter((r) => r.hide_in_search).map((r) => norm(r.path)));
}
export const isHidden = (hidden, href) => hidden.has(norm(String(href).split(/[?#]/)[0]));

function meta(name, content, attr = "name") {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (content == null) return el?.remove();
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.append(el); }
  el.setAttribute("content", content);
}

/** After a page has drawn: its own title and description (if it has them), the language, and "don't index" when ticked. */
export async function applySeo(site, path) {
  document.documentElement.lang = site?.site_language || "en-GB";
  const row = await seoFor(path);
  const siteText = String(site?.social_description ?? "").trim();
  if (row?.title) document.title = row.title;
  else if (norm(path) === "/" && String(site?.social_title ?? "").trim()) document.title = site.social_title.trim();
  const text = String(row?.description ?? "").trim() || siteText;
  if (text) { meta("description", text); meta("og:description", text, "property"); }
  meta("og:title", document.title, "property");
  meta("robots", row?.noindex ? "noindex, nofollow" : null);
}
export const siteTitle = (site) => String(site?.social_title ?? "").trim() || SITE.name;
