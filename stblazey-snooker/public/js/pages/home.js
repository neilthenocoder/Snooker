import { html, mount, $, $$, fmtDate, fmtTime, fmtDay, fmtAgo, cssUrl, ukDay, todayUK, safeHref } from "../core/dom.js";
import { TICKER_PX } from "../core/branding.js";
import { sideName, matchLabel, onTable } from "../core/live-score.js";
import { mountSquadBox } from "../core/squad.js";
import { mySnookerOn, mySnookerSetUp, mySnookerTeamId, mySnookerHome, myPrefs } from "../core/auth.js";
import { mountMySnooker, mySnookerStar } from "../core/my-snooker.js";
import { maybeStartGuide } from "../core/guide.js";
import { openForEntry } from "./enter.js";
import { seasonContext, sideBoxData } from "../core/context.js";
import { articles, settings, upcomingMatches, loadCompetitions, subscribe, table, liveMatches, currentCompetitions } from "../core/api.js";
import { deadlineWarnings, deadlineBar } from "../core/comp-deadlines.js";
import { matchScore, shieldHolder, isLiveNow, isAwaitingResult } from "../core/rules.js";
import { buildBracket, isEntry, walkoverSide, roundName, winnerSide } from "../core/bracket.js";
import { answered, articleCueview } from "../core/cueview.js";
import { leagueTablePanel, rankingsPanel, sidebar, panel, picture, urls, badge, avatar, articleThumb, shortName, latestNews, trophy, shieldPicture, resultsBox } from "../core/components.js";
import { SITE } from "../config.js";
import { menuMore } from "../core/menu.js";
import { newsletterBox, wireNewsletterBox } from "../core/popups.js";
import { leagueMarks, provisionalNote } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import { competitionSummaries } from "./competitions.js";
import { loadForm, formBadge, formChips } from "../core/form.js";
import { liveSoonTag, compBoxStyle } from "../core/components.js";
import { homeSections, isOffSeason, promoBlock, mySnookerPrompt, newsBlock, compsBlock, teamsBlock } from "../core/home-blocks.js";
import { leagueCrests } from "../core/components.js";

const ROTATE_MS = 7000;      // banner: time each article is shown
const CAROUSEL_MS = 4500;    // live strip: time before it moves on one card
const FEATURE_MS = 6000;     // feature box (when it shows one message at a time): time each one is shown

// The four quick links under the hero: one slim row (see the v13 block in style.css).
// Round 93 (Baize): line icons, drawn in chalk cream on small baize-green tiles.
const qi = (d) => html`<span class="ql-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></span>`;
const quickIcon = {
  fixtures: qi("M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"),
  results: qi("M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4"),
  tables: qi("M4 5h16v14H4zM4 10h16M4 15h16M10 5v14"),
  rankings: qi("M5 20V12M12 20V5M19 20v-6"),
  breaks: qi("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"),
  competitions: qi("M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"),
  calendar: qi("M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"),
  handicaps: qi("M5 9h6M8 6v6M13 17h6M18 5 6 19"),
};

// Round 84: the round ‹ › buttons on the left and right edges of every sliding strip.
const chevLeft = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 5.3 8 12l6.7 6.7"/></svg>`;
const chevRight = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 5.3 16 12l-6.7 6.7"/></svg>`;
const calIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v17H4V4h3Zm11 8H6v9h12Zm0-4H6v2h12Z"/></svg>`;
const searchGlass = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>`;

// ─────────────────────────────────────────────────────────────
//  ROUND 99 — THE HOME PAGE IN THE ST BLAZEY DESIGN SYSTEM (the layout Rich chose)
//  1. The lead story on a photo, with Top stories beside it
//  2. Live and upcoming matches: the dark strip (Live · Upcoming · Results)
//  3. The league table, with Next up beside it
//  4. My Snooker
//  5. Competitions: the cup with the latest result, and the other cups beside it
//  Rich's trims: news only in one place (the top), competitions once (no second competitions strip),
//  no wall of every team (they are in the tables and the League menu), no stories row, no quick links.
//  "Everything" (Site settings → Home page style) adds every league table, the shields, player and team of the
//  week and CueViews underneath, in the same design.
// ─────────────────────────────────────────────────────────────
const sbIcon = (d, size = 18) => html`<svg class="sb-icon" viewBox="0 0 24 24" style="width:${size}px;height:${size}px" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = {
  trophy: "M8 4h8v5a4 4 0 0 1-8 0ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z",
  right: "m9 6 6 6-6 6",
  left: "m15 6-6 6 6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
};
/** "Tue 10 Nov" in the visitor's own time (the footer says times are local). */
const sbDay = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "") : "");
const initialsOf = (name = "") => name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
const pic = (a) => a.image_url || a.circle_image_url || "";
/** A cup's own trophy picture (Admin → Competitions), or the trophy icon until one is uploaded. */
const cupTrophy = (c, size = 22) => (c?.trophy_url ? html`<img class="sb-trophy-img" src="${c.trophy_url}" alt="" loading="lazy">` : sbIcon(ICON.trophy, size));
/** A team's emblem (its own, else its club's — the venue's), or its initials until it has one. */
const crestOf = (ctx, t) => { const logo = t?.logo_url || ctx.venue?.get?.(t?.venue_id)?.logo_url || "";
  return logo ? html`<span class="sb-crest"><img src="${logo}" alt="" loading="lazy"></span>` : html`<span class="sb-crest sb-crest--initials" aria-hidden="true">${initialsOf(t?.name ?? "")}</span>`; };
const photo = (a, cls = "") => (pic(a) ? html`<img class="${cls}" src="${pic(a)}" alt="" loading="lazy">` : html`<span class="sb-ph ${cls}" aria-hidden="true"></span>`);

export default async function home(view, { user } = {}) {
  setTitle("");
  adminEdit("settings", null, { label: "Edit home page" });
  const [ctx, news, allComps, site] = await Promise.all([seasonContext(), articles(), competitionSummaries({ current: true }), settings()]);
  // Form: for player and team of the week, and (round 104) the Form card on the Everything page.
  if (site.home_style === "full" || site.player_of_week_show || site.team_of_week_show || site.player_of_month_show || site.team_of_month_show) ctx.form = await loadForm(ctx).catch(() => null);
  const today = todayUK();
  const dates = await table("key_dates", "starts_on").catch(() => []);
  const entering = openForEntry(allComps.map((x) => x.c));
  const comps = allComps.filter(({ c }) => !c.season_id || c.season_id === ctx.season?.id);
  const compData = await currentCompetitions().catch(() => null);
  view.classList.add("flush");
  const everything = site.home_style === "full";
  const sections = homeSections(site);
  const on = (key) => sections.find((x) => x.key === key)?.on;
  const promoWanted = site.promo_mode === "always" || (site.promo_mode !== "never" && isOffSeason(ctx, allComps));
  // Round 101 (Rich): the banner can be the rounded card with Top stories beside it, or his full-width photo with the
  // menu and the match strip on top of it. "auto" = the card on the Standard page, the full photo on Everything.
  // Round 108 (Rich's own banner variant): "split" — the photo and the
  // headline in two blocks side by side, the menu above them as usual.
  const heroWanted = ["card", "full", "split"].includes(site.hero_layout) ? site.hero_layout : site.hero_layout === "big" ? "full" : everything ? "full" : "card";
  const full = heroWanted === "full", split = heroWanted === "split";

  // News: the lead stories (ticked "Featured", else the newest), then four more in Top stories, then (with the
  // full-width banner) one more as the big story card beside them — each story once.
  const featured = news.filter((a) => a.featured);
  const slides = (featured.length ? featured : news).slice(0, Math.max(1, Math.min(4, site.hero_count || 3)));
  const rest = news.filter((a) => !slides.includes(a));
  const top = rest.slice(0, 4), bigStory = full || split ? rest[4] ?? null : null;

  const section = (inner, cls = "") => (inner ? html`<section class="sb-section ${cls}"><div class="sb-container">${inner}</div></section>` : "");
  const notices = [
    user ? deadlineBar(deadlineWarnings(user, ctx, compData ?? { competitions: [], entries: [], matches: [] }, site)) : "",
    entering.length ? html`<a class="sb-notice" href="/enter"><span class="sb-chip">Entries are open</span><span>${entering.map((c) => c.name).join(", ")}</span><b class="sb-link">Enter now ${sbIcon(ICON.arrow, 16)}</b></a>` : "",
  ].filter(Boolean);
  const topStories = (cls = "") => (top.length ? html`<aside class="sb-card sb-top ${cls}">
        <div class="sb-top__head"><h2>Top stories</h2><a class="sb-pill-link" href="/news">All news</a></div>
        ${top.map((a) => html`<a class="sb-story-row" href="${urls.article(a)}">${photo(a)}
          <span class="sb-story-row__text">${a.category ? html`<span class="sb-kicker">${a.category}</span>` : ""}<span class="sb-story-row__title">${a.title}</span><span class="sb-meta">${fmtAgo(a.published_at)}</span></span></a>`)}
      </aside>` : "");
  const strip = html`<section class="sb-strip live-strip ${full ? "sb-strip--over" : ""}" aria-labelledby="sb-strip-h"><div class="sb-strip__inner" data-strip></div></section>`;
  const comps2 = compData && comps.length && (on("competitions") !== false || on("comp_strip")) ? competitionsBlock(comps, compData, { gold: true }) : "";

  mount(view, html`
    <div class="sb-home ${everything ? "sb-home--everything" : ""} ${full ? "sb-home--full" : ""}">
    ${full ? html`<div class="sb-fh">${heroFull(slides, site)}${strip}</div>`
      : split ? html`<div class="sb-container">${heroSplit(slides, site)}</div>${strip}`
      : html`<div class="sb-container"><div class="sb-hero">
      ${heroLead(slides, site)}
      ${topStories("sb-hero__side sb-hide-phone")}
    </div></div>
    ${strip}
    ${top.length ? html`<div class="sb-container sb-only-phone sb-top-phone">${topStories()}</div>` : ""}`}

    ${notices.length ? html`<div class="sb-container sb-notices">${notices}</div>` : ""}

    ${everything ? section(sbQuickLinks(ctx), "sb-section--quick") : ""}

    ${section(html`<div class="sb-split">
      ${tableCard(ctx)}
      ${nextUp(ctx)}
    </div>
    ${on("mysnooker") !== false ? mySnookerCard(user, ctx) : ""}`, everything ? "sb-section--tight" : "sb-section--first")}

    ${/* Round 110 (Rich: "add the Runabout Shield holders … preferably higher up"): straight after the table */ ""}
    ${(everything && site.shields_show !== false) || on("shields") ? section(shieldHolders(ctx), "sb-section--tight") : ""}
    ${(full || split) && top.length ? section(html`<div class="sb-stories">${topStories()}${bigStory ? storyCard(bigStory) : ""}</div>`, "sb-section--tight") : ""}

    ${promoWanted && on("promo") !== false ? section(promoBlock(site, ctx, dates, today), "sb-promo-sec") : ""}

    ${everything ? section(rankingsRow(ctx), "sb-section--tight") : ""}

    ${comps2 ? section(comps2, everything ? "sb-section--tight" : "") : ""}
    ${everything ? section(promoColumns(ctx, site), "sb-section--tight") : ""}

    ${on("tables") ? section(html`<div class="sb-section-head"><div><h2>League tables</h2><p>Every league this season.</p></div><a class="sb-link" href="/league">All tables</a></div>
      <div class="sb-tables">${ctx.leagues.map((l) => leagueTablePanel(ctx, l, { limit: 10 }))}</div>`) : ""}
    ${everything || on("spotlights") ? section(spotlights(ctx, site, { months: !everything }), "sb-legacy") : ""}
    ${(everything || on("cueviews")) && site.cueviews_show !== false ? section(cueviewBox(ctx, news), "sb-legacy") : ""}
    ${/* Round 111 (Rich): the newsletter sign-up as a box at the bottom of the home page */ ""}
    ${section(newsletterBox(site, user), "sb-section--tight sb-nlsec")}
    <div class="sb-home__end"></div>
    </div>`);

  // The full-width banner: the menu sits on the photo (see-through) until the page scrolls.
  const root = document.documentElement;
  root.classList.toggle("sb-navover", full);
  root.classList.toggle("sb-has-quick", everything);   // the Quick links replace "Find your way around" here
  const onScroll = () => root.classList.toggle("sb-scrolled", scrollY > 24);
  if (full) { onScroll(); addEventListener("scroll", onScroll, { passive: true }); }

  wireNewsletterBox(view);
  maybeStartGuide({ personal: false, site });
  const stopSquad = await mountSquadBox(user, ctx, site).catch(() => () => {});
  // Round 108 (Rich): Quick links on one row that slides sideways, with arrows like the match strip.
  const stopQuick = manualSlider($(".sb-quick", view), ".sb-quick__row", "data-quick-move");
  // …and the list of other cups beside the featured one gets up and down arrows, so it is plain there are more.
  const cupList = $(".sb-comps__list", view), cupSide = $(".sb-comps__side", view);
  const cupEnds = () => { if (!cupList || !cupSide) return; const can = cupList.scrollHeight - cupList.clientHeight > 4;
    cupSide.classList.toggle("can-slide", can); cupSide.classList.toggle("at-start", !can || cupList.scrollTop <= 4); cupSide.classList.toggle("at-end", !can || cupList.scrollTop + cupList.clientHeight >= cupList.scrollHeight - 4); };
  cupList?.addEventListener("scroll", cupEnds, { passive: true });
  cupSide?.addEventListener("click", (e) => { const b = e.target.closest("[data-cup-move]"); if (b) cupList.scrollBy({ top: Number(b.dataset.cupMove) * cupList.clientHeight * 0.8, behavior: "smooth" }); });
  addEventListener("resize", cupEnds, { passive: true }); cupEnds();
  view.addEventListener("click", () => requestAnimationFrame(cupEnds));   // after Under way · Coming up changes the list

  // The lead story turns every few seconds — Admin → Site settings → "Seconds each lead story shows" (round 106; 6 as
  // standard). The bars under it fill up as the time runs out, then the next story comes in. Swipe, drag or press a bar.
  const slideEls = $$("[data-slide]", view), dots = $$("[data-dot]", view);
  const track = $("[data-track]", view), heroBox = $("[data-hero]", view);
  const secs = Number(site.home_sections?.hero_seconds);
  const heroMs = (secs >= 3 && secs <= 30 ? secs : 6) * 1000;
  view.style.setProperty("--hero-ms", `${heroMs}ms`);
  let current = 0, turn = null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const auto = slideEls.length > 1 && !reduce;
  const place = (px = 0, animate = true) => {
    if (!track) return;
    track.style.transition = animate && !reduce ? "transform .6s cubic-bezier(.22, .7, .2, 1)" : "none";
    track.style.transform = `translate3d(calc(${-current * 100}% + ${px}px), 0, 0)`;
  };
  const schedule = () => {
    clearTimeout(turn);
    if (auto) turn = setTimeout(() => (document.hidden ? schedule() : show(current + 1)), heroMs);
  };
  const show = (i) => {
    current = (i + slideEls.length) % slideEls.length;
    slideEls.forEach((s, j) => { s.setAttribute("aria-hidden", String(j !== current)); s.tabIndex = j === current ? 0 : -1; });
    dots.forEach((d) => {
      const j = Number(d.dataset.dot);
      d.toggleAttribute("data-done", j < current);
      d.setAttribute("aria-current", "false");
      void d.offsetWidth;                         // start the bar's fill again from empty
      d.setAttribute("aria-current", String(j === current));
    });
    dots[0]?.parentElement.classList.toggle("is-auto", auto);
    dots[0]?.parentElement.classList.remove("is-held");
    place(0, true);
    schedule();
  };
  show(0); place(0, false);
  view.addEventListener("click", (e) => { const d = e.target.closest("[data-dot]"); if (d) { e.preventDefault(); show(Number(d.dataset.dot)); } });
  if (heroBox && track && slideEls.length > 1) {
    let drag = null, dragged = false;
    heroBox.addEventListener("pointerdown", (e) => {
      if ((e.pointerType === "mouse" && e.button !== 0) || e.target.closest("[data-dot]")) return;
      drag = { x: e.clientX, y: e.clientY, t: performance.now(), w: heroBox.clientWidth || 1, id: e.pointerId, on: false, dx: 0 }; dragged = false;
    });
    heroBox.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        drag.on = true; dragged = true; clearTimeout(turn);
        dots[0]?.parentElement.classList.add("is-held");
        try { heroBox.setPointerCapture(e.pointerId); } catch { /* fine */ }
      }
      const edge = (current === 0 && dx > 0) || (current === slideEls.length - 1 && dx < 0);
      drag.dx = edge ? dx / 3 : dx; place(drag.dx, false); e.preventDefault();
    });
    const end = () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.on) return;
      const fast = Math.abs(d.dx) / Math.max(1, performance.now() - d.t) > 0.45;
      const far = Math.abs(d.dx) > d.w * 0.18 || (fast && Math.abs(d.dx) > 24);
      show(Math.max(0, Math.min(slideEls.length - 1, far ? current + (d.dx < 0 ? 1 : -1) : current)));
    };
    heroBox.addEventListener("pointerup", end); heroBox.addEventListener("pointercancel", end);
    heroBox.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
    heroBox.addEventListener("dragstart", (e) => e.preventDefault());
  }
  const onResize = () => place(0, false);
  addEventListener("resize", onResize, { passive: true });

  // The match strip, kept live.
  const stopStrip = await mountLiveStrip($("[data-strip]", view), user, { mode: "tabs", layout: "sb" });
  // The full-width banner keeps its headline clear of the strip on top of its photo, however tall the strip is.
  const fh = $(".sb-fh", view), stripEl = $(".sb-strip", view);
  // Round 103 (Neil: "where is this white strip at the top?"): the photo is pulled up under the menu by exactly the
  // menu's height (measured, not guessed), and the space above the strip grows to fit the tallest headline, so a long
  // headline never slides up under the menu.
  const hdr = $(".sb-header");
  const fit = () => {
    if (!fh) return;
    if (stripEl) fh.style.setProperty("--fh-strip", `${stripEl.offsetHeight}px`);
    if (hdr) fh.style.setProperty("--hdr-h", `${hdr.offsetHeight}px`);
    const tallest = Math.max(0, ...$$(".sb-fh__inner", fh).map((b) => b.offsetHeight));
    fh.style.setProperty("--fh-body", `${tallest}px`);
  };
  const ro = fh && "ResizeObserver" in window ? new ResizeObserver(fit) : null;
  if (ro) { [stripEl, hdr, ...$$(".sb-fh__inner", fh)].filter(Boolean).forEach((el) => ro.observe(el)); }
  fit();

  // The league switch on the table, and the cup filter: they change what shows in place.
  view.addEventListener("click", (e) => {
    const b = e.target.closest("[data-seg]");
    if (!b) return;
    const group = b.closest("[data-seg-group]"), key = b.dataset.seg;
    for (const x of group.querySelectorAll("[data-seg]")) x.setAttribute("aria-pressed", String(x === b));
    const scope = group.closest("[data-seg-scope]");
    for (const p of scope.querySelectorAll("[data-seg-pane]")) p.hidden = !p.dataset.segPane.split(" ").includes(key);
  });

  return () => { clearTimeout(turn); stopStrip(); stopSquad(); stopQuick(); removeEventListener("resize", cupEnds); removeEventListener("resize", onResize); removeEventListener("scroll", onScroll); ro?.disconnect(); root.classList.remove("sb-navover", "sb-has-quick"); };
}

