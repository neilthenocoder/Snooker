// Light or dark (the St Blazey design system). Runs in <head>, before the page is drawn, so it never flashes.
// The visitor's own choice (the sun and moon buttons in the menu) is remembered in this browser. With none, the
// website's standard (Admin → Branding → Light and dark) is used, and if that is "the device's setting", the device's.
// The match strip, the competition panel and the footer stay dark either way.
(function () {
  var t, std;
  try { t = localStorage.getItem("sb-theme"); } catch (e) { /* private window */ }
  try { std = (JSON.parse(localStorage.getItem("sbdsl-brand") || "{}") || {}).theme; } catch (e) { /* none yet */ }
  if (t !== "light" && t !== "dark") t = std === "light" || std === "dark" ? std : window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
})();
