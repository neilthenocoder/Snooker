import { html, mount } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { articles } from "../core/api.js";
import { leagueTablePanel, sidebar, panel, picture, urls } from "../core/components.js";
import { SITE } from "../config.js";
import { setTitle } from "../core/router.js";
import { competitionSummaries } from "./competitions.js";

export default async function home(view) {
  setTitle("");
  const [ctx, news, comps] = await Promise.all([seasonContext(), articles(), competitionSummaries()]);
  const lead = news.find((a) => a.category !== "Competitions") ?? news[0];
  view.classList.add("flush");

  mount(view, html`
    <section class="hero">
      <div class="wrap">
        <div class="hero-text">
          ${lead
            ? html`<h2>${lead.title}</h2><p>${lead.excerpt} <a class="pill" href="${urls.article(lead)}">Continue reading</a></p>`
            : html`<h2>${SITE.name}</h2><p>Established ${SITE.established}</p>`}
        </div>
        ${lead?.image_url ? html`<img class="hero-circle" src="${lead.image_url}" alt="">` : ""}
      </div>
    </section>
    <div class="wrap layout" style="margin-top:36px">
      <div class="stack">
        <div class="quick-links" style="margin-bottom:-14px">
          <a style="background:var(--yellow);color:#1b0e06" href="/competitions">Competitions</a>
          <a style="background:var(--red)" href="/handicaps">Handicaps</a>
          <a style="background:var(--green)" href="/fixtures">Fixtures</a>
        </div>
        ${ctx.leagues.map((l) => leagueTablePanel(ctx, l, { limit: 10 }))}
        ${panel("Latest Competitions", html`<div class="list-rows" style="background:var(--cream)">
          ${comps.length ? comps.map(({ c, season, progress }) => html`<a href="${urls.competition(c)}">${picture(c.image_url)}<div><strong>${c.name}</strong><small>${c.kind}${season ? ` · ${season.name}` : ""}</small>${progress}</div></a>`)
            : html`<div class="empty">No competitions yet.</div>`}
        </div>`, { color: "yellow", href: "/competitions" })}
      </div>
      ${sidebar(ctx, news)}
    </div>`);
}
