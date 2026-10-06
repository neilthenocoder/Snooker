import { html, mount } from "../core/dom.js";
import { articles, table } from "../core/api.js";
import { breadcrumb, articleCard } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

/**
 * /news — all articles grouped by category. Which category comes first ("Display order")
 * and how many columns its articles are shown in are both set under Admin → News categories.
 */
export default async function news(view) {
  setTitle("Latest News");
  adminEdit("categories", null, { label: "Edit news layout" });
  const [list, categories] = await Promise.all([articles(), table("categories", "sort").catch(() => [])]);
  const columnsOf = new Map(categories.map((c) => [c.name, Math.max(1, Math.min(6, Number(c.columns) || 4))]));
  const groups = new Map(categories.map((c) => [c.name, []]));
  for (const a of list) (groups.get(a.category) ?? groups.set(a.category, []).get(a.category)).push(a);
  const filled = [...groups].filter(([, items]) => items.length);
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Latest News"]])}
    <h1>Latest News</h1>
    ${filled.length > 1 ? html`<div class="chips">${filled.map(([cat]) => html`<a class="tag-link" href="#${encodeURIComponent(cat)}">${cat}</a>`)}</div>` : ""}
    ${filled.length ? filled.map(([cat, items]) => html`
      <div class="tag" id="${encodeURIComponent(cat)}">${cat}</div>
      <div class="cards news-cols ${(columnsOf.get(cat) ?? 4) <= 3 ? "few" : ""}" style="--cols:${columnsOf.get(cat) ?? 4}">${items.map(articleCard)}</div>`) : html`<div class="empty">No articles yet.</div>`}
  </div>`);
}
