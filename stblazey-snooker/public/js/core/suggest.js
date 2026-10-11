// ─────────────────────────────────────────────────────────────
//  SUGGESTIONS — the list that opens under a text box as you type
//  ("Start typing a player's name…").
//  The browser has its own (<input list="…"> with a <datalist>), but on
//  iPhones it does not open as a list — you only get a word above the
//  keyboard, if that — so the site draws its own, the same on every device.
//
//  Nothing changes in the pages: any <input list="some-id"> is picked up
//  the moment it is tapped. Its <datalist> still holds the choices
//  (<option value="Sam Bolitho">Bethel A</option> → name, with the team in grey).
//  Choosing one fills the box in and sends a "suggest:pick" event from it.
//  Call initSuggest() once (main.js does).
// ─────────────────────────────────────────────────────────────
const MAX_SHOWN = 40;

let box = null;        // the list on screen
let input = null;      // the text box it belongs to
let shown = [];        // the choices in it
let active = -1;       // the one the arrow keys are on
let closing = 0;
let picking = false;

const isOurs = (el) => el instanceof HTMLInputElement && (el.hasAttribute("list") || el.dataset.suggest);

/** Take the box over from the browser: its own list is switched off, ours is used instead. */
function adopt(el) {
  if (el.hasAttribute("list")) { el.dataset.suggest = el.getAttribute("list"); el.removeAttribute("list"); }
  el.setAttribute("autocomplete", "off");
  el.setAttribute("autocapitalize", "words");
  el.setAttribute("role", "combobox");
  el.setAttribute("aria-autocomplete", "list");
}

function choices(el) {
  const list = document.getElementById(el.dataset.suggest);
  if (!list) return [];
  return [...list.querySelectorAll("option")].map((o) => { const value = o.value || o.textContent.trim(), note = o.textContent.trim(); return { value, note: note === value ? "" : note }; }).filter((o) => o.value);
}

/** Names that start with what was typed come first, then a later word starting with it, then anywhere in the name. */
function matches(el) {
  const q = el.value.trim().toLowerCase();
  const all = choices(el);
  if (!q) return all;
  const rank = (o) => { const v = o.value.toLowerCase(); return v.startsWith(q) ? 0 : v.includes(` ${q}`) ? 1 : v.includes(q) ? 2 : o.note.toLowerCase().includes(q) ? 3 : -1; };
  return all.map((o) => [rank(o), o]).filter(([r]) => r >= 0).sort((a, b) => a[0] - b[0]).map(([, o]) => o);
}

function place() {
  if (!box || !input?.isConnected) return;
  const r = input.getBoundingClientRect();
  const width = Math.max(r.width, Math.min(240, document.documentElement.clientWidth - 16));
  box.style.left = `${Math.max(8, Math.min(r.left, document.documentElement.clientWidth - width - 8)) + window.scrollX}px`;
  box.style.top = `${r.bottom + window.scrollY}px`;
  box.style.width = `${width}px`;
}

/** On a phone the keyboard covers half the screen: move the page up so the list is not hidden behind it. */
function keepInView() {
  if (!box || !input?.isConnected) return;
  const vv = window.visualViewport;
  const top = vv ? vv.offsetTop : 0, height = vv ? vv.height : window.innerHeight;
  const r = input.getBoundingClientRect();
  const need = r.bottom + Math.min(box.offsetHeight, 250) + 8 - (top + height);
  if (need <= 0) return;
  const head = document.querySelector(".site-header")?.getBoundingClientRect();
  const headBottom = head && head.bottom > 0 && head.top <= 1 ? head.bottom : 0;
  const room = r.top - top - headBottom - 8;      // how far the box can go up before it meets the top of the screen
  if (room > 0) window.scrollBy({ top: Math.min(need, room), behavior: "smooth" });
}

function close() {
  clearTimeout(closing);
  if (box) { box.remove(); box = null; }
  if (input) input.setAttribute("aria-expanded", "false");
  shown = []; active = -1;
}

function mark() {
  [...box.querySelectorAll("button")].forEach((b, i) => { b.classList.toggle("on", i === active); if (i === active) b.scrollIntoView({ block: "nearest" }); });
}

function open(el) {
  clearTimeout(closing);
  if (input !== el) close();
  input = el;
  const all = matches(el);
  // Nothing to offer — or the box already holds exactly the one thing on offer.
  if (!all.length || (all.length === 1 && all[0].value.toLowerCase() === el.value.trim().toLowerCase())) return close();
  shown = all.slice(0, MAX_SHOWN); active = -1;
  if (!box) {
    box = document.createElement("div");
    box.className = "suggest";
    box.setAttribute("role", "listbox");
    // A press on the list must not take the cursor out of the text box (that would close the list before the choice is made).
    box.addEventListener("mousedown", (e) => e.preventDefault());
    box.addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) pick(shown[Number(b.dataset.i)]); });
    document.body.append(box);
  }
  box.replaceChildren(...shown.map((o, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.i = String(i); b.setAttribute("role", "option"); b.tabIndex = -1;
    const name = document.createElement("span"); name.textContent = o.value; b.append(name);
    if (o.note) { const note = document.createElement("small"); note.textContent = o.note; b.append(note); }
    return b;
  }));
  if (all.length > shown.length) { const more = document.createElement("p"); more.className = "suggest-more"; more.textContent = `${all.length - shown.length} more — keep typing to narrow it down`; box.append(more); }
  el.setAttribute("aria-expanded", "true");
  place();
  keepInView();
}

function pick(choice) {
  if (!choice || !input) return;
  const el = input;
  picking = true;
  el.value = choice.value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  picking = false;
  close();
  el.dispatchEvent(new CustomEvent("suggest:pick", { bubbles: true, detail: choice }));
  if (el.isConnected) el.focus();
}

let started = false;
export function initSuggest() {
  if (started) return;
  started = true;
  document.addEventListener("focusin", (e) => { if (isOurs(e.target)) { adopt(e.target); open(e.target); } });
  document.addEventListener("input", (e) => { if (!picking && isOurs(e.target)) { adopt(e.target); open(e.target); } });
  document.addEventListener("click", (e) => { if (isOurs(e.target) && !box) open(e.target); });
  // Leaving the box closes the list — a moment later, so that a tap on the list still counts.
  document.addEventListener("focusout", (e) => { if (e.target === input) { clearTimeout(closing); closing = setTimeout(close, 180); } });
  document.addEventListener("pointerdown", (e) => { if (box && e.target !== input && !box.contains(e.target)) close(); }, true);
  // The arrow keys move through the list, Enter takes the one they are on, Esc closes it.
  document.addEventListener("keydown", (e) => {
    if (!box || e.target !== input) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); active = (active + (e.key === "ArrowDown" ? 1 : -1) + shown.length + (active < 0 && e.key === "ArrowUp" ? 1 : 0)) % shown.length; mark(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); e.stopImmediatePropagation(); pick(shown[active]); }
    else if (e.key === "Escape") { e.stopPropagation(); close(); }
  }, true);
  window.addEventListener("resize", place, { passive: true });
  window.addEventListener("scroll", place, { passive: true, capture: true });
  window.visualViewport?.addEventListener("resize", () => { place(); keepInView(); }, { passive: true });
  // A page change takes the text box away: the list goes with it.
  new MutationObserver(() => { if (box && !input?.isConnected) close(); }).observe(document.body, { childList: true, subtree: true });
}
