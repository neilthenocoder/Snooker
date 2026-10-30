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
import { matchScore, shieldHolder } from "../core/rules.js";
import { buildBracket, isEntry, walkoverSide } from "../core/bracket.js";
import { answered, articleCueview } from "../core/cueview.js";
import { leagueTablePanel, sidebar, panel, picture, urls, badge, avatar, articleThumb, shortName, latestNews, trophy, shieldPicture } from "../core/components.js";
import { SITE } from "../config.js";
import { setTitle, adminEdit } from "../core/router.js";
import { competitionSummaries } from "./competitions.js";
import { loadForm, formBadge, formChips } from "../core/form.js";
import { liveSoonTag, compBoxStyle } from "../core/components.js";
import { homeSections, isOffSeason, promoBlock, mySnookerPrompt, newsBlock, compsBlock, teamsBlock } from "../core/home-blocks.js";

const ROTATE_MS = 7000;      // banner: time each article is shown
const CAROUSEL_MS = 4500;    // live strip: time before it moves on one card
const FEATURE_MS = 6000;     // feature box (when it shows one message at a time): time each one is shown

// The four quick links under the hero: one slim row (see the v13 block in style.css).
const qi = (d) => html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const quickIcon = {
  competitions: qi("M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v2H8v-2h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3Zm0 4H6v1a2 2 0 0 0 1 1.7Zm10 0v2.7A2 2 0 0 0 18 8V7Z"),
  calendar: qi("M7 2h2v2h6V2h2v2h3v17H4V4h3Zm11 8H6v9h12Zm0-4H6v2h12Z"),
  handicaps: qi("M4 7h3V4h2v3h3v2H9v3H7V9H4Zm9 9h7v2h-7Zm4.6-11.5 1.6 1.2-11 14.6-1.6-1.2Z"),
  fixtures: qi("M4 5h16v2H4Zm0 6h16v2H4Zm0 6h10v2H4Z"),
  // Round 53 (Rich): League tables, Rankings, Breaks — "as important as the 4 buttons" — and Results, so there are two even rows.
  results: qi("M4 4h16v16H4Zm2 2v12h12V6Zm2 2h3v3H8Zm5 1h3v1h-3Zm-5 4h3v3H8Zm5 1h3v1h-3Z"),
  tables: qi("M3 4h18v16H3Zm2 2v3h14V6Zm0 5v3h4v-3Zm6 0v3h8v-3Zm-6 5v2h4v-2Zm6 0v2h8v-2Z"),
  rankings: qi("M4 20V10h4v10Zm6 0V4h4v16Zm6 0v-7h4v7Z"),
  breaks: qi("M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"),
};

