import { html, mount } from "../core/dom.js";
import { articles, table } from "../core/api.js";
import { breadcrumb, articleCard } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

/** /news — all articles grouped by category, in the order set under Admin → News categories. */
export default async function news(view) {
  setTitle("Latest News");
  adminEdit("articles");
  const [list, categories] = await Promise.all([articles(), table("categories", "sort").catch(() => [])]);
  const order = categories.map((c) => c.name);
  const groups = new Map(order.map((n) => [n, []]));
  for (const a of list) (groups.get(a.category) ?? groups.set(a.category, []).get(a.category)).push(a);
  const filled = [...groups].filter(([, items]) => items.length);
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Latest News"]])}
    <h1>Latest News</h1>
    ${filled.length > 1 ? html`<div class="chips">${filled.map(([cat]) => html`<a class="tag-link" href="#${encodeURIComponent(cat)}">${cat}</a>`)}</div>` : ""}
    ${filled.length ? filled.map(([cat, items]) => html`
      <div class="tag" id="${encodeURIComponent(cat)}">${cat}</div>
      <div class="cards">${items.map(articleCard)}</div>`) : html`<div class="empty">No articles yet.</div>`}
  </div>`);
}
