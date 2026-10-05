import { html, mount, fmtDate, paragraphs, cssUrl, ukDay } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { articles } from "../core/api.js";
import { addDays } from "../core/schedule.js";
import { sidebar, breadcrumb, panel, dataTable, articleCard, articleThumb, quoteBox, playerLink, teamLink, leagueTablePanel, urls, cueviewSection, gallery } from "../core/components.js";
import { articleCueview } from "../core/cueview.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

export default async function article(view, { params }) {
  const [ctx, news] = await Promise.all([seasonContext(), articles()]);
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
  const related = news.filter((x) => x.id !== a.id && (x.category === a.category || (a.competition_id && x.competition_id === a.competition_id))).slice(0, 3);

  mount(view, html`
    <section class="hero article-hero" style="${a.image_url ? `--hero-img:${cssUrl(a.image_url)}` : ""}">
      <div class="wrap hero-inner"><div class="hero-slide on">
        <div class="hero-text"><h2><span>${a.title}</span></h2><p class="hero-meta">${a.category} · ${fmtDate(a.published_at)}</p></div>
        ${articleThumb(a) ? html`<img class="hero-circle" src="${articleThumb(a)}" alt="">` : ""}
      </div></div>
    </section>
    <div class="wrap layout" style="margin-top:30px">
      <div class="stack">
        <div>${breadcrumb([["Home", "/"], ["News", "/news"], [a.category, `/news#${encodeURIComponent(a.category)}`], [a.title]])}
          <article class="prose article-body">
            <h3 class="article-kicker">${a.category === "Match Reports" ? "Match report" : a.category}</h3>
            ${a.lead ? html`<p class="lead">${a.lead}</p>` : ""}
            ${bodyWithQuote(a)}
          </article>
        </div>
        ${cueviewSection(a.cueview_name || a.title, articleCueview(a).filter((q) => q.key !== "hand"))}
        ${a.show_breaks && league ? panel(`Top breaks of the week — ${league.name}`, dataTable([
          { label: "Player", cell: (b) => playerLink(b.player) },
          { label: "Team", cell: (b) => teamLink(ctx.team.get(b.player?.team_id)), cls: "hide-sm" },
          { label: "Date", cell: (b) => html`<a href="${urls.match(b.fixture)}">${fmtDate(b.fixture.starts_at)}</a>` },
          { label: "Break", cell: (b) => b.value, cls: "num strong" },
        ], weekBreaks.slice(0, 10), { empty: "No breaks recorded that week." })) : ""}
        ${a.show_results && league ? panel(`Team results — week ending ${fmtDate(weekEnd)}`, dataTable([
          { label: "Home", cell: (f) => teamLink(ctx.team.get(f.home_team_id)) },
          { label: "Score", cell: (f) => { const s = ctx.scoreOf(f); return html`<a class="strong" href="${urls.match(f)}">${s.home} - ${s.away}</a>`; }, cls: "num" },
          { label: "Away", cell: (f) => teamLink(ctx.team.get(f.away_team_id)) },
        ], weekFixtures, { empty: "No results that week." })) : ""}
        ${a.show_standings && league ? leagueTablePanel(ctx, league) : ""}
        ${photoMatches.length ? html`<div class="mn-week"><h3>Match night photos</h3>
          ${photoMatches.map((f) => html`<div class="mn-match"><a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} v ${ctx.team.get(f.away_team_id)?.name}</a>${gallery(f.gallery)}</div>`)}</div>` : ""}
        ${related.length ? html`<div><h3>Related news</h3><div class="cards">${related.map(articleCard)}</div></div>` : ""}
      </div>
      ${sidebar(ctx, news.filter((x) => x.id !== a.id), { leagues: league ? [league] : ctx.leagues })}
    </div>`);
}

/** Article text with the quote box where "[quote]" is typed (or after the first paragraph). */
function bodyWithQuote(a) {
  const parts = String(a.body || a.excerpt || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const quote = quoteBox(a.quote_text, a.quote_author);
  let at = parts.findIndex((p) => p.toLowerCase() === "[quote]");
  if (at >= 0) parts.splice(at, 1); else at = Math.min(1, parts.length);
  return html`${paragraphs(parts.slice(0, at).join("\n\n"))}${quote}${paragraphs(parts.slice(at).join("\n\n"))}`;
}
