// Site search: the magnifying glass in the menu opens an overlay that
// searches players, teams, competitions, venues, news and info pages.
import { html, mount, $, fmtDate } from "./dom.js";
import { table, articles, loadCompetitions } from "./api.js";
import { urls } from "./components.js";
import { navigate } from "./router.js";

const PER_GROUP = 6;
let index = null;

/** Everything searchable, loaded the first time the overlay opens. */
async function buildIndex() {
  const [players, teams, venues, pages, news, comps] = await Promise.all([
    table("players", "full_name"), table("teams", "name"), table("venues", "name"),
    table("pages", "sort"), articles(), loadCompetitions(),
  ]);
  const team = new Map(teams.map((t) => [t.id, t]));
  return [
    ...players.map((p) => ({ group: "Players", title: p.full_name, sub: team.get(p.team_id)?.name ?? "", href: urls.player(p), img: p.avatar_url || "/assets/avatar.svg" })),
    ...teams.map((t) => ({ group: "Teams", title: t.name, sub: "Fixtures & results", href: urls.team(t), img: t.logo_url })),
    ...comps.competitions.map((c) => ({ group: "Competitions", title: c.name, sub: `${c.kind} competition`, href: urls.competition(c), img: c.image_url })),
    ...venues.map((v) => ({ group: "Venues", title: v.name, sub: v.address ?? "", href: urls.venue(v), img: v.image_url })),
    ...news.map((a) => ({ group: "News", title: a.title, sub: `${a.category} · ${fmtDate(a.published_at)}`, more: a.excerpt ?? "", href: urls.article(a), img: a.circle_image_url || a.image_url })),
    ...pages.map((p) => ({ group: "Pages", title: p.title, sub: p.summary ?? "", href: urls.page(p) })),
  ];
}

/** Best matches first: names that start with the search, then names containing it, then descriptions. */
function find(items, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const it of items) {
    const title = it.title.toLowerCase(), rest = `${it.sub} ${it.more ?? ""}`.toLowerCase();
    if (!words.every((w) => title.includes(w) || rest.includes(w))) continue;
    scored.push({ it, rank: title.startsWith(words[0]) ? 0 : words.every((w) => title.includes(w)) ? 1 : 2 });
  }
  return scored.sort((a, b) => a.rank - b.rank || a.it.title.localeCompare(b.it.title)).map((x) => x.it);
}

export async function openSearch() {
  if ($("dialog.search")) return;
  const dlg = document.createElement("dialog");
  dlg.className = "search";
  mount(dlg, html`<div class="search-bar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/></svg>
      <input type="search" placeholder="Search players, teams, news, venues…" aria-label="Search the website" autocomplete="off">
      <button type="button" data-close aria-label="Close search">×</button></div>
    <div class="search-results" data-results><p class="search-hint">Start typing a name…</p></div>`);
  document.body.append(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  const input = $("input", dlg), results = $("[data-results]", dlg);
  let first = null;

  const draw = () => {
    const q = input.value.trim();
    if (q.length < 2) { first = null; return mount(results, html`<p class="search-hint">Start typing a name…</p>`); }
    if (!index) return mount(results, html`<p class="search-hint">Loading…</p>`);
    const hits = find(index, q);
    first = hits[0] ?? null;
    const groups = new Map();
    for (const h of hits) (groups.get(h.group) ?? groups.set(h.group, []).get(h.group)).push(h);
    mount(results, hits.length ? [...groups].map(([g, items]) => html`<h4>${g}</h4>
      ${items.slice(0, PER_GROUP).map((h) => html`<a class="search-hit" href="${h.href}">
        ${h.img ? html`<img src="${h.img}" alt="" loading="lazy">` : html`<span class="search-dot">${String(h.title).trim().charAt(0).toUpperCase()}</span>`}
        <span><strong>${h.title}</strong><small>${h.sub}</small></span></a>`)}
      ${items.length > PER_GROUP ? html`<p class="search-more">+ ${items.length - PER_GROUP} more — keep typing to narrow it down</p>` : ""}`)
      : html`<p class="search-hint">Nothing found for “${q}”.</p>`);
  };

  input.addEventListener("input", draw);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && first) { close(); navigate(first.href); } });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) return close();
    const hit = e.target.closest(".search-hit");
    if (hit) { e.preventDefault(); close(); navigate(hit.getAttribute("href")); }
  });
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dlg.showModal();
  input.focus();
  // The index is rebuilt each time the overlay opens, so new results show up straight away.
  index = await buildIndex().catch(() => []);
  draw();
}
