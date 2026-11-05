// Light or dark (the St Blazey design system). Runs in <head>, before the page is drawn, so it never flashes.
// The visitor's own choice (the sun and moon buttons in the menu) is remembered in this browser; with none, the
// device's own setting is followed. The match strip, the competition panel and the footer stay dark either way.
(function () {
  var t;
  try { t = localStorage.getItem("sb-theme"); } catch (e) { /* private window: just follow the device */ }
  if (t !== "light" && t !== "dark") t = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
})();