export default async function home(view, { user } = {}) {
  setTitle("");
  adminEdit("settings", null, { label: "Edit home page" });
  const [ctx, news, allComps, site, box, notices, dates] = await Promise.all([seasonContext(), articles(), competitionSummaries({ current: true }), settings(), sideBoxData(),
    table("announcements", "sort").catch(() => []), table("key_dates", "starts_on").catch(() => [])]);
  // Form (Rich, round 25) beside the player and team of the week.
  if (site.player_of_week_show || site.team_of_week_show || site.player_of_month_show || site.team_of_month_show) ctx.form = await loadForm(ctx).catch(() => null);
  const today = todayUK();
  const entering = openForEntry(allComps.map((x) => x.c));
  const slides = news.filter((a) => a.featured).slice(0, Math.max(1, site.hero_count || 4));
  // This season's competitions (ones with no season set count as current).
  const comps = allComps.filter(({ c }) => !c.season_id || c.season_id === ctx.season?.id);
  view.classList.add("flush");
  // Round 48 (Neil's idea, Rich agreed to try it): logged in and following a team or a player → the home page IS
  // their My Snooker: the live strip and the quick links stay on top, then their own sections in their own order.
  // "Normal home page" (/?home=1) shows everyone's home page once.
  // Round 52 (Neil): the home page is the same for everyone again; My Snooker is its own page (/mysnooker, pages/myteam.js).
  const personal = false;
  // Round 47 (Rich): the standard home page — news and promotion first, the blocks and their order chosen in Site settings.
  // "Everything" is the earlier home page with all the tables (Site settings → Home page → Home page style).
  const standard = site.home_style !== "full";
  const sections = homeSections(site);
  const on = (key) => sections.find((x) => x.key === key)?.on;
  const promoWanted = site.promo_mode === "always" || (site.promo_mode !== "never" && isOffSeason(ctx, allComps));
  const compData = standard && on("competitions") ? await currentCompetitions().catch(() => null) : null;
  const block = {
    promo: () => (promoWanted ? promoBlock(site, ctx, dates, today) : ""),
    mysnooker: () => mySnookerPrompt(user, ctx),
    news: () => newsBlock(news, slides.map((a) => a.id)),
    competitions: () => (compData ? compsBlock(comps, compData) : ""),
    spotlights: () => spotlights(ctx, site),
    teams: () => teamsBlock(ctx),
    cueviews: () => (site.cueviews_show !== false ? cueviewBox(ctx, news) : ""),
    tables: () => html`${ctx.leagues.map((l) => leagueTablePanel(ctx, l, { limit: 10 }))}`,
    shields: () => (site.shields_show !== false ? shieldsBox(ctx) : ""),
  };
  // The home page is the same for everyone (My Snooker is a page of its own, in the menu).

  mount(view, html`
    ${personal ? html`<section class="hero hero-personal"><div class="live-strip-wrap ${["red", "yellow", "grey"].includes(site.strip_line ?? "red") ? `strip-line-${site.strip_line ?? "red"}` : ""}"><div class="wrap"><div class="live-strip" data-strip></div></div></div></section>` : html`
    <section class="hero hero-l-${heroLayout(site)}" style="${site.hero_image_url && heroLayout(site) !== "white" ? `--hero-img:${cssUrl(site.hero_image_url)};` : ""}${/^#[0-9a-f]{6}$/i.test(site.hero_bg ?? "") ? `--hero-bg:${site.hero_bg}` : ""}">
      ${heroLayout(site) === "big" ? html`<div class="hero-bgs" aria-hidden="true">${slides.map((a, i) => html`<div class="hero-bg ${i ? "" : "on"}" style="${a.image_url || a.circle_image_url ? `background-image:${cssUrl(a.image_url || a.circle_image_url)}` : ""}"></div>`)}</div>` : ""}
      <div class="wrap hero-inner">
        <div class="hero-slides" data-slides><div class="hero-track" data-track>
          ${slides.length ? slides.map((a, i) => heroSlide(a, i === 0, heroLayout(site) === "white" && slides.length > 1 ? { at: i, of: slides.length } : null)) : html`<div class="hero-slide on"><div class="hero-text"><h2><span>${SITE.name}</span></h2><p class="hero-meta">Established ${SITE.established}</p></div></div>`}
        </div></div>
        ${slides.length > 1 && heroLayout(site) !== "white" ? html`<div class="hero-dots">${slides.map((_, i) => html`<button class="${i ? "" : "on"}" data-dot="${i}" aria-label="Show article ${i + 1}"></button>`)}</div>` : ""}
      </div>
      <div class="live-strip-wrap ${["red", "yellow", "grey"].includes(site.strip_line ?? "red") ? `strip-line-${site.strip_line ?? "red"}` : ""}"><div class="wrap"><div class="live-strip" data-strip></div></div></div>
    </section>
    `}
    <div class="${personal ? "wrap ms-homepage" : "wrap layout"}" style="margin-top:${personal ? 24 : 30}px">
      <div class="stack">
        <div class="home-top">
        <div class="hb-head ql-head"><h2>Quick links</h2></div>
        <nav class="quick-links ql-8" aria-label="Quick links">
          <a style="background:var(--green)" href="/fixtures">${quickIcon.fixtures}<span>Fixtures</span></a>
          <a style="background:var(--red)" href="/results">${quickIcon.results}<span>Results</span></a>
          <a style="background:var(--blue)" href="${urls.season(ctx.season, "league-tables")}">${quickIcon.tables}<span>League tables</span></a>
          <a style="background:var(--red)" href="${urls.season(ctx.season, "rankings")}">${quickIcon.rankings}<span>Rankings</span></a>
          <a style="background:var(--green)" href="${urls.season(ctx.season, "breaks")}">${quickIcon.breaks}<span>Breaks</span></a>
          <a style="background:var(--yellow);color:#1b0e06" href="/competitions">${quickIcon.competitions}<span>Competitions</span></a>
          <a style="background:var(--red)" href="/calendar">${quickIcon.calendar}<span>Calendar</span></a>
          <a style="background:var(--blue)" href="/handicaps">${quickIcon.handicaps}<span>Handicaps</span></a>
        </nav>
        ${myBtn(user, ctx)}
        ${featureBox(site, notices, today)}
        ${user ? deadlineBar(deadlineWarnings(user, ctx, await currentCompetitions().catch(() => ({ competitions: [], entries: [], matches: [] })), site)) : ""}
        ${entering.length ? html`<a class="enter-bar" href="/enter"><b>Entries are open</b> for ${entering.map((c) => c.name).join(", ")} <span>Enter now →</span></a>` : ""}
        ${keyDates(site, dates, allComps.map((x) => x.c), today)}
        </div>
        ${personal ? html`<div data-ms-home></div>` : standard ? html`${sections.filter((x) => x.on).map((x) => block[x.key]?.() ?? "")}` : html`
        ${ctx.leagues.map((l) => leagueTablePanel(ctx, l, { limit: 10 }))}
        ${site.shields_show !== false ? shieldsBox(ctx) : ""}
        ${spotlights(ctx, site)}
        ${site.cueviews_show !== false ? cueviewBox(ctx, news) : ""}
        ${panel("Latest Competitions", html`<div class="list-rows comp-cols" style="background:var(--cream)">
          ${comps.length ? comps.map(({ c, season, progress }) => html`<a href="${urls.competition(c)}">${compBoxStyle(c) !== "trophy" ? html`<span class="cc-pic">${picture(c.image_url)}</span>` : html`<div class="ph trophy-ph">${trophy(c)}</div>`}<div><strong>${c.name}</strong><small>${c.kind}${season ? ` · ${season.name}` : ""}</small><span class="cc-prog">${progress}</span></div></a>`)
            : html`<div class="empty">No competitions yet.</div>`}
        </div>`, { color: "yellow", href: "/competitions" })}`}
      </div>
      ${personal ? "" : sidebar(ctx, latestNews(news, site, slides.map((a) => a.id)), { count: site.latest_news_count || 1, box,
        breaks: !standard || on("side_breaks"), rankings: !standard || on("side_rankings") })}
    </div>`);

  // The guide: the first time someone sees their own home page, or straight after "Show me around".
  maybeStartGuide({ personal, site });
  // Captains and vice captains: the "Manage team" box at the bottom of the screen in the days before a match.
  const stopSquad = await mountSquadBox(user, ctx, site).catch(() => () => {});

  // Rotate the banner articles (pauses while the mouse is over it).
  const slideEls = $$(".hero-slide", view), dots = $$("[data-dot]", view);
  let current = 0, paused = false;
  // Round 74 (Neil & Rich): the stories sit side by side on a track — no fade-in. The track follows a finger (or the
  // mouse) as it is dragged, and lets go onto the next or previous story; the automatic turn slides it along too.
  const track = $("[data-track]", view), heroBox = $("[data-slides]", view);
  const place = (px = 0, animate = true) => {
    if (!track) return;
    track.style.transition = animate ? "transform .5s cubic-bezier(.22, .7, .2, 1)" : "none";
    track.style.transform = `translate3d(calc(${-current * 100}% + ${px}px), 0, 0)`;
  };
  const show = (i) => {
    current = (i + slideEls.length) % slideEls.length;
    slideEls.forEach((s, j) => { s.classList.toggle("on", j === current); s.setAttribute("aria-hidden", String(j !== current)); });
    $$(".hero-bg", view).forEach((s, j) => s.classList.toggle("on", j === current));
    dots.forEach((d) => d.classList.toggle("on", Number(d.dataset.dot) === current));
    place(0, true);
  };
  place(0, false);
  // The dots in the white card are drawn into every slide, so they're found by click instead of up front.
  $(".hero-inner", view)?.addEventListener("click", (e) => { const d = e.target.closest("[data-dot]"); if (d) show(Number(d.dataset.dot)); });
  if (heroBox && track && slideEls.length > 1) {
    let drag = null, dragged = false;
    heroBox.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest("[data-dot]")) return;
      drag = { x: e.clientX, y: e.clientY, t: performance.now(), w: heroBox.clientWidth || 1, id: e.pointerId, on: false, dx: 0 };
      dragged = false;
    });
    heroBox.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }     // scrolling the page up or down
        drag.on = true; dragged = true; paused = true; heroBox.classList.add("dragging");
        try { heroBox.setPointerCapture(e.pointerId); } catch { /* fine */ }
      }
      // A little resistance past the first and last story.
      const edge = (current === 0 && dx > 0) || (current === slideEls.length - 1 && dx < 0);
      drag.dx = edge ? dx / 3 : dx;
      place(drag.dx, false);
      e.preventDefault();
    });
    const end = () => {
      if (!drag) return;
      const d = drag; drag = null; heroBox.classList.remove("dragging");
      if (!d.on) return;
      const fast = Math.abs(d.dx) / Math.max(1, performance.now() - d.t) > 0.45;
      const far = Math.abs(d.dx) > d.w * 0.18 || (fast && Math.abs(d.dx) > 24);
      const next = far ? current + (d.dx < 0 ? 1 : -1) : current;
      show(Math.max(0, Math.min(slideEls.length - 1, next)));
      setTimeout(() => { paused = false; }, ROTATE_MS);
    };
    heroBox.addEventListener("pointerup", end);
    heroBox.addEventListener("pointercancel", end);
    // A drag that started on the headline or picture doesn't open the article.
    heroBox.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
    heroBox.addEventListener("dragstart", (e) => e.preventDefault());
    addEventListener("resize", () => place(0, false), { passive: true });
  }
  $(".hero-inner", view)?.addEventListener("mouseenter", () => { paused = true; });
  $(".hero-inner", view)?.addEventListener("mouseleave", () => { paused = false; });
  const timer = slideEls.length > 1 ? setInterval(() => { if (!paused && !document.hidden) show(current + 1); }, ROTATE_MS) : null;

  // Live & upcoming matches strip, updated live — with the league / competition and team filters (round 52).
  const stopStrip = await mountLiveStrip($("[data-strip]", view), user, { mode: "filters" });

  // The feature box: scrolling like the ticker (at the ticker's speed), or one message at a time.
  const feature = $("[data-feature]", view);
  let featureTimer = null;
  if (feature?.dataset.feature === "scroll") {
    const track = $(".ticker-track", feature), sets = $$(".ticker-set", feature), once = sets[0].innerHTML;
    const pace = Math.max(1, Math.min(10, Math.round(Number(site.ticker_pace) || 3)));
    const setPace = () => {
      // A short list is repeated until it is at least as wide as the box, so the loop never shows a gap.
      for (const s of sets) s.innerHTML = once;
      const times = Math.min(8, Math.ceil($(".ticker-view", feature).clientWidth / Math.max(1, sets[0].getBoundingClientRect().width)));
      if (times > 1) for (const s of sets) s.innerHTML = once.repeat(times);
      track.style.animationDuration = `${Math.max(8, Math.round(sets[0].getBoundingClientRect().width / TICKER_PX[pace - 1]))}s`;
    };
    setPace();
    document.fonts?.ready.then(() => track.isConnected && setPace());
  } else if (feature?.dataset.feature === "rotate") {
    const items = $$(".feature-item", feature);
    let at = 0, held = false;
    feature.addEventListener("mouseenter", () => { held = true; });
    feature.addEventListener("mouseleave", () => { held = false; });
    feature.addEventListener("focusin", () => { held = true; });
    feature.addEventListener("focusout", () => { held = false; });
    featureTimer = setInterval(() => {
      if (held || document.hidden) return;
      items[at].classList.remove("on");
      at = (at + 1) % items.length;
      items[at].classList.add("on");
    }, FEATURE_MS);
  }

  // Key dates: the ‹ › buttons appear only when the dates don't all fit, and slide the row along.
  const kd = $("[data-kd]", view), kdRow = kd && $(".kd-row", kd);
  const kdFit = () => kd?.classList.toggle("can-slide", kdRow.scrollWidth - kdRow.clientWidth > 4);
  if (kd) {
    kdFit();
    document.fonts?.ready.then(() => kd.isConnected && kdFit());
    window.addEventListener("resize", kdFit, { passive: true });
    kd.addEventListener("click", (e) => { const b = e.target.closest("[data-kd-move]"); if (b) kdRow.scrollBy({ left: Number(b.dataset.kdMove) * Math.max(240, kdRow.clientWidth * 0.8), behavior: "smooth" }); });
  }


  return () => { clearInterval(timer); clearInterval(featureTimer); stopStrip(); stopSquad(); window.removeEventListener("resize", kdFit); };
}


