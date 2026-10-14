// Image library pop-up: pick a picture that's already on the website,
// or upload new ones. Returns the chosen URL (or null if cancelled).
// Pictures are filed in categories, and can be sorted.
import { html, mount, $, toast, fmtDate } from "../core/dom.js";
import { mediaLibrary, deleteFromLibrary, save } from "../core/api.js";
import { uploadImage, MEDIA_CATEGORIES } from "../core/upload.js";
import { getUser, isMaster } from "../core/auth.js";

/**
 * Everyone has their own pictures (round 20): what they upload is theirs. The Master Admin sees everybody's
 * (and can pick from anyone's); everyone else sees only their own. The database enforces this too
 * (supabase/schema.sql, "own pictures"); the filter here is for the demo, which has no database rules.
 * Pictures from before this change have no owner: they are the Master Admin's.
 */
async function myLibrary() {
  const [items, user] = await Promise.all([mediaLibrary(), getUser()]);
  const master = isMaster(user);
  return { items: master ? items : items.filter((m) => m.owner_id && m.owner_id === user?.id), user, master };
}
const ownerKey = (m, user) => (!m.owner_id || m.owner_id === user?.id ? "me" : m.owner_id);

const SORTS = { newest: "Newest first", oldest: "Oldest first", name: "Name (A–Z)" };
const categoryOf = (m) => m.category || "General";

/** Category + sort controls, shared by the pop-up and the Image library page. */
function libraryBar(items, state) {
  if (state.master) items = items.filter((m) => !state.owner || ownerKey(m, state.user) === state.owner);
  const counts = new Map();
  for (const m of items) counts.set(categoryOf(m), (counts.get(categoryOf(m)) ?? 0) + 1);
  const cats = [...new Set([...MEDIA_CATEGORIES, ...counts.keys()])].filter((c) => counts.has(c) || c === state.category);
  return html`<div class="lib-bar">
    <div class="lib-cats" role="group" aria-label="Category">
      <button type="button" class="${state.category ? "" : "on"}" data-lib-cat="">All <small>${items.length}</small></button>
      ${cats.map((c) => html`<button type="button" class="${state.category === c ? "on" : ""}" data-lib-cat="${c}">${c} <small>${counts.get(c) ?? 0}</small></button>`)}
    </div>
    ${state.master ? ownerSelect(state) : ""}
    <label>Sort <select data-lib-sort>${Object.entries(SORTS).map(([k, l]) => html`<option value="${k}" ${state.sort === k ? "selected" : ""}>${l}</option>`)}</select></label>
  </div>`;
}

/** Master Admin only: whose pictures to show — everyone's, their own, or one person's. */
function ownerSelect(state) {
  const people = new Map();
  for (const m of state.all) { const k = ownerKey(m, state.user); if (k !== "me") people.set(k, m.owner_name || "Someone"); }
  const mine = state.all.filter((m) => ownerKey(m, state.user) === "me").length;
  const count = (k) => state.all.filter((m) => ownerKey(m, state.user) === k).length;
  return html`<label>Whose pictures <select data-lib-owner>
    <option value="" ${state.owner ? "" : "selected"}>Everyone's (${state.all.length})</option>
    <option value="me" ${state.owner === "me" ? "selected" : ""}>Mine (${mine})</option>
    ${[...people].sort((a, b) => a[1].localeCompare(b[1])).map(([k, name]) => html`<option value="${k}" ${state.owner === k ? "selected" : ""}>${name} (${count(k)})</option>`)}
  </select></label>`;
}

function arrange(items, state) {
  const list = items.filter((m) => (!state.master || !state.owner || ownerKey(m, state.user) === state.owner) && (!state.category || categoryOf(m) === state.category));
  if (state.sort === "name") list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  else if (state.sort === "oldest") list.reverse();
  return list;
}

/** Grid of library images; used by the pop-up and the Image library page. */
export function libraryGrid(items, { pickable = false, deletable = false, owners = null } = {}) {
  if (!items.length) return html`<div class="empty">No pictures here yet — upload some.</div>`;
  return html`<div class="lib-grid">${items.map((m) => html`<figure class="lib-item">
    <button type="button" class="lib-thumb" ${pickable ? html`data-pick-url="${m.url}"` : html`data-open="${m.url}"`} title="${m.name ?? ""}"><img src="${m.url}" alt="" loading="lazy"></button>
    <figcaption><span>${m.name ?? ""}</span><small>${owners ? `${ownerKey(m, owners) === "me" ? "Mine" : m.owner_name || "Someone"} · ` : ""}${categoryOf(m)} · ${fmtDate(m.created_at)}</small>
      ${deletable ? html`<select data-move-media="${m.id}" aria-label="Category">${[...new Set([...MEDIA_CATEGORIES, categoryOf(m)])].map((c) => html`<option ${c === categoryOf(m) ? "selected" : ""}>${c}</option>`)}</select>
        <button type="button" class="btn small ghost" data-copy="${m.url}">Copy link</button><button type="button" class="btn small" data-del-media="${m.id}">Delete</button>` : ""}
    </figcaption></figure>`)}</div>`;
}