/** The lead story card(s): photo, category, how long ago, headline, Continue reading and the dots. */
function heroLead(slides, site = {}) {
  if (!slides.length) return html`<div class="sb-hero__lead sb-hero__lead--empty"><div class="sb-hero__body"><span class="sb-tag">Since ${SITE.established}</span><h1 class="sb-hero__title">${SITE.name}</h1></div></div>`;
  const dots = slides.length > 1 ? html`<div class="sb-hero__dots" role="group" aria-label="Choose a story">${slides.map((_, i) => html`<button type="button" data-dot="${i}" aria-label="Story ${i + 1}" aria-current="${String(i === 0)}"><i></i></button>`)}</div>` : "";
  return html`<div class="sb-hero__lead sb-hero__frame" data-hero>
    <div class="sb-hero__track" data-track>
      ${slides.map((a, i) => html`<a class="sb-hero__slide" data-slide href="${urls.article(a)}" aria-hidden="${String(i !== 0)}">
        ${pic(a) || site.hero_image_url ? html`<img src="${pic(a) || site.hero_image_url}" alt="" ${i ? html`loading="lazy"` : ""}>` : html`<span class="sb-hero__ph" aria-hidden="true" style="${site.hero_bg ? `background:${site.hero_bg}` : ""}"></span>`}
        <span class="sb-hero__body">
          <span class="sb-hero__tags">${a.category ? html`<span class="sb-tag">${a.category}</span>` : ""}<span class="sb-tag sb-tag--glass">${fmtAgo(a.published_at)}</span></span>
          ${i === 0 ? html`<h1 class="sb-hero__title">${a.title}</h1>` : html`<h2 class="sb-hero__title">${a.title}</h2>`}
          <span class="sb-hero__cta"><span class="sb-btn sb-btn--light sb-btn--xl">Continue reading</span></span>
        </span></a>`)}
    </div>
    ${dots}
  </div>`;
}


/**
 * Round 101 — Rich's full-width banner: the lead story's photo across the whole page, the menu on top of it, the
 * headline, a line of the story, the date, its category and a yellow Continue reading; the match strip sits on the
 * bottom of the photo. Several lead stories turn like the card banner (swipe, dots).
 */
function heroFull(slides, site = {}) {
  if (!slides.length) return html`<div class="sb-fh__frame"><div class="sb-fh__slide"><span class="sb-fh__body"><span class="sb-fh__inner"><h1 class="sb-fh__title">${SITE.name}</h1></span></span></div></div><div class="sb-fh__space"></div>`;
  const dots = slides.length > 1 ? html`<div class="sb-fh__dots"><div class="sb-container"><div class="sb-hero__dots" role="group" aria-label="Choose a story">${slides.map((_, i) => html`<button type="button" data-dot="${i}" aria-label="Story ${i + 1}" aria-current="${String(i === 0)}"><i></i></button>`)}</div></div></div>` : "";
  return html`<div class="sb-fh__frame" data-hero>
      <div class="sb-fh__track" data-track>
      ${slides.map((a, i) => html`<a class="sb-fh__slide" data-slide href="${urls.article(a)}" aria-hidden="${String(i !== 0)}">
        ${pic(a) || site.hero_image_url ? html`<img src="${pic(a) || site.hero_image_url}" alt="" ${i ? html`loading="lazy"` : ""}>` : ""}
        <span class="sb-fh__body"><span class="sb-fh__inner">
          ${i === 0 ? html`<h1 class="sb-fh__title">${a.title}</h1>` : html`<h2 class="sb-fh__title">${a.title}</h2>`}
          ${a.excerpt ? html`<span class="sb-fh__excerpt">${a.excerpt}</span>` : ""}
          <span class="sb-fh__date">${fmtDate(a.published_at)}</span>
          <span class="sb-fh__ctas">${a.category ? html`<span class="sb-btn sb-btn--light">${a.category}</span>` : ""}<span class="sb-btn sb-btn--yellow">Continue reading</span></span>
        </span></span></a>`)}
      </div>
    </div>
    ${dots}
    <button type="button" class="sb-fh__down" data-scroll-down aria-label="Scroll down"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16.5 5 9.6l1.4-1.4L12 13.7l5.6-5.5L19 9.6Z"/></svg></button>
    <div class="sb-fh__space" aria-hidden="true"></div>`;
}

/**
 * Round 108 — Rich's own banner: the photo in one block and the headline in a dark block of its own
 * beside it (under it on a phone), turning together, with the bars that fill as each story's time runs out.
 */
function heroSplit(slides, site = {}) {
  if (!slides.length) return heroLead(slides, site);
  const dots = slides.length > 1 ? html`<div class="sb-hero__dots sb-hs__dots" role="group" aria-label="Choose a story">${slides.map((_, i) => html`<button type="button" data-dot="${i}" aria-label="Story ${i + 1}" aria-current="${String(i === 0)}"><i></i></button>`)}</div>` : "";
  return html`<div class="sb-hs" data-hero>
    <div class="sb-hs__track" data-track>
      ${slides.map((a, i) => html`<a class="sb-hs__slide" data-slide href="${urls.article(a)}" aria-hidden="${String(i !== 0)}">
        <span class="sb-hs__pic">${pic(a) || site.hero_image_url ? html`<img src="${pic(a) || site.hero_image_url}" alt="" ${i ? html`loading="lazy"` : ""}>` : html`<span class="sb-hero__ph" aria-hidden="true"></span>`}</span>
        <span class="sb-hs__text">
          <span class="sb-hero__tags">${a.category ? html`<span class="sb-tag">${a.category}</span>` : ""}<span class="sb-tag sb-tag--glass">${fmtAgo(a.published_at)}</span></span>
          ${i === 0 ? html`<h1 class="sb-hs__title">${a.title}</h1>` : html`<h2 class="sb-hs__title">${a.title}</h2>`}
          ${a.excerpt ? html`<span class="sb-hs__excerpt">${a.excerpt}</span>` : ""}
          <span class="sb-hs__foot"><span class="sb-btn sb-btn--yellow">Continue reading</span><span class="sb-hs__date">${fmtDate(a.published_at)}</span></span>
        </span></a>`)}
    </div>
    ${dots}
  </div>`;
}

/** A big photo card for one story (beside Top stories): its category in red, how long ago in yellow, Continue reading. */
const storyCard = (a) => html`<a class="sb-storycard" href="${urls.article(a)}">
  ${pic(a) ? html`<img src="${pic(a)}" alt="" loading="lazy">` : html`<span class="sb-hero__ph" aria-hidden="true"></span>`}
  <span class="sb-storycard__body">
    <span class="sb-hero__tags">${a.category ? html`<span class="sb-tag">${a.category}</span>` : ""}<span class="sb-tag sb-tag--yellow">${fmtAgo(a.published_at)}</span></span>
    <span class="sb-storycard__title">${a.title}</span>
    <span class="sb-btn sb-btn--light">Continue reading</span>
  </span></a>`;

