// Image library pop-up: pick a picture that's already on the website,
// or upload new ones. Returns the chosen URL (or null if cancelled).
import { html, mount, $, toast, fmtDate } from "../core/dom.js";
import { mediaLibrary, deleteFromLibrary } from "../core/api.js";
import { uploadImage } from "../core/upload.js";

/** Grid of library images; used by the pop-up and the Image library page. */
export function libraryGrid(items, { pickable = false, deletable = false } = {}) {
  if (!items.length) return html`<div class="empty">The library is empty — upload some pictures.</div>`;
  return html`<div class="lib-grid">${items.map((m) => html`<figure class="lib-item">
    <button type="button" class="lib-thumb" ${pickable ? html`data-pick-url="${m.url}"` : html`data-open="${m.url}"`} title="${m.name ?? ""}"><img src="${m.url}" alt="" loading="lazy"></button>
    <figcaption><span>${m.name ?? ""}</span><small>${fmtDate(m.created_at)}</small>
      ${deletable ? html`<button type="button" class="btn small ghost" data-copy="${m.url}">Copy link</button><button type="button" class="btn small" data-del-media="${m.id}">Delete</button>` : ""}
    </figcaption></figure>`)}</div>`;
}

/** Upload one or more files from an <input type=file>; returns the URLs. */
export async function uploadFiles(input, { folder = "library", maxSize = 1600 } = {}) {
  const urls = [];
  for (const file of input.files) {
    try { urls.push(await uploadImage(file, { folder, maxSize })); }
    catch (err) { toast(`${file.name}: ${err.message}`, "error"); }
  }
  input.value = "";
  return urls;
}

export function pickImage({ folder = "library", maxSize = 1600 } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "picker";
    document.body.append(dlg);
    const close = (url) => { dlg.close(); dlg.remove(); resolve(url ?? null); };
    const draw = async () => mount($(".picker-body", dlg), libraryGrid(await mediaLibrary(), { pickable: true }));
    mount(dlg, html`<div class="picker-head"><h3>Choose an image</h3>
        <label class="btn small green">Upload new<input type="file" accept="image/*" multiple hidden data-picker-upload></label>
        <button type="button" class="btn small ghost" data-close>Cancel</button></div>
      <div class="picker-body"></div>`);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest("[data-close]")) return close();
      const pick = e.target.closest("[data-pick-url]");
      if (pick) close(pick.dataset.pickUrl);
    });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    dlg.addEventListener("change", async (e) => {
      if (!e.target.matches("[data-picker-upload]")) return;
      const urls = await uploadFiles(e.target, { folder, maxSize });
      if (urls.length === 1) return close(urls[0]);
      draw();
    });
    dlg.showModal();
    draw();
  });
}

/** Admin → Image library page. */
export async function mediaPage(el) {
  const draw = async () => mount($("[data-lib]", el), libraryGrid(await mediaLibrary(), { deletable: true }));
  mount(el, html`<div class="notice">Every picture uploaded anywhere in the admin is kept here, so you can re-use it for news, pages, venues and more.
      Deleting a picture here removes it from the website wherever it was used.</div>
    <div class="toolbar"><label class="btn green">Upload pictures<input type="file" accept="image/*" multiple hidden data-lib-upload></label></div>
    <div data-lib></div>`);
  await draw();
  el.addEventListener("change", async (e) => {
    if (!e.target.matches("[data-lib-upload]")) return;
    const n = (await uploadFiles(e.target)).length;
    if (n) toast(`${n} picture${n > 1 ? "s" : ""} uploaded`);
    draw();
  });
  el.addEventListener("click", async (e) => {
    const copy = e.target.closest("[data-copy]");
    if (copy) { await navigator.clipboard?.writeText(copy.dataset.copy).catch(() => {}); return toast("Link copied"); }
    const open = e.target.closest("[data-open]");
    if (open) return window.open(open.dataset.open, "_blank", "noopener");
    const del = e.target.closest("[data-del-media]");
    if (!del || !confirm("Delete this picture? Anywhere it's used will show a blank instead.")) return;
    try {
      const item = (await mediaLibrary()).find((m) => m.id === del.dataset.delMedia);
      await deleteFromLibrary(item); toast("Deleted"); draw();
    } catch (err) { toast(err.message, "error"); }
  });
}
