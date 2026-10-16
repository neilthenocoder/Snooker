// ─────────────────────────────────────────────────────────────
//  Admin → Website → Marketplace adverts (Rich, round 22). Anyone logged in can put up an
//  advert on /marketplace; it waits here until it is approved (and again after the seller
//  changes it). Approve, turn down (with a reason the seller sees), or remove. The switch
//  for the whole marketplace and its intro text are at the bottom.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, fmtDate, paragraphs, confirmBox } from "../core/dom.js";
import { marketAds, marketCategories, save, remove, settings, invalidate } from "../core/api.js";
import { panel, dataTable } from "../core/components.js";
import { price, adHref, statusTag } from "../core/market.js";
import { friendly } from "./crud.js";

export const waitingAds = async () => (await marketAds()).filter((a) => a.status === "pending");

export async function marketPage(el, { onChange = () => {} } = {}) {
  const draw = async () => {
    invalidate();
    const [ads, cats, site] = await Promise.all([marketAds(), marketCategories(), settings()]);
    const cat = (id) => cats.find((c) => c.id === id)?.name ?? "Other";
    const waiting = ads.filter((a) => a.status === "pending").sort((a, b) => String(a.updated_at ?? a.created_at).localeCompare(String(b.updated_at ?? b.created_at)));
    mount(el, html`<div class="notice">Adverts people put up on the <a href="/marketplace" target="_blank" rel="noopener">marketplace</a> wait here until they are approved. A seller who changes an advert sends it back here.
      <b>Turn down</b> asks for a reason, which the seller sees under “Your adverts”. The categories are under Website → Marketplace categories.</div>
      <h2 class="adm-h">Waiting for approval ${waiting.length ? html`<span class="nav-count">${waiting.length}</span>` : ""}</h2>
      ${waiting.length ? html`<div class="stack">${waiting.map((a) => html`<article class="appr">
          ${a.image_url ? html`<img src="${a.image_url}" alt="" loading="lazy">` : html`<div class="appr-ph"></div>`}
          <div class="appr-body">
            <small>${cat(a.category_id)} · ${price(a)} · from ${a.owner_name ?? "?"} · ${fmtDate(a.updated_at ?? a.created_at)}</small>
            <h3>${a.title}</h3>
            <div class="appr-text">${paragraphs(a.description)}</div>
            <p class="muted" style="margin:0 0 12px"><b>Contact:</b> ${a.contact}</p>
            <div class="btn-row">
              <button type="button" class="btn green" data-ok="${a.id}">Approve</button>
              <button type="button" class="btn ghost" data-no="${a.id}">Turn down</button>
              <a class="btn ghost" href="${adHref(a)}/edit">Change it first</a>
            </div></div></article>`)}</div>`
        : html`<div class="empty box">Nothing waiting — every advert has been dealt with.</div>`}
      ${panel("All adverts", dataTable([
        { label: "Advert", cell: (a) => html`<a href="${adHref(a)}" target="_blank" rel="noopener"><b>${a.title}</b></a><br><small class="muted">${a.owner_name ?? ""}</small>` },
        { label: "Category", cell: (a) => cat(a.category_id), cls: "hide-sm" },
        { label: "Price", cell: (a) => price(a), cls: "hide-sm" },
        { label: "Status", cell: (a) => statusTag(a) },
        { label: "Date", cell: (a) => fmtDate(a.created_at), cls: "hide-sm" },
        { label: "", cls: "right", cell: (a) => html`<span class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">
          ${a.status === "approved" ? html`<button type="button" class="btn small ghost" data-sold="${a.id}">Sold</button>` : ""}
          ${["rejected", "sold"].includes(a.status) ? html`<button type="button" class="btn small ghost" data-ok="${a.id}">Put back up</button>` : ""}
          <button type="button" class="btn small" data-del="${a.id}">Delete</button></span>` },
      ], ads, { empty: "No adverts yet." }))}
      ${panel("Marketplace settings", html`<form class="form" data-mk-settings>
        <label class="check"><input type="checkbox" name="market_on" ${site.market_on !== false ? "checked" : ""}> The marketplace is open (/marketplace)</label>
        <label>Text at the top of the marketplace<textarea name="market_intro" rows="3" placeholder="Cues, cases, tables and kit for sale between players…">${site.market_intro ?? ""}</textarea></label>
        <div class="btn-row"><button class="btn">Save</button></div></form>`, { color: "yellow" })}`);
  };
  el.onclick = async (e) => {
    const t = e.target.closest("button");
    const id = t?.dataset.ok || t?.dataset.no || t?.dataset.sold || t?.dataset.del;
    if (!id) return;
    try {
      if (t.dataset.ok) { await save("market_ads", { id, status: "approved", reject_reason: null }); toast("Approved — it's on the marketplace"); }
      if (t.dataset.no) {
        const why = window.prompt("Why is it turned down? (the seller sees this — optional)", "");
        if (why === null) return;
        await save("market_ads", { id, status: "rejected", reject_reason: why.trim().slice(0, 300) || null }); toast("Turned down");
      }
      if (t.dataset.sold) { await save("market_ads", { id, status: "sold" }); toast("Marked as sold"); }
      if (t.dataset.del) { if (!(await confirmBox("The advert is removed for good.", { title: "Delete this advert?", ok: "Delete" }))) return; await remove("market_ads", id); toast("Deleted"); }
      await draw(); onChange();
    } catch (err) { toast(friendly(err), "error"); }
  };
  el.onsubmit = async (e) => {
    if (!e.target.matches("[data-mk-settings]")) return;
    e.preventDefault();
    try { await save("settings", { id: 1, market_on: e.target.elements.market_on.checked, market_intro: e.target.elements.market_intro.value.trim() || null }); toast("Saved"); }
    catch (err) { toast(friendly(err), "error"); }
  };
  await draw();
}
