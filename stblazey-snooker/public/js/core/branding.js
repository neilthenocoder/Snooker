// ─────────────────────────────────────────────────────────────
//  BRANDING — turns the choices made under Admin → Branding
//  (colours, fonts, layout, loading logo) into what the pages
//  actually look like. The stylesheet reads everything from CSS
//  variables, so this file only has to set those.
// ─────────────────────────────────────────────────────────────
const CACHE = "sbdsl-brand";

/** Fonts offered in Admin → Branding (all free from Google Fonts). The first of each is the standard one. */
export const FONTS = {
  head: ["Space Grotesk", "Oswald", "Bebas Neue", "Barlow Condensed", "Montserrat", "Poppins", "Archivo", "Roboto Condensed", "Teko", "Anton"],
  body: ["Questrial", "Inter", "Open Sans", "Roboto", "Lato", "Nunito", "Source Sans 3", "Plus Jakarta Sans", "Poppins", "Montserrat"],
};

/** Colour settings → the CSS variable each one drives, and (for menu buttons) the variable for its text. */
const COLOURS = {
  color_primary: ["--red"],
  color_home: ["--nav-home", "--nav-home-ink"],
  color_competitions: ["--yellow", "--nav-comps-ink"],
  color_fixtures: ["--green", "--nav-fixtures-ink"],
  color_league: ["--nav-league", "--nav-league-ink"],
  color_login: ["--nav-login", "--nav-login-ink"],
  color_background: ["--cream"],
};

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v ?? "");
/** Black or white — whichever reads better on this colour. */
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1b0e06" : "#ffffff";
}
const darker = (hex, by = 0.82) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * by).toString(16).padStart(2, "0")).join("")}`;

/** The plain values the page needs, worked out from the settings row. */
function brandOf(site) {
  const vars = {};
  for (const [key, [main, ink]] of Object.entries(COLOURS)) {
    const v = site[key];
    if (!isHex(v)) continue;
    vars[main] = v;
    if (ink) vars[ink] = inkOn(v);
    if (key === "color_primary") vars["--red-dark"] = darker(v);
  }
  const fonts = [site.font_head, site.font_body].filter((f) => f && [...FONTS.head, ...FONTS.body].includes(f));
  if (FONTS.head.includes(site.font_head)) vars["--font-head"] = `"${site.font_head}", "Arial", sans-serif`;
  if (FONTS.body.includes(site.font_body)) vars["--font-body"] = `"${site.font_body}", "Helvetica Neue", Arial, system-ui, sans-serif`;
  return {
    vars, fonts,
    sidebar: ["left", "below"].includes(site.sidebar_layout) ? site.sidebar_layout : "right",
    sections: site.section_colors !== false,
    loader: site.loading_logo_url || site.logo_url || "",
  };
}

/** Put a brand on the page. (Also called from index.html's first lines with the remembered brand, so the right colours show straight away.) */
export function paint(brand) {
  const root = document.documentElement;
  for (const name of [...Object.values(COLOURS).flat(), "--red-dark", "--font-head", "--font-body"]) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(brand.vars ?? {})) root.style.setProperty(name, value);
  root.classList.toggle("sidebar-left", brand.sidebar === "left");
  root.classList.toggle("sidebar-below", brand.sidebar === "below");
  root.classList.toggle("section-colors", brand.sections !== false);
  let link = document.getElementById("brand-fonts");
  if (brand.fonts?.length) {
    if (!link) { link = Object.assign(document.createElement("link"), { id: "brand-fonts", rel: "stylesheet" }); document.head.append(link); }
    const href = `https://fonts.googleapis.com/css?family=${brand.fonts.map((f) => `${f.replace(/ /g, "+")}:400,500,600,700`).join("|")}&display=swap`;
    if (link.href !== href) link.href = href;
  } else link?.remove();
  const logo = document.querySelector("#boot img");
  if (logo && brand.loader && logo.getAttribute("src") !== brand.loader) logo.src = brand.loader;
}

/** Apply the site settings, and remember them for the next visit's loading screen. */
export function applyBranding(site) {
  const brand = brandOf(site);
  paint(brand);
  try { localStorage.setItem(CACHE, JSON.stringify(brand)); } catch {}
}

// ── full-screen loading logo ──────────────────────────────────
let waiting = null;
/** Show the black loading screen if the page hasn't appeared within `delay` ms. */
export function loaderOn(delay = 300) {
  clearTimeout(waiting);
  waiting = setTimeout(() => document.getElementById("boot")?.classList.remove("done"), delay);
}
export function loaderOff() {
  clearTimeout(waiting);
  document.getElementById("boot")?.classList.add("done");
}
