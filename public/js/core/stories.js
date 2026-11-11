// ─────────────────────────────────────────────────────────────
//  STORIES (round 98, Neil — like the Premier League app)
//  A row of circles at the top of the home page: a news picture with a short heading under it.
//  Which articles appear, and their short headings, are set only in the admin dashboard
//  (News → "Show as a story" and "Story heading"). Pressing a circle opens the story viewer:
//  the picture, headline and the whole article, read in place; ‹ › (or swipe, or the arrow keys)
//  move between stories, and "Read the full article" opens its page.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$, fmtAgo, paragraphs } from "./dom.js";
import { fullArticle } from "./api.js";
import { urls } from "./components.js";

const SEEN = "sbds-stories-seen";
const MAX = 12;
const seenSet = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || "[]")); } catch { return new Set(); } };
const markSeen = (id) => { try { const s = seenSet(); s.add(id); localStorage.setItem(SEEN, JSON.stringify([...s].slice(-200))); } catch { /* not remembered */ } };

/** The articles that are stories: published, ticked, newest first. */
export const storyList = (news) => news.filter((a) => a.story_on && a.is_published !== false && (!a.publish_at || Date.parse(a.publish_at) <= Date.now())).slice(0, MAX);
const picOf = (a) => a.circle_image_url || a.image_url || "";
const headOf = (a) => (a.story_title || "").trim() || a.title;

/** The row of circles. */
export function storiesRow(list) {
  if (!list.length) return "";
  const seen = seenSet();
  return html`<section class="bz-stories" aria-label="Stories"><div class="wrap"><div class="st-row">
    ${list.map((a, i) => html`<button type="button" class="st-bubble ${seen.has(a.id) ? "seen" : ""}" data-story="${i}" aria-label="Story: ${headOf(a)}">
      <span class="st-ring"><span class="st-pic">${picOf(a) ? html`<img src="${picOf(a)}" alt="" loading="lazy">` : html`<span class="st-ph" aria-hidden="true"></span>`}</span></span>
      <span class="st-label">${headOf(a)}</span></button>`)}
  </div></div></section>`;
}

const icon = (d) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
/** The article's text without the [quote] / [video] markers the article page uses. */
const textOf = (a) => String(a?.body ?? "").split(/\n/).filter((l) => !/^\s*\[(quote|video)\]\s*$/i.test(l)).join("\n");

/** Make the circles open the viewer. Returns a function that tidies up. */
export function mountStories(root, list) {
  if (!list.length || !root) return () => {};
  let layer = null, at = 0, lastFocus = null, touch = null;
  const full = new Map();

  const draw = () => {
    const a = list[at], body = full.get(a.id);
    mount(layer, html`<div class="st-shade" data-st-close></div>
      <div class="st-card" role="dialog" aria-modal="true" aria-label="${headOf(a)}">
        <div class="st-bars" aria-hidden="true">${list.map((_, i) => html`<i class="${i < at ? "done" : i === at ? "now" : ""}"></i>`)}</div>
        <header class="st-head">
          <span class="st-mini">${picOf(a) ? html`<img src="${picOf(a)}" alt="">` : ""}</span>
          <span class="st-who"><b>${headOf(a)}</b><small>${a.category ? `${a.category}, ` : ""}${fmtAgo(a.published_at)}</small></span>
          <button type="button" class="st-x" data-st-close aria-label="Close the story">${icon("M6 6l12 12M18 6 6 18")}</button>
        </header>
        <div class="st-scroll">
          ${a.image_url ? html`<img class="st-img" src="${a.image_url}" alt="">` : ""}
          <div class="st-text">
            <h2>${a.title}</h2>
            ${body?.lead ? html`<p class="st-lead">${body.lead}</p>` : a.excerpt ? html`<p class="st-lead">${a.excerpt}</p>` : ""}
            ${body ? paragraphs(textOf(body)) : html`<p class="st-loading">Loading the story…</p>`}
            <a class="btn st-read" href="${urls.article(a)}">Read the full article</a>
          </div>
        </div>
        <nav class="st-nav" aria-label="Stories">
          <button type="button" class="st-prev" data-st-go="-1" ${at === 0 ? "disabled" : ""} aria-label="Previous story">${icon("M15 5 8 12l7 7")}</button>
          <span>${at + 1} of ${list.length}</span>
          <button type="button" class="st-next" data-st-go="1" ${at === list.length - 1 ? "disabled" : ""} aria-label="Next story">${icon("m9 5 7 7-7 7")}</button>
        </nav>
      </div>`);
    $(".st-x", layer)?.focus({ preventScroll: true });
    markSeen(a.id);
    $(`[data-story="${at}"]`, root)?.classList.add("seen");
    if (!full.has(a.id)) {
      fullArticle(a.slug).then((row) => { full.set(a.id, row || {}); if (layer && list[at].id === a.id) draw(); })
        .catch(() => { full.set(a.id, {}); if (layer && list[at].id === a.id) draw(); });
    }
  };
  const go = (dir) => { const n = at + dir; if (n < 0 || n >= list.length) return; at = n; draw(); $(".st-scroll", layer)?.scrollTo({ top: 0 }); };
  const close = () => {
    if (!layer) return;
    layer.remove(); layer = null;
    document.documentElement.classList.remove("st-open");
    document.removeEventListener("keydown", onKey);
    lastFocus?.focus({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "Tab" && layer) {   // keep the keyboard inside the viewer
      const f = $$("button:not([disabled]), a[href]", layer); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  };
  const open = (i) => {
    at = i; lastFocus = document.activeElement;
    layer = document.createElement("div"); layer.className = "st-layer";
    document.body.append(layer);
    document.documentElement.classList.add("st-open");
    document.addEventListener("keydown", onKey);
    layer.addEventListener("click", (e) => {
      if (e.target.closest("[data-st-close]")) return close();
      const b = e.target.closest("[data-st-go]"); if (b) go(Number(b.dataset.stGo));
    });
    // Swipe sideways on a phone to move between stories (an up-and-down swipe still scrolls the text).
    layer.addEventListener("touchstart", (e) => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
    layer.addEventListener("touchend", (e) => {
      if (!touch) return; const t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y; touch = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    }, { passive: true });
    draw();
  };
  const onClick = (e) => { const b = e.target.closest("[data-story]"); if (b) open(Number(b.dataset.story)); };
  root.addEventListener("click", onClick);
  return () => { root.removeEventListener("click", onClick); close(); };
}
