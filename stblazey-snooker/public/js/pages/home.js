import { html, mount, $, $$, fmtDate, fmtTime, cssUrl, ukDay, todayUK } from "../core/dom.js";
import { TICKER_PX } from "../core/branding.js";
import { sideName, matchLabel } from "../core/live-score.js";
import { openForEntry } from "./enter.js";
import { seasonContext, sideBoxData } from "../core/context.js";
import { articles, settings, upcomingMatches, loadCompetitions, subscribe, table, liveMatches } from "../core/api.js";
import { matchScore, shieldHolder } from "../core/rules.js";
import { buildBracket, isEntry } from "../core/bracket.js";
import { answered, articleCueview } from "../core/cueview.js";
import { leagueTablePanel, sidebar, panel, picture, urls, badge, avatar, articleThumb, shortName, latestNews, trophy } from "../core/components.js";
import { SITE } from "../config.js";
import { setTitle, adminEdit } from "../core/router.js";
import { mySnookerOn, mySnookerTeamId, mySnookerSetUp, mySnookerOnHome, mySnookerOwnPage } from "../core/auth.js";
import { mountMySnooker, mySnookerStar } from "../core/my-snooker.js";
import { competitionSummaries } from "./competitions.js";

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
};

export default async function home(view, { user } = {}) {
  setTitle("");
  adminEdit("settings", null, { label: "Edit home page" });
  const [ctx, news, allComps, site, box, notices, dates] = await Promise.all([seasonContext(), articles(), competitionSummaries(), settings(), sideBoxData(),
    table("announcements", "sort").catch(() => []), table("key_dates", "starts_on").catch(() => [])]);
  const today = todayUK();
  const entering = openForEntry(allComps.map((x) => x.c));
  const slides = news.filter((a) => a.featured).slice(0, Math.max(1, site.hero_count || 4));
  // This season's competitions (ones with no season set count as current).
  const comps = allComps.filter(({ c }) => !c.season_id || c.season_id === ctx.season?.id);
  view.classList.add("flush");
  // My Snooker at the top of the home page, for those who chose to have it here.
  const onHome = mySnookerOnHome(user);

  mount(view, html`
    <section class="hero" style="${site.hero_image_url ? `--hero-img:${cssUrl(site.hero_image_url)}` : ""}">
      <div class="wrap hero-inner">
        <div class="hero-slides" data-slides>
          ${slides.length ? slides.map((a, i) => heroSlide(a, i === 0)) : html`<div class="hero-slide on"><div class="hero-text"><h2><span>${SITE.name}</span></h2><p class="hero-meta">Established ${SITE.established}</p></div></div>`}
        </div>
        ${slides.length > 1 ? html`<div class="hero-dots">${slides.map((_, i) => html`<button class="${i ? "" : "on"}" data-dot="${i}" aria-label="Show article ${i + 1}"></button>`)}</div>` : ""}
      </div>
      <div class="live-strip-wrap"><div class="wrap"><div class="live-strip" data-strip></div></div></div>
    </section>
    ${onHome ? html`<div class="wrap" style="margin-top:30px"><section class="ms ms-home" aria-label="My Snooker">
      <header class="ms-home-head"><h2>${mySnookerStar} My Snooker</h2>
        <span class="btn-row">${mySnookerOwnPage(user) ? html`<a class="btn small ghost" href="/myteam">Open my page</a>` : ""}<a class="btn small ghost" href="/my/snooker">Change what I see</a></span></header>
      <div data-my-snooker></div></section></div>` : ""}
    <div class="wrap layout" style="margin-top:30px">
      <div class="stack">
        ${!onHome && user && mySnookerOn(user) ? html`<a class="ms-bar" href="${mySnookerSetUp(user) ? "/myteam" : "/my/snooker"}"><b>My Snooker</b>
          <span>${mySnookerSetUp(user) ? html`${ctx.team.get(mySnookerTeamId(user))?.name ?? "The players you follow"}: matches, results, breaks and news` : "Follow your team and players, and get your own page"}</span>
          <i>${mySnookerSetUp(user) ? "Open my page →" : "Set it up →"}</i></a>` : ""}
        <nav class="quick-links" aria-label="Quick links">
          <a style="background:var(--yellow);color:#1b0e06" href="/competitions">${quickIcon.competitions}<span>Competitions</span></a>
          <a style="background:var(--red)" href="/calendar">${quickIcon.calendar}<span>Calendar</span></a>
          <a style="background:var(--blue)" href="/handicaps">${quickIcon.handicaps}<span>Handicaps</span></a>
          <a style="background:var(--green)" href="/fixtures">${quickIcon.fixtures}<span>Fixtures</span></a>
        </nav>
        ${featureBox(site, notices, today)}
        ${entering.length ? html`<a class="enter-bar" href="/enter"><b>Entries are open</b> for ${entering.map((c) => c.name).join(", ")} <span>Enter now →</span></a>` : ""}
        ${keyDates(site, dates, allComps.map((x) => x.c), today)}
        ${ctx.leagues.map((l) => leagueTablePanel(ctx, l, { limit: 10 }))}
        ${site.shields_show !== false ? shieldsBox(ctx) : ""}
        ${spotlights(ctx, site)}
        ${site.cueviews_show !== false ? cueviewBox(ctx, news) : ""}
        ${panel("Latest Competitions", html`<div class="list-rows" style="background:var(--cream)">
          ${comps.length ? comps.map(({ c, season, progress }) => html`<a href="${urls.competition(c)}">${c.image_url ? picture(c.image_url) : html`<div class="ph trophy-ph">${trophy(c)}</div>`}<div><strong>${c.name}</strong><small>${c.kind}${season ? ` · ${season.name}` : ""}</small>${progress}</div></a>`)
            : html`<div class="empty">No competitions yet.</div>`}
        </div>`, { color: "yellow", href: "/competitions" })}
      </div>
      ${sidebar(ctx, latestNews(news, site, slides.map((a) => a.id)), { count: site.latest_news_count || 1, box })}
    </div>`);

  const stopMine = onHome ? await mountMySnooker($("[data-my-snooker]", view), user, { home: true }) : () => {};

  // Rotate the banner articles (pauses while the mouse is over it).
  const slideEls = $$(".hero-slide", view), dots = $$("[data-dot]", view);
  let current = 0, paused = false;
  const show = (i) => {
    current = (i + slideEls.length) % slideEls.length;
    slideEls.forEach((s, j) => s.classList.toggle("on", j === current));
    dots.forEach((d, j) => d.classList.toggle("on", j === current));
  };
  dots.forEach((d) => d.addEventListener("click", () => show(Number(d.dataset.dot))));
  $(".hero-inner", view).addEventListener("mouseenter", () => { paused = true; });
  $(".hero-inner", view).addEventListener("mouseleave", () => { paused = false; });
  const timer = slideEls.length > 1 ? setInterval(() => { if (!paused && !document.hidden) show(current + 1); }, ROTATE_MS) : null;

  // Live & upcoming matches strip, updated live.
  const drawStrip = async () => mount($("[data-strip]", view), await liveStrip());
  await drawStrip();
  const unsubscribe = subscribe(["fixtures", "frames", "competition_matches", "competitions", "live_matches"], drawStrip);

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

  // …which moves on one card at a time, then goes back to the start.
  const strip = $("[data-strip]", view);
  let stripPaused = false;
  const move = (dir) => {
    const row = $(".strip-row", strip);
    if (!row) return;
    const stepPx = ($(".strip-card", row)?.offsetWidth ?? 230) + 10;
    const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
    if (dir > 0 && atEnd) row.scrollTo({ left: 0, behavior: "smooth" });
    else if (dir < 0 && row.scrollLeft <= 4) row.scrollTo({ left: row.scrollWidth, behavior: "smooth" });
    else row.scrollBy({ left: dir * stepPx, behavior: "smooth" });
  };
  for (const [on, off] of [["mouseenter", "mouseleave"], ["touchstart", "touchend"], ["focusin", "focusout"]]) {
    strip.addEventListener(on, () => { stripPaused = true; }, { passive: true });
    strip.addEventListener(off, () => { stripPaused = false; }, { passive: true });
  }
  strip.addEventListener("click", (e) => { const b = e.target.closest("[data-strip-move]"); if (b) move(Number(b.dataset.stripMove)); });
  const carousel = setInterval(() => { if (!stripPaused && !document.hidden) move(1); }, CAROUSEL_MS);

  return () => { clearInterval(timer); clearInterval(carousel); clearInterval(featureTimer); unsubscribe(); stopMine(); };
}

