import { html, mount, paragraphs } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { articles } from "../core/api.js";
import { breadcrumb, sidebar, dataTable, panel, teamLink, tile, urls, gallery, quoteBox, picture, fixturesTable } from "../core/components.js";
import { setTitle } from "../core/router.js";
import notFound from "./not-found.js";

/** Google map for a venue: the admin's embed link if given, otherwise placed from the address. */
export function mapEmbed(v) {
  const given = String(v.map_url ?? "");
  const src = given.match(/src="([^"]+)"/)?.[1] ?? (given.includes("/maps/embed") ? given : null);
  const q = encodeURIComponent(v.address || v.name);
  return {
    src: src && /^https:\/\/(www\.)?google\.[a-z.]+\/maps\//.test(src) ? src : `https://www.google.com/maps?q=${q}&output=embed`,
    link: given && /^https:\/\//.test(given) && !given.includes("<") ? given : `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}

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
  const upcoming = ctx.fixtures.filter((f) => f.venue_id === v.id && f.status === "scheduled").slice(0, 6);
  const map = mapEmbed(v);
  const contact = [
    ["Address", v.address],
    ["Telephone", v.phone && html`<a href="tel:${v.phone.replace(/\s+/g, "")}">${v.phone}</a>`],
    ["Email", v.email && html`<a href="mailto:${v.email}">${v.email}</a>`],
    ["Contact", v.contact_name],
  ].filter(([, x]) => x);

  mount(view, html`<div class="wrap layout">
    <div class="stack">
      <div>${breadcrumb([["Home", "/"], ["Venues", "/venues"], [v.name]])}<h1>${v.name}</h1></div>
      <div class="venue-top">
        ${v.image_url ? picture(v.image_url, v.name, "venue-photo") : ""}
        <dl class="facts">${contact.map(([k, x]) => html`<div><dt>${k}</dt><dd>${x}</dd></div>`)}
          <div><dt>Map</dt><dd><a href="${map.link}" target="_blank" rel="noopener">Open in Google Maps</a></dd></div></dl>
      </div>
      ${v.description ? html`<div><h3>About ${v.name}</h3><div class="prose">${paragraphs(v.description)}</div></div>` : ""}
      ${quoteBox(v.quote)}
      <div class="map-frame"><iframe src="${map.src}" title="Map of ${v.name}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
      ${v.gallery?.length ? html`<div><h3>Gallery</h3>${gallery(v.gallery)}</div>` : ""}
      ${teams.length ? panel("Teams based here", dataTable([
        { label: "Team", cell: (t) => teamLink(t) },
        { label: "League", cell: (t) => ctx.league.get(t.league_id)?.name },
      ], teams)) : ""}
      ${upcoming.length ? panel("Next matches here", fixturesTable(ctx, upcoming)) : ""}
    </div>
    ${sidebar(ctx, news)}
  </div>`);
}
