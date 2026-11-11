// ─────────────────────────────────────────────────────────────
//  Admin → Website → SEO (Rich, round 22: "the Framer way").
//  Site settings: the title, language, description and preview picture of the whole site.
//  Page settings: any page can have its own title, description and picture, and be kept
//  out of search engines or out of the site's own search. News articles have their own
//  (News → the article → Social preview). Search engines are told about every page in
//  /sitemap.xml (netlify/edge-functions/seo-files.js); /robots.txt points them to it.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, confirmBox } from "../core/dom.js";
import { settings, save, seoPages, saveSeoPage, deleteSeoPage, table, invalidate } from "../core/api.js";
import { panel, dataTable } from "../core/components.js";
import { SITE } from "../config.js";
import { SEO_PAGES } from "../core/seo.js";
import { uploadImage } from "../core/upload.js";
import { pickImage } from "./picker.js";
import { friendly } from "./crud.js";

const LANGUAGES = [["en-GB", "English (UK)"], ["en", "English"], ["en-US", "English (US)"], ["cy", "Welsh"], ["kw", "Cornish"]];
const TITLE_MAX = 60, TEXT_MAX = 160;
const count = (n, max) => html`<small class="seo-count ${n > max ? "over" : ""}">${n} / ${max}</small>`;

/** How it looks in Google, and on Facebook / WhatsApp. */
const previews = ({ title, text, image, url }) => html`<div class="seo-previews">
  <div class="seo-google"><small>Google</small><span class="g-url">${url}</span><span class="g-title">${title}</span><span class="g-text">${text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX - 1)}…` : text}</span></div>
  <div class="seo-social"><small>Shared on social media</small>${image ? html`<img src="${image}" alt="">` : html`<span class="seo-noimg">No picture</span>`}
    <span class="s-url">${url.replace(/^https?:\/\//, "").split("/")[0]}</span><b>${title}</b><span>${text}</span></div></div>`;

const imageField = (name, value) => html`<div class="image-field">
  <img class="image-preview ${value ? "" : "hidden"}" src="${value ?? ""}" alt="" data-seo-preview="${name}">
  <div class="btn-row"><button type="button" class="btn small blue" data-seo-library="${name}">Choose from library</button>
    <label class="btn small secondary">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-seo-upload="${name}"></label>
    <button type="button" class="btn small ghost" data-seo-clear="${name}">Remove</button></div>
  <input type="hidden" name="${name}" value="${value ?? ""}"></div>`;

export async function seoPage(el) {
  const [site, rows, infoPages] = await Promise.all([settings(), seoPages(), table("pages", "sort").catch(() => [])]);
  const origin = location.origin;
  const pages = [...SEO_PAGES, ...infoPages.map((p) => [`/page/${p.slug}`, `Info page: ${p.title}`])];
  const nameOf = (path) => pages.find(([p]) => p === path)?.[1] ?? path;
  let current = new URLSearchParams(location.search).get("page") || "/";

  const draw = () => {
    const row = rows.find((r) => r.path === current) ?? { path: current };
    const siteTitle = site.social_title || SITE.name, siteText = site.social_description || "";
    mount(el, html`
      <div class="notice">How the website shows up in Google and when a link to it is shared. <b>Site settings</b> are for the whole site; <b>page settings</b> let any page have its own.
        News articles have their own under News → the article → Social preview. Search engines find every page through <a href="/sitemap.xml" target="_blank" rel="noopener">/sitemap.xml</a> — once the site is on its own domain, add that address in Google Search Console.</div>
      ${panel("Site settings", html`<form class="form" data-seo-site>
        <div class="grid-2"><label>Title ${count((site.social_title || "").length, TITLE_MAX)}<input name="social_title" maxlength="120" value="${site.social_title ?? ""}" placeholder="${SITE.name}"></label>
          <label>Language<select name="site_language">${LANGUAGES.map(([v, l]) => html`<option value="${v}" ${(site.site_language || "en-GB") === v ? "selected" : ""}>${l}</option>`)}</select></label></div>
        <label>Description ${count((site.social_description || "").length, TEXT_MAX)}<textarea name="social_description" rows="2" maxlength="300" placeholder="Fixtures, results, league tables, breaks and rankings…">${site.social_description ?? ""}</textarea></label>
        <label>Preview picture <span class="muted">(1200 × 630 is ideal)</span></label>${imageField("social_image_url", site.social_image_url)}
        ${previews({ title: siteTitle, text: siteText, image: site.social_image_url, url: `${origin}/` })}
        <div class="btn-row form-actions"><button class="btn">Save site settings</button></div></form>`)}
      ${panel("Page settings", html`<form class="form" data-seo-page>
        <label>Page<select data-seo-pick>${pages.map(([p, l]) => html`<option value="${p}" ${p === current ? "selected" : ""}>${l} — ${p}</option>`)}
          ${pages.some(([p]) => p === current) ? "" : html`<option value="${current}" selected>${current}</option>`}</select></label>
        <p class="muted" style="margin:-4px 0 12px">Another page? <button type="button" class="linkish" data-seo-other>Type its address</button> (e.g. /team/bethel-a).</p>
        <div class="grid-2"><label>Title ${count((row.title || "").length, TITLE_MAX)}<input name="title" maxlength="120" value="${row.title ?? ""}" placeholder="${nameOf(current)} | ${siteTitle}"></label>
          <label>URL<span class="seo-url"><a href="${current}" target="_blank" rel="noopener">${origin}${current}</a></span></label></div>
        <label>Description ${count((row.description || "").length, TEXT_MAX)}<textarea name="description" rows="2" maxlength="300" placeholder="${siteText || "Leave empty to use the site's description"}">${row.description ?? ""}</textarea></label>
        <label>Page image <span class="muted">(the picture when this page is shared — leave empty to use the site's)</span></label>${imageField("image_url", row.image_url)}
        <label class="check"><input type="checkbox" name="index" ${row.noindex ? "" : "checked"}> <span><b>Search engines</b> — show this page in Google and other search engines</span></label>
        <label class="check"><input type="checkbox" name="search" ${row.hide_in_search ? "" : "checked"}> <span><b>Site search</b> — show this page in the website's own search (the magnifying glass)</span></label>
        ${previews({ title: row.title || `${nameOf(current)} | ${siteTitle}`, text: row.description || siteText, image: row.image_url || site.social_image_url, url: `${origin}${current}` })}
        <div class="btn-row form-actions"><button class="btn">Save page settings</button>${rows.some((r) => r.path === current) ? html`<button type="button" class="btn ghost" data-seo-reset>Back to the site's settings</button>` : ""}</div></form>`, { color: "yellow" })}
      ${rows.length ? panel("Pages with their own settings", dataTable([
        { label: "Page", cell: (r) => html`<button type="button" class="linkish" data-seo-go="${r.path}">${nameOf(r.path)}</button> <small class="muted">${r.path}</small>` },
        { label: "Title", cell: (r) => r.title || "–", cls: "hide-sm" },
        { label: "Search engines", cell: (r) => (r.noindex ? "Hidden" : "Shown") },
        { label: "Site search", cell: (r) => (r.hide_in_search ? "Hidden" : "Shown"), cls: "hide-sm" },
      ], rows)) : ""}`);
  };
  draw();

  const setImage = (form, name, url) => {
    form.elements[name].value = url;
    const img = $(`[data-seo-preview="${name}"]`, form); img.src = url; img.classList.toggle("hidden", !url);
  };
  el.onchange = async (e) => {
    const t = e.target;
    if (t.matches("[data-seo-pick]")) { current = t.value; return draw(); }
    if (t.dataset.seoUpload) {
      const file = t.files[0]; if (!file) return;
      t.closest("label").classList.add("busy");
      try { setImage(t.form ?? t.closest("form"), t.dataset.seoUpload, await uploadImage(file, { folder: "branding", maxSize: 1200, format: "jpeg" })); } catch (err) { toast(err.message, "error"); }
      t.closest("label").classList.remove("busy");
    }
  };
  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const form = t.closest("form");
    if (t.dataset.seoLibrary) { const url = await pickImage({ folder: "branding", maxSize: 1200 }); if (url) setImage(form, t.dataset.seoLibrary, url); return; }
    if (t.dataset.seoClear) return setImage(form, t.dataset.seoClear, "");
    if (t.dataset.seoGo) { current = t.dataset.seoGo; draw(); return el.querySelector("[data-seo-page]")?.scrollIntoView({ behavior: "smooth" }); }
    if (t.dataset.seoOther !== undefined) {
      const path = window.prompt("The page's address on this website, starting with / (for example /team/bethel-a):", "/");
      if (!path) return;
      if (!/^\/[^\s]*$/.test(path.trim())) return toast("An address on this website starts with /", "error");
      current = path.trim().replace(/(.)\/+$/, "$1"); return draw();
    }
    if (t.dataset.seoReset !== undefined) {
      if (!(await confirmBox("This page's own title, description and picture are removed, and it is shown in search engines and the site search again.", { title: "Use the site's settings?", ok: "Yes" }))) return;
      try { await deleteSeoPage(current); rows.splice(rows.findIndex((r) => r.path === current), 1); toast("Back to the site's settings"); draw(); } catch (err) { toast(friendly(err), "error"); }
    }
  };
  el.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target.elements, btn = e.target.querySelector("button:not([type=button])");
    btn.disabled = true;
    try {
      if (e.target.matches("[data-seo-site]")) {
        Object.assign(site, await save("settings", { id: 1, social_title: f.social_title.value.trim() || null, social_description: f.social_description.value.trim() || null,
          social_image_url: f.social_image_url.value || null, site_language: f.site_language.value }));
      } else {
        const row = { path: current, title: f.title.value.trim() || null, description: f.description.value.trim() || null, image_url: f.image_url.value || null,
          noindex: !f.index.checked, hide_in_search: !f.search.checked };
        await saveSeoPage(row);
        const i = rows.findIndex((r) => r.path === current);
        if (i >= 0) rows[i] = row; else rows.push(row);
      }
      invalidate(); toast("Saved — search engines pick changes up the next time they visit"); draw();
    } catch (err) { toast(friendly(err), "error"); btn.disabled = false; }
  };
}