/** Quick links (Rich's design): the pages that used to be under "More", each with a coloured dot. */
function sbQuickLinks(ctx) {
  // Round 102 (Rich): the icons from the earlier quick links, not coloured balls.
  const links = [["Fixtures", "/fixtures", quickIcon.fixtures], ["Results", "/results", quickIcon.results], ["League tables", urls.season(ctx.season, "league-tables"), quickIcon.tables],
    ["Rankings", urls.season(ctx.season, "rankings"), quickIcon.rankings], ["Breaks", urls.season(ctx.season, "breaks"), quickIcon.breaks], ["Competitions", "/competitions", quickIcon.competitions],
    ["Calendar", "/calendar", quickIcon.calendar], ["Handicaps", "/handicaps", quickIcon.handicaps], ["Our players", "/players", sbIcon("M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4 21a8 8 0 0 1 16 0", 20)],
    ["Form guide", "/form", sbIcon("M3 17l6-6 4 4 8-8M15 7h6v6", 20)], ["Live scoreboard", "/scoreboard", sbIcon("M3 6h18v12H3ZM12 6v12M7 10v4M15.5 10h2v4h-2", 20)], ["Hall of Fame", "/hall-of-fame", sbIcon(ICON.star, 20)]];
  // Round 108 (Rich: "quick links … is huge — a manual scroller here on 1 row would be good"): one slim row that slides.
  return html`<div class="sb-quick">
    <div class="sb-quick__head"><h2>Quick links</h2><span class="sb-quick__ctrl">
      <button type="button" class="sb-icon-btn sb-quick__btn" data-quick-move="-1" aria-label="Earlier links">${sbIcon(ICON.left)}</button>
      <button type="button" class="sb-icon-btn sb-quick__btn sb-quick__btn--solid" data-quick-move="1" aria-label="More links">${sbIcon(ICON.right)}</button></span></div>
    <div class="sb-quick__row">${links.map(([label, href, icon]) => html`<a class="sb-quick__item" href="${href}"><span class="sb-quick__ico" aria-hidden="true">${icon}</span><span>${label}</span></a>`)}</div></div>`;
}

/** Victory Rankings · Rees Rankings · Breaks (Rich's design): the leader on green, the breaks podium in gold, silver and bronze. */
function rankingsRow(ctx) {
  const leagues = ctx.leagues.filter((l) => ctx.rankings(l.id).length);
  const breakLeagues = ctx.leagues.filter((l) => ctx.breaksIn(l.id).length);
  if (!leagues.length && !breakLeagues.length) return "";
  const rankCard = (l) => {
    const rows = ctx.rankings(l.id).slice(0, 8);
    return html`<div class="sb-card sb-rank">
      <div class="sb-rank__head"><h2>${shortName(l)} rankings</h2><a class="sb-pill-link" href="${urls.standings(l)}#players">Full rankings</a></div>
      <ol class="sb-rank__list">${rows.map((r, i) => html`<li class="${i === 0 ? "is-first" : ""}"><a href="${urls.player(r.player)}">
        <span class="sb-rank__pos">${r.pos}</span>${avatar(r.player, "avatar sb-rank__face")}<span class="sb-rank__name">${r.player.full_name}</span><b class="sb-num">${r.pts}</b></a></li>`)}</ol>
      ${provisionalNote(ctx, l)}</div>`;
  };
  // Round 110 (Rich): no heading over these — the cards say what they are.
  return html`<div class="sb-ranks sb-ranks--2">${leagues.map(rankCard)}</div>
    <div class="sb-ranks sb-ranks--2 sb-ranks--below">${formCard(ctx)}${breakLeagues.length ? breaksCard(ctx, breakLeagues) : ""}</div>`;
}
/**
 * Round 104 (Neil: "why did you remove the player form section?"): the players in the best form — the mark out of 10
 * over their last matches, the W/L of each, and the arrow for which way it is going — as on My Snooker and the Form guide.
 */
