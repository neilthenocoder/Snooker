import { html, mount, fmtDate, paragraphs, cssUrl } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { articles } from "../core/api.js";
import { sidebar, breadcrumb } from "../core/components.js";
import { setTitle } from "../core/router.js";
import notFound from "./not-found.js";

export default async function article(view, { params }) {
  const [ctx, news] = await Promise.all([seasonContext(), articles()]);
  const a = news.find((x) => x.slug === params.slug);
  if (!a) return notFound(view);
  setTitle(a.title);
  view.classList.add("flush");
  mount(view, html`
    <section class="hero" style="${a.image_url ? `--hero-img:${cssUrl(a.image_url)}` : ""}">
      <div class="wrap"><div class="hero-text"><h2>${a.title}</h2><p>${a.category} · ${fmtDate(a.published_at)}</p></div>
      ${a.image_url ? html`<img class="hero-circle" src="${a.image_url}" alt="">` : ""}</div>
    </section>
    <div class="wrap layout" style="margin-top:36px">
      <div>
        ${breadcrumb([["Home", "/"], ["News", "/news"], [a.title]])}
        <article class="prose">${paragraphs(a.body || a.excerpt)}</article>
      </div>
      ${sidebar(ctx, news)}
    </div>`);
}
