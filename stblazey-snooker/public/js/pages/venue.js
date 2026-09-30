import { html, mount, paragraphs } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { articles } from "../core/api.js";
import { breadcrumb, sidebar, dataTable, panel, teamLink, tile, urls } from "../core/components.js";
import { setTitle } from "../core/router.js";
import notFound from "./not-found.js";

/** /venues (list) and /venue/:slug (one venue) share this module. */
export default async function venue(view, { params }) {
  const [ctx, news] = await Promise.all([seasonContext(), articles()]);

  if (!params.slug) {
    setTitle("Venues");
    return mount(view, html`<div class="wrap">
      ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Venues"]])}
      <h1>Venues</h1>
      <div class="cards">${ctx.venues.map((v) => tile(v.name, v.address || "", urls.venue(v)))}</div>
    </div>`);
  }

  const v = ctx.venues.find((x) => x.slug === params.slug);
  if (!v) return notFound(view);
  setTitle(v.name);
  const teams = ctx.teams.filter((t) => t.venue_id === v.id);
  mount(view, html`<div class="wrap layout">
    <div class="stack">
      <div><h1>${v.name}</h1>
        <div class="prose" style="font-size:15px">${paragraphs(v.description || "")}${v.address ? html`<p><strong>Address:</strong> ${v.address}</p>` : ""}</div>
      </div>
      ${teams.length ? panel("Teams based here", dataTable([
        { label: "Team", cell: (t) => teamLink(t) },
        { label: "League", cell: (t) => ctx.league.get(t.league_id)?.name },
      ], teams)) : ""}
    </div>
    ${sidebar(ctx, news)}
  </div>`);
}