function formCard(ctx) {
  if (!ctx.form) return "";
  const rows = ctx.leagues.flatMap((l) => ctx.playersIn(l.id)).map((p) => ({ p, f: ctx.form.player(p.id) })).filter((x) => x.f?.n)
    .sort((a, b) => b.f.form - a.f.form || b.f.n - a.f.n || a.p.full_name.localeCompare(b.p.full_name)).slice(0, 8);
  if (!rows.length) return "";
  return html`<div class="sb-card sb-rank sb-formcard">
    <div class="sb-rank__head"><h2>In form</h2><a class="sb-pill-link" href="/form">Form guide</a></div>
    <ol class="sb-rank__list">${rows.map(({ p, f }, i) => html`<li class="${i === 0 ? "is-first" : ""}"><a href="${urls.player(p)}#form">
      <span class="sb-rank__pos">${i + 1}</span>${avatar(p, "avatar sb-rank__face")}<span class="sb-rank__name"><span>${p.full_name}</span><small>${ctx.team.get(p.team_id)?.name ?? ""}</small></span>
      <span class="sb-formcard__chips">${formChips(f, { links: false })}</span>${formBadge(f, { trend: true })}</a></li>`)}</ol>
  </div>`;
}
/** The Breaks card: one league at a time — 1st, 2nd and 3rd on a podium, then the next four. */
function breaksCard(ctx, leagues) {
  const place = ["1st", "2nd", "3rd"];
  const pod = (b, i) => (b ? html`<a class="sb-pod sb-pod--${i + 1}" href="${b.player ? urls.player(b.player) : "#"}"><span class="sb-pod__place">${place[i]}</span>${avatar(b.player, "avatar sb-pod__face")}<b class="sb-num">${b.value}</b><span class="sb-pod__name">${b.player?.full_name ?? ""}</span></a>` : html`<span class="sb-pod sb-pod--empty"></span>`);
  return html`<div class="sb-card sb-breaks" data-seg-scope>
    <div class="sb-rank__head"><h2>Breaks</h2>
      ${leagues.length > 1 ? html`<div class="sb-seg sb-seg--sm" role="group" aria-label="League" data-seg-group>${leagues.map((l, i) => html`<button type="button" data-seg="${l.id}" aria-pressed="${String(i === 0)}">${shortName(l)}</button>`)}</div>` : ""}</div>
    ${leagues.map((l, i) => { const list = ctx.breaksIn(l.id), top = list.slice(0, 3), more = list.slice(3, 7);
      return html`<div data-seg-pane="${l.id}" ${i ? "hidden" : ""}>
        <div class="sb-podium">${pod(top[1], 1)}${pod(top[0], 0)}${pod(top[2], 2)}</div>
        ${more.length ? html`<ol class="sb-rank__list sb-breaks__list" start="4">${more.map((b, j) => html`<li><a href="${b.player ? urls.player(b.player) : "#"}"><span class="sb-rank__pos">${j + 4}</span>${avatar(b.player, "avatar sb-rank__face")}<span class="sb-rank__name">${b.player?.full_name ?? ""}</span><b class="sb-break sb-num">${b.value}</b></a></li>`)}</ol>` : ""}
        <a class="sb-pill-link sb-breaks__all" href="${urls.standings(l)}#breaks">All ${shortName(l)} breaks</a>
      </div>`; })}
  </div>`;
}

/** The Runabout Shield holders: each league's shield, who holds it, since when and how many defences. */
function shieldHolders(ctx) {
  const shields = ctx.leagues.filter((l) => l.shield_team_id).map((l) => ({ l, ...shieldHolder(l, ctx.fixtures, ctx.framesByFixture) }));
  if (!shields.length) return "";
  return html`<div class="sb-section-head"><div><h2>Runabout Shield holders</h2><p>Win a league match against the holders and the shield is yours.</p></div></div>
    <div class="sb-shields">${shields.map(({ l, holderId, since, history }) => {
      const t = ctx.team.get(holderId);
      const defences = history.filter((h) => h.to === holderId && h.defended && (!since || h.fixture.starts_at > since.starts_at)).length;
      return html`<a class="sb-card sb-shield" href="${urls.shield(l)}">
        <span class="sb-shield__pic">${shieldPicture(l)}</span>
        <span class="sb-shield__text"><span class="sb-kicker">${l.shield_name || `${l.name} Runabout Shield`}</span>
          <span class="sb-shield__holder">${t ? crestOf(ctx, t) : ""}<b>${t?.name ?? "–"}</b></span>
          <span class="sb-meta">${since ? `Won ${fmtDate(since.starts_at)}` : "Holders since the start of the season"}${defences ? ` · ${defences} defence${defences > 1 ? "s" : ""}` : ""}</span></span>
        <span class="sb-spot__go">${sbIcon(ICON.right)}</span></a>`;
    })}</div>`;
}

/** The league table: one league at a time, with a switch between them. */
function tableCard(ctx) {
  // Round 101 (Rich: "the league tables before … I loved — please can this go back"): the places moved since last
  // week, the leader on green, the promotion (P) and relegation (R) places marked and shaded, the key underneath.
  const leagues = ctx.leagues.filter((l) => ctx.standings(l.id).length);
  if (!leagues.length) return "";
  return html`<div class="sb-card sb-split__main" data-seg-scope>
    <div class="sb-card-head"><h2>League table</h2>
      ${leagues.length > 1 ? html`<div class="sb-seg" role="group" aria-label="League" data-seg-group>${leagues.map((l, i) => html`<button type="button" data-seg="${l.id}" aria-pressed="${String(i === 0)}">${l.name}</button>`)}</div>` : ""}</div>
    ${leagues.map((l, i) => { const rows = ctx.standings(l.id), m = leagueMarks(ctx, l, { shown: rows });
      return html`<div data-seg-pane="${l.id}" ${i ? "hidden" : ""}>
      <div class="sb-table-wrap"><table class="sb-table sb-lt">
        <caption class="sr-only">${l.name} table</caption>
        <thead><tr><th class="sb-c" scope="col">Pos</th><th scope="col">Team</th><th class="sb-c" scope="col" title="Played">P</th><th class="sb-c" scope="col" title="Won">W</th><th class="sb-c" scope="col" title="Lost">L</th><th class="sb-c" scope="col" title="Frames for">F</th><th class="sb-c" scope="col" title="Frames against">A</th><th class="sb-c" scope="col" title="Points">Pts</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr class="${m.rowClass(r)}">
          <td class="sb-c">${m.pos(r)}</td><td class="sb-table__team">${m.team(r)}</td>
          <td class="sb-c">${r.p}</td><td class="sb-c">${r.w}</td><td class="sb-c">${r.l}</td><td class="sb-c">${r.f}</td><td class="sb-c">${r.a}</td><td class="sb-c sb-table__key">${m.pts(r)}</td></tr>`)}</tbody>
      </table></div>
      ${m.key}${provisionalNote(ctx, l)}
      <div class="sb-card-foot"><a class="sb-btn sb-btn--outline sb-btn--lg" href="${urls.standings(l)}">Full table</a></div>
    </div>`; })}
  </div>`;
}

/** Next up: the next league night's fixtures, grouped by league. */
function nextUp(ctx) {
  const now = Date.now() - 3 * 3600e3;
  const coming = ctx.fixtures.filter((f) => f.starts_at && Date.parse(f.starts_at) >= now && !["submitted", "approved", "postponed", "in_progress"].includes(f.status))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (!coming.length) return html`<div class="sb-card sb-split__side"><div class="sb-card-head"><h2>Next up</h2></div><p class="sb-empty">No league matches coming up just now. <a class="sb-link" href="/calendar">See the calendar</a></p></div>`;
  const day = ukDay(coming[0].starts_at);
  const night = coming.filter((f) => ukDay(f.starts_at) === day);
  const times = [...new Set(night.map((f) => fmtTime(f.starts_at)))];
  const groups = ctx.leagues.map((l) => ({ l, list: night.filter((f) => f.league_id === l.id) })).filter((g) => g.list.length);
  const name = (id) => ctx.team.get(id)?.name ?? "TBC";
  return html`<div class="sb-card sb-split__side">
    <div class="sb-card-head"><h2>Next up</h2><span class="sb-chip sb-chip--date sb-num">${sbDay(coming[0].starts_at)}${times.length === 1 ? ` · ${times[0]}` : ""}</span></div>
    <div class="sb-next">${groups.map(({ l, list }) => html`<div class="sb-fixture-group"><span class="sb-meta">${l.name}</span>
      ${list.map((f) => html`<a class="sb-fixture" href="${urls.match(f)}"><span><span>${name(f.home_team_id)}</span>${crestOf(ctx, ctx.team.get(f.home_team_id))}</span><span class="sb-v">${times.length === 1 ? "v" : fmtTime(f.starts_at)}</span><span>${crestOf(ctx, ctx.team.get(f.away_team_id))}<span>${name(f.away_team_id)}</span></span></a>`)}</div>`)}</div>
    <div class="sb-card-foot"><a class="sb-link" href="/fixtures">All fixtures ${sbIcon(ICON.arrow, 16)}</a></div>
  </div>`;
}

/** My Snooker: the one red card on the page. */
function mySnookerCard(user, ctx) {
  const team = user ? ctx.team.get(mySnookerTeamId(user)) : null;
  return html`<div class="sb-promo sb-promo--home">
    <span class="sb-promo__icon">${sbIcon(ICON.star, 24)}</span>
    <span class="sb-promo__text"><span class="sb-promo__title">${user ? (team ? `My Snooker: ${team.name}` : "My Snooker") : "My Snooker: your team's own page"}</span>
      <span class="sb-promo__desc">${user ? "Your team's table, fixtures, results, rankings and breaks, and everyone you follow, on one page." : "Log in and see your team's table, fixtures, results, rankings and breaks on one page, in the order you choose."}</span></span>
    ${user ? html`<a class="sb-btn" href="/mysnooker">Open My Snooker</a>` : html`<button type="button" class="sb-btn" data-account-open>Log in</button>`}
  </div>`;
}

/**
 * Competitions, once: the cup with something happening nearest to today, big and dark with its current round, and the
 * other cups beside it, each with how far it has got. Under way · Coming up switches the list in place.
 */
function competitionsBlock(comps, data, { gold = false } = {}) {
  const now = Date.now();
  const info = comps.map((x) => {
    const b = buildBracket(data.entries.filter((e) => e.competition_id === x.c.id), data.matches.filter((m) => m.competition_id === x.c.id));
    const real = b.rounds.flat().filter((m) => !m.isBye);
    const live = real.find((m) => m.row.status === "in_progress");
    const last = real.filter((m) => m.played).sort((p, q) => String(q.row.result_at ?? q.row.starts_at ?? "").localeCompare(String(p.row.result_at ?? p.row.starts_at ?? "")))[0];
    const known = (m) => b.entryById.has(m.a) && b.entryById.has(m.b);
    const next = real.filter((m) => !m.played && known(m) && m.row.starts_at && Date.parse(m.row.starts_at) > now - 3 * 3600e3).sort((p, q) => p.row.starts_at.localeCompare(q.row.starts_at))[0];
    const name = (id) => b.entryById.get(id)?.name ?? "TBC";
    const done = !!b.champion, drawn = real.length > 0;
    const lastAt = last ? Date.parse(last.row.result_at ?? last.row.starts_at ?? 0) : null, nextAt = next ? Date.parse(next.row.starts_at) : null;
    const nearest = Math.min(...[lastAt, nextAt].filter((t) => t !== null).map((t) => Math.abs(now - t)));
    const score = live ? 4e15 : !done && Number.isFinite(nearest) ? 3e15 - nearest : done ? 1e15 : 0;
    return { ...x, b, live, last, next, name, done, drawn, score };
  }).sort((p, q) => q.score - p.score);
  const [topCup, ...rest] = info;
  const focus = topCup.live ?? topCup.next ?? topCup.last;
  const label = topCup.live ? "Being played now" : topCup.last && !topCup.done ? "Latest result" : topCup.next ? "Next match" : topCup.done ? "Finished" : "Coming up";
  const round = focus ? spotlightRound(topCup, focus) : "";
  const status = (x) => (x.live ? "live" : x.done ? "done" : x.drawn ? "on" : "soon");
  const meta = (x) => (x.live ? "Being played now" : x.next && !x.done ? `Next match ${sbDay(x.next.row.starts_at)}` : x.progress ?? "");
  const counts = { on: rest.filter((x) => ["live", "on"].includes(status(x))).length, soon: rest.filter((x) => status(x) === "soon").length };
  const pct = (p) => { const m = String(p ?? "").match(/(\d+)\s+of\s+(\d+)/i); return m && Number(m[2]) ? Math.round((Number(m[1]) / Number(m[2])) * 100) : null; };
  const ordered = [...rest].sort((p, q) => ["live", "on", "soon", "done"].indexOf(status(p)) - ["live", "on", "soon", "done"].indexOf(status(q)));
  return html`<div data-seg-scope class="${gold ? "sb-compsec--gold" : ""}">
    <div class="sb-section-head"><div><h2>Competitions</h2><p>${comps.length} cups this season: the latest result, the draws and what's next.</p></div>
      ${counts.on && counts.soon ? html`<div class="sb-seg sb-seg--ink sb-seg--surface" role="group" aria-label="Show competitions" data-seg-group>
        <button type="button" data-seg="all" aria-pressed="true">All · ${rest.length}</button><button type="button" data-seg="on" aria-pressed="false">Under way · ${counts.on}</button><button type="button" data-seg="soon" aria-pressed="false">Coming up · ${counts.soon}</button></div>` : html`<a class="sb-link" href="/competitions">All competitions</a>`}</div>
    <div class="sb-comps">
      <div class="sb-spotlight">
        <div class="sb-spotlight__hero ${topCup.c.image_url ? "has-photo" : ""}">
          ${topCup.c.image_url
            // Round 110 (Rich): the cup's own picture (Admin → Competitions → Picture: the winner, the trophy…) fills the top
            // of the panel in place of the trophy — it changes with whichever cup is shown here.
            ? html`<span class="sb-spotlight__photo"><img src="${topCup.c.image_url}" alt="" loading="lazy"></span>`
            : html`<span class="sb-spotlight__trophy ${topCup.c.trophy_url ? "has-img" : ""}">${cupTrophy(topCup.c, 30)}</span>`}
          <div class="sb-spotlight__text"><span class="sb-spotlight__label">${label}</span>
            <a class="sb-spotlight__title" href="${urls.competition(topCup.c)}">${topCup.c.name}</a>
            <span class="sb-spotlight__sub">${topCup.progress ?? ""}</span></div>
          <a class="sb-btn sb-btn--primary sb-btn--xl" href="${urls.competition(topCup.c)}">See the draw</a>
        </div>
        ${round ? html`<div class="sb-spotlight__round">${round}</div>` : ""}
      </div>
      ${ordered.length ? html`<div class="sb-comps__side">
        <button type="button" class="sb-comps__arrow sb-comps__arrow--up" data-cup-move="-1" aria-label="Earlier competitions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.5 5 14.4l1.4 1.4L12 10.3l5.6 5.5L19 14.4Z"/></svg></button>
        <div class="sb-comps__list">${ordered.map((x) => { const s = status(x), p = pct(x.progress);
          return html`<a class="sb-spot" href="${urls.competition(x.c)}" data-seg-pane="all ${s === "live" ? "on" : s}">
            <span class="sb-spot__icon ${x.c.trophy_url ? "has-img" : s === "done" || s === "on" || s === "live" ? "is-brass" : ""}">${cupTrophy(x.c)}</span>
            <span class="sb-spot__text"><span class="sb-comp__name">${x.c.name}</span><span class="sb-meta">${meta(x)}</span>
              ${p !== null && !x.done ? html`<span class="sb-cue" style="--pct:${Math.max(3, p)}%" aria-hidden="true"><span class="sb-cue__fill"></span><span class="sb-cue__tip"></span></span>` : ""}</span>
            ${s === "live" ? html`<span class="sb-chip">Live</span>` : ""}
            <span class="sb-spot__go">${sbIcon(ICON.right)}</span></a>`; })}</div>
        <button type="button" class="sb-comps__arrow sb-comps__arrow--down" data-cup-move="1" aria-label="More competitions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16.5 5 9.6l1.4-1.4L12 13.7l5.6-5.5L19 9.6Z"/></svg><span>More cups</span></button>
        <a class="sb-btn sb-btn--ink sb-btn--block" href="/competitions">All competitions</a>
      </div>` : ""}
    </div>
  </div>`;
}
/** The featured cup's current round: every pairing, played ones with their scores. */
function spotlightRound(x, focus) {
  const ms = (x.b.rounds[focus.round - 1] ?? []).filter((m) => !m.isBye && x.b.entryById.has(m.a) && x.b.entryById.has(m.b));
  if (!ms.length) return "";
  const played = ms.filter((m) => m.played).length;
  const order = (m) => (m.row.status === "in_progress" ? 0 : m.played ? 1 : 2);
  const list = [...ms].sort((p, q) => order(p) - order(q)).slice(0, 6);
  const cell = (m) => {
    const live = m.row.status === "in_progress", w = m.played ? winnerSide(m.row) : null;
    const row = (id, sc, me) => html`<span class="sb-result__row ${w ? (w === me ? "sb-result__row--win" : "sb-result__row--loss") : "sb-result__row--tba"}"><span>${x.name(id)}</span>
      ${m.played || live ? html`<span class="sb-frame ${w ? (w === me ? "sb-frame--win" : "sb-frame--loss") : "sb-frame--live"}">${sc ?? ""}</span>` : ""}</span>`;
    return html`<a class="sb-result" href="/cup-match/${m.row.no ?? m.row.id}"><span class="sb-result__label">${live ? "Being played now" : m.played ? "Result" : m.row.starts_at ? `${sbDay(m.row.starts_at)} · ${fmtTime(m.row.starts_at)}` : "To be arranged"}</span>
      ${row(m.a, m.row.score_a, "a")}${row(m.b, m.row.score_b, "b")}</a>`;
  };
  return html`<div class="sb-spotlight__roundhead"><span class="sb-spotlight__roundname">${roundName(focus.round, x.b.totalRounds, x.b)}</span><span class="sb-chip sb-chip--brass">${played} of ${ms.length} played</span></div>
    <div class="sb-spotlight__grid">${list.map(cell)}</div>
    ${ms.length > 6 ? html`<a class="sb-spotlight__more" href="${urls.competition(x.c)}">and ${ms.length - 6} more in this round</a>` : ""}`;
}


/** The banner's layout (Admin → Site settings → Home page banner — Rich, round 23): picture beside, one big picture, or headline only. */
// Round 28: "white" — a white banner, the headline on the left and the picture on the right .
const heroLayout = (site) => (["big", "text", "white"].includes(site.hero_layout) ? site.hero_layout : "side");

/** One banner article: headline, category and date, a small "continue reading" — all linking to the article. */
// dots (round 53, Rich): on the white banner the slider dots sit in the white card, under "Continue reading".
/** The eight quick links (round 77: a row of cards that scrolls sideways when there's no room). */
function quickLinks(ctx) {
  return html`<nav class="quick-links ql-8 ql-scroll" aria-label="Quick links">
    <a href="/fixtures">${quickIcon.fixtures}<span>Fixtures</span></a>
    <a href="/results">${quickIcon.results}<span>Results</span></a>
    <a href="${urls.season(ctx.season, "league-tables")}">${quickIcon.tables}<span>League tables</span></a>
    <a href="${urls.season(ctx.season, "rankings")}">${quickIcon.rankings}<span>Rankings</span></a>
    <a href="${urls.season(ctx.season, "breaks")}">${quickIcon.breaks}<span>Breaks</span></a>
    <a href="/competitions">${quickIcon.competitions}<span>Competitions</span></a>
    <a href="/calendar">${quickIcon.calendar}<span>Calendar</span></a>
    <a href="/handicaps">${quickIcon.handicaps}<span>Handicaps</span></a>
  </nav>`;
}

const storyPic = (a) => (a.image_url || a.circle_image_url ? html`<img src="${a.image_url || a.circle_image_url}" alt="" loading="lazy">` : html`<span class="hub-ph" aria-hidden="true"></span>`);
/** Round 77: featured news — the big story with three beside it (as on the News page). */
function featuredNewsBlock(list) {
  if (!list.length) return "";
  const [top, ...rest] = list;
  return html`<div class="hb-head"><h2>Latest news</h2><a href="/news">All the news →</a></div>
    <div class="feat-grid ${rest.length ? "" : "solo"}">
      <a class="feat-main" href="${urls.article(top)}">${storyPic(top)}<span class="feat-text"><strong>${top.title}</strong><small>${top.category ?? ""} | ${fmtAgo(top.published_at)}</small></span></a>
      ${rest.length ? html`<div class="feat-side">${rest.map((a) => html`<a class="feat-card" href="${urls.article(a)}">${storyPic(a)}
        <span class="feat-text"><strong>${a.title}</strong><small><b>${a.category ?? ""}</b> | ${fmtAgo(a.published_at)}</small></span></a>`)}</div>` : ""}
    </div>`;
}
/** Round 77: four more stories as big cards, two by two. */
function moreStories(list) {
  if (!list.length) return "";
  return html`<div class="hb-head"><h2>More stories</h2><a href="/news">All the news →</a></div>
    <div class="story-grid">${list.map((a) => html`<a class="story-card" href="${urls.article(a)}"><span class="story-pic">${storyPic(a)}</span>
      <span class="story-text">${a.category ? html`<small>${a.category}</small>` : ""}<strong>${a.title}</strong><em>${fmtAgo(a.published_at)} →</em></span></a>`)}</div>`;
}
/**
 * Live and upcoming competitions (round 84, Rich): a promo strip in the dark band that you swipe (or drag) yourself —
 * no automatic movement. Round ‹ › buttons sit on its left and right edges, and a search box above it finds a
 * competition by name. Live ones first, then those under way, then those still to come, finished ones last.
 */
/** Round 93: how far a competition has got, drawn as a cue (the shaft fills, the blue tip leads). */
function cue(progress) {
  const m = String(progress ?? "").match(/(\d+)\s+of\s+(\d+)/i);
  if (!m || !Number(m[2])) return "";
  const pct = Math.max(3, Math.min(100, Math.round((Number(m[1]) / Number(m[2])) * 100)));
  return html`<span class="bz-cue" aria-hidden="true"><i style="width:${pct}%"></i><b></b></span>`;
}
function compStrip(comps, data) {
  if (!comps.length) return "";
  const rank = (x) => { const p = String(x.progress ?? ""); return /being played|live/i.test(p) ? 0 : /Winner/.test(p) ? 3 : /not made|Draw not/i.test(p) ? 2 : 1; };
  const chip = [["live", "Live now"], ["on", "Under way"], ["soon", "Coming up"], ["done", "Finished"]];
  return html`<div class="hb-head cs-head"><h2>Live and upcoming competitions</h2>
      <label class="cs-search">${searchGlass}<input type="search" data-cs-search placeholder="Search competitions" aria-label="Search live and upcoming competitions" autocomplete="off"></label>
      <a href="/competitions">All competitions →</a></div>
    <div class="cs-view" data-cs>
      <button type="button" class="edge-btn prev" data-cs-move="-1" aria-label="Previous competitions">${chevLeft}</button>
      <div class="cs-row">${[...comps].sort((p, q) => rank(p) - rank(q)).map((x) => { const { c, progress } = x, [k, label] = chip[rank(x)];
        return html`<a class="cs-card" href="${urls.competition(c)}" data-name="${`${c.name} ${c.kind ?? ""}`.toLowerCase()}">
        <span class="cs-top">${compBoxStyle(c) !== "trophy" && c.image_url ? picture(c.image_url, "", "cs-pic") : trophy(c, "cs-trophy")}<i class="cs-chip ${k}">${label}</i></span>
        <span class="cs-text"><strong>${c.name}</strong><small>${progress ?? ""}</small>${cue(progress)}<em>See the draw</em></span></a>`; })}</div>
      <button type="button" class="edge-btn next" data-cs-move="1" aria-label="More competitions">${chevRight}</button>
      <p class="cs-none" hidden>No live or upcoming competition matches “<b data-cs-q></b>”. <a href="/competitions">See every competition →</a></p>
    </div>`;
}

/**
 * A row that slides sideways under your own control: the ‹ › buttons move it about one screen's worth, fade out at
 * either end, and a mouse can drag it like a finger swipes it. Returns a function that stops it.
 */
function manualSlider(box, rowSel, moveAttr) {
  const row = box && $(rowSel, box);
  if (!row) return () => {};
  const ends = () => {
    const can = row.scrollWidth - row.clientWidth > 4;
    box.classList.toggle("can-slide", can);
    box.classList.toggle("at-start", !can || row.scrollLeft <= 4);
    box.classList.toggle("at-end", !can || row.scrollLeft + row.clientWidth >= row.scrollWidth - 4);
  };
  const step = () => { const card = [...row.children].find((el) => el.offsetParent !== null); return Math.max((card?.offsetWidth ?? 260) + 16, Math.floor(row.clientWidth / ((card?.offsetWidth ?? 260) + 16)) * ((card?.offsetWidth ?? 260) + 16)); };
  box.addEventListener("click", (e) => { const b = e.target.closest(`[${moveAttr}]`); if (b) row.scrollBy({ left: Number(b.getAttribute(moveAttr)) * step(), behavior: "smooth" }); });
  let drag = null, dragged = false;
  row.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || e.button !== 0) return; drag = { x: e.clientX, left: row.scrollLeft, id: e.pointerId }; dragged = false; });
  row.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!dragged && Math.abs(dx) < 6) return;
    if (!dragged) { dragged = true; row.classList.add("is-dragging"); try { row.setPointerCapture(e.pointerId); } catch { /* fine */ } }
    row.scrollLeft = drag.left - dx;
  });
  const end = () => { if (!drag) return; drag = null; row.classList.remove("is-dragging"); };
  row.addEventListener("pointerup", end); row.addEventListener("pointercancel", end);
  row.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  row.addEventListener("dragstart", (e) => e.preventDefault());
  row.addEventListener("scroll", ends, { passive: true });
  window.addEventListener("resize", ends, { passive: true });
  ends();
  document.fonts?.ready.then(() => row.isConnected && ends());
  box.refreshEnds = ends;
  return () => window.removeEventListener("resize", ends);
}

/** Round 93: one featured story — its picture, category, headline, when, and a Continue reading button. */
function storySlide(a, on) {
  const pic = a.image_url || a.circle_image_url;
  return html`<div class="hero-slide bz-slide ${on ? "on" : ""}">
    <a class="bz-slide-pic" href="${urls.article(a)}" aria-hidden="true" tabindex="-1">${pic ? html`<img src="${pic}" alt="">` : html`<span class="hub-ph"></span>`}</a>
    <div class="bz-slide-text">
      ${a.category ? html`<span class="bz-slide-cat">${a.category}</span>` : ""}
      <h2 class="bz-slide-title"><a href="${urls.article(a)}">${a.title}</a></h2>
      <p class="bz-slide-meta"><time datetime="${a.published_at ?? ""}" title="${fmtDate(a.published_at)}">${fmtAgo(a.published_at)}</time></p>
      <a class="btn bz-read" href="${urls.article(a)}">Continue reading</a>
    </div>
  </div>`;
}

const DESIGN_ORDER = ["promo", "news", "comp_strip", "competitions", "teams", "features"];
/** Round 96: More stories — four cards in a row, the Latest news card style. */
function moreStoryCards(list) {
  if (!list.length) return "";
  return html`<div class="hb-head"><h2>More stories</h2><a href="/news">All the news</a></div>
    <div class="bz-news bz-more">${list.map((a) => html`<a class="bz-news-card" href="${urls.article(a)}"><span class="bz-news-pic">${storyPic(a)}</span>
      <span class="bz-news-text">${a.category ? html`<span class="bz-news-cat">${a.category}</span>` : ""}<strong>${a.title}</strong><small>${fmtAgo(a.published_at)}</small></span></a>`)}</div>`;
}
/** Round 94: latest news as three cards — picture, category, headline, when. */
function newsCards(list) {
  if (!list.length) return "";
  return html`<div class="hb-head"><h2>Latest news</h2><a href="/news">All the news</a></div>
    <div class="bz-news">${list.map((a) => html`<a class="bz-news-card" href="${urls.article(a)}"><span class="bz-news-pic">${storyPic(a)}</span>
      <span class="bz-news-text">${a.category ? html`<span class="bz-news-cat">${a.category}</span>` : ""}<strong>${a.title}</strong><small>${fmtAgo(a.published_at)}</small></span></a>`)}</div>`;
}
/** Round 94: Our teams — one card per league, its teams in two columns with their emblems. */
function teamsCards(ctx) {
  // Round 96/98: the crest wall (shared with Fixtures and Our Players — components.js leagueCrests).
  const wall = leagueCrests(ctx, { note: (t) => ctx.venue?.get?.(t.venue_id)?.name ?? "" });
  return wall ? html`<div class="hb-head"><h2>Our teams</h2><a href="/fixtures">Fixtures and results</a></div>${wall}` : "";
}

function heroSlide(a, on, dots = null) {
  return html`<div class="hero-slide ${on ? "on" : ""}">
    <div class="hero-text">
      <h2><a href="${urls.article(a)}"><span>${a.title}</span></a></h2>
      <p class="hero-meta">${a.category} · <time datetime="${a.published_at ?? ""}" title="${fmtDate(a.published_at)}">${fmtAgo(a.published_at)}</time></p>
      <a class="hero-more" href="${urls.article(a)}">Continue reading <span aria-hidden="true">→</span></a>
      ${dots ? html`<div class="hero-dots in-card">${Array.from({ length: dots.of }, (_, i) => html`<button class="${i === dots.at ? "on" : ""}" data-dot="${i}" aria-label="Show article ${i + 1}"></button>`)}</div>` : ""}
    </div>
    ${a.image_url || a.circle_image_url ? html`<a class="hero-pic-link" href="${urls.article(a)}" aria-label="${a.title}"><img class="hero-pic" src="${a.image_url || a.circle_image_url}" alt=""></a>` : ""}
  </div>`;
}

/**
 * The coloured strip under the quick links (Admin → Site settings → Home page: feature box).
 * It carries the feature text with its pulsing label ("NEW") and — when "Also show the announcements"
 * is ticked — the announcements too. One message: it just sits there. More than one: they scroll across
 * like the ticker, or show one at a time (Site settings → "When there is more than one message").
 */
function featureBox(site, notices, today) {
  if (!site.feature_show) return "";
  const own = site.feature_text ? [{ label: site.feature_label, text: site.feature_text, url: safeHref(site.feature_url), own: true }] : [];
  const extra = site.feature_announcements === false ? [] : notices
    .filter((a) => a.is_active !== false && a.show_in_feature !== false && a.text && (!a.starts_on || a.starts_on <= today) && (!a.ends_on || a.ends_on >= today))
    .map((a) => ({ label: a.label || "Announcement", text: a.text, url: safeHref(a.url) }));
  const items = [...own, ...extra];
  if (!items.length) return "";
  const bg = /^#[0-9a-f]{6}$/i.test(site.feature_bg ?? "") ? site.feature_bg : "#0b84e0";
  // Dark text on light colours, white on dark ones.
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const light = (r * 299 + g * 587 + b * 114) / 1000 > 150;
  const style = `background:${bg};color:${light ? "#1b0e06" : "#fff"}`;
  const target = (url) => (/^https?:\/\//.test(url) ? html`target="_blank" rel="noopener"` : "");
  const tag = (item, pulse = false) => (item.label ? html`<span class="feature-new ${pulse ? "" : "still"}">${item.label}</span>` : "");

  if (items.length === 1) {
    const [it] = items;
    const inner = html`${tag(it, true)}<span class="feature-text">${it.text}</span>${it.url ? html`<span class="feature-go" aria-hidden="true">→</span>` : ""}`;
    return it.url ? html`<a class="feature-box" style="${style}" href="${it.url}" ${target(it.url)}>${inner}</a>` : html`<div class="feature-box" style="${style}">${inner}</div>`;
  }
  if (site.feature_style === "rotate") {
    return html`<div class="feature-box rotating" style="${style}" data-feature="rotate" role="region" aria-label="Announcements">
      ${items.map((it, i) => { const inner = html`${tag(it, !!it.own)}<span class="feature-text">${it.text}</span>${it.url ? html`<span class="feature-go" aria-hidden="true">→</span>` : ""}`;
        return it.url ? html`<a class="feature-item ${i ? "" : "on"}" href="${it.url}" ${target(it.url)}>${inner}</a>` : html`<div class="feature-item ${i ? "" : "on"}">${inner}</div>`; })}
    </div>`;
  }
  // Scrolling: the first label stays put on the left; the messages pass by, each announcement with its own small label.
  const one = (it) => { const inner = html`${it.own ? "" : tag(it)}${it.text}${it.url ? html`<i aria-hidden="true">→</i>` : ""}`;
    return it.url ? html`<a class="ticker-item" href="${it.url}" ${target(it.url)}>${inner}</a>` : html`<span class="ticker-item">${inner}</span>`; };
  return html`<div class="feature-box scrolling" style="${style}" data-feature="scroll" role="region" aria-label="Announcements">
    ${own.length ? tag(own[0], true) : html`<span class="feature-new">Announcements</span>`}
    <div class="ticker-view"><div class="ticker-track"><div class="ticker-set">${items.map(one)}</div><div class="ticker-set" aria-hidden="true">${items.map(one)}</div></div></div>
  </div>`;
}

/**
 * Key dates (Admin → Key dates): the next few dates everyone should know, in one slim row —
 * the label on the left, then each date as a small card (date tile, title, how long to go).
 * More dates than fit slide sideways. A date leaves the row the day after it (or its last day) has passed.
 */
const kdIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v17H4V4h3Zm11 8H6v9h12Zm0-4H6v2h12Z"/></svg>`;
function keyDates(site, dates, competitions, today) {
  if (site.key_dates_show === false) return "";
  const list = dates.filter((d) => d.is_active !== false && (d.ends_on || d.starts_on) >= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on)).slice(0, Math.max(1, site.key_dates_count || 5));
  if (!list.length) return "";
  const part = (iso, opts) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
  const days = (iso) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5);
  const when = (d) => { const n = days(d.starts_on); return n <= 0 ? (d.ends_on && d.ends_on > today ? "On now" : "Today") : n === 1 ? "Tomorrow" : n < 14 ? `In ${n} days` : `In ${Math.round(n / 7)} weeks`; };
  // Round 93 (Baize): a card with the dates one under another — the day in a small tile, the title, the details,
  // and how long to go (red when it's within a day).
  return html`<section class="kd bz-kd" aria-label="Key dates">
    <div class="bz-kd-head"><h3>Key dates</h3><a href="/calendar">Open the calendar</a></div>
    ${list.map((d) => {
      const comp = competitions.find((c) => c.id === d.competition_id);
      const href = safeHref(d.url) || (comp ? urls.competition(comp) : "/calendar");
      const more = [part(d.starts_on, { weekday: "long" }), d.ends_on && d.ends_on !== d.starts_on ? `until ${part(d.ends_on, { weekday: "short", day: "numeric", month: "short" }).replace(",", "")}` : "", d.details ?? ""].filter(Boolean).join(", ");
      return html`<a class="bz-kd-row" href="${href}" ${/^https?:\/\//.test(href) ? html`target="_blank" rel="noopener"` : ""}>
        <time datetime="${d.starts_on}"><b>${part(d.starts_on, { day: "numeric" })}</b><span>${part(d.starts_on, { month: "short" })}</span></time>
        <span class="bz-kd-text"><strong>${d.title}</strong>${more ? html`<small>${more}</small>` : ""}</span>
        <em class="${days(d.starts_on) <= 1 ? "soon" : ""}">${when(d)}</em></a>`;
    })}
  </section>`;
}

