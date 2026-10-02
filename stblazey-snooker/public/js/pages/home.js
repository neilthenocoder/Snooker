import { html, mount, $, $$, fmtDate, fmtTime, cssUrl, ukDay, todayUK } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { articles, settings, upcomingMatches, loadCompetitions, subscribe, table } from "../core/api.js";
import { matchScore, shieldHolder } from "../core/rules.js";
import { buildBracket, isEntry } from "../core/bracket.js";
import { answered, articleCueview } from "../core/cueview.js";
import { leagueTablePanel, sidebar, panel, picture, urls, badge, avatar, articleThumb, shortName, latestNews } from "../core/components.js";
import { SITE } from "../config.js";
import { setTitle, adminEdit } from "../core/router.js";
import { competitionSummaries } from "./competitions.js";

const ROTATE_MS = 7000;      // banner: time each article is shown
const CAROUSEL_MS = 4500;    // live strip: time before it moves on one card

export default async function home(view) {
  setTitle("");
  adminEdit("settings", null, { label: "Edit home page" });
  const [ctx, news, allComps, site] = await Promise.all([seasonContext(), articles(), competitionSummaries(), settings()]);
  const slides = news.filter((a) => a.featured).slice(0, Math.max(1, site.hero_count || 4));
  // This season's competitions (ones with no season set count as current).
  const comps = allComps.filter(({ c }) => !c.season_id || c.season_id === ctx.season?.id);
  view.classList.add("flush");

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
    <button type="button" class="scroll-hint" data-scroll-hint aria-label="Scroll down for more">
      <span class="mouse"><i></i></span><span>Scroll</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16.5 5 9.6l1.4-1.4L12 13.7l5.6-5.5L19 9.6Z"/></svg></button>
    <div class="wrap layout" style="margin-top:30px">
      <div class="stack">
        <div class="quick-links">
          <a style="background:var(--yellow);color:#1b0e06" href="/competitions">Competitions</a>
          <a style="background:var(--red)" href="/calendar">Calendar</a>
          <a style="background:var(--blue)" href="/handicaps">Handicaps</a>
          <a style="background:var(--green)" href="/fixtures">Fixtures</a>
        </div>
        ${featureBox(site)}
        ${ctx.leagues.map((l) => leagueTablePanel(ctx, l, { limit: 10 }))}
        ${site.shields_show !== false ? shieldsBox(ctx) : ""}
        ${spotlights(ctx, site)}
        ${site.cueviews_show !== false ? cueviewBox(ctx, news) : ""}
        ${panel("Latest Competitions", html`<div class="list-rows" style="background:var(--cream)">
          ${comps.length ? comps.map(({ c, season, progress }) => html`<a href="${urls.competition(c)}">${picture(c.image_url)}<div><strong>${c.name}</strong><small>${c.kind}${season ? ` · ${season.name}` : ""}</small>${progress}</div></a>`)
            : html`<div class="empty">No competitions yet.</div>`}
        </div>`, { color: "yellow", href: "/competitions" })}
      </div>
      ${sidebar(ctx, latestNews(news, site, slides.map((a) => a.id)), { count: site.latest_news_count || 1 })}
    </div>`);

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
  const unsubscribe = subscribe(["fixtures", "frames", "competition_matches"], drawStrip);

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

  // Phones: a "scroll" hint, so people know there's more below. It goes once they scroll.
  const hint = $("[data-scroll-hint]", view);
  const onScroll = () => hint.classList.toggle("gone", window.scrollY > 60);
  window.addEventListener("scroll", onScroll, { passive: true });
  hint.addEventListener("click", () => window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" }));
  onScroll();

  return () => { clearInterval(timer); clearInterval(carousel); unsubscribe(); window.removeEventListener("scroll", onScroll); };
}

/** One banner article: headline, category and date, a small "continue reading" — all linking to the article. */
function heroSlide(a, on) {
  return html`<div class="hero-slide ${on ? "on" : ""}">
    <div class="hero-text">
      <h2><a href="${urls.article(a)}"><span>${a.title}</span></a></h2>
      <div class="hero-foot"><p class="hero-meta">${a.category} · ${fmtDate(a.published_at)}</p>
        <a class="hero-more" href="${urls.article(a)}">Continue reading</a></div>
    </div>
    ${articleThumb(a) ? html`<a class="hero-circle-link" href="${urls.article(a)}" aria-label="${a.title}"><img class="hero-circle" src="${articleThumb(a)}" alt=""></a>` : ""}
  </div>`;
}

/** The coloured "NEW …" strip under the quick links (Admin → Site settings → Home page: feature box). */
function featureBox(site) {
  if (!site.feature_show || !site.feature_text) return "";
  const bg = /^#[0-9a-f]{6}$/i.test(site.feature_bg ?? "") ? site.feature_bg : "#0b84e0";
  // Dark text on light colours, white on dark ones.
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const light = (r * 299 + g * 587 + b * 114) / 1000 > 150;
  const url = site.feature_url || "";
  const external = /^https?:\/\//.test(url);
  const inner = html`${site.feature_label ? html`<span class="feature-new">${site.feature_label}</span>` : ""}<span class="feature-text">${site.feature_text}</span>${url ? html`<span class="feature-go" aria-hidden="true">→</span>` : ""}`;
  const style = `background:${bg};color:${light ? "#1b0e06" : "#fff"}`;
  return url ? html`<a class="feature-box" style="${style}" href="${url}" ${external ? html`target="_blank" rel="noopener"` : ""}>${inner}</a>`
    : html`<div class="feature-box" style="${style}">${inner}</div>`;
}

// ── live & upcoming strip ─────────────────────────────────────
async function liveStrip() {
  const [{ fixtures, comps, frames }, teams, leagues, compData, venues, players] = await Promise.all([
    upcomingMatches(), table("teams", "name"), table("leagues", "sort"), loadCompetitions(), table("venues", "name"), table("players", "full_name"),
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
        score: { home: m.score_a ?? 0, away: m.score_b ?? 0 }, hasFrames: m.score_a != null, href: `/cup-match/${m.id}`, venue: venues.find((v) => v.id === m.venue_id),
      };
    }).filter(Boolean),
  ].sort((x, y) => (y.live - x.live) || x.when.localeCompare(y.when)).slice(0, 12);

  if (!cards.length) return html`<div class="strip-empty">No matches coming up. <a href="/calendar">See the calendar</a></div>`;
  const face = (s) => (s.player ? avatar(s.player, "avatar sc-face") : s.team ? badge(s.team) : html`<span class="badge">${s.name.slice(0, 2).toUpperCase()}</span>`);
  const side = (s) => html`<div class="sc-side">${face(s)}<span>${s.name}</span></div>`;
  return html`<div class="strip-head"><h3>Live & upcoming matches</h3>
      <span class="strip-ctrl"><button type="button" data-strip-move="-1" aria-label="Previous matches">‹</button><button type="button" data-strip-move="1" aria-label="Next matches">›</button>
        <a href="/calendar">Calendar →</a></span></div>
    <div class="strip-row">${cards.map((c) => html`<a class="strip-card ${c.live ? "is-live" : ""}" href="${c.href}">
      <div class="sc-top"><span>${ukDay(c.when) === todayUK() ? "Tonight" : fmtDate(c.when)}</span><span class="sc-comp">${c.title}</span></div>
      <div class="sc-body">${side(c.a)}
        <div class="sc-mid">${c.hasFrames || c.done ? html`<b>${c.score.home} - ${c.score.away}</b>` : html`<b class="time">${fmtTime(c.when)}</b>`}
          ${c.live ? html`<span class="live-dot">Live</span>` : c.done ? html`<small>Result</small>` : ""}</div>
        ${side(c.b)}</div>
      <div class="sc-foot">${c.venue?.name ?? ""}</div>
    </a>`)}</div>`;
}

// ── shields, spotlights, CueViews ─────────────────────────────
function shieldsBox(ctx) {
  const shields = ctx.leagues.filter((l) => l.shield_team_id).map((l) => ({ l, ...shieldHolder(l, ctx.fixtures, ctx.framesByFixture) }));
  if (!shields.length) return "";
  return panel("Shield holders", html`<div class="shields">${shields.map(({ l, holderId, since, history }) => {
    const t = ctx.team.get(holderId);
    const defences = history.filter((h) => h.to === holderId && h.defended && (!since || h.fixture.starts_at > since.starts_at)).length;
    return html`<a class="shield" href="${t ? urls.team(t) : "#"}">
      <svg class="shield-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5.2 3.4 9.7 8 11 4.6-1.3 8-5.8 8-11V5Z"/></svg>
      <small>${l.shield_name || `${shortName(l)} Shield`}</small>
      ${t ? badge(t) : ""}<strong>${t?.name ?? "–"}</strong>
      <span>${since ? `Won ${fmtDate(since.starts_at)}` : "Holder since the start of the season"}${defences ? ` · ${defences} defence${defences > 1 ? "s" : ""}` : ""}</span>
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
