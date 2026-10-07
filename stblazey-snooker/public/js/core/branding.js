// ─────────────────────────────────────────────────────────────
//  BRANDING — turns the choices made under Admin → Branding
//  (colours, fonts, page layouts, loading screen) into what the
//  pages actually look like. The stylesheet reads everything from
//  CSS variables, so this file only has to set those.
// ─────────────────────────────────────────────────────────────
const CACHE = "sbdsl-brand";

/** Fonts offered in Admin → Branding (all free from Google Fonts). The first of each is the standard one. */
export const FONTS = {
  head: ["Space Grotesk", "Oswald", "Bebas Neue", "Barlow Condensed", "Montserrat", "Poppins", "Archivo", "Roboto Condensed", "Teko", "Anton"],
  body: ["Questrial", "Inter", "Open Sans", "Roboto", "Lato", "Nunito", "Source Sans 3", "Plus Jakarta Sans", "Poppins", "Montserrat"],
};

/** The parts of the site that can each have their own page layout (Admin → Branding → Page layout). */
export const LAYOUT_GROUPS = [["home", "Home page"], ["competitions", "Competitions"], ["fixtures", "Fixtures"], ["league", "League"], ["news", "News"]];
export const LAYOUT_LABELS = { auto: "Standard — as each page was designed", sidebar: "Right sidebar on every page", full: "Full width on every page" };

/** Colour settings → the CSS variable each one drives, and (for menu buttons) the variable for its text. */
const COLOURS = {
  color_primary: ["--red"],
  color_home: ["--nav-home", "--nav-home-ink"],
  color_competitions: ["--yellow", "--nav-comps-ink"],
  color_fixtures: ["--green", "--nav-fixtures-ink"],
  color_league: ["--nav-league", "--nav-league-ink"],
  color_news: ["--nav-news", "--nav-news-ink"],
  color_login: ["--nav-login", "--nav-login-ink"],
  color_background: ["--cream"],
};

/**
 * Text sizes that can be set under Admin → Branding → Text sizes: [key, name, standard size in px, CSS variable].
 * Leave one empty to keep the standard size. (Phones keep their own, smaller headings and menu.)
 */
export const TEXT_SIZES = [
  ["body", "Normal text (paragraphs, lists)", 15, "--fs-body"],
  ["h1", "Page titles (H1)", 38, "--fs-h1"],
  ["h2", "Section headings (H2)", 22, "--fs-h2"],
  ["h3", "Smaller headings (H3)", 20, "--fs-h3"],
  ["panel", "Box headings (the coloured bars on tables and boxes)", 18, "--fs-panel"],
  ["table", "Tables: rows", 14, "--fs-table"],
  ["table_head", "Tables: column headings", 14, "--fs-table-head"],
  ["nav", "Menu buttons", 18, "--fs-nav"],
  ["button", "Buttons", 15, "--fs-button"],
  ["prose", "Articles and info pages", 16, "--fs-prose"],
];