// ── live & upcoming strip ─────────────────────────────────────
/** Round 52 (Neil): under the four quick links, for anyone logged in — the way to their My Snooker page. */
function myBtn(user, ctx) {
  // Not logged in: nothing here — the "My Snooker: your team's own page" invitation further down does that job.
  if (!user) return "";
  const team = ctx.team.get(mySnookerTeamId(user));
  return html`<a class="my-snooker-btn" href="/mysnooker">${mySnookerStar}<b>My Snooker</b>
    <span>${team ? html`The latest stats for ${team.name} and everyone you follow` : "The latest stats of all your favourite teams and players"}</span><i aria-hidden="true">→</i></a>`;
}

let sbStripTab = "";
// Round 51 (Neil): a logged-in person can see only their own team's matches on the strip (All | Bugle).
const STRIP_MINE = "sbds-strip-mine";
const stripMine = () => { try { return localStorage.getItem(STRIP_MINE) === "1"; } catch { return false; } };
/** The teams (and players) "my team" means: the teams they follow, their own team, and their player's team. */
function stripTeams(user, players) {
  if (!user?.profile) return { teams: new Set(), people: new Set() };
  const prefs = myPrefs(user), me = players.find((x) => x.id === user.profile.player_id);
  return { teams: new Set([...prefs.teams, user.profile.team_id, me?.team_id].filter(Boolean)), people: new Set([...prefs.players, me?.id].filter(Boolean)) };
}

