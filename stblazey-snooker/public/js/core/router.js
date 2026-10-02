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
