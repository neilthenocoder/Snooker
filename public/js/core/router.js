// Shared navigation helpers for pages (main.js plugs in the real router).
import { SITE } from "../config.js";

let handler = (path) => { location.href = path; };
export const setNavigator = (fn) => { handler = fn; };
export const navigate = (path, opts) => handler(path, opts);

let shellRefresher = async () => {};
export const setShellRefresher = (fn) => { shellRefresher = fn; };
export const refreshShell = () => shellRefresher();

export function setTitle(title) {
  document.title = title ? `${title} | ${SITE.name}` : SITE.name;
}

// ── "Edit this page" button ──────────────────────────────────
// A page says which admin section edits it; the shell shows a button to
// the people allowed to use that section (see drawEditButton in main.js).
let editTarget = null;
/** e.g. adminEdit("teams", team.id) or adminEdit("fixtures", null, { href: "/scorecard/…", label: "Edit scorecard" }) */
export function adminEdit(section, id = null, { href = null, label = null } = {}) {
  editTarget = { section, href: href ?? `/admin/${section}${id ? `?edit=${encodeURIComponent(id)}` : ""}`, label };
}
export const takeEditTarget = () => { const t = editTarget; editTarget = null; return t; };

// ── what the page is about (for the side boxes) ──────────────
// When Admin → Branding gives a part of the site a sidebar, the boxes in it follow the page:
// a competition's page gets that competition's breaks and news, a team's page its league, and so on.
// A page says what it is about with sideContext({ competition }) / ({ league }) / ({ team }) / ({ player });
// main.js collects it after the page has drawn (see core/side.js).
let sideAbout = null;
export function sideContext(about) { sideAbout = about; }
export const takeSideContext = () => { const a = sideAbout; sideAbout = null; return a; };
