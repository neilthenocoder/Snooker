// ─────────────────────────────────────────────────────────────
//  Admin → Website → Menu (Rich, round 22: "a menu creator and a menu re-ordering").
//  The buttons of the menu bar: their words, where they go, their colour, the order
//  (drag them, or use ↑ ↓) and whether they show. Add buttons of your own (a page of
//  the site, an info page, another website). Below: the extra links in the phone menu.
//  Saved in settings.menu_items / menu_more; "Back to the standard menu" empties them.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$, toast, confirmBox } from "../core/dom.js";
import { settings, save, table } from "../core/api.js";
import { panel } from "../core/components.js";
import { refreshShell } from "../core/router.js";
import { menuItems, menuMore, menuLook, MENU_COLORS, STANDARD_MENU, STANDARD_MORE } from "../core/menu.js";
import { friendly } from "./crud.js";

const PAGES = [["/", "Home"], ["/competitions", "Competitions"], ["/fixtures", "Fixtures"], ["/results", "Results"], ["/league", "League"], ["/news", "News"], ["/live", "Live"],
  ["/calendar", "Calendar"], ["/players", "Our Players"], ["/seasons", "Seasons"], ["/handicaps", "Handicaps"], ["/venues", "Venues"], ["/rules", "Rules"], ["/meetings", "Meetings"],
  ["/marketplace", "Marketplace"], ["/merchandise", "Merchandise"], ["/presentation", "Presentation night"], ["/archive", "Archive"], ["/enter", "Enter a competition"], ["/newsletter", "Newsletter sign-up"], ["/scoreboard", "Live scoreboard"], ["/hall-of-fame", "Hall of Fame"], ["/downloads", "Downloads"], ["/sponsorship", "Sponsorship"]];

