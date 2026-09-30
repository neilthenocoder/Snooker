// ─────────────────────────────────────────────────────────────
//  GENERIC ADMIN EDITOR — one list + form engine used by every
//  section in admin/resources.js. Nothing here is table-specific.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, fmtDate, fmtTime, toLocalInput, fromLocalInput } from "../core/dom.js";
import { table, save, remove, invalidate } from "../core/api.js";
import { slugify } from "../core/schedule.js";
import { dataTable, panel } from "../core/components.js";

const MAX_ROWS = 100;
const labelOf = (row) => row?.name ?? row?.full_name ?? row?.title ?? row?.email ?? "–";
const shortLabel = (f) => f.short ?? f.label.split(" (")[0];
const pretty = (v) => String(v ?? "").replace(/_/g, " ");

async function loadRefs(res) {
  const names = [...new Set(res.fields.filter((f) => f.type === "ref").map((f) => f.ref))];
  const loaded = await Promise.all(names.map((n) => table(n, n === "leagues" ? "sort" : "name")));
  return Object.fromEntries(names.map((n, i) => [n, loaded[i]]));
}

function display(field, value, refs) {
  if (value == null || value === "") return "–";
  switch (field.type) {
    case "ref": return labelOf(refs[field.ref].find((r) => r.id === value));
    case "checkbox": return value ? "Yes" : "No";
    case "datetime": return `${fmtDate(value)} ${fmtTime(value)}`;
    case "date": return fmtDate(value);
    case "select": return pretty(value);
    default: return String(value).length > 60 ? `${String(value).slice(0, 60)}…` : value;
  }
}

function input(field, row, refs, rows) {
  const isNew = !row.id;
  const value = row[field.name] ?? (isNew ? field.default : undefined) ?? "";
  const req = field.required || (isNew && field.requiredOnCreate);
  const attrs = `name="${field.name}" ${req ? "required" : ""} ${field.createOnly && !isNew ? "disabled" : ""}`;
  const a = (s) => html([s]); // attrs are built from our own config only, never user text
  switch (field.type) {
    case "textarea": return html`<textarea ${a(attrs)}>${value}</textarea>`;
    case "checkbox": return html`<input type="checkbox" ${a(attrs)} ${value ? "checked" : ""}>`;
    case "number": return html`<input type="number" ${a(attrs)} value="${value}">`;
    case "date": return html`<input type="date" ${a(attrs)} value="${String(value).slice(0, 10)}">`;
    case "datetime": return html`<input type="datetime-local" ${a(attrs)} value="${toLocalInput(value)}">`;
    case "password": return html`<input type="password" autocomplete="new-password" minlength="${field.minLength ?? 8}" ${a(attrs)}>`;
    case "email": return html`<input type="email" ${a(attrs)} value="${value}">`;
    case "select": return html`<select ${a(attrs)}>${field.options.map((o) => html`<option value="${o}" ${o === value ? "selected" : ""}>${pretty(o)}</option>`)}</select>`;
    case "ref": return html`<select ${a(attrs)}><option value="">– none –</option>${refs[field.ref].map((r) => html`<option value="${r.id}" ${r.id === value ? "selected" : ""}>${labelOf(r)}</option>`)}</select>`;
    default: {
      const list = field.list ? html`<datalist id="dl-${field.name}">${[...new Set(rows.map((r) => r[field.name]).filter(Boolean))].map((o) => html`<option value="${o}">`)}</datalist>` : "";
      return html`<input type="text" ${a(attrs)} ${field.list ? a(`list="dl-${field.name}"`) : ""} value="${value}">${list}`;
    }
  }
}

