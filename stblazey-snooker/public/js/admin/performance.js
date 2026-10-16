// ─────────────────────────────────────────────────────────────
//  Admin → Website → Performance (Rich, round 22: "Performance menu?" — Framer has one).
//  How fast the website opens: measured in this browser for this visit, the size of the
//  pictures in the image library (big ones slow phones down), and a button for Google's own
//  PageSpeed test of the live site.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast } from "../core/dom.js";
import { mediaLibrary } from "../core/api.js";
import { panel, dataTable } from "../core/components.js";
import { DEMO_MODE } from "../config.js";

const BIG = 500 * 1024;
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const secs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
const grade = (ms, good, ok) => (ms <= good ? "ok" : ms <= ok ? "warn" : "bad");

export async function performancePage(el) {
  const nav = performance.getEntriesByType("navigation")[0];
  const res = performance.getEntriesByType("resource");
  const paint = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint");
  const total = res.reduce((n, r) => n + (r.transferSize || 0), 0) + (nav?.transferSize || 0);
  const kinds = {};
  for (const r of res) { const k = r.initiatorType === "img" || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(r.name) ? "Pictures" : r.initiatorType === "script" || /\.js(\?|$)/.test(r.name) ? "Scripts" : r.initiatorType === "link" || /\.css(\?|$)/.test(r.name) ? "Styles & fonts" : "Data"; kinds[k] = (kinds[k] ?? 0) + 1; }
  const measures = nav ? [
    ["The server answered", nav.responseStart - nav.startTime, 600, 1500, "How long Netlify took to send the first part of the page."],
    ["First thing on screen", paint?.startTime ?? nav.domContentLoadedEventEnd, 1800, 3000, "When the visitor first saw something (the loading screen counts)."],
    ["Page ready to use", nav.domContentLoadedEventEnd - nav.startTime, 2500, 4000, "When the page could be used."],
    ["Everything loaded", nav.loadEventEnd - nav.startTime, 3500, 6000, "Every picture and file of the first page, finished."],
  ] : [];
  const origin = location.origin;
  mount(el, html`
    <div class="notice">How quickly the website opens. The numbers below are for <b>this visit, in this browser</b> (open the website fresh, then come here, for the truest figures).
      For the full picture — phones on a slow connection, and what to improve — run Google's free test on the live website.</div>
    <div class="btn-row"><a class="btn green" href="https://pagespeed.web.dev/analysis?url=${encodeURIComponent(origin + "/")}" target="_blank" rel="noopener">Test the home page with Google PageSpeed</a>
      <a class="btn secondary" href="https://pagespeed.web.dev/analysis?url=${encodeURIComponent(origin + "/fixtures")}" target="_blank" rel="noopener">Test the fixtures page</a></div>
    ${panel("This visit", measures.length ? html`<div class="pf-grid">${measures.map(([label, ms, good, ok, what]) => html`<div class="pf-tile ${grade(ms, good, ok)}"><small>${label}</small><b>${secs(ms)}</b><span>${what}</span></div>`)}
        <div class="pf-tile"><small>Downloaded</small><b>${total ? kb(total) : "–"}</b><span>${res.length + 1} files: ${Object.entries(kinds).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(", ")}. Files already saved in the browser count as nothing.</span></div></div>`
      : html`<p class="muted">This browser doesn't share its timings.</p>`)}
    ${panel("Pictures in the image library", html`<p class="muted" style="margin-top:0">Pictures uploaded on the website are made smaller automatically (to about 300 KB). Ones over ${kb(BIG)} — usually added before that, or pasted in as a link — slow pages down on phones: upload them again, or swap them for a smaller copy.</p>
      <div class="btn-row"><button type="button" class="btn small" data-pf-images>Check the picture sizes</button><span class="muted" data-pf-progress></span></div><div data-pf-out></div>`, { color: "yellow" })}
    ${panel("What already keeps the website quick", html`<ul class="pf-list">
      <li>Pages are built in the visitor's browser from one small page, so moving around the site doesn't reload everything.</li>
      <li>Pictures are made smaller (WebP) when they are uploaded.</li>
      <li>Netlify serves the site from the nearest of its servers; the scripts are checked for a newer copy on every visit, so an update shows straight away.</li>
      <li>The loading screen only appears if a page takes more than a moment (Branding → Loading screen).</li></ul>`)}`);

  el.onclick = async (e) => {
    const btn = e.target.closest("[data-pf-images]");
    if (!btn) return;
    btn.disabled = true;
    const progress = (t) => mount($("[data-pf-progress]", el), t);
    try {
      const items = (await mediaLibrary()).filter((m) => /^https?:/.test(m.url));
      if (DEMO_MODE && !items.length) { progress("The demo keeps its pictures inside the browser, so there is nothing to measure."); btn.disabled = false; return; }
      const sized = [];
      for (let i = 0; i < items.length; i += 8) {
        progress(`Measuring… ${Math.min(i + 8, items.length)} of ${items.length}`);
        sized.push(...await Promise.all(items.slice(i, i + 8).map(async (m) => {
          try { const r = await fetch(m.url, { method: "HEAD" }); return { ...m, bytes: Number(r.headers.get("content-length")) || null }; } catch { return { ...m, bytes: null }; }
        })));
      }
      const big = sized.filter((m) => m.bytes > BIG).sort((a, b) => b.bytes - a.bytes);
      const known = sized.filter((m) => m.bytes);
      progress(html`${sized.length} pictures · ${known.length ? `${kb(known.reduce((n, m) => n + m.bytes, 0))} in all` : "sizes not shared"} · <b>${big.length}</b> over ${kb(BIG)}`);
      mount($("[data-pf-out]", el), big.length ? dataTable([
        { label: "", cell: (m) => html`<img class="thumb" src="${m.url}" alt="" loading="lazy">` },
        { label: "Picture", cell: (m) => html`<a href="${m.url}" target="_blank" rel="noopener">${m.name || m.url.split("/").pop()}</a>` },
        { label: "Size", cell: (m) => html`<b class="lk-why">${kb(m.bytes)}</b>`, cls: "num" },
      ], big) : html`<p class="notice ok" style="margin:0">Every picture is a sensible size.</p>`);
    } catch (err) { toast(err.message, "error"); }
    btn.disabled = false;
  };
}
