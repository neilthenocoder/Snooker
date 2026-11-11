// /marketplace/new and /marketplace/:id/edit — put up (or change) an advert. Logged in only.
// Whatever is sent waits for the league's approval (guard_market_ad in supabase/schema.sql).
import { html, mount, $, toast } from "../core/dom.js";
import { marketAds, marketCategories, save, invalidate } from "../core/api.js";
import { breadcrumb } from "../core/components.js";
import { setTitle, navigate } from "../core/router.js";
import { canManage } from "../core/auth.js";
import { uploadImage } from "../core/upload.js";
import { adHref, findAd } from "../core/market.js";

export default async function marketEdit(view, { params, user }) {
  const isNew = !params.id;
  setTitle(isNew ? "Put up an advert" : "Change your advert");
  const crumbs = breadcrumb([["Home", "/"], ["Marketplace", "/marketplace"], [isNew ? "Put up an advert" : "Change your advert"]]);
  if (!user) {
    return mount(view, html`<div class="wrap" style="max-width:640px">${crumbs}<h1>Put up an advert</h1>
      <div class="box"><p>Anyone with a league login can put up an advert. Please log in first.</p><button type="button" class="btn" data-account-open>Log in</button></div></div>`);
  }
  const [ads, cats] = await Promise.all([marketAds().catch(() => []), marketCategories().catch(() => [])]);
  const ad = isNew ? { title: "", description: "", price: "", contact: user.email ?? "", category_id: cats[0]?.id ?? "", image_url: "" } : findAd(ads, params.id);
  if (!ad || (!isNew && ad.owner_id !== user.id && !canManage(user, "website"))) {
    return mount(view, html`<div class="wrap" style="max-width:640px">${crumbs}<h1>Advert not found</h1><div class="empty box">You can only change your own adverts. <a href="/marketplace">Back to the marketplace</a></div></div>`);
  }
  const officer = canManage(user, "website");
  mount(view, html`<div class="wrap" style="max-width:720px">${crumbs}
    <h1>${isNew ? "Put up an advert" : "Change your advert"}</h1>
    <div class="notice">${officer ? "As a league officer your changes go up straight away." : html`Your advert goes on the marketplace <b>once the league has approved it</b>${isNew ? "" : " — and after any change, it is checked again"}. You'll see how it's getting on under “Your adverts” on the marketplace page.`}</div>
    <form class="form box" data-mk-form>
      <label>What are you selling?<input name="title" required minlength="3" maxlength="100" value="${ad.title}" placeholder="e.g. Peradon 57&quot; ash cue with case"></label>
      <div class="grid-2">
        <label>Category<select name="category_id">${cats.map((c) => html`<option value="${c.id}" ${c.id === ad.category_id ? "selected" : ""}>${c.name}</option>`)}</select></label>
        <label>Price in £ <span class="muted">(leave empty for “price on request”; 0 = free)</span><input name="price" type="number" min="0" max="100000" step="0.01" value="${ad.price ?? ""}" inputmode="decimal"></label>
      </div>
      <label>Description<textarea name="description" required maxlength="2000" style="min-height:150px" placeholder="Condition, size, weight, what's included…">${ad.description}</textarea></label>
      <div class="mk-upload">
        <img class="image-preview ${ad.image_url ? "" : "hidden"}" src="${ad.image_url ?? ""}" alt="" data-mk-preview>
        <div class="btn-row"><label class="btn small secondary">${ad.image_url ? "Change the picture" : "Add a picture"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-mk-file></label>
          <button type="button" class="btn small ghost ${ad.image_url ? "" : "hidden"}" data-mk-noimg>Remove the picture</button></div>
        <input type="hidden" name="image_url" value="${ad.image_url ?? ""}"></div>
      <label>How should buyers contact you? <span class="muted">(shown on the advert)</span><input name="contact" required minlength="3" maxlength="200" value="${ad.contact}" placeholder="Phone number or email address"></label>
      <div data-mk-error></div>
      <div class="btn-row"><button class="btn green">${isNew ? "Send it to the league" : "Save the changes"}</button><a class="btn ghost" href="${isNew ? "/marketplace" : adHref(ad)}">Cancel</a></div>
    </form></div>`);

  const form = $("[data-mk-form]", view);
  const setImage = (url) => {
    form.elements.image_url.value = url;
    const img = $("[data-mk-preview]", view); img.src = url; img.classList.toggle("hidden", !url);
    $("[data-mk-noimg]", view).classList.toggle("hidden", !url);
  };
  $("[data-mk-file]", view).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const label = e.target.closest("label"); label.classList.add("busy");
    try { setImage(await uploadImage(file, { folder: "market", maxSize: 1400, library: false })); }
    catch (err) { toast(err.message, "error"); }
    label.classList.remove("busy");
  });
  $("[data-mk-noimg]", view).addEventListener("click", () => setImage(""));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = form.elements, btn = form.querySelector("button:not([type=button])");
    const row = { title: f.title.value.trim(), description: f.description.value.trim(), contact: f.contact.value.trim(), category_id: f.category_id.value || null,
      price: f.price.value === "" ? null : Number(f.price.value), image_url: f.image_url.value || null };
    if (!isNew) row.id = ad.id;
    else if (officer) row.status = "approved";
    btn.disabled = true;
    try {
      const saved = await save("market_ads", row);
      invalidate();
      toast(saved.status === "approved" ? "Your advert is on the marketplace" : "Thank you — the league will check your advert soon");
      navigate(adHref(saved));
    } catch (err) {
      mount($("[data-mk-error]", view), html`<div class="notice error">${err.message}</div>`);
      btn.disabled = false;
    }
  });
}
