import { html, mount } from "../core/dom.js";
import { articles } from "../core/api.js";
import { breadcrumb, articleCard } from "../core/components.js";
import { setTitle } from "../core/router.js";

/** /news — all articles grouped by category. /competitions reuses it with one category. */
export default async function news(view, { only } = {}) {
  const all = await articles();
  const list = only ? all.filter((a) => a.category === only) : all;
  const title = only ? "Competitions" : "Latest News";
  setTitle(title);
  const groups = new Map();
  for (const a of list) (groups.get(a.category) ?? groups.set(a.category, []).get(a.category)).push(a);
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], [title]])}
    <h1>${title}</h1>
    ${list.length ? [...groups].map(([cat, items]) => html`
      ${only ? "" : html`<div class="tag">${cat}</div>`}
      <div class="cards">${items.map(articleCard)}</div>`) : html`<div class="empty">No articles yet.</div>`}
  </div>`);
}