/** The banner's layout (Admin → Site settings → Home page banner — Rich, round 23): picture beside, one big picture, or headline only. */
// Round 28: "white" — a white banner, the headline on the left and the picture on the right .
const heroLayout = (site) => (["big", "text", "white"].includes(site.hero_layout) ? site.hero_layout : "side");

/** One banner article: headline, category and date, a small "continue reading" — all linking to the article. */
// dots (round 53, Rich): on the white banner the slider dots sit in the white card, under "Continue reading".
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
  return html`<section class="kd ${list.length > 1 ? "many" : "one"}" aria-label="Key dates" data-kd>
    <a class="kd-label" href="/calendar" title="See everything on the calendar">${kdIcon}<span>Key dates</span><i aria-hidden="true">Calendar →</i></a>
    <div class="kd-row">${list.map((d) => {
      const comp = competitions.find((c) => c.id === d.competition_id);
      const href = safeHref(d.url) || (comp ? urls.competition(comp) : "/calendar");
      // One line under the title: how long to go, the day, the last day (if it runs on) and the details.
      const more = [part(d.starts_on, { weekday: "short" }), d.ends_on && d.ends_on !== d.starts_on ? `until ${part(d.ends_on, { weekday: "short", day: "numeric", month: "short" }).replace(",", "")}` : "", d.details ?? ""].filter(Boolean).join(" · ");
      return html`<a class="kd-item" href="${href}" ${/^https?:\/\//.test(href) ? html`target="_blank" rel="noopener"` : ""} title="${d.title} — ${when(d)}${more ? `, ${more}` : ""}">
        <time datetime="${d.starts_on}"><b>${part(d.starts_on, { day: "numeric" })}</b><span>${part(d.starts_on, { month: "short" })}</span></time>
        <div><strong>${d.title}</strong><small><em class="${days(d.starts_on) <= 1 ? "soon" : ""}">${when(d)}</em>${more}</small></div></a>`;
    })}</div>
    ${list.length > 1 ? html`<span class="kd-nav"><button type="button" data-kd-move="-1" aria-label="Earlier key dates">‹</button><button type="button" data-kd-move="1" aria-label="More key dates">›</button></span>` : ""}
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
export async function mountLiveStrip(el, user, { mode = "filters" } = {}) {
  const draw = async () => mount(el, await liveStrip(user, mode));
  await draw();
  const unsubscribe = subscribe(["fixtures", "frames", "competition_matches", "competitions", "live_matches"], draw);
  let paused = false;
  const move = (dir) => {
    const row = $(".strip-row", el);
    if (!row) return;
    const stepPx = ($(".strip-card", row)?.offsetWidth ?? 230) + 10;
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
    const step = ($(".strip-card", row)?.offsetWidth ?? 230) + 10;
    row.scrollTo({ left: Math.round(row.scrollLeft / step) * step, behavior: "smooth" });
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
  el.addEventListener("dragstart", (e) => { if (e.target.closest(".strip-row")) e.preventDefault(); });
  el.addEventListener("click", (e) => {
    if (dragged && e.target.closest(".strip-row")) { e.preventDefault(); e.stopPropagation(); dragged = false; return; }
    dragged = false;
    const b = e.target.closest("[data-strip-move]"); if (b) return move(Number(b.dataset.stripMove));
    const t = e.target.closest("[data-strip-mine]");
    if (t) { try { localStorage.setItem(STRIP_MINE, t.dataset.stripMine); } catch { /* not remembered */ } draw(); }
  });
  el.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-strip-filter]");
    if (!sel) return;
    setStripFilter({ ...stripFilter(), [sel.dataset.stripFilter]: sel.value });
    draw();
  });
  const carousel = setInterval(() => { if (!paused && !document.hidden) move(1); }, CAROUSEL_MS);
  return () => { clearInterval(carousel); unsubscribe(); };
}

async function liveStrip(user = null, mode = "filters") {
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
      key: `l:${fx.league_id}`, when: fx.starts_at, status: fx.status, live: fx.status === "in_progress", done: ["submitted", "approved"].includes(fx.status), doneAt: fx.result_at && fx.result_at > fx.starts_at ? fx.result_at : fx.starts_at,
      label: fx.status === "submitted" ? "pending" : fx.status === "approved" ? "completed" : fx.status === "postponed" ? "postponed" : null,
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
        key: `c:${c.id}`, when: m.starts_at ?? m.result_at ?? new Date().toISOString(), status: m.status, live: m.status === "in_progress", done: m.status === "completed", title: c.name, cup: true,
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
    <button type="button" data-strip-mine="0" aria-pressed="${mine ? "false" : "true"}">All</button><button type="button" data-strip-mine="1" aria-pressed="${mine ? "true" : "false"}">${mineLabel}</button></span>` : "";
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

  const head = html`<div class="strip-head"><h3>Live & upcoming matches</h3>
      <span class="strip-ctrl"><span class="strip-arrows"><button type="button" data-strip-move="-1" aria-label="Previous matches">‹</button><button type="button" data-strip-move="1" aria-label="Next matches">›</button></span>
        <a href="/calendar">Calendar →</a></span></div>
    ${filters}${toggle ? html`<div class="strip-filters">${toggle}</div>` : ""}`;
  if (!cards.length) return html`${stripColours(site)}${filters || toggle ? head : ""}<div class="strip-empty">${mine ? `No matches coming up for ${mineLabel} just now.`
    : f.comp || f.team ? "No matches for that choice just now." : "No matches coming up."} <a href="/calendar">See the calendar</a></div>`;
  const face = (s) => (s.player ? avatar(s.player, "avatar sc-face") : s.team ? badge(s.team) : html`<span class="badge">${s.name.slice(0, 2).toUpperCase()}</span>`);
  const side = (s) => html`<div class="sc-side">${face(s)}<span>${s.name}</span></div>`;
  return html`${stripColours(site)}${head}
    <div class="strip-row">${cards.map((c) => (c.draw ? html`<a class="strip-card is-draw ${c.live ? "is-live" : ""}" href="${c.href}">
      <div class="sc-top"><span>${ukDay(c.when) === todayUK() ? "Today" : fmtDay(c.when)}</span><span class="sc-comp">${c.title}</span></div>
      <div class="sc-draw">${c.live ? html`<span class="live-dot">Live draw</span>` : html`<b>The draw</b>`}<p>${c.text}</p></div>
      <div class="sc-foot">${c.foot}</div></a>` : html`<a class="strip-card ${c.live ? "is-live" : ""}" href="${c.href}">
      <div class="sc-top"><span>${ukDay(c.when) === todayUK() ? "Tonight" : fmtDay(c.when)}</span><span class="sc-comp">${c.title}</span></div>
      <div class="sc-body">${side(c.a)}
        <div class="sc-mid">${c.postponed ? html`<b>P - P</b>` : c.walkover ? html`<b>W/O</b>` : c.hasFrames || c.done ? scoreTiles(c) : html`<b class="time">${fmtTime(c.when)}</b>`}
          ${c.postponed ? html`<span class="sc-label postponed">Postponed</span>` : c.live ? html`<span class="live-dot">Live</span>` : c.done ? html`<span class="sc-label ${c.label ?? "completed"}">${{ pending: "Pending", walkover: "Walkover" }[c.label] ?? "Completed"}</span>` : c.hasFrames ? "" : liveSoonTag({ starts_at: c.when, status: c.status ?? "scheduled" })}</div>
        ${side(c.b)}</div>
      <div class="sc-foot">${c.walkover ? `Walkover to ${c.walkover}` : c.venue?.name ?? ""}</div>
    </a>`))}</div>`;
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
  const vars = [["live", site.strip_live_color], ["soon", site.strip_soon_color], ["done", site.strip_done_color], ["pending", site.strip_pending_color], ["postponed", site.strip_postponed_color], ["walkover", site.strip_walkover_color]]
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
function spotlights(ctx, site) {
  // Player and team of the week, and (round 25) of the month — each a slim card with their form.
  const cards = [
    ["player", "week"], ["team", "week"], ["player", "month"], ["team", "month"],
  ].map(([kind, span]) => {
    if (!site[`${kind}_of_${span}_show`]) return null;
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