// Round 52 (Neil): on the home page, two filters — a league or competition, and a team (remembered on this device).
const STRIP_FILTER = "sbds-strip-filter";
const stripFilter = () => { try { const v = JSON.parse(localStorage.getItem(STRIP_FILTER) || "{}"); return { comp: String(v.comp || ""), team: String(v.team || "") }; } catch { return { comp: "", team: "" }; } };
const setStripFilter = (v) => { try { localStorage.setItem(STRIP_FILTER, JSON.stringify(v)); } catch { /* not remembered */ } };

/**
 * The Live & upcoming strip, drawn into `el` and kept up to date, moving on one card at a time.
 * mode "filters" (the home page): League / competition and Team dropdowns; choosing a team offers "View team stats".
 * mode "mine" (My Snooker): the All | my team switch. Returns a function that stops it.
 */
export async function mountLiveStrip(el, user, { mode = "filters", layout = "strip" } = {}) {
  const draw = async () => mount(el, await liveStrip(user, mode, layout));
  await draw();
  const unsubscribe = subscribe(["fixtures", "frames", "competition_matches", "competitions", "live_matches"], draw);
  let paused = false;
  const move = (dir) => {
    const row = $(".strip-row", el);
    if (!row) return;
    const stepPx = ($(".strip-card, .sb-match", row)?.offsetWidth ?? 230) + 16;
    const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
    if (dir > 0 && atEnd) row.scrollTo({ left: 0, behavior: "smooth" });
    else if (dir < 0 && row.scrollLeft <= 4) row.scrollTo({ left: row.scrollWidth, behavior: "smooth" });
    else row.scrollBy({ left: dir * stepPx, behavior: "smooth" });
  };
  for (const [on, off] of [["mouseenter", "mouseleave"], ["touchstart", "touchend"], ["focusin", "focusout"]]) {
    el.addEventListener(on, () => { paused = true; }, { passive: true });
    el.addEventListener(off, () => { paused = false; }, { passive: true });
  }
  // Round 72 (Rich): drag the strip with the mouse to see more (fingers already swipe it). The ‹ › buttons stay.
  // A drag that moves more than a few pixels doesn't open the card it started on.
  let drag = null, dragged = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    const row = e.target.closest(".strip-row");
    if (!row || e.target.closest("select, button")) return;
    drag = { row, x: e.clientX, left: row.scrollLeft, id: e.pointerId };
    dragged = false;
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!dragged && Math.abs(dx) < 6) return;
    if (!dragged) { dragged = true; paused = true; drag.row.classList.add("is-dragging"); try { drag.row.setPointerCapture(e.pointerId); } catch { /* fine */ } }
    drag.row.scrollLeft = drag.left - dx;
    e.preventDefault();
  });
  const endDrag = () => {
    if (!drag) return;
    const row = drag.row; drag = null;
    if (!dragged) return;
    row.classList.remove("is-dragging");
    // Settle on the nearest card, as the arrows do.
    const step = ($(".strip-card, .sb-match", row)?.offsetWidth ?? 230) + (row.classList.contains("sb-strip__row") ? 16 : 10);
    row.scrollTo({ left: Math.round(row.scrollLeft / step) * step, behavior: "smooth" });
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
  el.addEventListener("dragstart", (e) => { if (e.target.closest(".strip-row")) e.preventDefault(); });
  el.addEventListener("click", (e) => {
    if (dragged && e.target.closest(".strip-row")) { e.preventDefault(); e.stopPropagation(); dragged = false; return; }
    dragged = false;
    const b = e.target.closest("[data-strip-move]"); if (b) return move(Number(b.dataset.stripMove));
    const tabBtn = e.target.closest("[data-strip-tab]"); if (tabBtn) { sbStripTab = tabBtn.dataset.stripTab; draw(); return; }
    const t = e.target.closest("[data-strip-mine]");
    if (t) { try { localStorage.setItem(STRIP_MINE, t.dataset.stripMine); } catch { /* not remembered */ } draw(); }
  });
  el.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-strip-filter]");
    if (!sel) return;
    setStripFilter({ ...stripFilter(), [sel.dataset.stripFilter]: sel.value });
    draw();
  });
  // Round 108 (Rich: "Live and upcoming matches — add auto scroll"): the home page strip moves on by itself too, one
  // card every few seconds, pausing while the pointer or a finger is on it.
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const carousel = still ? null : setInterval(() => { if (!paused && !document.hidden) move(1); }, CAROUSEL_MS);
  return () => { clearInterval(carousel); unsubscribe(); };
}

