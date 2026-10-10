// The loading screen and the colours chosen under Admin → Branding, applied before anything is drawn
// (they are remembered in the browser, so they show at once). This is a file of its own, loaded by
// index.html, because the site's security rules (public/_headers) do not allow a script to be written
// straight into a page.
try {
  var b = JSON.parse(localStorage.getItem("sbdsl-brand") || "{}"), r = document.documentElement, boot = document.getElementById("boot");
  for (var k in (b.vars || {})) r.style.setProperty(k, b.vars[k]);
  if (b.sidebar === "left") r.classList.add("sidebar-left");
  if (b.sections !== false) r.classList.add("section-colors");
  if (b.loaderShow === false) boot.classList.add("off");
  if (b.loader) boot.querySelector("img").src = b.loader;
} catch (e) {}