/** One banner article: headline, category and date, a small "continue reading" — all linking to the article. */
function heroSlide(a, on) {
  return html`<div class="hero-slide ${on ? "on" : ""}">
    <div class="hero-text">
      <h2><a href="${urls.article(a)}"><span>${a.title}</span></a></h2>
      <p class="hero-meta">${a.category} · ${fmtDate(a.published_at)}</p>
      <a class="hero-more" href="${urls.article(a)}">Continue reading <span aria-hidden="true">→</span></a>
    </div>
    ${articleThumb(a) ? html`<a class="hero-circle-link" href="${urls.article(a)}" aria-label="${a.title}"><img class="hero-circle" src="${articleThumb(a)}" alt=""></a>` : ""}
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
  const own = site.feature_text ? [{ label: site.feature_label, text: site.feature_text, url: site.feature_url || "", own: true }] : [];
  const extra = site.feature_announcements === false ? [] : notices
    .filter((a) => a.is_active !== false && a.show_in_feature !== false && a.text && (!a.starts_on || a.starts_on <= today) && (!a.ends_on || a.ends_on >= today))
    .map((a) => ({ label: a.label || "Announcement", text: a.text, url: a.url || "" }));
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
 * Key dates (Admin → Key dates): the next few dates everyone should know, as a row of date cards.
 * A date leaves the box the day after it (or its last day) has passed.
 */
function keyDates(site, dates, competitions, today) {
  if (site.key_dates_show === false) return "";
  const list = dates.filter((d) => d.is_active !== false && (d.ends_on || d.starts_on) >= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on)).slice(0, Math.max(1, site.key_dates_count || 5));
  if (!list.length) return "";
  const part = (iso, opts) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
  const days = (iso) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5);
  const when = (d) => { const n = days(d.starts_on); return n <= 0 ? (d.ends_on && d.ends_on > today ? "On now" : "Today") : n === 1 ? "Tomorrow" : n < 14 ? `In ${n} days` : `In ${Math.round(n / 7)} weeks`; };
  return panel("Key dates", html`<div class="key-dates">${list.map((d) => {
    const comp = competitions.find((c) => c.id === d.competition_id);
    const href = d.url || (comp ? urls.competition(comp) : "");
    const inner = html`<time datetime="${d.starts_on}"><b>${part(d.starts_on, { day: "numeric" })}</b><span>${part(d.starts_on, { month: "short" })}</span><small>${part(d.starts_on, { weekday: "short" })}</small></time>
      <div><strong>${d.title}</strong>
        ${d.ends_on && d.ends_on !== d.starts_on ? html`<small>Until ${part(d.ends_on, { weekday: "short", day: "numeric", month: "short" })}</small>` : ""}
        ${d.details ? html`<small>${d.details}</small>` : ""}
        <em class="${days(d.starts_on) <= 1 ? "soon" : ""}">${when(d)}</em></div>
      ${comp ? trophy(comp, "kd-trophy", { always: false }) : ""}`;
    return href ? html`<a class="key-date" href="${href}" ${/^https?:\/\//.test(href) ? html`target="_blank" rel="noopener"` : ""}>${inner}</a>` : html`<div class="key-date">${inner}</div>`;
  })}</div>`, { color: "yellow", foot: { href: "/calendar", label: "See everything on the calendar" } });
}

// ── live & upcoming strip ─────────────────────────────────────
async function liveStrip() {
  const [{ fixtures, comps, frames }, teams, leagues, compData, venues, players, boards] = await Promise.all([
    upcomingMatches(), table("teams", "name"), table("leagues", "sort"), loadCompetitions(), table("venues", "name"), table("players", "full_name"), liveMatches().catch(() => []),
  ]);
  const team = new Map(teams.map((t) => [t.id, t]));
  const framesBy = new Map();
  for (const f of frames) (framesBy.get(f.fixture_id) ?? framesBy.set(f.fixture_id, []).get(f.fixture_id)).push(f);
  const brackets = new Map(compData.competitions.map((c) => [c.id, buildBracket(compData.entries.filter((e) => e.competition_id === c.id), compData.matches.filter((m) => m.competition_id === c.id))]));

  const cards = [
    ...fixtures.map((fx) => ({
      when: fx.starts_at, live: fx.status === "in_progress", done: ["submitted", "approved"].includes(fx.status),
      title: leagues.find((l) => l.id === fx.league_id)?.name ?? "League",
      a: { name: team.get(fx.home_team_id)?.name ?? "?", team: team.get(fx.home_team_id) },
      b: { name: team.get(fx.away_team_id)?.name ?? "?", team: team.get(fx.away_team_id) }, score: matchScore(framesBy.get(fx.id)),
      hasFrames: framesBy.has(fx.id), href: urls.match(fx), venue: venues.find((v) => v.id === fx.venue_id),
    })),
    ...comps.map((m) => {
      const c = compData.competitions.find((x) => x.id === m.competition_id);
      const bm = brackets.get(m.competition_id)?.rounds[m.round - 1]?.[m.slot];
      if (!c || !bm || !isEntry(bm.a) || !isEntry(bm.b)) return null;
      // Team cups show the team emblem; singles show the player's photo.
      const who = (id) => { const e = compData.entries.find((x) => x.id === id); return { name: e.name, team: team.get(e.team_id), player: players.find((p) => p.id === e.player_id) }; };
      return {
        when: m.starts_at, live: m.status === "in_progress", done: m.status === "completed", title: c.name,
        a: who(bm.a), b: who(bm.b),
        score: { home: m.score_a ?? 0, away: m.score_b ?? 0 }, hasFrames: m.score_a != null, href: `/cup-match/${m.no ?? m.id}`, venue: venues.find((v) => v.id === m.venue_id),
      };
    }).filter(Boolean),
    // Matches scored ball by ball (finals): on now, or set up with a date in the next three weeks.
    ...boards.filter((m) => m.status === "live" || (m.status === "setup" && m.starts_at && Date.parse(m.starts_at) < Date.now() + 21 * 864e5)).map((m) => {
      const who = (s) => { const p = players.find((x) => x.id === m[`player_${s}_id`]); return { name: sideName(m, s, players), player: p ?? {} }; };
      return { when: m.started_at ?? m.starts_at, live: m.status === "live", done: false, title: matchLabel(m, compData.competitions), a: who("a"), b: who("b"),
        score: { home: m.frames_a ?? 0, away: m.frames_b ?? 0 }, hasFrames: m.status === "live", href: urls.scoreboard(m), venue: { name: m.status === "live" ? "Ball by ball — watch live" : m.venue ?? "" } };
    }),
    // Competition draws: one being made live now, one due soon, or one made in the last two days.
    ...compData.competitions.map((c) => {
      const dl = c.draw_live, entry = (id) => compData.entries.find((e) => e.id === id)?.name;
      const last = dl?.log?.at(-1);
      const tie = last ? (last.a && last.b ? `${entry(last.a)} has drawn ${entry(last.b)}` : `${entry(last.a ?? last.b)} gets a bye`) : "";
      if (dl?.status === "live") return { draw: true, live: true, when: dl.started_at, title: c.name, text: tie || "The draw is starting…", foot: "Watch the draw live →", href: `/draw/${c.slug}` };
      if (dl?.status === "done" && Date.now() - Date.parse(dl.finished_at) < 48 * 3600e3) return { draw: true, live: false, when: dl.finished_at, title: c.name, text: tie, foot: "See the full draw →", href: `/draw/${c.slug}` };
      if (!dl && c.draw_at && Date.parse(c.draw_at) > Date.now() - 3 * 3600e3 && Date.parse(c.draw_at) < Date.now() + 21 * 864e5)
        return { draw: true, live: false, when: c.draw_at, title: c.name, text: `Draw at ${fmtTime(c.draw_at)}`, foot: "Live on the website →", href: `/draw/${c.slug}` };
      return null;
    }).filter(Boolean),
  ].sort((x, y) => (y.live - x.live) || x.when.localeCompare(y.when)).slice(0, 12);

  if (!cards.length) return html`<div class="strip-empty">No matches coming up. <a href="/calendar">See the calendar</a></div>`;
  const face = (s) => (s.player ? avatar(s.player, "avatar sc-face") : s.team ? badge(s.team) : html`<span class="badge">${s.name.slice(0, 2).toUpperCase()}</span>`);
  const side = (s) => html`<div class="sc-side">${face(s)}<span>${s.name}</span></div>`;
  return html`<div class="strip-head"><h3>Live & upcoming matches</h3>
      <span class="strip-ctrl"><button type="button" data-strip-move="-1" aria-label="Previous matches">‹</button><button type="button" data-strip-move="1" aria-label="Next matches">›</button>
        <a href="/calendar">Calendar →</a></span></div>
    <div class="strip-row">${cards.map((c) => (c.draw ? html`<a class="strip-card is-draw ${c.live ? "is-live" : ""}" href="${c.href}">
      <div class="sc-top"><span>${ukDay(c.when) === todayUK() ? "Today" : fmtDate(c.when)}</span><span class="sc-comp">${c.title}</span></div>
      <div class="sc-draw">${c.live ? html`<span class="live-dot">Live draw</span>` : html`<b>The draw</b>`}<p>${c.text}</p></div>
      <div class="sc-foot">${c.foot}</div></a>` : html`<a class="strip-card ${c.live ? "is-live" : ""}" href="${c.href}">
      <div class="sc-top"><span>${ukDay(c.when) === todayUK() ? "Tonight" : fmtDate(c.when)}</span><span class="sc-comp">${c.title}</span></div>
      <div class="sc-body">${side(c.a)}
        <div class="sc-mid">${c.hasFrames || c.done ? html`<b>${c.score.home} - ${c.score.away}</b>` : html`<b class="time">${fmtTime(c.when)}</b>`}
          ${c.live ? html`<span class="live-dot">Live</span>` : c.done ? html`<small>Result</small>` : ""}</div>
        ${side(c.b)}</div>
      <div class="sc-foot">${c.venue?.name ?? ""}</div>
    </a>`))}</div>`;
}

// ── shields, spotlights, CueViews ─────────────────────────────
function shieldsBox(ctx) {
  const shields = ctx.leagues.filter((l) => l.shield_team_id).map((l) => ({ l, ...shieldHolder(l, ctx.fixtures, ctx.framesByFixture) }));
  if (!shields.length) return "";
  return panel("Shield holders", html`<div class="shields">${shields.map(({ l, holderId, since, history }) => {
    const t = ctx.team.get(holderId);
    const defences = history.filter((h) => h.to === holderId && h.defended && (!since || h.fixture.starts_at > since.starts_at)).length;
    return html`<a class="shield" href="${urls.shield(l)}" title="See where the ${l.shield_name || "shield"} has been this season">
      <svg class="shield-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5.2 3.4 9.7 8 11 4.6-1.3 8-5.8 8-11V5Z"/></svg>
      <small>${l.shield_name || `${l.name} Runabout Shield`}</small>
      ${t ? badge(t) : ""}<strong>${t?.name ?? "–"}</strong>
      <span>${since ? `Won ${fmtDate(since.starts_at)}` : "Holder since the start of the season"}${defences ? ` · ${defences} defence${defences > 1 ? "s" : ""}` : ""}</span>
      <em>Shield history →</em>
    </a>`;
  })}</div>`);
}

function spotlights(ctx, site) {
  const p = site.player_of_week_show && ctx.player.get(site.player_of_week_id);
  const t = site.team_of_week_show && ctx.team.get(site.team_of_week_id);
  if (!p && !t) return "";
  return html`<div class="spotlights">
    ${p ? html`<a class="spotlight" href="${urls.player(p)}"><span class="spot-label">Player of the week</span>
      ${avatar(p, "spot-photo")}<strong>${p.full_name}</strong><small>${ctx.team.get(p.team_id)?.name ?? ""}</small><p>${site.player_of_week_text ?? ""}</p></a>` : ""}
    ${t ? html`<a class="spotlight" href="${urls.team(t)}"><span class="spot-label">Team of the week</span>
      <span class="spot-badge">${badge(t)}</span><strong>${t.name}</strong><small>${ctx.league.get(t.league_id)?.name ?? ""}</small><p>${site.team_of_week_text ?? ""}</p></a>` : ""}
  </div>`;
}

/** CueViews picked for the home page: players' own, and interviews attached to news articles. */
function cueviewBox(ctx, news) {
  // Interviews from the news come first (newest first), then the featured players.
  const cards = [
    ...news.filter((a) => a.cueview_featured && articleCueview(a).length).map((a) => ({
      href: `${urls.article(a)}#cueview`, photo: html`<img class="cv-photo" src="${articleThumb(a) || "/assets/avatar.svg"}" alt="" loading="lazy">`,
      name: a.cueview_name || a.title, sub: "Interview", qs: articleCueview(a) })),
    ...ctx.players.filter((p) => p.cueview_featured && answered(p).length).map((p) => ({
      href: `${urls.player(p)}#cueview`, photo: avatar(p, "cv-photo"), name: p.full_name, sub: ctx.team.get(p.team_id)?.name ?? "",
      qs: answered(p).filter((q) => q.key !== "biography") })),
  ];
  if (!cards.length) return "";
  return panel("CueView", html`<div class="cv-cards">${cards.slice(0, 6).map((c) => html`<a class="cv-card" href="${c.href}">
      <div class="cv-head">${c.photo}<div><strong>${c.name}</strong><small>${c.sub}</small></div></div>
      ${c.qs.slice(0, 3).map((q) => html`<p><b>${q.label}</b>${q.answer}</p>`)}
      <span class="cv-more">Read the full CueView →</span></a>`)}</div>`);
}
