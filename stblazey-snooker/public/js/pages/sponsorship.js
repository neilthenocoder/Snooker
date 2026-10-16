// /sponsorship — the league's sponsorship packages (Gold, Silver, Bronze… — Admin → Website → Sponsorship packages)
// and the businesses already supporting it (Rich, round 23).
import { html, mount, paragraphs } from "../core/dom.js";
import { table, settings } from "../core/api.js";
import { breadcrumb, urls } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

const lines = (t) => String(t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

export default async function sponsorship(view) {
  setTitle("Sponsorship");
  adminEdit("sponsor_packages", null, { label: "Edit the packages" });
  const [packs, sponsors, site] = await Promise.all([table("sponsor_packages", "sort").catch(() => []), table("sponsors", "sort").catch(() => []), settings()]);
  const list = packs.filter((p) => p.is_active !== false);
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Sponsorship"]])}
    <h1>Sponsor the league</h1>
    <div class="sp-intro">${paragraphs(site.sponsorship_intro || "Put your business in front of every player, captain and supporter in the league — on the website all season, at the clubs and at presentation night. Choose a package below and get in touch.")}</div>
    ${list.length ? html`<div class="sp-grid">${list.map((p) => html`<article class="sp-card" style="--sp:${/^#[0-9a-f]{6}$/i.test(p.colour ?? "") ? p.colour : "#e8003d"}">
        <header><h2>${p.name}</h2>${p.price ? html`<p class="sp-price">${p.price}${p.period ? html` <small>${p.period}</small>` : ""}</p>` : ""}</header>
        ${p.summary ? html`<p class="sp-sum">${p.summary}</p>` : ""}
        <ul>${lines(p.benefits).map((b) => html`<li>${b}</li>`)}${p.includes_advert ? html`<li>Your advert on the website</li>` : ""}</ul>
        <p class="sp-who">${sponsors.filter((s) => s.package_id === p.id).map((s) => html`<a href="${urls.sponsor(s)}">${s.name}</a>`).map((x, i) => html`${i ? ", " : "Already with us: "}${x}`)}</p>
      </article>`)}</div>`
      : html`<div class="empty box">The sponsorship packages are being finalised — please get in touch to hear about them.</div>`}
    <section class="sp-contact box"><h3>Interested? Get in touch</h3>${paragraphs(site.sponsorship_contact || "Contact the league secretary — details on the Contact Us page.")}</section>
  </div>`);
}
