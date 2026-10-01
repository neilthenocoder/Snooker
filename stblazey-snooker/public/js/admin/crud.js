// ─────────────────────────────────────────────────────────────
//  GENERIC ADMIN EDITOR — one list + form engine used by every
//  section in admin/resources.js. Nothing here is table-specific.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, fmtDate, fmtTime, toLocalInput, fromLocalInput } from "../core/dom.js";
import { table, save, remove, invalidate } from "../core/api.js";
import { slugify } from "../core/schedule.js";
import { dataTable, panel } from "../core/components.js";
import { uploadImage } from "../core/upload.js";
import { pickImage, uploadFiles } from "./picker.js";

const MAX_ROWS = 100;
export const labelOf = (row) => row?.name ?? row?.full_name ?? row?.title ?? row?.email ?? "–";
const shortLabel = (f) => f.short ?? f.label.split(" (")[0];
const pretty = (v) => String(v ?? "").replace(/_/g, " ");
const isField = (f) => f.type !== "heading";

/** Form-element name. Fields with `in` live inside a JSON column (e.g. players.cueview). */
const key = (f) => (f.in ? `${f.in}__${f.name}` : f.name);
const valueOf = (f, row) => (f.in ? row[f.in]?.[f.name] : row[f.name]);

async function loadRefs(res) {
  const names = [...new Set(res.fields.filter((f) => f.type === "ref").map((f) => f.ref))];
  const order = { leagues: "sort", categories: "sort", fixtures: "starts_at" };
  const loaded = await Promise.all(names.map((n) => table(n, order[n] ?? "name")));
  return Object.fromEntries(names.map((n, i) => [n, loaded[i]]));
}

/** For a ref field: the stored value of a referenced row (its id, or e.g. its name). */
const refValue = (f, r) => r[f.store ?? "id"];

function display(field, value, refs) {
  if (value == null || value === "") return "–";
  switch (field.type) {
    case "ref": return labelOf(refs[field.ref].find((r) => refValue(field, r) === value)) ?? value;
    case "checkbox": return value ? "Yes" : "No";
    case "datetime": return `${fmtDate(value)} ${fmtTime(value)}`;
    case "date": return fmtDate(value);
    case "select": return pretty(value);
    case "image": return html`<img class="thumb" src="${value}" alt="">`;
    case "gallery": return `${value.length} picture${value.length === 1 ? "" : "s"}`;
    default: return String(value).length > 60 ? `${String(value).slice(0, 60)}…` : value;
  }
}

const galleryThumbs = (name, urls) => html`${urls.map((u, i) => html`<figure class="gal-thumb"><img src="${u}" alt="">
  <button type="button" data-gal-remove="${name}" data-i="${i}" aria-label="Remove">×</button></figure>`)}`;