async function liveStrip(user = null, mode = "filters", layout = "strip") {
  // Round 38 (Rich): how long results stay on the strip, and the colours of its Live / Live soon / Completed / Pending /
  // Walkover / Postponed (round 39)
  // labels, are set under Admin → Site settings → "Home page: Live & upcoming strip".
  const site = await settings().catch(() => ({}));
  const hours = Number.isFinite(Number(site.strip_result_hours)) && site.strip_result_hours !== null && site.strip_result_hours !== "" ? Number(site.strip_result_hours) : 48;
  const [{ fixtures, comps, frames }, teams, leagues, compData, venues, players, boards] = await Promise.all([
    upcomingMatches((mode === "mine" && user && stripMine()) || (mode === "filters" && (stripFilter().comp || stripFilter().team)) ? 80 : 12, hours), table("teams", "name"), table("leagues", "sort"), currentCompetitions(), table("venues", "name"), table("players", "full_name"), liveMatches().catch(() => []),
  ]);
  const team = new Map(teams.map((t) => [t.id, t]));
  const framesBy = new Map();
  for (const f of frames) (framesBy.get(f.fixture_id) ?? framesBy.set(f.fixture_id, []).get(f.fixture_id)).push(f);
  const brackets = new Map(compData.competitions.map((c) => [c.id, buildBracket(compData.entries.filter((e) => e.competition_id === c.id), compData.matches.filter((m) => m.competition_id === c.id))]));

  const all = [
    ...fixtures.map((fx) => ({
      ...(() => { const sc = matchScore(framesBy.get(fx.id)), played = (Number(sc.home) || 0) + (Number(sc.away) || 0);
        const live = isLiveNow(fx, Date.now(), played), stale = fx.status === "in_progress" && !live;
        // Round 99: an "in progress" match whose night is over (or whose frames are all played) is a result waiting to be submitted, not live.
        return { live, done: stale || ["submitted", "approved"].includes(fx.status), label: stale || fx.status === "submitted" ? "pending" : fx.status === "approved" ? "completed" : fx.status === "postponed" ? "postponed" : null }; })(),
      key: `l:${fx.league_id}`, when: fx.starts_at, status: fx.status, doneAt: fx.result_at && fx.result_at > fx.starts_at ? fx.result_at : fx.starts_at,
      postponed: fx.status === "postponed",
      title: leagues.find((l) => l.id === fx.league_id)?.name ?? "League",
      a: { name: team.get(fx.home_team_id)?.name ?? "?", team: team.get(fx.home_team_id) },
      b: { name: team.get(fx.away_team_id)?.name ?? "?", team: team.get(fx.away_team_id) }, score: matchScore(framesBy.get(fx.id)),
      hasFrames: framesBy.has(fx.id), href: urls.match(fx), venue: venues.find((v) => v.id === fx.venue_id),
      // A frame of this match being scored ball by ball by a captain: the card says so and opens that scoreboard.
      ...(() => { const board = boards.find((m) => m.fixture_id === fx.id && onTable(m));
        return board ? { href: urls.scoreboard(board), venue: { name: `Frame ${board.frame_no ?? board.state?.frame?.no ?? ""} ball by ball — watch live` } } : {}; })(),
    })),
    ...comps.map((m) => {
      const c = compData.competitions.find((x) => x.id === m.competition_id);
      const bm = brackets.get(m.competition_id)?.rounds[m.round - 1]?.[m.slot];
      if (!c || !bm || !isEntry(bm.a) || !isEntry(bm.b)) return null;
      // Team cups show the team emblem; singles show the player's photo.
      const who = (id) => { const e = compData.entries.find((x) => x.id === id); return { name: e.name, team: team.get(e.team_id), player: players.find((p) => p.id === e.player_id) }; };
      return {
        // A result typed in with no date goes by the time it went in (result_at); a match being scored, by now.
        key: `c:${c.id}`, when: m.starts_at ?? m.result_at ?? new Date().toISOString(), status: m.status, live: isLiveNow(m), done: m.status === "completed" || isAwaitingResult(m), title: c.name, cup: true,
        doneAt: m.result_at ?? m.starts_at, label: m.status === "completed" ? (walkoverSide(m) ? "walkover" : "completed") : m.status === "postponed" ? "postponed" : null,
        postponed: m.status === "postponed",
        a: who(bm.a), b: who(bm.b),
        score: { home: m.score_a ?? 0, away: m.score_b ?? 0 }, hasFrames: m.score_a != null, href: `/cup-match/${m.no ?? m.id}`, venue: venues.find((v) => v.id === m.venue_id),
        // Round 37: a walkover has no score — the card says who went through.
        walkover: walkoverSide(m) ? who(walkoverSide(m) === "a" ? bm.a : bm.b).name : null,
      };
    }).filter(Boolean),
    // Matches scored ball by ball (finals): on now, or set up with a date in the next three weeks.
    ...boards.filter((m) => !m.fixture_id && (m.status === "live" || (m.status === "setup" && m.starts_at && Date.parse(m.starts_at) < Date.now() + 21 * 864e5))).map((m) => {
      const who = (s) => { const p = players.find((x) => x.id === m[`player_${s}_id`]); return { name: sideName(m, s, players), player: p ?? {} }; };
      return { when: m.started_at ?? m.starts_at, live: m.status === "live", done: false, title: matchLabel(m, compData.competitions), a: who("a"), b: who("b"),
        score: { home: m.frames_a ?? 0, away: m.frames_b ?? 0 }, hasFrames: m.status === "live", href: urls.scoreboard(m), venue: { name: m.status === "live" ? "Ball by ball — watch live" : m.venue ?? "" } };
    }),
    // Competition draws: one being made live now, one due soon, or one made in the last two days.
    ...compData.competitions.map((c) => {
      const dl = c.draw_live, entry = (id) => compData.entries.find((e) => e.id === id)?.name;
      const last = dl?.log?.at(-1);
      const tie = last ? (last.a && last.b ? `${entry(last.a)} has drawn ${entry(last.b)}` : `${entry(last.a ?? last.b)} gets a bye`) : "";
      if (dl?.status === "live") return { key: `c:${c.id}`, draw: true, live: true, when: dl.started_at, title: c.name, text: tie || "The draw is starting…", foot: "Watch the draw live →", href: `/draw/${c.slug}` };
      if (dl?.status === "done" && Date.now() - Date.parse(dl.finished_at) < 48 * 3600e3) return { key: `c:${c.id}`, draw: true, live: false, when: dl.finished_at, title: c.name, text: tie, foot: "See the full draw →", href: `/draw/${c.slug}` };
      if (!dl && c.draw_at && Date.parse(c.draw_at) > Date.now() - 3 * 3600e3 && Date.parse(c.draw_at) < Date.now() + 21 * 864e5)
        return { key: `c:${c.id}`, draw: true, live: false, when: c.draw_at, title: c.name, text: `Draw at ${fmtTime(c.draw_at)}`, foot: "Live on the website →", href: `/draw/${c.slug}` };
      return null;
    }).filter(Boolean),
  ].sort((x, y) => (y.live - x.live) || String(x.when).localeCompare(String(y.when)));
  // My team only: matches with one of their teams (or a player they follow) on either side.
  const mineSets = stripTeams(user, players), canMine = mode === "mine" && mineSets.teams.size > 0, mine = canMine && stripMine();
  const ours = (c) => [c.a, c.b].some((sd) => sd && ((sd.team && mineSets.teams.has(sd.team.id)) || (sd.player?.team_id && mineSets.teams.has(sd.player.team_id)) || (sd.player?.id && mineSets.people.has(sd.player.id))));
  // The home page's filters: a league or competition, and a team (a team's cup matches count, and its players' singles).
  const f = mode === "filters" ? stripFilter() : { comp: "", team: "" };
  const hasTeam = (c, id) => [c.a, c.b].some((sd) => sd && ((sd.team && sd.team.id === id) || sd.player?.team_id === id));
  const pool = mine ? all.filter((c) => !c.draw && ours(c))
    : all.filter((c) => (!f.comp || c.key === f.comp) && (!f.team || (!c.draw && hasTeam(c, f.team))));
  const fTeam = f.team ? team.get(f.team) : null;
  // Round 53 (Neil): each filter is a small pill showing the choice, with the real dropdown laid invisibly on top — so
  // tapping still opens the phone's own list, and iPhones don't zoom in (their dropdowns stay 16px, just unseen).
  const compName = f.comp.startsWith("l:") ? leagues.find((l) => `l:${l.id}` === f.comp)?.name : compData.competitions.find((c) => `c:${c.id}` === f.comp)?.name;
  const filters = mode !== "filters" ? "" : html`<div class="strip-filters">
    <label class="strip-select ${compName ? "is-set" : ""}"><span class="strip-select-text">${compName || "All leagues & cups"}</span>
      <select data-strip-filter="comp" aria-label="League or competition">
        <option value="">All leagues & cups</option>
        <optgroup label="Leagues">${leagues.map((l) => html`<option value="l:${l.id}" ${f.comp === `l:${l.id}` ? "selected" : ""}>${l.name}</option>`)}</optgroup>
        ${compData.competitions.length ? html`<optgroup label="Competitions">${compData.competitions.map((c) => html`<option value="c:${c.id}" ${f.comp === `c:${c.id}` ? "selected" : ""}>${c.name}</option>`)}</optgroup>` : ""}
      </select></label>
    <label class="strip-select ${fTeam ? "is-set" : ""}"><span class="strip-select-text">${fTeam?.name || "All teams"}</span>
      <select data-strip-filter="team" aria-label="Team">
        <option value="">All teams</option>
        ${teams.filter((t) => t.active !== false || t.id === f.team).map((t) => html`<option value="${t.id}" ${f.team === t.id ? "selected" : ""}>${t.name}</option>`)}
      </select></label>
    ${fTeam ? html`<a class="strip-stats" href="/mysnooker?team=${fTeam.id}">View ${fTeam.name} stats →</a>` : ""}
  </div>`;
  const mineTeams = [...mineSets.teams].map((id) => team.get(id)).filter(Boolean);
  const mineLabel = mineTeams.length === 1 ? mineTeams[0].name : "My teams";
  const toggle = canMine ? html`<span class="strip-mine" role="group" aria-label="Which matches to show">
    <button type="button" data-strip-mine="0" aria-pressed="${mine ? "false" : "true"}">${layout === "sb" ? "All teams" : "All"}</button><button type="button" data-strip-mine="1" aria-pressed="${mine ? "true" : "false"}">${mineLabel}</button></span>` : "";
  // Rich, round 33: a league night fills a dozen places on its own, so cup matches a week or two away never got a
  // look in. Everything live comes first; then the next matches in date order, keeping up to four places for the
  // next cup matches (and draws) that would otherwise drop off the end.
  const PLACES = 12, CUP_PLACES = 4, RESULT_PLACES = 8;
  // Results stay for the hours set in Site settings (0 = never), counted from when the result went in (a cup result
  // typed in later counts from then). At most eight, the newest; they come first, then what's coming up.
  const cutoff = Date.now() - hours * 3600e3;
  const results = pool.filter((c) => c.done && !c.live && hours > 0 && Date.parse(c.doneAt ?? c.when) >= cutoff)
    .sort((x, y) => String(y.doneAt ?? y.when).localeCompare(String(x.doneAt ?? x.when))).slice(0, RESULT_PLACES)
    .sort((x, y) => String(x.when).localeCompare(String(y.when)));
  const live = pool.filter((c) => c.live), rest = pool.filter((c) => !c.live && !c.done);
  const isCup = (c) => c.cup || c.draw;
  let shown = rest.slice(0, Math.max(0, PLACES - live.length));
  const wanted = Math.min(CUP_PLACES, rest.filter(isCup).length, shown.length);
  // Swap the latest league matches for the next cup matches until there are enough cup cards.
  for (const cup of rest.filter((c) => isCup(c) && !shown.includes(c))) {
    if (shown.filter(isCup).length >= wanted) break;
    const lastLeague = shown.map((c, i) => [c, i]).filter(([c]) => !isCup(c)).at(-1);
    if (!lastLeague) break;
    shown.splice(lastLeague[1], 1); shown.push(cup);
  }
  shown.sort((x, y) => String(x.when).localeCompare(String(y.when)));
  const cards = [...live, ...results, ...shown];

  // Round 93 (Baize): on the home page the matches are a list inside the green Matchday panel — each row a scoreline
  // (name, club badge, score or time, club badge, name) with the league or competition and the venue under it.
  // Round 99 (the design system): the dark strip under the lead story — Live · n / Upcoming / Results, cards that
  // scroll sideways, the arrows and "View all matches". The tab chosen is kept while the strip updates itself.
  if (layout === "sb") {
    // Round 101 (Rich): All first, then Live (always there — it says when nothing is on), Upcoming and Results; the
    // chosen one in red so you can see where you are. Each card has the My Snooker colour coding: the leading score
    // green and the other red, the state as a coloured label, and a coloured edge — green live, gold waiting for the
    // result (or a draw), red a finished result. The colours come from Admin → Site settings → Live & upcoming strip.
    const clubLogo = (t) => (t && !t.logo_url ? venues.find((v) => v.id === t.venue_id)?.logo_url || "" : "");
    const circle = (sd) => { const logo = sd.player?.avatar_url || sd.team?.logo_url || clubLogo(sd.team);
      return logo ? html`<span class="sb-initials sb-initials--pic"><img src="${logo}" alt=""></span>` : html`<span class="sb-initials" aria-hidden="true">${initialsOf(sd.name)}</span>`; };
    const upcoming = shown.filter((c) => !c.live), sets = { all: cards, live, upcoming, results: [...results].reverse() };
    if (!sbStripTab || !sets[sbStripTab]) sbStripTab = "all";
    const list = sets[sbStripTab] ?? [];
    const tab = (key, label) => html`<button type="button" data-strip-tab="${key}" aria-pressed="${String(sbStripTab === key)}">${label}</button>`;
    const when = (c) => (ukDay(c.when) === todayUK() ? (c.done ? "Today" : "Tonight") : sbDay(c.when));
    const tone = (c) => (c.draw ? "draw" : c.live ? "live" : c.postponed ? "postponed" : c.label === "pending" ? "pending" : c.walkover ? "walkover" : c.done ? "done" : "soon");
    const label = (c) => (c.live ? html`<span class="sb-state sb-state--live">Live</span>` : c.postponed ? html`<span class="sb-state sb-state--postponed">Postponed</span>`
      : c.walkover ? html`<span class="sb-state sb-state--walkover">Walkover</span>` : c.label === "pending" ? html`<span class="sb-state sb-state--pending">${c.status === "in_progress" ? "Awaiting result" : "Pending"}</span>`
      : c.done ? html`<span class="sb-state sb-state--done">Completed</span>` : liveSoonTag({ starts_at: c.when, status: c.status ?? "scheduled" }));
    const tiles = (c) => { const h = Number(c.score?.home), a = Number(c.score?.away), lead = h === a ? null : h > a ? "h" : "a";
      return html`<span class="sb-score sb-score--tone" aria-label="${c.score.home} – ${c.score.away}"><span class="${lead ? (lead === "h" ? "w" : "l") : ""}">${c.score.home}</span><span class="${lead ? (lead === "a" ? "w" : "l") : ""}">${c.score.away}</span></span>`; };
    const card = (c) => (c.draw ? html`<a class="sb-match sb-match--draw" href="${c.href}">
        <span class="sb-match__top"><b>${when(c)}</b><span class="sb-match__league">${c.title}</span></span>
        <span class="sb-match__draw">${c.live ? html`<span class="sb-state sb-state--live">Live draw</span>` : html`<b>The draw</b>`}<span>${c.text}</span></span>
        <span class="sb-match__venue">${c.foot.replace(" →", "")}</span></a>`
      : html`<a class="sb-match sb-match--${tone(c)}" href="${c.href}">
        <span class="sb-match__top"><b>${when(c)}</b><span class="sb-match__league">${c.title}</span></span>
        <span class="sb-match__teams">
          <span class="sb-match__team ${c.done && Number(c.score?.home) > Number(c.score?.away) ? "is-win" : ""}">${circle(c.a)}<span>${c.a.name}</span></span>
          <span class="sb-match__mid">${c.postponed ? html`<span class="sb-match__time">P–P</span>` : c.walkover ? html`<span class="sb-match__time">W/O</span>` : c.hasFrames || c.done ? tiles(c) : html`<span class="sb-match__time">${fmtTime(c.when)}</span>`}${label(c)}</span>
          <span class="sb-match__team ${c.done && Number(c.score?.away) > Number(c.score?.home) ? "is-win" : ""}">${circle(c.b)}<span>${c.b.name}</span></span>
        </span>
        <span class="sb-match__venue">${c.walkover ? `Walkover to ${c.walkover}` : c.venue?.name || " "}</span></a>`);
    const next = upcoming[0];
    const empty = sbStripTab === "live"
      ? html`<p class="sb-strip__empty"><b>No matches are live right now.</b> ${next ? `The next is ${next.a.name} v ${next.b.name}, ${when(next)} at ${fmtTime(next.when)}.` : ""} <a href="/calendar">See the calendar</a></p>`
      : html`<p class="sb-strip__empty">No matches here just now. <a href="/calendar">See the calendar</a></p>`;
    return html`${stripColours(site)}<div class="sb-strip__head">
        <h2 id="sb-strip-h">Live and upcoming matches</h2>
        ${mode === "mine" && toggle ? html`<span class="sb-strip__mine">${toggle}</span>` : ""}
        <div class="sb-seg sb-seg--arena sb-seg--pick" role="group" aria-label="Which matches">${tab("all", "All")}${tab("live", `Live · ${live.length}`)}${tab("upcoming", "Upcoming")}${tab("results", "Results")}</div>
        <div class="sb-strip__ctrl">
          <button type="button" class="sb-icon-btn sb-icon-btn--arena" data-strip-move="-1" aria-label="Previous matches">${sbIcon(ICON.left)}</button>
          <button type="button" class="sb-icon-btn sb-icon-btn--arena-solid" data-strip-move="1" aria-label="Next matches">${sbIcon(ICON.right)}</button>
          <a class="sb-strip__all" href="/fixtures">View all matches</a>
        </div></div>
      ${list.length ? html`<div class="sb-strip__row strip-row">${list.map(card)}</div>` : empty}
      <a class="sb-strip__all sb-strip__all--below" href="/fixtures">View all matches ${sbIcon(ICON.arrow, 18)}</a>`;
  }

  if (layout === "list") {
    const clubLogo = (t) => (t && !t.logo_url ? venues.find((v) => v.id === t.venue_id)?.logo_url || "" : "");
    const crest = (sd) => (sd.player ? avatar(sd.player, "avatar md-face") : sd.team ? badge({ ...sd.team, logo_url: sd.team.logo_url || clubLogo(sd.team) }) : html`<span class="badge">${sd.name.slice(0, 2).toUpperCase()}</span>`);
    const LIST_MAX = 5;
    const rows = cards.slice(0, LIST_MAX);
    const dayOf = (c) => (ukDay(c.when) === todayUK() ? "Tonight" : fmtDay(c.when));
    const filtersRow = filters || toggle ? html`<div class="md-filters">${filters}${toggle ? html`<div class="strip-filters">${toggle}</div>` : ""}</div>` : "";
    if (!rows.length) return html`${stripColours(site)}${filtersRow}<div class="md-list md-empty"><p>${mine ? `No matches coming up for ${mineLabel} just now.` : f.comp || f.team ? "No matches for that choice just now." : "No matches coming up."}</p><a href="/calendar">See the calendar</a></div>`;
    return html`${stripColours(site)}${filtersRow}
      <div class="md-list">${rows.map((c) => (c.draw ? html`<a class="md-row is-draw ${c.live ? "is-live" : ""}" href="${c.href}">
          <span class="md-draw"><b>${c.live ? "Live draw" : "The draw"}: ${c.title}</b><span>${c.text}</span></span>
          <span class="md-meta">${dayOf(c)}, ${c.foot}</span></a>`
        : html`<a class="md-row ${c.live ? "is-live" : ""}" href="${c.href}">
          <span class="md-side home"><b>${c.a.name}</b>${crest(c.a)}</span>
          <span class="md-mid">${c.postponed ? html`<b class="md-word">P - P</b>` : c.walkover ? html`<b class="md-word">W/O</b>` : c.hasFrames || c.done ? scoreTiles(c) : html`<b class="md-time">${fmtTime(c.when)}</b>`}</span>
          <span class="md-side away">${crest(c.b)}<b>${c.b.name}</b></span>
          <span class="md-meta">${c.live ? html`<span class="md-live">Live now</span>` : c.postponed ? html`<span class="md-flag">Postponed</span>` : c.done ? html`<span class="md-flag">${{ pending: "Pending", walkover: "Walkover" }[c.label] ?? "Result"}</span>` : c.hasFrames ? "" : liveSoonTag({ starts_at: c.when, status: c.status ?? "scheduled" })}<span>${dayOf(c)}, ${c.title}${c.walkover ? `, walkover to ${c.walkover}` : c.venue?.name ? `, ${c.venue.name}` : ""}</span></span>
        </a>`))}</div>
      ${cards.length > LIST_MAX ? html`<a class="md-more" href="/calendar">${cards.length - LIST_MAX} more on the calendar</a>` : ""}`;
  }

  // Round 84 (Rich): no ‹ › beside the calendar — round buttons sit on the strip's left and right edges instead, and
  // the calendar is a bigger button of its own.
  const head = html`<div class="strip-head"><h3>Live & upcoming matches</h3>
      <span class="strip-ctrl"><a class="strip-cal" href="/calendar">${calIcon}<span>Calendar</span></a></span></div>
    ${filters}${toggle ? html`<div class="strip-filters">${toggle}</div>` : ""}`;
  if (!cards.length) return html`${stripColours(site)}${filters || toggle ? head : ""}<div class="strip-empty">${mine ? `No matches coming up for ${mineLabel} just now.`
    : f.comp || f.team ? "No matches for that choice just now." : "No matches coming up."} <a href="/calendar">See the calendar</a></div>`;
  // Round 84 (Rich): each match reads like a scoreline — name, club badge, the score (or the time), club badge, name —
  // with the team or league in grey under each name. A team with no emblem of its own shows its club's (the venue's).
  const clubLogo = (t) => (t && !t.logo_url ? venues.find((v) => v.id === t.venue_id)?.logo_url || "" : "");
  const face = (s) => (s.player ? avatar(s.player, "avatar sc-face") : s.team ? badge({ ...s.team, logo_url: s.team.logo_url || clubLogo(s.team) }) : html`<span class="badge">${s.name.slice(0, 2).toUpperCase()}</span>`);
  const subOf = (s) => (s.player?.team_id ? team.get(s.player.team_id)?.name ?? "" : "");
  // Round 85: each side also carries its own score, so on a phone (narrow cards, two and a half to a screen) the card
  // reads as two rows — badge, name, score — like a scoreboard. Computers keep the score in the middle.
  const rowScore = (c, k) => {
    if (c.postponed || c.walkover || !(c.hasFrames || c.done)) return "";
    const h = Number(c.score?.home), a = Number(c.score?.away), mine = k === "home" ? h : a, theirs = k === "home" ? a : h, over = c.done && h !== a;
    return html`<b class="sc-row-score ${over ? (mine > theirs ? "w" : "l") : ""}">${k === "home" ? c.score.home : c.score.away}</b>`;
  };
  const side = (s, end, c) => html`<div class="sc-side ${end}">${face(s)}<span class="sc-name"><b>${s.name}</b>${subOf(s) ? html`<small>${subOf(s)}</small>` : ""}</span>${rowScore(c, end)}</div>`;
  return html`${stripColours(site)}${head}
    <div class="strip-view">
    <button type="button" class="edge-btn prev" data-strip-move="-1" aria-label="Previous matches">${chevLeft}</button>
    <div class="strip-row">${cards.map((c) => (c.draw ? html`<a class="strip-card is-draw ${c.live ? "is-live" : ""}" href="${c.href}">
      <div class="sc-top"><span>${ukDay(c.when) === todayUK() ? "Today" : fmtDay(c.when)}</span><span class="sc-comp">${c.title}</span></div>
      <div class="sc-draw">${c.live ? html`<span class="live-dot">Live draw</span>` : html`<b>The draw</b>`}<p>${c.text}</p></div>
      <div class="sc-foot">${c.foot}</div></a>` : html`<a class="strip-card ${c.live ? "is-live" : ""}" href="${c.href}">
      <div class="sc-top"><span>${ukDay(c.when) === todayUK() ? "Tonight" : fmtDay(c.when)}</span><span class="sc-comp">${c.title}</span></div>
      <div class="sc-body ${c.hasFrames || c.done ? "has-score" : ""}">${side(c.a, "home", c)}
        <div class="sc-mid">${c.postponed ? html`<b>P - P</b>` : c.walkover ? html`<b>W/O</b>` : c.hasFrames || c.done ? scoreTiles(c) : html`<b class="time">${fmtTime(c.when)}</b>`}
          ${c.postponed ? html`<span class="sc-label postponed">Postponed</span>` : c.live ? html`<span class="live-dot">Live</span>` : c.done ? html`<span class="sc-label ${c.label ?? "completed"}">${{ pending: "Pending", walkover: "Walkover" }[c.label] ?? "Completed"}</span>` : c.hasFrames ? "" : liveSoonTag({ starts_at: c.when, status: c.status ?? "scheduled" })}</div>
        ${side(c.b, "away", c)}</div>
      <div class="sc-foot">${c.walkover ? `Walkover to ${c.walkover}` : c.venue?.name ?? ""}</div>
    </a>`))}</div>
    <button type="button" class="edge-btn next" data-strip-move="1" aria-label="Next matches">${chevRight}</button>
    </div>`;
}

