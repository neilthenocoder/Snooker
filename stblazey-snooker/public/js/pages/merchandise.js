// /merchandise — what the league sells (shirts, towels, chalk…), kept under Admin → Website → Merchandise.
// Nothing is paid for on the website: each item says how to get it (its own link, or the page's "How to order").
import { html, mount, paragraphs } from "../core/dom.js";
import { table, settings } from "../core/api.js";
import { breadcrumb } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

const link = (url) => (/^(https?:|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}`);
const bag = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7V6a5 5 0 0 1 10 0v1h3l1 14H3L4 7Zm2 0h6V6a3 3 0 0 0-6 0Z"/></svg>`;

export default async function merchandise(view) {
  setTitle("Merchandise");
  adminEdit("merchandise", null, { label: "Edit merchandise" });
  const [all, site] = await Promise.all([table("merchandise", "sort").catch(() => []), settings()]);
  const items = all.filter((m) => m.is_active !== false).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
  const how = (site.merch_how ?? "").trim();

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Merchandise"]])}
    <h1>Merchandise</h1>
    ${site.merch_intro ? html`<div class="merch-intro">${paragraphs(site.merch_intro)}</div>` : ""}
    ${items.length ? html`<div class="merch-grid">${items.map((m) => {
      const options = String(m.options ?? "").split(/[,\n]/).map((o) => o.trim()).filter(Boolean);
      return html`<article class="merch-card" id="item-${m.id}">
        <div class="merch-pic">${m.image_url ? html`<button type="button" data-lightbox="${m.image_url}" aria-label="See ${m.name} full size"><img src="${m.image_url}" alt="${m.name}" loading="lazy"></button>` : html`<span class="merch-ph">${bag}</span>`}
          ${m.price ? html`<b class="merch-price">${m.price}</b>` : ""}</div>
        <div class="merch-body"><h3>${m.name}</h3>
          ${m.description ? html`<div class="merch-text">${paragraphs(m.description)}</div>` : ""}
          ${options.length ? html`<div class="merch-options" aria-label="Options">${options.map((o) => html`<span>${o}</span>`)}</div>` : ""}
          ${m.url ? html`<a class="btn" href="${link(m.url)}" ${/^\//.test(m.url) ? "" : html`target="_blank" rel="noopener"`}>Order this</a>`
            : how ? html`<a class="btn ghost" href="#how-to-order">How to order</a>` : ""}</div>
      </article>`; })}</div>`
      : html`<div class="empty box">Nothing on sale just now. League shirts and other items will be shown here when they are available.</div>`}
    ${how ? html`<section class="merch-how box" id="how-to-order"><h3>How to order</h3>${paragraphs(how)}</section>` : ""}
  </div>`);
}
