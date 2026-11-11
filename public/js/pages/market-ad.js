// /marketplace/:id — one advert of the marketplace.
import { html, mount, fmtDate, paragraphs, safeHref } from "../core/dom.js";
import { marketAds, marketCategories } from "../core/api.js";
import { breadcrumb } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import { canManage } from "../core/auth.js";
import { price, adHref, findAd, statusTag } from "../core/market.js";

/** A phone number or an email address in the contact details becomes a link. */
const contactLinks = (text) => String(text).split(/(\S+@\S+\.\S+|\+?\d[\d\s]{8,}\d)/).map((part, i) => {
  if (i % 2 === 0) return part;
  const href = part.includes("@") ? `mailto:${part}` : `tel:${part.replace(/\s+/g, "")}`;
  return safeHref(href) ? html`<a href="${href}">${part}</a>` : part;
});

export default async function marketAd(view, { params, user }) {
  const [ads, cats] = await Promise.all([marketAds().catch(() => []), marketCategories().catch(() => [])]);
  const a = findAd(ads, params.id);
  if (!a) {
    setTitle("Advert not found");
    return mount(view, html`<div class="wrap">${breadcrumb([["Home", "/"], ["Marketplace", "/marketplace"], ["Not found"]])}
      <h1>Advert not found</h1><div class="empty box">This advert has been taken down, or is still waiting for the league to approve it. <a href="/marketplace">Back to the marketplace</a></div></div>`);
  }
  setTitle(a.title);
  adminEdit("market", null, { label: "Approve adverts" });
  const mine = user && a.owner_id === user.id, cat = cats.find((c) => c.id === a.category_id);
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Marketplace", "/marketplace"], [a.title]])}
    ${!["approved", "sold"].includes(a.status) ? html`<div class="notice ${a.status === "rejected" ? "error" : "todo"}"><b>${a.status === "rejected" ? "Not approved" : "Not on the marketplace yet"}</b> —
      ${a.status === "rejected" ? (a.reject_reason || "the league did not approve this advert.") : "only you and the league can see it until it has been approved."}</div>` : ""}
    <article class="mk-ad">
      <div class="mk-ad-pic">${a.image_url ? html`<button type="button" data-lightbox="${a.image_url}" aria-label="See the picture full size"><img src="${a.image_url}" alt="${a.title}"></button>` : html`<span class="mk-ph big">🎱</span>`}</div>
      <div class="mk-ad-body">
        <small class="muted">${cat?.name ?? "Other"} · put up ${fmtDate(a.approved_at ?? a.created_at)}${a.owner_name ? ` by ${a.owner_name}` : ""}</small>
        <h1>${a.title}</h1>
        <p class="mk-ad-price">${a.status === "sold" ? html`<span class="mk-status s-sold">Sold</span>` : price(a)}</p>
        <div class="mk-ad-text">${paragraphs(a.description)}</div>
        ${a.status !== "sold" ? html`<div class="mk-contact"><b>Contact the seller</b><p>${contactLinks(a.contact)}</p></div>` : ""}
        <p class="muted mk-note">The league checks each advert before it goes up, but takes no part in the sale: agree it with the seller directly.</p>
        ${mine || canManage(user, "website") ? html`<div class="btn-row">${statusTag(a)}<a class="btn small secondary" href="${adHref(a)}/edit">Edit this advert</a></div>` : ""}
      </div>
    </article>
  </div>`);
}