/** Read the form back into a row, converting each field by its type. */
function collect(form, res, editing) {
  const row = editing.id ? { id: editing.id } : {};
  for (const f of res.fields) {
    const el = form.elements[f.name];
    if (!el || el.disabled) continue;
    let v = f.type === "checkbox" ? el.checked : el.value.trim();
    if (f.type === "number") v = v === "" ? null : Number(v);
    else if (f.type === "datetime") v = fromLocalInput(v);
    else if (f.type !== "checkbox" && v === "") v = null;
    if (f.type === "password" && !v) continue;
    row[f.name] = v;
  }
  for (const f of res.fields.filter((x) => x.type === "slug")) {
    if (!row[f.name]) row[f.name] = slugify(row[f.from] ?? "");
  }
  return row;
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
    ...res.columns.map((name) => {
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
    (!search || res.columns.some((c) => String(display(res.fields.find((f) => f.name === c), r[c], refs)).toLowerCase().includes(search))));

  function drawList() {
    const list = visible();
    mount($("[data-list]", el), html`${list.length > MAX_ROWS ? html`<div class="notice">Showing the first ${MAX_ROWS} of ${list.length} — use search or filters to narrow down.</div>` : ""}
      ${dataTable(columns, list.slice(0, MAX_ROWS), { empty: "Nothing here yet — press “Add new”." })}`);
  }

  function drawForm() {
    const box = $("[data-form]", el);
    if (!editing) return mount(box, "");
    mount(box, panel(editing.id ? `Edit ${res.label}` : `Add to ${res.label}`, html`<form class="form" data-crud-form>
      <div class="grid-2">${res.fields.map((f) => html`<label class="${f.type === "checkbox" ? "check" : ""}" style="${f.type === "textarea" ? "grid-column:1/-1" : ""}">
        ${f.type === "checkbox" ? "" : shortLabel(f) === f.label ? f.label : html`${shortLabel(f)} <span class="muted" style="font-weight:400">(${f.label.split(" (")[1]}</span>`}
        ${input(f, editing, refs, rows)}${f.type === "checkbox" ? f.label : ""}</label>`)}</div>
      <div class="btn-row"><button class="btn">Save</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>
    </form>`));
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  await load();
  mount(el, html`
    ${res.intro ? html`<div class="notice">${res.intro}</div>` : ""}
    <div class="toolbar">
      <button class="btn green" data-new>+ Add new</button>
      <input type="search" placeholder="Search…" data-search>
      ${filterFields.map((f) => html`<select data-filter="${f.name}"><option value="">Any ${shortLabel(f).toLowerCase()}</option>
        ${(f.type === "ref" ? refs[f.ref].map((r) => [r.id, labelOf(r)]) : (f.options ?? [...new Set(rows.map((r) => r[f.name]).filter(Boolean))]).map((o) => [o, pretty(o)]))
          .map(([v, l]) => html`<option value="${v}" ${filters[f.name] === v ? "selected" : ""}>${l}</option>`)}</select>`)}
    </div>
    <div data-form style="margin-bottom:20px"></div>
    <div class="panel" data-list></div>`);
  drawList();

  el.addEventListener("input", (e) => {
    if (e.target.matches("[data-search]")) { search = e.target.value.trim().toLowerCase(); drawList(); }
    if (e.target.matches("[data-filter]")) { filters[e.target.dataset.filter] = e.target.value; drawList(); }
  });

  el.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.matches("[data-new]")) { editing = { ...filters }; drawForm(); }
    if (t.matches("[data-cancel]")) { editing = null; drawForm(); }
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
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await (res.save ? res.save(row) : save(res.table, row));
      toast("Saved");
      editing = null; drawForm(); await load(); drawList();
    } catch (err) { toast(friendly(err), "error"); btn.disabled = false; }
  });
}

/** Turn common database errors into plain English. */
function friendly(err) {
  const m = err.message || String(err);
  if (/duplicate key|unique/i.test(m)) return "That name or web address is already used — try a different one.";
  if (/foreign key/i.test(m)) return "This is still used elsewhere (e.g. a team still has players or fixtures). Remove those first.";
  if (/row-level security|permission/i.test(m)) return "You don't have permission to do that.";
  return m;
}
