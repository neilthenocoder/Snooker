// /sponsor/<slug> — a page about one sponsor, written in Admin → Sponsors.
import { html, mount } from "../core/dom.js";
import { table } from "../core/api.js";
import { markup } from "../core/markup.js";
import { breadcrumb, urls } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

export default async function sponsor(view, { params }) {
  const all = await table("sponsors", "sort");
  const s = all.find((x) => x.slug === params.slug) ?? all.find((x) => x.id === params.slug);
  if (!s) return notFound(view);
  setTitle(s.name);
  adminEdit("sponsors", s.id);
  const site = s.url && /^https?:\/\//.test(s.url) ? s.url : s.url ? `https://${s.url}` : "";
  const contact = [
    ["Address", s.address],
    ["Telephone", s.phone && html`<a href="tel:${s.phone.replace(/\s+/g, "")}">${s.phone}</a>`],
    ["Email", s.email && html`<a href="mailto:${s.email}">${s.email}</a>`],
    ["Website", site && html`<a href="${site}" target="_blank" rel="noopener">${site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>`],
  ].filter(([, v]) => v);
  const others = all.filter((x) => x.id !== s.id);
  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Our sponsors"], [s.name]])}
      <div class="sponsor-head">
        ${s.image_url ? html`<div class="sponsor-logo"><img src="${s.image_url}" alt="${s.name}"></div>` : ""}
        <div><p class="sponsor-kicker">Proud sponsor of the league</p><h1>${s.name}</h1>
          ${site ? html`<a class="btn" href="${site}" target="_blank" rel="noopener">Visit their website</a>` : ""}</div>
      </div></div>
    <div class="sponsor-body ${s.photo_url || contact.length ? "" : "solo"}">
      <div class="prose rich">${s.about ? markup(s.about) : html`<p>${s.name} supports the St Blazey &amp; District Snooker League. Thank you for backing local snooker.</p>`}</div>
      ${s.photo_url || contact.length ? html`<aside>${s.photo_url ? html`<img class="sponsor-photo" src="${s.photo_url}" alt="">` : ""}
        ${contact.length ? html`<dl class="facts">${contact.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>` : ""}</aside>` : ""}
    </div>
    ${others.length ? html`<div><h3>Our other sponsors</h3><div class="sponsors left">${others.map((o) => html`<a href="${urls.sponsor(o)}">${o.image_url ? html`<img src="${o.image_url}" alt="${o.name}">` : o.name}</a>`)}</div></div>` : ""}
  </div>`);
}