/** Ticker speed (Admin → Site settings → Announcements ticker): 1 = very slow … 10 = fast, in pixels a second. */
export const TICKER_PX = [16, 24, 34, 46, 60, 76, 94, 114, 136, 160];

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v ?? "");
/** Black or white — whichever reads better on this colour. */
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1b0e06" : "#ffffff";
}
const darker = (hex, by = 0.82) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * by).toString(16).padStart(2, "0")).join("")}`;

/**
 * Reads what Google Fonts gives you under "Get embed code" — the <link …> lines, the @import line,
 * or just the address — and returns { url, families } (null if there's no Google Fonts address in it).
 * Only fonts.googleapis.com is accepted, so nothing else can be loaded through this box.
 */
export function parseFontEmbed(text) {
  const hit = String(text ?? "").replace(/&amp;/g, "&").match(/https:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s)<>]+/);
  if (!hit) return null;
  const url = hit[0];
  const families = [...url.matchAll(/[?&]family=([^&]+)/g)]
    .flatMap((m) => decodeURIComponent(m[1].replace(/\+/g, " ")).split("|"))
    .map((f) => f.split(":")[0].trim())
    .filter((f) => /^[\w .'-]{1,60}$/.test(f));
  return families.length ? { url, families: [...new Set(families)] } : null;
}

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
  // Fonts: one of the built-in list, or one from the pasted Google Fonts embed link.
  const embed = parseFontEmbed(site.font_embed);
  const mine = embed?.families ?? [];
  const links = [];
  const builtIn = [site.font_head, site.font_body].filter((f) => f && !mine.includes(f) && [...FONTS.head, ...FONTS.body].includes(f));
  if (builtIn.length) links.push(`https://fonts.googleapis.com/css?family=${[...new Set(builtIn)].map((f) => `${f.replace(/ /g, "+")}:400,500,600,700`).join("|")}&display=swap`);
  if (embed && [site.font_head, site.font_body].some((f) => mine.includes(f))) links.push(embed.url);
  if ([...FONTS.head, ...mine].includes(site.font_head)) vars["--font-head"] = `"${site.font_head}", "Arial", sans-serif`;
  if ([...FONTS.body, ...mine].includes(site.font_body)) vars["--font-body"] = `"${site.font_body}", "Helvetica Neue", Arial, system-ui, sans-serif`;
  // Text sizes: only the ones that have been changed.
  for (const [key, , , cssVar] of TEXT_SIZES) {
    const n = Number(site.text_sizes?.[key]);
    if (n >= 8 && n <= 90) vars[cssVar] = `${n}px`;
  }
  // Page titles shrink with the screen: keep that in step with the chosen size (38px ↔ 4vw as standard).
  if (vars["--fs-h1"]) vars["--fs-h1-fluid"] = `${((parseFloat(vars["--fs-h1"]) / 38) * 4).toFixed(2)}vw`;
  const layouts = {};
  for (const [group] of LAYOUT_GROUPS) layouts[group] = ["sidebar", "full"].includes(site.page_layouts?.[group]) ? site.page_layouts[group] : "auto";
  return {
    vars, links, layouts,
    sidebar: site.sidebar_layout === "left" ? "left" : "right",
    sections: site.section_colors !== false,
    loader: site.loading_logo_url || site.logo_url || "",
    loaderShow: site.loader_show !== false,
    loaderMs: Math.max(0, Math.min(10, Number(site.loader_seconds) || 0)) * 1000,
  };
}

let current = { layouts: {}, loaderShow: true, loaderMs: 0 };
/** "auto" | "sidebar" | "full" for one part of the site (home, competitions, fixtures, league, news). */
export const layoutFor = (group) => current.layouts?.[group] ?? "auto";

/** Put a brand on the page. (index.html's first lines do the same with the remembered brand, so the right colours show straight away.) */
export function paint(brand) {
  current = brand;
  const root = document.documentElement;
  for (const name of [...Object.values(COLOURS).flat(), "--red-dark", "--font-head", "--font-body", "--fs-h1-fluid", ...TEXT_SIZES.map((t) => t[3])]) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(brand.vars ?? {})) root.style.setProperty(name, value);
  root.classList.toggle("sidebar-left", brand.sidebar === "left");
  root.classList.toggle("section-colors", brand.sections !== false);
  // Font stylesheets: keep the ones still wanted, drop the rest.
  const wanted = brand.links ?? [];
  for (const link of document.querySelectorAll("link[data-brand-font]")) if (!wanted.includes(link.href)) link.remove();
  for (const href of wanted) {
    if ([...document.querySelectorAll("link[data-brand-font]")].some((l) => l.href === href)) continue;
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href });
    link.dataset.brandFont = "";
    document.head.append(link);
  }
  const boot = document.getElementById("boot");
  boot?.classList.toggle("off", brand.loaderShow === false);
  const logo = boot?.querySelector("img");
  if (logo && brand.loader && logo.getAttribute("src") !== brand.loader) logo.src = brand.loader;
}

/** Apply the site settings, and remember them for the next visit's loading screen. */
export function applyBranding(site) {
  const brand = brandOf(site);
  paint(brand);
  try { localStorage.setItem(CACHE, JSON.stringify(brand)); } catch {}
}

// ── full-screen loading logo ──────────────────────────────────
let waiting = null, firstLoad = true;
/** Show the black loading screen if the page hasn't appeared within `delay` ms. */
export function loaderOn(delay = 300) {
  clearTimeout(waiting);
  if (current.loaderShow === false) return;
  waiting = setTimeout(() => document.getElementById("boot")?.classList.remove("done"), delay);
}
/**
 * Hide it again. When the site is first opened it stays up for at least the time set under
 * Admin → Branding → Loading screen; moving between pages afterwards it only shows while a page is slow.
 */
export function loaderOff() {
  clearTimeout(waiting);
  const hide = () => document.getElementById("boot")?.classList.add("done");
  const left = firstLoad && current.loaderShow !== false ? (current.loaderMs || 0) - performance.now() : 0;
  firstLoad = false;
  if (left > 0) waiting = setTimeout(hide, left); else hide();
}