function input(field, row, refs, rows) {
  const isNew = !row.id;
  const name = key(field);
  const value = valueOf(field, row) ?? (isNew ? field.default : undefined) ?? "";
  const req = field.required || (isNew && field.requiredOnCreate);
  const attrs = `name="${name}" ${req ? "required" : ""} ${field.createOnly && !isNew ? "disabled" : ""}`;
  const a = (s) => html([s]); // attrs are built from our own config only, never user text
  switch (field.type) {
    case "textarea": return html`<textarea ${a(attrs)} style="${field.rows ? `min-height:${field.rows * 24}px` : ""}">${value}</textarea>`;
    case "checkbox": return html`<input type="checkbox" ${a(attrs)} ${value ? "checked" : ""}>`;
    case "number": return html`<input type="number" ${a(attrs)} value="${value}">`;
    case "date": return html`<input type="date" ${a(attrs)} value="${String(value).slice(0, 10)}">`;
    case "datetime": return html`<input type="datetime-local" ${a(attrs)} value="${toLocalInput(value)}">`;
    case "password": return html`<input type="password" autocomplete="new-password" minlength="${field.minLength ?? 8}" ${a(attrs)}>`;
    case "email": return html`<input type="email" ${a(attrs)} value="${value}">`;
    case "select": return html`<select ${a(attrs)}>${field.options.map((o) => html`<option value="${o}" ${o === value ? "selected" : ""}>${pretty(o) || "–"}</option>`)}</select>`;
    case "image": return html`<div class="image-field">
      <img class="image-preview ${field.round ? "round" : ""} ${value ? "" : "hidden"}" src="${value}" alt="" data-preview="${name}">
      <div class="btn-row">
        <button type="button" class="btn small blue" data-library="${name}" data-folder="${field.folder ?? "misc"}" data-max="${field.maxSize ?? 1600}">Choose from library</button>
        <label class="btn small secondary">Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-upload="${name}" data-folder="${field.folder ?? "misc"}" data-max="${field.maxSize ?? 1600}"></label>
        <button type="button" class="btn small ghost" data-clear-image="${name}">Remove</button>
      </div>
      <input type="text" ${a(attrs)} value="${value}" placeholder="…or paste an image link" data-image-url></div>`;
    case "gallery": {
      const urls = Array.isArray(value) ? value : [];
      return html`<div class="gallery-field">
        <div class="gal-thumbs" data-gal="${name}">${galleryThumbs(name, urls)}</div>
        <div class="btn-row">
          <button type="button" class="btn small blue" data-gal-add="${name}">Add from library</button>
          <label class="btn small secondary">Upload pictures<input type="file" accept="image/*" multiple hidden data-gal-upload="${name}"></label>
        </div>
        <input type="hidden" name="${name}" value="${JSON.stringify(urls)}"></div>`;
    }
    case "ref": return html`<select ${a(attrs)}><option value="">– none –</option>${refs[field.ref].map((r) => html`<option value="${refValue(field, r)}" ${refValue(field, r) === value ? "selected" : ""}>${labelOf(r)}</option>`)}</select>`;
    default: {
      const list = field.list ? html`<datalist id="dl-${name}">${[...new Set(rows.map((r) => valueOf(field, r)).filter(Boolean))].map((o) => html`<option value="${o}">`)}</datalist>` : "";
      return html`<input type="text" ${a(attrs)} ${field.list ? a(`list="dl-${name}"`) : ""} value="${value}" placeholder="${field.placeholder ?? ""}">${list}`;
    }
  }
}

/** Read the form back into a row, converting each field by its type. */
function collect(form, res, editing) {
  const row = editing.id != null ? { id: editing.id } : {};
  for (const f of res.fields.filter(isField)) {
    const el = form.elements[key(f)];
    if (!el || el.disabled) continue;
    let v = f.type === "checkbox" ? el.checked : el.value.trim();
    if (f.type === "number") v = v === "" ? null : Number(v);
    else if (f.type === "datetime") v = fromLocalInput(v);
    else if (f.type === "gallery") v = JSON.parse(v || "[]");
    else if (f.type !== "checkbox" && v === "") v = null;
    if (f.type === "password" && !v) continue;
    if (f.in) row[f.in] = { ...(editing[f.in] ?? {}), ...(row[f.in] ?? {}), [f.name]: v ?? "" };
    else row[f.name] = v;
  }
  for (const f of res.fields.filter((x) => x.type === "slug")) {
    if (!row[f.name]) row[f.name] = slugify(row[f.from] ?? "");
  }
  return row;
}

function formFields(res, editing, refs, rows) {
  return res.fields.map((f) => {
    if (f.type === "heading") return html`<h4 class="form-heading">${f.label}${f.help ? html`<small>${f.help}</small>` : ""}</h4>`;
    const caption = shortLabel(f) === f.label ? f.label : html`${shortLabel(f)} <span class="muted" style="font-weight:400">(${f.label.split(" (")[1]}</span>`;
    const help = f.help ? html`<small class="help">${f.help}</small>` : "";
    if (f.type === "checkbox") return html`<label class="check">${input(f, editing, refs, rows)}${f.label}</label>`;
    // Image and gallery fields contain their own buttons, so they sit in a <div> rather than a <label>.
    if (["image", "gallery"].includes(f.type)) return html`<div class="field-label" style="grid-column:1/-1">${caption}${help}${input(f, editing, refs, rows)}</div>`;
    return html`<label style="${f.type === "textarea" || f.wide ? "grid-column:1/-1" : ""}">${caption}${help}${input(f, editing, refs, rows)}</label>`;
  });
}

