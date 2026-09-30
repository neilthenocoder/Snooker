import { html, mount, $, fmtDate, paragraphs, cssUrl } from "../core/dom.js";
import { table, articles, loadCompetitions, subscribe } from "../core/api.js";
import { buildBracket, progressText, isEntry } from "../core/bracket.js";
import { bracketView, wireBracket, roundCards, standingsTable } from "../core/bracket-view.js";
import { breadcrumb, panel, picture, urls } from "../core/components.js";
import { setTitle } from "../core/router.js";
import notFound from "./not-found.js";

export default async function competition(view, { params }) {
  const draw = async () => {
    const [data, venues, seasons, news] = await Promise.all([loadCompetitions(), table("venues", "name"), table("seasons", "name"), articles()]);
    const c = data.competitions.find((x) => x.slug === params.slug);
    if (!c) return notFound(view);
    setTitle(c.name);
    const entries = data.entries.filter((e) => e.competition_id === c.id);
    const b = buildBracket(entries, data.matches.filter((m) => m.competition_id === c.id));
    const venueById = new Map(venues.map((v) => [v.id, v]));
    const season = seasons.find((s) => s.id === c.season_id);
    const champ = b.champion ? b.entryById.get(b.champion) : null;
    const real = b.rounds.flat().filter((m) => !m.isBye);
    const next = real.filter((m) => !m.played && m.row.starts_at).sort((x, y) => x.row.starts_at.localeCompare(y.row.starts_at))[0];
    const related = news.filter((a) => a.competition_id === c.id);
    const others = data.competitions.filter((x) => x.id !== c.id);
    view.classList.add("flush");

    mount(view, html`
      <section class="comp-hero" style="${c.image_url ? `--comp-img:${cssUrl(c.image_url)}` : ""}">
        <div class="wrap">
          ${breadcrumb([["Home", "/"], ["Competitions", "/competitions"], [c.name]])}
          <div class="comp-hero-row">
            <div>
              <p class="comp-kicker">${c.kind} competition${season ? ` · ${season.name}` : ""}</p>
              <h1>${c.name}</h1>
              <p class="comp-progress">${progressText(b)}</p>
            </div>
            ${champ ? html`<div class="comp-champ"><small>Champion</small>${champ.name}</div>` : ""}
          </div>
        </div>
      </section>
      <div class="wrap" style="margin-top:30px">
        ${panel(`${c.name} ${season?.name ?? ""} — the road to the final`, html`
          <p class="bracket-hint">Hover over (or tap) a name to follow their route. Scroll sideways on a phone.</p>
          ${bracketView(b)}`, { cls: "bracket-panel" })}
      </div>
      <div class="wrap layout" style="margin-top:30px">
        <div class="stack">
          ${c.info ? html`<div><h3 style="margin-top:0">Competition information</h3><div class="prose" style="font-size:15px">${paragraphs(c.info)}</div></div>` : ""}
          ${panel("Standings", standingsTable(b))}
          <div>${roundCards(b, venueById)}</div>
        </div>
        <aside class="sidebar">
          ${panel("At a glance", html`<div class="glance">
            <div><b>${entries.length}</b>Entrants</div>
            <div><b>${real.filter((m) => m.played).length}/${real.length}</b>Matches played</div>
            <div><b>${b.rounds.flat().filter((m) => m.played && m.row.score_a != null).reduce((n, m) => n + m.row.score_a + m.row.score_b, 0)}</b>Frames played</div>
            <div><b>${next ? fmtDate(next.row.starts_at) : "–"}</b>Next match</div>
          </div>
          ${next && isEntry(next.a) && isEntry(next.b) ? html`<p class="glance-next">Next up: <b>${b.entryById.get(next.a).name}</b> v <b>${b.entryById.get(next.b).name}</b></p>` : ""}`)}
          ${panel("Related news", related.length ? html`<div>${related.map((a) => html`<a class="news-mini" href="${urls.article(a)}">${picture(a.image_url)}<div><strong>${a.title}</strong><small>${fmtDate(a.published_at)}</small>${a.excerpt}</div></a>`)}</div>` : html`<div class="empty">No news yet.</div>`, { color: "blue" })}
          ${others.length ? panel("Other competitions", html`<div class="list-links">${others.map((x) => html`<a href="${urls.competition(x)}">${x.name}</a>`)}</div>`) : ""}
        </aside>
      </div>`);
    wireBracket($("[data-bracket]", view) ?? document.createElement("div"));
  };
  await draw();
  return subscribe(["competition_matches"], draw);
}