/** Round 73 (the new look): the score as two tiles, like a scoreboard — the winner's green once the match is over. */
function scoreTiles(c) {
  const h = Number(c.score?.home), a = Number(c.score?.away), over = c.done && h !== a;
  return html`<b class="sc-tiles"><i class="${over ? (h > a ? "w" : "l") : ""}">${c.score.home}</i><i class="${over ? (a > h ? "w" : "l") : ""}">${c.score.away}</i></b>`;
}

/**
 * Round 38: the strip's label colours from Site settings, as CSS variables (empty = the standard colour).
 * The writing on each label turns black or white, whichever reads better on the colour chosen.
 */
function stripColours(site) {
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v ?? "") ? v : null);
  const ink = (c) => { const n = parseInt(c.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111" : "#fff"; };
  const vars = [["live", site.strip_live_color], ["soon", site.strip_soon_color], ["done", null /* round 115 (Rich): Completed is always the site green */], ["pending", /^#f2b705$/i.test(site.strip_pending_color ?? "") ? null : site.strip_pending_color], ["postponed", site.strip_postponed_color], ["walkover", site.strip_walkover_color]]
    .filter(([, c]) => hex(c)).map(([k, c]) => `--strip-${k}:${c};--strip-${k}-ink:${ink(c)}`).join(";");
  return vars ? html`<style>[data-strip]{${vars}}</style>` : "";
}

// ── shields, spotlights, CueViews ─────────────────────────────
function shieldsBox(ctx) {
  const shields = ctx.leagues.filter((l) => l.shield_team_id).map((l) => ({ l, ...shieldHolder(l, ctx.fixtures, ctx.framesByFixture) }));
  if (!shields.length) return "";
  // One slim row for each shield: its picture (small), who holds it and since when. The whole row opens the shield's history.
  return panel("Shield holders", html`<div class="shield-rows">${shields.map(({ l, holderId, since, history }) => {
    const t = ctx.team.get(holderId);
    const defences = history.filter((h) => h.to === holderId && h.defended && (!since || h.fixture.starts_at > since.starts_at)).length;
    return html`<a class="shield-row" href="${urls.shield(l)}" title="See where the ${l.shield_name || "shield"} has been this season">
      ${shieldPicture(l)}
      <div><small>${l.shield_name || `${l.name} Runabout Shield`}</small>
        <strong>${t ? badge(t) : ""}<span>${t?.name ?? "–"}</span></strong>
        <em>${since ? `Won ${fmtDate(since.starts_at)}` : "Holders since the start of the season"}${defences ? ` · ${defences} defence${defences > 1 ? "s" : ""}` : ""}</em></div>
      <i aria-hidden="true">›</i>
    </a>`;
  })}</div>`);
}

const spotForm = (f) => (f?.n ? html`<span class="spot-form">${formChips(f, { links: false })}</span>` : "");
const spotScore = (f) => (f?.n ? html`<span class="spot-score"><small>Form</small>${formBadge(f, { big: true, trend: true })}</span>` : "");
function spotlights(ctx, site, { months = true } = {}) {
  // Player and team of the week, and (round 25) of the month — each a slim card with their form.
  const cards = [
    ["player", "week"], ["team", "week"], ["player", "month"], ["team", "month"],
  ].map(([kind, span]) => {
    if (!site[`${kind}_of_${span}_show`] || (span === "month" && !months)) return null;
    const who = ctx[kind].get(site[`${kind}_of_${span}_id`]);
    if (!who) return null;
    const text = site[`${kind}_of_${span}_text`], label = `${kind === "player" ? "Player" : "Team"} of the ${span}`;
    const f = ctx.form?.[kind](who.id);
    return kind === "player"
      ? html`<a class="spotlight spot-${span}" href="${urls.player(who)}">${avatar(who, "spot-photo")}
          <div><span class="spot-label">${label}</span><strong>${who.full_name}</strong><small>${ctx.team.get(who.team_id)?.name ?? ""}</small>${text ? html`<p>${text}</p>` : ""}${spotForm(f)}</div>${spotScore(f)}</a>`
      : html`<a class="spotlight spot-${span}" href="${urls.team(who)}"><span class="spot-badge">${badge(who)}</span>
          <div><span class="spot-label">${label}</span><strong>${who.name}</strong><small>${ctx.league.get(who.league_id)?.name ?? ""}</small>${text ? html`<p>${text}</p>` : ""}${spotForm(f)}</div>${spotScore(f)}</a>`;
  }).filter(Boolean);
  if (!cards.length) return "";
  // A slim card each (picture on the left, the words beside it), so they take little room on a phone.
  return html`<div class="spotlights ${cards.length === 4 ? "four" : ""}">${cards}</div>`;
}

/**
 * CueViews picked for the home page: players' own, and interviews attached to news articles.
 * Kept small — the photo, the name and a "Q&A" mark with how many questions were answered; the answers
 * themselves are one tap away on the player's page (or the article).
 */
/**
 * Round 108 (Rich): four promotions in a row under Competitions — sign up to the newsletter, send us your CueView, and
 * the player and team of the month (Admin → Site settings → Player / Team of the month).
 */
// Round 110 (Rich: "new icons needed for Player and Team of the month"): a player with a star, and a team of three.
const POTM_ICON = "M10 2.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4ZM2.2 21c0-4.4 3.5-7.6 7.8-7.6 1.4 0 2.6.3 3.7.9L13 21ZM18.2 13.0L19.4 16.0L22.6 16.2L20.1 18.2L20.9 21.3L18.2 19.6L15.5 21.3L16.3 18.2L13.8 16.2L17.0 16.0Z";
const TOTM_ICON = "M12 3.6a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6ZM5.4 6.6a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM18.6 6.6a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM6.2 20.4c0-3.6 2.6-6.4 5.8-6.4s5.8 2.8 5.8 6.4ZM.8 19.4c0-2.8 2-4.9 4.6-4.9.8 0 1.5.2 2.1.5-1.1 1.2-1.8 2.7-2 4.4ZM23.2 19.4c0-2.8-2-4.9-4.6-4.9-.8 0-1.5.2-2.1.5 1.1 1.2 1.8 2.7 2 4.4Z";
function promoColumns(ctx, site) {
  const pIco = (d) => html`<span class="sb-promo4__ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></span>`;
  const player = site.player_of_month_show !== false ? ctx.player.get(site.player_of_month_id) : null;
  const team = site.team_of_month_show !== false ? ctx.team.get(site.team_of_month_id) : null;
  const pf = player && ctx.form?.player(player.id), tf = team && ctx.form?.team(team.id);
  return html`<div class="sb-promo4">
    <a class="sb-promo4__card sb-promo4__card--news" href="/newsletter" data-newsletter-open>
      ${pIco("M3 5h18v14H3Zm2 2v.5l7 4.5 7-4.5V7Zm14 2.8-7 4.5-7-4.5V17h14Z")}
      <span class="sb-kicker">Newsletter</span><b class="sb-promo4__title">Sign up to the newsletter</b>
      <span class="sb-promo4__text">Results, draws and league news in your inbox. Unsubscribe any time.</span>
      <span class="sb-btn sb-btn--primary">Sign up</span></a>
    <a class="sb-promo4__card sb-promo4__card--cue" href="/cueview">
      ${pIco("M4 4h16v12H9.5L5 20v-4H4Zm4.2 3.2v2h7.6v-2Zm0 3.6v2h5.2v-2Z")}
      <span class="sb-kicker">CueView</span><b class="sb-promo4__title">Send us your CueView</b>
      <span class="sb-promo4__text">Answer our questions and tell the league about your game, your cue and your best break.</span>
      <span class="sb-btn sb-btn--yellow">Send yours</span></a>
    <a class="sb-promo4__card sb-promo4__card--potm" href="${player ? urls.player(player) : "/form"}">
      ${player ? html`<span class="sb-promo4__face">${avatar(player, "avatar")}</span>` : pIco(POTM_ICON)}
      <span class="sb-kicker">Player of the month</span><b class="sb-promo4__title">${player?.full_name ?? "Coming soon"}</b>
      <span class="sb-promo4__text">${player ? site.player_of_month_text || ctx.team.get(player.team_id)?.name || "" : "Chosen at the end of each month. See who's in form now."}</span>
      ${pf?.n ? html`<span class="sb-promo4__form">${formChips(pf, { links: false })}</span>` : html`<span class="sb-btn sb-btn--outline">${player ? "View player" : "Form guide"}</span>`}</a>
    <a class="sb-promo4__card sb-promo4__card--totm" href="${team ? urls.team(team) : "/league"}">
      ${team ? html`<span class="sb-promo4__face">${crestOf(ctx, team)}</span>` : pIco(TOTM_ICON)}
      <span class="sb-kicker">Team of the month</span><b class="sb-promo4__title">${team?.name ?? "Coming soon"}</b>
      <span class="sb-promo4__text">${team ? site.team_of_month_text || ctx.league.get(team.league_id)?.name || "" : "Chosen at the end of each month from the league tables."}</span>
      ${tf?.n ? html`<span class="sb-promo4__form">${formChips(tf, { links: false })}</span>` : html`<span class="sb-btn sb-btn--outline">${team ? "View team" : "League tables"}</span>`}</a>
  </div>`;
}

const qaIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9.5L5 20v-4H4Zm4.2 3.2v2h7.6v-2Zm0 3.6v2h5.2v-2Z"/></svg>`;
function cueviewBox(ctx, news) {
  // Interviews from the news come first (newest first), then the featured players.
  const cards = [
    ...news.filter((a) => a.cueview_featured && articleCueview(a).length).map((a) => ({
      href: `${urls.article(a)}#cueview`, photo: html`<img class="cv-photo" src="${articleThumb(a) || "/assets/avatar.svg"}" alt="" loading="lazy">`,
      name: a.cueview_name || a.title, sub: "Interview", n: articleCueview(a).length })),
    ...ctx.players.filter((p) => p.cueview_featured && answered(p).length).map((p) => ({
      href: `${urls.player(p)}#cueview`, photo: avatar(p, "cv-photo"), name: p.full_name, sub: ctx.team.get(p.team_id)?.name ?? "",
      n: answered(p).filter((q) => q.key !== "biography").length })),
  ];
  if (!cards.length) return "";
  return panel("CueView", html`<div class="cv-row">${cards.slice(0, 6).map((c) => html`<a class="cv-chip" href="${c.href}" title="Read ${c.name}'s CueView">
      ${c.photo}<div><strong>${c.name}</strong><small>${c.sub}</small></div>
      <span class="cv-qa" aria-label="${c.n} question${c.n === 1 ? "" : "s"} answered">${qaIcon}<b>${c.n}</b></span></a>`)}</div>`);
}
