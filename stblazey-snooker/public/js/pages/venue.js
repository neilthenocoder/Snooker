import { html, mount, paragraphs, fmtDate, fmtTime } from "../core/dom.js";
import { seasonContext, sideBoxData } from "../core/context.js";
import { articles } from "../core/api.js";
import { breadcrumb, dataTable, panel, teamLink, urls, gallery, quoteBox, picture, fixturesTable, emblem, breaksBox, newsMini } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
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
  const [ctx, news, box] = await Promise.all([seasonContext(), articles(), sideBoxData()]);

  // A venue's emblem: its own, or the emblem of a team based there.
  const venueEmblem = (v) => emblem({ name: v.name, logo_url: v.logo_url || ctx.teams.find((t) => t.venue_id === v.id && t.logo_url)?.logo_url });

  if (!params.slug) {
    setTitle("Venues");
    adminEdit("venues");
    return mount(view, html`<div class="wrap">
      ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Venues"]])}
      <h1>Venues</h1>
      <div class="cards">${ctx.venues.map((v) => html`<a class="tile venue-tile" href="${urls.venue(v)}">${venueEmblem(v)}
        <span><h4>${v.name}</h4><span class="tile-go">Click here to view</span>${v.address ? html`<p>${v.address}</p>` : ""}</span></a>`)}</div>
    </div>`);
  }

  const v = ctx.venues.find((x) => x.slug === params.slug);
  if (!v) return notFound(view);
  setTitle(v.name);
  adminEdit("venues", v.id);
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
      <div>${breadcrumb([["Home", "/"], ["Venues", "/venues"], [v.name]])}<h1 class="with-emblem">${venueEmblem(v)}${v.name}</h1></div>
      <div class="venue-top">
        ${v.image_url ? picture(v.image_url, v.name, "venue-photo") : ""}
        <dl class="facts two-col">${contact.map(([k, x]) => html`<div><dt>${k}</dt><dd>${x}</dd></div>`)}
          <div><dt>Map</dt><dd><a href="${map.link}" target="_blank" rel="noopener">Open in Google Maps</a></dd></div>
          ${v.tables ? html`<div><dt>Snooker tables</dt><dd>${v.tables}</dd></div>` : ""}
          ${teams.length ? html`<div><dt>Teams based here</dt><dd>${teams.map((t) => t.name).join(", ")}</dd></div>` : ""}</dl>
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
    ${venueSidebar(ctx, news, v, teams)}
  </div>`);
}

/**
 * The side column of a venue's page is about that venue only (Rich, round 23 — not the general league boxes):
 * results and breaks made here, the next matches here, and news of the teams based here.
 * A side advert aimed at this venue (Admin → Website → Side adverts) goes on top of it.
 */
function venueSidebar(ctx, news, v, teams) {
  const here = ctx.fixtures.filter((f) => f.venue_id === v.id);
  const played = here.filter((f) => ctx.hasResult(f)).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 5);
  const next = here.filter((f) => f.status === "scheduled" && Date.parse(f.starts_at) > Date.now() - 6 * 36e5).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 4);
  const ids = new Set(here.map((f) => f.id));
  const breaks = ctx.breaks.filter((b) => ids.has(b.fixture_id)).map((b) => ({ ...b, player: ctx.player.get(b.player_id), when: ctx.fixture.get(b.fixture_id)?.starts_at }))
    .filter((b) => b.player).sort((a, b) => b.value - a.value);
  const names = teams.map((t) => t.name.toLowerCase());
  const teamNews = news.filter((a) => names.some((n) => `${a.title} ${a.excerpt ?? ""}`.toLowerCase().includes(n)) || String(a.body ?? "").toLowerCase().includes(v.name.toLowerCase())).slice(0, 4);
  const team = (id) => ctx.team.get(id)?.name ?? "?";
  return html`<aside class="sidebar venue-side">
    ${panel(`Latest results at ${v.name}`, played.length ? html`<div class="res-list">${played.map((f) => { const sc = ctx.scoreOf(f); return html`<a class="res-mini" href="${urls.match(f)}">
        <small>${fmtDate(f.starts_at)}</small><span class="${sc.home > sc.away ? "won" : sc.home < sc.away ? "lost" : ""}">${team(f.home_team_id)}</span><b>${sc.home} – ${sc.away}</b><span class="${sc.away > sc.home ? "won" : sc.away < sc.home ? "lost" : ""}">${team(f.away_team_id)}</span></a>`; })}</div>`
      : html`<div class="empty">No results here yet this season.</div>`, { color: "green" })}
    ${next.length ? panel(`Next at ${v.name}`, html`<div class="list-links">${next.map((f) => html`<a href="${urls.match(f)}"><b>${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)}</b> ${team(f.home_team_id)} v ${team(f.away_team_id)}</a>`)}</div>`, { color: "yellow" }) : ""}
    ${breaksBox(`Breaks at ${v.name}`, breaks)}
    ${teamNews.length ? panel(teams.length === 1 ? `${teams[0].name} news` : "News from here", html`<div>${teamNews.map(newsMini)}</div>`, { color: "blue" }) : ""}
  </aside>`;
}