export async function menuPage(el) {
  const [site, infoPages] = await Promise.all([settings(), table("pages", "sort").catch(() => [])]);
  let items = menuItems(site, { all: true }).map((x) => ({ ...x }));
  let more = menuMore(site).map((x) => ({ ...x }));
  const suggestions = [...PAGES, ...infoPages.map((p) => [`/page/${p.slug}`, p.title])];
  let dragFrom = null;

  const colourChoice = (item, i) => {
    const own = /^#/.test(item.color);
    return html`<span class="mn-colour"><select data-f="color" data-i="${i}">${Object.entries(MENU_COLORS).map(([k, l]) => html`<option value="${k}" ${item.color === k ? "selected" : ""}>${l}</option>`)}
      <option value="own" ${own ? "selected" : ""}>A colour of its own…</option></select>
      ${own ? html`<input type="color" data-f="own" data-i="${i}" value="${item.color}">` : ""}</span>`;
  };
  const draw = () => mount(el, html`
    <div class="notice">The buttons along the top of every page, in order. <b>Drag a row</b> (or use ↑ ↓) to move it, untick <b>Show</b> to hide it, change its words or where it goes, and pick its colour —
      the section colours follow Website → Branding. Add a button for any page of the website, an info page, or another website. Press <b>Save</b> to put the new menu on the website.</div>
    ${panel("Menu bar", html`<div class="mn-preview" aria-label="How the menu bar will look">${items.filter((x) => !x.hidden).map((x) => { const { cls, style } = menuLook(x); return html`<span class="${cls}" style="${style}">${x.label}</span>`; })}</div>
      <ol class="mn-list" data-list="items">${items.map((x, i) => html`<li class="mn-row ${x.hidden ? "off" : ""}" data-i="${i}">
        <span class="mn-grip" draggable="true" aria-hidden="true" title="Drag to move">⋮⋮</span>
        <label class="mn-show" title="Show this button"><input type="checkbox" data-f="show" data-i="${i}" ${x.hidden ? "" : "checked"}> Show</label>
        <input class="mn-label" data-f="label" data-i="${i}" value="${x.label}" maxlength="30" aria-label="Words on the button">
        <input class="mn-href" data-f="href" data-i="${i}" value="${x.href}" list="mn-pages" aria-label="Where it goes" placeholder="/page or https://…">
        ${colourChoice(x, i)}
        <span class="mn-move"><button type="button" data-up="${i}" ${i ? "" : "disabled"} aria-label="Move up">↑</button><button type="button" data-down="${i}" ${i < items.length - 1 ? "" : "disabled"} aria-label="Move down">↓</button>
          <button type="button" data-remove="${i}" aria-label="Remove">✕</button></span></li>`)}</ol>
      <div class="btn-row"><button type="button" class="btn small green" data-add-item>+ Add a button</button></div>`)}
    ${panel("Phone menu: extra links", html`<p class="muted" style="margin-top:0">On phones the menu opens full screen: the buttons above, then these smaller links underneath.</p>
      <ol class="mn-list" data-list="more">${more.map((x, i) => html`<li class="mn-row" data-i="${i}">
        <span class="mn-grip" draggable="true" aria-hidden="true" title="Drag to move">⋮⋮</span>
        <input class="mn-label" data-g="label" data-i="${i}" value="${x.label}" maxlength="30" aria-label="Words">
        <input class="mn-href" data-g="href" data-i="${i}" value="${x.href}" list="mn-pages" aria-label="Where it goes">
        <span class="mn-move"><button type="button" data-mup="${i}" ${i ? "" : "disabled"} aria-label="Move up">↑</button><button type="button" data-mdown="${i}" ${i < more.length - 1 ? "" : "disabled"} aria-label="Move down">↓</button>
          <button type="button" data-mremove="${i}" aria-label="Remove">✕</button></span></li>`)}</ol>
      <div class="btn-row"><button type="button" class="btn small green" data-add-more>+ Add a link</button></div>`, { color: "yellow" })}
    <datalist id="mn-pages">${suggestions.map(([href, label]) => html`<option value="${href}">${label}</option>`)}</datalist>
    <div class="btn-row form-actions"><button type="button" class="btn" data-save>Save the menu</button><button type="button" class="btn ghost" data-standard>Back to the standard menu</button></div>`);
  draw();

  const swap = (list, i, j) => { [list[i], list[j]] = [list[j], list[i]]; draw(); };
  el.oninput = (e) => {
    const t = e.target, i = Number(t.dataset.i);
    if (t.dataset.f === "label" || t.dataset.f === "href") { items[i][t.dataset.f] = t.value; }
    if (t.dataset.f === "own") { items[i].color = t.value; draw(); }
    if (t.dataset.g) more[i][t.dataset.g] = t.value;
    if (t.dataset.f === "label") $$(".mn-preview > span", el)[items.filter((x, n) => n <= i && !x.hidden).length - 1]?.replaceChildren(t.value);
  };
  el.onchange = (e) => {
    const t = e.target, i = Number(t.dataset.i);
    if (t.dataset.f === "show") { items[i].hidden = !t.checked; draw(); }
    if (t.dataset.f === "color") { items[i].color = t.value === "own" ? "#0b84e0" : t.value; draw(); }
    if (t.dataset.f === "href" && !items[i].label) { const hit = suggestions.find(([h]) => h === t.value); if (hit) { items[i].label = hit[1]; draw(); } }
    if (t.dataset.g === "href" && !more[i].label) { const hit = suggestions.find(([h]) => h === t.value); if (hit) { more[i].label = hit[1]; draw(); } }
  };
  // Drag a row to a new place.
  el.ondragstart = (e) => { const li = e.target.closest?.(".mn-row"); if (!li) return; dragFrom = { list: li.parentElement.dataset.list, i: Number(li.dataset.i) }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", ""); e.dataTransfer.setDragImage?.(li, 20, 20); li.classList.add("dragging"); };
  el.ondragover = (e) => { const li = e.target.closest?.(".mn-row"); if (li && dragFrom && li.parentElement.dataset.list === dragFrom.list) { e.preventDefault(); $$(".mn-row.over", el).forEach((x) => x.classList.remove("over")); li.classList.add("over"); } };
  el.ondrop = (e) => {
    const li = e.target.closest?.(".mn-row");
    if (!li || !dragFrom || li.parentElement.dataset.list !== dragFrom.list) return;
    e.preventDefault();
    const list = dragFrom.list === "items" ? items : more, to = Number(li.dataset.i);
    const [moved] = list.splice(dragFrom.i, 1); list.splice(to, 0, moved); dragFrom = null; draw();
  };
  el.ondragend = () => { dragFrom = null; $$(".mn-row", el).forEach((x) => x.classList.remove("dragging", "over")); };
  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const d = t.dataset;
    if (d.up) return swap(items, Number(d.up), Number(d.up) - 1);
    if (d.down) return swap(items, Number(d.down), Number(d.down) + 1);
    if (d.remove) { items.splice(Number(d.remove), 1); return draw(); }
    if (d.mup) return swap(more, Number(d.mup), Number(d.mup) - 1);
    if (d.mdown) return swap(more, Number(d.mdown), Number(d.mdown) + 1);
    if (d.mremove) { more.splice(Number(d.mremove), 1); return draw(); }
    if (d.addItem !== undefined) { items.push({ label: "", href: "", color: "league", hidden: false }); draw(); return $$("[data-list=items] .mn-label", el).at(-1)?.focus(); }
    if (d.addMore !== undefined) { more.push({ label: "", href: "" }); draw(); return $$("[data-list=more] .mn-label", el).at(-1)?.focus(); }
    if (d.standard !== undefined) {
      if (!(await confirmBox("The menu goes back to Home, Competitions, Fixtures, League, News and Live, with the standard phone links.", { title: "Use the standard menu?", ok: "Yes" }))) return;
      items = STANDARD_MENU.map((x) => ({ ...x, hidden: false })); more = STANDARD_MORE.map((x) => ({ ...x }));
      try { await save("settings", { id: 1, menu_items: null, menu_more: null }); await refreshShell(); toast("The standard menu is back"); draw(); } catch (err) { toast(friendly(err), "error"); }
      return;
    }
    if (d.save !== undefined) {
      const bad = [...items, ...more].find((x) => !x.label.trim() || !x.href.trim());
      if (bad) return toast("Every button and link needs words and somewhere to go (or remove it).", "error");
      if (!items.some((x) => !x.hidden)) return toast("Show at least one button.", "error");
      t.disabled = true;
      try { await save("settings", { id: 1, menu_items: items.map((x) => ({ ...x, label: x.label.trim(), href: x.href.trim() })), menu_more: more.map((x) => ({ label: x.label.trim(), href: x.href.trim() })) }); await refreshShell(); toast("Menu saved"); }
      catch (err) { toast(friendly(err), "error"); }
      t.disabled = false;
    }
  };
}
