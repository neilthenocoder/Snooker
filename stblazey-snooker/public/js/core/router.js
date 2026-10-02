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
