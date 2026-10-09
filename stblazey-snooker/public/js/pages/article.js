import { html, mount, fmtDate, paragraphs, cssUrl, ukDay } from "../core/dom.js";
import { seasonContext, sideBoxData } from "../core/context.js";
import { articles } from "../core/api.js";
import { addDays } from "../core/schedule.js";
import { breadcrumb, panel, dataTable, quoteBox, playerLink, teamLink, leagueTablePanel, urls, cueviewSection, gallery, newsStrip, videoEmbed, shareBar, readTime, categoriesOf } from "../core/components.js";
import { SITE } from "../config.js";
import { articleCueview } from "../core/cueview.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

export default async function article(view, { params }) {
  const [ctx, news, box] = await Promise.all([seasonContext(), articles(), sideBoxData()]);
  const a = news.find((x) => x.slug === params.slug);
  if (!a) return notFound(view);
  setTitle(a.title);
  adminEdit("articles", a.id);
  view.classList.add("flush");
  const league = ctx.league.get(a.league_id);

  // The week the round-up covers: the 7 days ending on week_ending (or the article date).
  const weekEnd = (a.week_ending || a.published_at || "").slice(0, 10);
  const weekStart = weekEnd ? addDays(weekEnd, -6) : null;
  const inWeek = (iso) => weekStart && ukDay(iso) >= weekStart && ukDay(iso) <= weekEnd;
  const weekFixtures = league ? ctx.fixturesIn(league.id).filter((f) => inWeek(f.starts_at) && ctx.hasResult(f)) : [];
  const weekBreaks = league ? ctx.breaksIn(league.id).filter((b) => b.fixture && inWeek(b.fixture.starts_at)) : [];
  // Match night photos the home captains added to that week's matches (the round-up's league, or every league).
  const isRoundup = league || a.week_ending;
  const photoMatches = isRoundup && a.show_photos !== false
    ? (league ? ctx.fixturesIn(league.id) : ctx.fixtures).filter((f) => inWeek(f.starts_at) && f.gallery?.length) : [];

  // Related: the same competition first, then anything sharing a category, newest first.
  const shares = (x) => categoriesOf(x).some((c) => categoriesOf(a).includes(c));
  const related = [...news.filter((x) => x.id !== a.id && a.competition_id && x.competition_id === a.competition_id),
    ...news.filter((x) => x.id !== a.id && !(a.competition_id && x.competition_id === a.competition_id) && shares(x))].slice(0, 10);
  const author = a.author || box?.site?.news_author || SITE.name;
  const longDate = new Date(`${String(a.published_at).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const video = videoEmbed(a.video_url);

  mount(view, html`
    <header class="art-hero" style="${a.image_url ? `--art-img:${cssUrl(a.image_url)}` : ""}">
      <div class="wrap">
        ${breadcrumb([["Home", "/"], ["News", "/news"], [a.title]])}
        <div class="art-cats">${categoriesOf(a).map((c) => html`<a href="/news?category=${encodeURIComponent(c)}">${c}</a>`)}</div>
        <h1>${a.title}</h1>
      </div>
    </header>
    <div class="wrap art-wrap">
      <div class="art-bar">
        <p class="art-by"><span>By: <b>${author}</b></span><span>Date: <b><time datetime="${String(a.published_at).slice(0, 10)}">${longDate}</time></b></span><span>${readTime(a)} min read</span></p>
        ${shareBar(a.title, urls.article(a))}
      </div>
      <article class="art-body">
        ${a.lead ? html`<p class="lead">${a.lead}</p>` : ""}
        ${bodyWithQuote(a, video)}
      </article>
      <div class="stack art-extra">
        ${cueviewSection(a.cueview_name || a.title, articleCueview(a).filter((q) => q.key !== "hand"))}
        ${a.show_breaks && league ? panel(`Top breaks of the week — ${league.name}`, dataTable([
          { label: "Player", cell: (b) => playerLink(b.player) },
          { label: "Team", cell: (b) => teamLink(ctx.team.get(b.player?.team_id)), cls: "hide-sm" },
          { label: "Date", cell: (b) => html`<a href="${urls.match(b.fixture)}">${fmtDate(b.fixture.starts_at)}</a>` },
          { label: "Break", cell: (b) => b.value, cls: "num strong" },
        ], weekBreaks.slice(0, 10), { empty: "No breaks recorded that week." })) : ""}
        ${a.show_results && league ? panel(`Team results — week ending ${fmtDate(weekEnd)}`, dataTable([
          { label: "Home", cell: (f) => teamLink(ctx.team.get(f.home_team_id)) },
          { label: "Score", cell: (f) => { const s = ctx.scoreOf(f); return html`<a class="res-score done" href="${urls.match(f)}">${s.home} - ${s.away}</a>`; }, cls: "num" },
          { label: "Away", cell: (f) => teamLink(ctx.team.get(f.away_team_id)) },
        ], weekFixtures, { empty: "No results that week." })) : ""}
        ${a.show_standings && league ? leagueTablePanel(ctx, league) : ""}
        ${photoMatches.length ? html`<div class="mn-week"><h3>Match night photos</h3>
          ${photoMatches.map((f) => html`<div class="mn-match"><a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} v ${ctx.team.get(f.away_team_id)?.name}</a>${gallery(f.gallery)}</div>`)}</div>` : ""}
        <div class="art-foot">${shareBar(a.title, urls.article(a))}<a class="btn ghost" href="/news">More news</a></div>
      </div>
    </div>
    ${newsStrip("Related news", related)}`);
}

/**
 * Article text with the quote box where "[quote]" is typed (or after the first paragraph),
 * and the video where "[video]" is typed (or above the text).
 */
function bodyWithQuote(a, video = "") {
  const parts = String(a.body || a.excerpt || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const quote = quoteBox(a.quote_text, a.quote_author);
  let at = parts.findIndex((p) => p.toLowerCase() === "[quote]");
  if (at >= 0) parts.splice(at, 1); else at = Math.min(1, parts.length);
  const placed = parts.some((p) => p.toLowerCase() === "[video]");
  // Each stretch of text between the markers is ordinary paragraphs.
  const text = (list) => { const out = []; let run = [];
    for (const p of list) { if (p.toLowerCase() === "[video]") { out.push(paragraphs(run.join("\n\n")), video); run = []; } else run.push(p); }
    out.push(paragraphs(run.join("\n\n")));
    return out; };
  return html`${placed ? "" : video}${text(parts.slice(0, at))}${quote}${text(parts.slice(at))}`;
}
