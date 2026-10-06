// A small "add as many as you like" field: one text box per item, with × to remove
// and a button to add another. The items are kept in a hidden input as a list
// (["Bugle (2015–2018)","St Blazey A"]), so the form and the database column still hold text.
// Used for a player's past teams — in the admin and on the player's own profile form.
import { html } from "./dom.js";

/**
 * The stored text → its items. New values are a list; anything typed before this field existed
 * ("Bugle (2015–2018), St Blazey A", or one per line) is split at commas and line ends.
 */
export function listItems(text) {
  const t = String(text ?? "").trim();
  if (t.startsWith("[")) {
    try { const list = JSON.parse(t); if (Array.isArray(list)) return list.map((x) => String(x).trim()).filter(Boolean); } catch {}
  }
  return t.split(/\n|,(?![^()]*\))/).map((x) => x.trim()).filter(Boolean);
}
const pack = (items) => (items.length ? JSON.stringify(items) : "");

const row = (value, placeholder, suggestions) => html`<div class="list-row">
  <input type="text" data-list-item value="${value}" placeholder="${placeholder}" maxlength="120" ${suggestions ? html`list="${suggestions}"` : ""}>
  <button type="button" data-list-remove aria-label="Remove">×</button></div>`;

/** options: add (button text), placeholder, suggestions (names offered as you type). */
export function listField(name, value, { add = "+ Add another", placeholder = "", suggestions = [] } = {}) {
  const items = listItems(value);
  const dl = suggestions.length ? `dl-${name}` : "";
  return html`<div class="list-field" data-list-field data-placeholder="${placeholder}" data-suggest="${dl}">
    <div data-list-rows>${(items.length ? items : [""]).map((v) => row(v, placeholder, dl))}</div>
    <button type="button" class="btn small ghost" data-list-add>${add}</button>
    <input type="hidden" name="${name}" value="${pack(items)}">
    ${dl ? html`<datalist id="${dl}">${suggestions.map((s) => html`<option value="${s}">`)}</datalist>` : ""}
  </div>`;
}

/** Call once on the element that holds the form(s). Returns a function that removes the listeners. */
export function wireListFields(root) {
  const sync = (field) => {
    field.querySelector("input[type=hidden]").value = pack([...field.querySelectorAll("[data-list-item]")].map((i) => i.value.trim()).filter(Boolean));
  };
  const onInput = (e) => { if (e.target.matches("[data-list-item]")) sync(e.target.closest("[data-list-field]")); };
  const onClick = (e) => {
    const field = e.target.closest("[data-list-field]");
    if (!field) return;
    const rows = field.querySelector("[data-list-rows]");
    if (e.target.matches("[data-list-add]")) {
      rows.insertAdjacentHTML("beforeend", String(row("", field.dataset.placeholder, field.dataset.suggest)));
      rows.lastElementChild.querySelector("input").focus();
    }
    if (e.target.matches("[data-list-remove]")) {
      // The last box is emptied rather than removed, so there is always somewhere to type.
      if (rows.children.length > 1) e.target.closest(".list-row").remove(); else e.target.closest(".list-row").querySelector("input").value = "";
      sync(field);
    }
  };
  // Pressing Enter in a box adds the next one instead of sending the whole form.
  const onKey = (e) => { if (e.key === "Enter" && e.target.matches("[data-list-item]")) { e.preventDefault(); e.target.closest("[data-list-field]").querySelector("[data-list-add]").click(); } };
  root.addEventListener("input", onInput); root.addEventListener("click", onClick); root.addEventListener("keydown", onKey);
  return () => { root.removeEventListener("input", onInput); root.removeEventListener("click", onClick); root.removeEventListener("keydown", onKey); };
}
