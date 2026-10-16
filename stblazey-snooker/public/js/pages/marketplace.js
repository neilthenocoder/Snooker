// /marketplace — the Snooker marketplace (Rich, round 22). Anyone logged in can put up an advert
// (/marketplace/new); it appears here once the league has approved it (Admin → Website → Marketplace).
import { html, mount, $, $$, fmtDate, paragraphs, toast, confirmBox } from "../core/dom.js";
import { marketAds, marketCategories, settings, save, remove, invalidate } from "../core/api.js";
import { breadcrumb, panel, dataTable } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import { price, adHref, statusTag } from "../core/market.js";

const card = (a, cats) => html`<a class="mk-card ${a.status === "sold" ? "sold" : ""}" href="${adHref(a)}">
  <span class="mk-pic">${a.image_url ? html`<img src="${a.image_url}" alt="" loading="lazy">` : html`<span class="mk-ph">🎱</span>`}
    <b class="mk-price">${a.status === "sold" ? "Sold" : price(a)}</b></span>
  <span class="mk-body"><small>${cats.get(a.category_id)?.name ?? "Other"} · ${fmtDate(a.approved_at ?? a.created_at)}</small><strong>${a.title}</strong></span></a>`;

export default async function marketplace(view, { user, query }) {
  setTitle("Marketplace");
  adminEdit("market", null, { label: "Approve adverts" });
  const [ads, catList, site] = await Promise.all([marketAds().catch(() => []), marketCategories().catch(() => []), settings()]);
  const cats = new Map(catList.map((c) => [c.id, c]));
  if (site.market_on === false) {
    return mount(view, html`<div class="wrap">${breadcrumb([["Home", "/"], ["Marketplace"]])}<h1>Marketplace</h1>
      <div class="empty box">The marketplace is closed at the moment.</div></div>`);
  }
  const live = ads.filter((a) => ["approved", "sold"].includes(a.status)).sort((a, b) => (a.status === "sold") - (b.status === "sold") || String(b.approved_at ?? b.created_at).localeCompare(String(a.approved_at ?? a.created_at)));
  const mine = user ? ads.filter((a) => a.owner_id === user.id) : [];
  let q = query.get("q") ?? "", cat = query.get("cat") ?? "";

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Marketplace"]])}
    <div class="mk-head"><h1>Marketplace</h1>
      ${user ? html`<a class="btn green" href="/marketplace/new">+ Put up an advert</a>` : html`<button type="button" class="btn green" data-account-open>Log in to put up an advert</button>`}</div>
    <div class="mk-intro">${paragraphs(site.market_intro || "Cues, cases, tables and kit for sale between players. Anyone with a league login can put up an advert — it appears here once the league has checked it. Contact the seller directly: the league takes no part in the sale.")}</div>
    ${mine.length ? panel("Your adverts", dataTable([
      { label: "Advert", cell: (a) => html`<a href="${adHref(a)}"><b>${a.title}</b></a>` },
      { label: "Price", cell: (a) => price(a), cls: "hide-sm" },
      { label: "Status", cell: (a) => html`${statusTag(a)}${a.status === "rejected" && a.reject_reason ? html`<br><small class="muted">${a.reject_reason}</small>` : ""}` },
      { label: "", cls: "right", cell: (a) => html`<span class="btn-row" style="justify-content:flex-end">
        <a class="btn small secondary" href="${adHref(a)}/edit">Edit</a>
        ${a.status === "approved" ? html`<button type="button" class="btn small ghost" data-sold="${a.id}">Mark as sold</button>` : a.status === "sold" ? html`<button type="button" class="btn small ghost" data-unsold="${a.id}">For sale again</button>` : ""}
        <button type="button" class="btn small" data-del="${a.id}">Delete</button></span>` },
    ], mine), { color: "yellow" }) : ""}
    <div class="mk-tools">
      <input type="search" placeholder="Search the adverts…" value="${q}" data-mk-search aria-label="Search the adverts">
      <div class="mk-cats" role="group" aria-label="Category">
        <button type="button" class="${cat ? "" : "on"}" data-cat="">All</button>
        ${catList.map((c) => html`<button type="button" class="${cat === c.id ? "on" : ""}" data-cat="${c.id}">${c.name}</button>`)}</div>
    </div>
    <div data-mk-list></div>
  </div>`);

  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = live.filter((a) => (!cat || a.category_id === cat) && words.every((w) => `${a.title} ${a.description}`.toLowerCase().includes(w)));
    mount($("[data-mk-list]", view), list.length ? html`<div class="mk-grid">${list.map((a) => card(a, cats))}</div>`
      : html`<div class="empty box">${live.length ? "No adverts match — try another word or category." : "No adverts yet. Be the first to put one up!"}</div>`);
  };
  draw();
  $("[data-mk-search]", view).addEventListener("input", (e) => { q = e.target.value; draw(); });
  view.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-cat]");
    if (c) { cat = c.dataset.cat; $$("[data-cat]", view).forEach((b) => b.classList.toggle("on", b === c)); return draw(); }
    const id = e.target.dataset.sold || e.target.dataset.unsold || e.target.dataset.del;
    if (!id) return;
    try {
      if (e.target.dataset.del) {
        if (!(await confirmBox("The advert is removed from the marketplace for good.", { title: "Delete this advert?", ok: "Delete" }))) return;
        await remove("market_ads", id); toast("Advert deleted");
      } else { await save("market_ads", { id, status: e.target.dataset.sold ? "sold" : "approved" }); toast(e.target.dataset.sold ? "Marked as sold" : "For sale again"); }
      invalidate(); marketplace(view, { user, query });
    } catch (err) { toast(err.message, "error"); }
  });
}
