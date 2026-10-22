// The loading screen and the colours chosen under Admin → Branding, applied before anything is drawn
// (they are remembered in the browser, so they show at once). This is a file of its own, loaded by
// index.html, because the site's security rules (public/_headers) do not allow a script to be written
// straight into a page.
try {
  var b = JSON.parse(localStorage.getItem("sbdsl-brand") || "{}"), r = document.documentElement, boot = document.getElementById("boot");
  for (var k in (b.vars || {})) r.style.setProperty(k, b.vars[k]);
  if (b.sidebar === "left") r.classList.add("sidebar-left");
  if (b.sections !== false) r.classList.add("section-colors");
  if (b.look !== "classic") r.classList.add("look-calm");
  if (b.loaderShow === false) boot.classList.add("off");
  // Only the logo uploaded under Admin → Branding — there is no stand-in picture.
  if (b.loader) { var img = boot.querySelector("img"); img.src = b.loader; img.hidden = false; }
} catch (e) {}

// A safety net. If the website has not managed to show its first page after 20 seconds (12 until round 32) (a phone holding on to
// out-of-date files from an earlier version, a login that could not be refreshed, no signal…), the loading screen
// does not just stay there: it says so and offers two buttons. main.js sets window.sbdslStarted once a page is up.
setTimeout(function () {
  if (window.sbdslStarted) return;
  var boot = document.getElementById("boot");
  if (!boot || boot.querySelector(".boot-help")) return;
  boot.classList.remove("done", "off");
  var box = document.createElement("div");
  box.className = "boot-help";
  box.innerHTML = '<p>The website is taking longer than it should to open.</p>'
    + '<button type="button" data-boot="again">Try again</button>'
    + '<button type="button" data-boot="fresh">Start fresh on this device</button>'
    + '<small>“Start fresh” clears what this website has saved on this phone or computer (you will need to log in again) and loads the newest version. Nothing on the website itself is changed.</small>';
  boot.appendChild(box);
  box.addEventListener("click", function (e) {
    var what = e.target && e.target.getAttribute && e.target.getAttribute("data-boot");
    if (!what) return;
    if (what === "fresh") {
      try { localStorage.clear(); } catch (x) {}
      try { sessionStorage.clear(); } catch (x) {}
      try { if (window.caches) caches.keys().then(function (k) { k.forEach(function (n) { caches.delete(n); }); }); } catch (x) {}
    }
    // A new address makes the browser fetch the page again rather than reuse what it kept.
    location.replace(location.pathname + "?v=" + Date.now());
  });
}, 20000);
