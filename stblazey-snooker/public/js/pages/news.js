// /news — the news hub. A row of tabs (All, then every category in the order set under
// Admin → News categories) and the articles as cards: three across on a wide screen,
// and on a phone a clean list — picture on the left, headline and date beside it.
import { html, mount, $, fmtDate } from "../core/dom.js";
import { articles, table } from "../core/api.js";
import { breadcrumb, urls } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

const PAGE = 12;                                   // cards shown before "Show more"
const WORDS_A_MINUTE = 200;
const readTime = (a) => Math.max(1, Math.round(String(`${a.excerpt ?? ""} ${a.body ?? ""}`).trim().split(/\s+/).length / WORDS_A_MINUTE));

export default async function news(view, { query }) {
  setTitle("Latest News");
  adminEdit("articles", null, { label: "Edit news" });
  const [list, categories] = await Promise.all([articles(), table("categories", "sort").catch(() => [])]);
  // Tabs: the categories in their set order, then any category an article has that isn't in the list. Empty ones are left out.
  const names = [...new Set([...categories.map((c) => c.name), ...list.map((a) => a.category)])].filter((n) => n && list.some((a) => a.category === n));
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
    ${names.length > 1 ? html`<nav class="hub-tabs" aria-label="News categories" data-tabs></nav>` : ""}
    <div data-grid></div>
  </div>`);

  function draw() {
    const items = list.filter((a) => !cat || a.category === cat);
    const tabs = $("[data-tabs]", view);
    if (tabs) mount(tabs, html`${[["", "All", list.length], ...names.map((n) => [n, n, list.filter((a) => a.category === n).length])]
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
