// /news — the news hub. "Featured news" at the top (one big story and three beside it: the
// articles ticked "Featured news" in the dashboard, or the newest four if none is ticked),
// then a row of tabs (All, then every category in the order set under Admin → News categories)
// and the articles as cards: three across on a wide screen, and on a phone separate cards
// with the picture on the left and the headline and date beside it.
import { html, mount, $, fmtDate } from "../core/dom.js";
import { articles, table } from "../core/api.js";
import { breadcrumb, urls, readTime, categoriesOf } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

const PAGE = 12;                                   // cards shown before "Show more"
const FEATURED = 4;                                // one big story and three beside it

export default async function news(view, { query }) {
  setTitle("Latest News");
  adminEdit("articles", null, { label: "Edit news" });
  const [list, categories] = await Promise.all([articles(), table("categories", "sort").catch(() => [])]);
  // Tabs: the categories in their set order, then any category an article has that isn't in the list. Empty ones are left out.
  const inCat = (a, n) => categoriesOf(a).includes(n);
  const names = [...new Set([...categories.map((c) => c.name), ...list.flatMap(categoriesOf)])].filter((n) => n && list.some((a) => inCat(a, n)));
  // Featured: the ones ticked in the dashboard, newest first.
  const ticked = list.filter((a) => a.hub_featured);
  // (Fewer than four ticked: the newest of the rest make up the four, so the block is always full.)
  const featured = [...ticked, ...list.filter((a) => !a.hub_featured)].slice(0, FEATURED);
  const when = (a) => fmtDate(a.published_at);
  const pic = (a) => (a.image_url || a.circle_image_url ? html`<img src="${a.image_url || a.circle_image_url}" alt="" loading="lazy">` : html`<span class="hub-ph" aria-hidden="true"></span>`);
  let cat = names.includes(query.get("category")) ? query.get("category") : "";
  let shown = PAGE;

  const card = (a) => html`<a class="hub-card" href="${urls.article(a)}">
    <div class="hub-pic">${a.image_url || a.circle_image_url ? html`<img src="${a.image_url || a.circle_image_url}" alt="" loading="lazy">` : html`<span class="hub-ph" aria-hidden="true"></span>`}</div>
    <div class="hub-body">
      ${a.category ? html`<span class="hub-cat">${a.category}</span>` : ""}
      <h3>${a.title}</h3>
      ${a.excerpt ? html`<p class="hub-excerpt">${a.excerpt}</p>` : ""}
      <div class="hub-meta"><span>${fmtDate(a.published_at)}</span><span>${readTime(a)} min read</span></div>
    </div></a>`;

  mount(view, html`<div class="wrap news-hub">
    ${breadcrumb([["Home", "/"], ["Latest News"]])}
    <header class="hub-head"><h1>Latest News</h1><p>Match reports, competition news and CueViews from around the league.</p></header>
    <section class="hub-featured" data-featured aria-label="Featured news"></section>
    ${names.length > 1 ? html`<nav class="hub-tabs" aria-label="News categories" data-tabs></nav>` : ""}
    <div data-grid></div>
  </div>`);

  function draw() {
    const items = list.filter((a) => !cat || inCat(a, cat));
    // Featured news belongs to the "All" tab; a category tab shows just that category.
    const top = $("[data-featured]", view);
    mount(top, !cat && featured.length ? html`<h2>Featured news</h2><div class="feat-grid ${featured.length === 1 ? "solo" : ""}">
      <a class="feat-main" href="${urls.article(featured[0])}">${pic(featured[0])}
        <span class="feat-text"><strong>${featured[0].title}</strong><small>${featured[0].category} | ${when(featured[0])}</small></span></a>
      ${featured.length > 1 ? html`<div class="feat-side">${featured.slice(1).map((a) => html`<a class="feat-card" href="${urls.article(a)}">${pic(a)}
        <span class="feat-text"><strong>${a.title}</strong><small><b>${a.category}</b> | ${when(a)}</small></span></a>`)}</div>` : ""}</div>` : "");
    top.hidden = !!cat || !featured.length;
    const tabs = $("[data-tabs]", view);
    if (tabs) mount(tabs, html`${[["", "All", list.length], ...names.map((n) => [n, n, list.filter((a) => inCat(a, n)).length])]
      .map(([key, label, n]) => html`<a href="${key ? `/news?category=${encodeURIComponent(key)}` : "/news"}" data-cat="${key}" class="${key === cat ? "on" : ""}" ${key === cat ? html`aria-current="true"` : ""}>${label}<small>${n}</small></a>`)}`);
    mount($("[data-grid]", view), items.length ? html`<div class="hub-grid">${items.slice(0, shown).map(card)}</div>
      ${items.length > shown ? html`<div class="hub-more"><button type="button" class="btn ghost" data-more>Show more news <small>${items.length - shown} more</small></button></div>` : ""}`
      : html`<div class="empty box">No articles yet.</div>`);
    tabs?.querySelector(".on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }
  draw();

  // Changing tab doesn't reload the page: the list is simply redrawn (and the address kept in step, so it can be shared).
  $(".news-hub", view).addEventListener("click", (e) => {
    const tab = e.target.closest("[data-cat]");
    if (tab && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault(); e.stopPropagation();
      cat = tab.dataset.cat; shown = PAGE;
      history.replaceState(null, "", tab.getAttribute("href"));
      return draw();
    }
    if (e.target.closest("[data-more]")) { shown += PAGE; draw(); }
  });
}
