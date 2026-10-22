// ─────────────────────────────────────────────────────────────
//  THE MENU BAR (Rich, round 22: a menu creator, with re-ordering).
//  Admin → Website → Menu saves the buttons in settings.menu_items and
//  the extra links of the phone menu in settings.menu_more. Nothing
//  saved = the standard menu below, exactly as before.
//  A button: { label, href, color, hidden }. color is one of the section
//  colours (home, comps, fixtures, league, news, live — they follow
//  Admin → Branding) or a colour of its own ("#0b84e0"). The "live" button
//  is the pulsing LIVE button (its colour changes by itself).
// ─────────────────────────────────────────────────────────────
import { safeHref } from "./dom.js";

export const MENU_COLORS = { home: "Home colour (brown)", comps: "Competitions colour (yellow)", fixtures: "Fixtures colour (green)", league: "League colour (white)", news: "News colour (blue)", login: "Red", live: "LIVE button (changes by itself)" };
export const STANDARD_MENU = [
  { label: "Home", href: "/", color: "home" },
  { label: "Competitions", href: "/competitions", color: "comps" },
  { label: "Fixtures", href: "/fixtures", color: "fixtures" },
  { label: "League", href: "/league", color: "league" },
  { label: "News", href: "/news", color: "news" },
  { label: "Live", href: "/live", color: "live" },
];
export const STANDARD_MORE = [
  { label: "Calendar", href: "/calendar" }, { label: "Results", href: "/results" }, { label: "Handicaps", href: "/handicaps" },
  { label: "Our Players", href: "/players" }, { label: "Form guide", href: "/form" }, { label: "Season wrapped", href: "/wrapped" }, { label: "Seasons", href: "/seasons" }, { label: "Live scoreboard", href: "/scoreboard" },
  { label: "Marketplace", href: "/marketplace" }, { label: "Hall of Fame", href: "/hall-of-fame" }, { label: "Downloads", href: "/downloads" },
];

const HEX = /^#[0-9a-f]{6}$/i;
const clean = (list, withColor) => (Array.isArray(list) ? list : [])
  .map((x) => ({ label: String(x?.label ?? "").trim().slice(0, 30), href: safeHref(String(x?.href ?? "").trim()) ? String(x.href).trim() : "",
    ...(withColor ? { color: MENU_COLORS[x?.color] || HEX.test(x?.color ?? "") ? x.color : "league", hidden: !!x?.hidden } : {}) }))
  .filter((x) => x.label && x.href);

/** The menu bar's buttons, in order (only the ones that are showing). */
export const menuItems = (site, { all = false } = {}) => {
  const saved = clean(site?.menu_items, true);
  const list = saved.length ? saved : STANDARD_MENU.map((x) => ({ ...x, hidden: false }));
  return all ? list : list.filter((x) => !x.hidden);
};
/** The extra links under the buttons in the phone menu. */
export const menuMore = (site) => (Array.isArray(site?.menu_more) ? clean(site.menu_more, false) : STANDARD_MORE);
/** class and style for a button of the menu bar. */
export const menuLook = (item) => (item.color === "live" ? { cls: "nav-live nav-live-btn state-idle", style: "" }
  : HEX.test(item.color) ? { cls: "nav-own", style: `--own:${item.color};--own-ink:${inkFor(item.color)}` }
  : { cls: `nav-${item.color}`, style: "" });
/** Black or white writing, whichever reads better on the colour. */
export function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
}
export const isOutside = (href) => /^https?:\/\//i.test(href);