/** Upload one or more files from an <input type=file>; returns the URLs. */
export async function uploadFiles(input, { folder = "library", maxSize = 1600, category } = {}) {
  const urls = [];
  for (const file of input.files) {
    try { urls.push(await uploadImage(file, { folder, maxSize, ...(category ? { category } : {}) })); }
    catch (err) { toast(`${file.name}: ${err.message}`, "error"); }
  }
  input.value = "";
  return urls;
}

/** Wire the category buttons and the sort list; calls `redraw` when they change. */
function wireBar(root, state, redraw) {
  root.addEventListener("click", (e) => {
    const cat = e.target.closest("[data-lib-cat]");
    if (cat) { state.category = cat.dataset.libCat; redraw(); }
  });
  root.addEventListener("change", (e) => {
    if (e.target.matches("[data-lib-sort]")) { state.sort = e.target.value; redraw(); }
    if (e.target.matches("[data-lib-owner]")) { state.owner = e.target.value; state.category = ""; redraw(); }
  });
}

export function pickImage({ folder = "library", maxSize = 1600 } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "picker";
    document.body.append(dlg);
    const state = { category: "", sort: "newest" };
    const close = (url) => { dlg.close(); dlg.remove(); resolve(url ?? null); };
    const draw = async () => {
      const { items, user, master } = await myLibrary();
      Object.assign(state, { all: items, user, master });
      mount($(".picker-body", dlg), html`${libraryBar(items, state)}${libraryGrid(arrange(items, state), { pickable: true, owners: master ? user : null })}`);
    };
    mount(dlg, html`<div class="picker-head"><h3>Choose an image</h3>
        <label class="btn small green">Upload new<input type="file" accept="image/*" multiple hidden data-picker-upload></label>
        <button type="button" class="btn small ghost" data-close>Cancel</button></div>
      <div class="picker-body"></div>`);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest("[data-close]")) return close();
      const pick = e.target.closest("[data-pick-url]");
      if (pick) close(pick.dataset.pickUrl);
    });
    wireBar(dlg, state, draw);
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
  const state = { category: "", sort: "newest", owner: "" };
  const draw = async () => {
    const { items, user, master } = await myLibrary();
    Object.assign(state, { all: items, user, master });
    mount($("[data-lib]", el), html`${libraryBar(items, state)}${libraryGrid(arrange(items, state), { deletable: true, owners: master ? user : null })}`);
  };
  const me = await getUser();
  mount(el, html`<div class="notice">${isMaster(me)
      ? html`<b>Everyone's pictures.</b> Each person who uploads pictures has their own: they see only theirs, and you (the Master Admin) see everybody's — choose under <b>Whose pictures</b>. Pictures from before this change are yours.`
      : html`<b>Your pictures.</b> Everything you upload is kept here so you can use it again. Only you and the Master Admin can see them here.`}
      Pictures are filed by where they were uploaded (News, Players, Emblems & logos…) — change a picture's category with the list under it.
      Big photos are made smaller automatically (about 300 KB). Deleting a picture here removes it from the website wherever it was used.</div>
    <div class="toolbar"><label class="btn green">Upload pictures<input type="file" accept="image/*" multiple hidden data-lib-upload></label>
      <span class="muted">New uploads go into the category you're looking at (or General).</span></div>
    <div data-lib></div>`);
  await draw();
  wireBar(el, state, draw);
  el.addEventListener("change", async (e) => {
    const move = e.target.closest("[data-move-media]");
    if (move) {
      try { await save("media", { id: move.dataset.moveMedia, category: move.value }); toast(`Moved to ${move.value}`); draw(); }
      catch (err) { toast(err.message, "error"); }
      return;
    }
    if (!e.target.matches("[data-lib-upload]")) return;
    const n = (await uploadFiles(e.target, { category: state.category || "General" })).length;
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
      const item = (await myLibrary()).items.find((m) => m.id === del.dataset.delMedia);
      await deleteFromLibrary(item); toast("Deleted"); draw();
    } catch (err) { toast(err.message, "error"); }
  });
}
