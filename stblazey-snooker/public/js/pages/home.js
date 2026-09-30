import { html, mount, fmtDate, cssUrl } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { articles } from "../core/api.js";
import { leagueTablePanel, sidebar, panel, picture, urls } from "../core/components.js";
import { setTitle } from "../core/router.js";

export default async function home(view) {
  setTitle("");
  const [ctx, news] = await Promise.all([seasonContext(), articles()]);
  const lead = news.find((a) => a.category !== "Competitions") ?? news[0];
  const comps = news.filter((a) => a.category === "Competitions");
  view.classList.add("flush");

  mount(view, html`
    ${lead ? html`<section class="hero" style="${lead.image_url ? `--hero-img:${cssUrl(lead.image_url)}` : ""}">
      <div class="wrap">
        <div class="hero-text">
          <h2>${lead.title}</h2>
          <p>${lead.excerpt} <a class="pill" href="${urls.article(lead)}">Continue reading</a></p>
        </div>
        ${lead.image_url ? html`<img class="hero-circle" src="${lead.image_url}" alt="">` : ""}
      </div>
    </section>` : ""}
    <div class="wrap layout" style="margin-top:36px">
      <div class="stack">
        <div class="quick-links" style="margin-bottom:-14px">
          <a style="background:var(--yellow);color:#1b0e06" href="/competitions">Competitions</a>
          <a style="background:var(--red)" href="/handicaps">Handicaps</a>
          <a style="background:var(--green)" href="/fixtures">Fixtures</a>
        </div>
        ${ctx.leagues.map((l) => leagueTablePanel(ctx, l, { limit: 10 }))}
        ${panel("Latest Competitions", html`<div class="list-rows" style="background:var(--cream)">
          ${comps.map((a) => html`<a href="${urls.article(a)}">${picture(a.image_url)}<div><strong>${a.title}</strong><small>${fmtDate(a.published_at)}</small>${a.excerpt}</div></a>`)}
        </div>`, { color: "yellow", href: "/competitions" })}
      </div>
      ${sidebar(ctx, news)}
    </div>`);
}