export async function crud(el, res, { preset = {} } = {}) {
  const refs = await loadRefs(res);
  let rows = [];
  let editing = null;
  const filters = { ...preset };
  let search = "";

  const load = async () => {
    invalidate();
    rows = [...(await table(res.table, res.order))];
    if (res.desc) rows.reverse();
  };

  const filterFields = (res.filters ?? []).map((n) => res.fields.find((f) => f.name === n));
  const columns = [
    ...(res.columns ?? []).map((name) => {
      const f = res.fields.find((x) => x.name === name);
      return { label: shortLabel(f), cell: (r) => display(f, r[name], refs) };
    }),
    { label: "", cls: "right", cell: (r) => html`<span class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">
      ${(res.rowActions ?? []).map((a) => html`<a class="btn small ghost" href="${a.href(r)}">${a.label}</a>`)}
      <button class="btn small secondary" data-edit="${r.id}">Edit</button>
      <button class="btn small" data-delete="${r.id}">Delete</button></span>` },
  ];

  const visible = () => rows.filter((r) =>
    Object.entries(filters).every(([k, v]) => !v || r[k] === v) &&
    (!search || (res.columns ?? []).some((c) => String(display(res.fields.find((f) => f.name === c), r[c], refs)).toLowerCase().includes(search))));

  function drawList() {
    if (res.single) return;
    const list = visible();
    mount($("[data-list]", el), html`${list.length > MAX_ROWS ? html`<div class="notice">Showing the first ${MAX_ROWS} of ${list.length} — use search or filters to narrow down.</div>` : ""}
      ${dataTable(columns, list.slice(0, MAX_ROWS), { empty: "Nothing here yet — press “Add new”." })}`);
  }

  function drawForm() {
    const box = $("[data-form]", el);
    if (!editing) return mount(box, "");
    const title = res.single ? res.label : editing.id ? `Edit ${res.label}` : `Add to ${res.label}`;
    mount(box, panel(title, html`<form class="form" data-crud-form>
      <div class="grid-2">${formFields(res, editing, refs, rows)}</div>
      <div class="btn-row form-actions"><button class="btn">Save</button>${res.single ? "" : html`<button type="button" class="btn ghost" data-cancel>Cancel</button>`}</div>
    </form>`));
    if (!res.single) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  await load();
  mount(el, html`
    ${res.intro ? html`<div class="notice">${res.intro}</div>` : ""}
    ${res.single ? "" : html`<div class="toolbar">
      <button class="btn green" data-new>+ Add new</button>
      <input type="search" placeholder="Search…" data-search>
      ${filterFields.map((f) => html`<select data-filter="${f.name}"><option value="">Any ${shortLabel(f).toLowerCase()}</option>
        ${(f.type === "ref" ? refs[f.ref].map((r) => [refValue(f, r), labelOf(r)]) : (f.options ?? [...new Set(rows.map((r) => r[f.name]).filter(Boolean))]).map((o) => [o, pretty(o)]))
          .map(([v, l]) => html`<option value="${v}" ${filters[f.name] === v ? "selected" : ""}>${l}</option>`)}</select>`)}
    </div>`}
    <div data-form style="margin-bottom:20px"></div>
    <div class="panel" data-list></div>`);
  drawList();
  if (res.single) { editing = rows[0] ?? { id: 1 }; drawForm(); }

  // Image fields: upload / pick → put the URL in the text box → show a preview.
  const form = () => $("[data-crud-form]", el);
  const setImage = (name, url) => {
    form().elements[name].value = url;
    const img = $(`[data-preview="${name}"]`, form());
    img.src = url; img.classList.toggle("hidden", !url);
  };
  // Gallery fields keep their list of links as JSON in a hidden input.
  const galleryList = (name) => JSON.parse(form().elements[name].value || "[]");
  const setGallery = (name, urls) => {
    form().elements[name].value = JSON.stringify(urls);
    mount($(`[data-gal="${name}"]`, form()), galleryThumbs(name, urls));
  };

  el.addEventListener("change", async (e) => {
    const gal = e.target.closest("[data-gal-upload]");
    if (gal) {
      const name = gal.dataset.galUpload;
      const urls = await uploadFiles(gal, { folder: "gallery" });
      if (urls.length) { setGallery(name, [...galleryList(name), ...urls]); toast("Pictures added — press Save to keep them"); }
      return;
    }
    const input = e.target.closest("[data-upload]");
    if (!input?.files[0]) return;
    const label = input.closest("label");
    label.firstChild.textContent = "Uploading…";
    try { setImage(input.dataset.upload, await uploadImage(input.files[0], { folder: input.dataset.folder, maxSize: Number(input.dataset.max) })); toast("Image uploaded — press Save to keep it"); }
    catch (err) { toast(err.message, "error"); }
    finally { label.firstChild.textContent = "Upload image"; input.value = ""; }
  });

  el.addEventListener("input", (e) => {
    if (e.target.matches("[data-image-url]")) setImage(e.target.name, e.target.value.trim());
    if (e.target.matches("[data-search]")) { search = e.target.value.trim().toLowerCase(); drawList(); }
    if (e.target.matches("[data-filter]")) { filters[e.target.dataset.filter] = e.target.value; drawList(); }
  });

  el.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.matches("[data-new]")) { editing = { ...filters }; drawForm(); }
    if (t.matches("[data-cancel]")) { editing = null; drawForm(); }
    if (t.matches("[data-clear-image]")) setImage(t.dataset.clearImage, "");
    if (t.matches("[data-library]")) {
      const url = await pickImage({ folder: t.dataset.folder, maxSize: Number(t.dataset.max) });
      if (url) setImage(t.dataset.library, url);
    }
    if (t.matches("[data-gal-add]")) {
      const url = await pickImage({ folder: "gallery" });
      if (url) setGallery(t.dataset.galAdd, [...galleryList(t.dataset.galAdd), url]);
    }
    if (t.matches("[data-gal-remove]")) {
      const list = galleryList(t.dataset.galRemove);
      list.splice(Number(t.dataset.i), 1);
      setGallery(t.dataset.galRemove, list);
    }
    if (t.matches("[data-edit]")) { editing = rows.find((r) => r.id === t.dataset.edit); drawForm(); }
    if (t.matches("[data-delete]")) {
      const row = rows.find((r) => r.id === t.dataset.delete);
      if (!confirm(`Delete “${labelOf(row) !== "–" ? labelOf(row) : "this item"}”? This can't be undone.`)) return;
      try { await (res.remove ? res.remove(row) : remove(res.table, row.id)); toast("Deleted"); await load(); drawList(); }
      catch (err) { toast(friendly(err), "error"); }
    }
  });

  el.addEventListener("submit", async (e) => {
    if (!e.target.matches("[data-crud-form]")) return;
    e.preventDefault();
    let row = collect(e.target, res, editing);
    const problem = res.validate?.(row);
    if (problem) return toast(problem, "error");
    if (res.beforeSave) row = res.beforeSave(row, refs);
    const btn = e.target.querySelector("button:not([type=button])");
    btn.disabled = true;
    try {
      await (res.save ? res.save(row) : save(res.table, row));
      toast("Saved");
      await load();
      if (res.single) { editing = rows[0]; drawForm(); res.afterSave?.(); }
      else { editing = null; drawForm(); drawList(); }
    } catch (err) { toast(friendly(err), "error"); btn.disabled = false; }
  });
}

/** Turn common database errors into plain English. */
export function friendly(err) {
  const m = err.message || String(err);
  if (/duplicate key|unique/i.test(m)) return "That name or web address is already used — try a different one.";
  if (/foreign key/i.test(m)) return "This is still used elsewhere (e.g. a team still has players or fixtures). Remove those first.";
  if (/row-level security|permission/i.test(m)) return "You don't have permission to do that.";
  return m;
}
