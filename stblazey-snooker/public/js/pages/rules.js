// /rules — the league's rules and the rules of the game, each on its own tab, with a
// contents list made from the headings. The text comes from Admin → Info pages: every page
// with "Show on the Rules page" ticked is a tab here. Headings, bullets, sub-bullets,
// numbered lists and tables are typed as plain text (see core/markup.js).
import { html, mount } from "../core/dom.js";
import { table } from "../core/api.js";
import { renderMarkup } from "../core/markup.js";
import { breadcrumb, gallery } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function rules(view, { query }) {
  const all = await table("pages", "sort");
  // The pages ticked "Show on the Rules page" — or, until one is ticked, the info page called Rules.
  const ticked = all.filter((p) => p.show_in_rules);
  const pages = ticked.length ? ticked : all.filter((p) => p.slug === "rules");
  const page = pages.find((p) => p.slug === query.get("p")) ?? pages[0];
  setTitle(page ? page.title : "Rules");
  adminEdit("pages", page?.id ?? null, page ? {} : { label: "Add the rules" });
  if (!page) {
    return mount(view, html`<div class="wrap">${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Rules"]])}<h1>Rules</h1>
      <div class="notice">The rules haven't been added yet. In the dashboard, open Website → Info pages, add a page for each set of rules and tick “Show on the Rules page”.</div></div>`);
  }
  const { html: body, headings } = renderMarkup(page.body);
  const contents = headings.filter((h) => h.level <= 2);
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Rules", "/rules"], [page.title]])}
    <h1>${page.title}</h1>
    ${pages.length > 1 ? html`<div class="rule-tabs" role="tablist">${pages.map((p) => html`<a class="${p.id === page.id ? "on" : ""}" href="/rules?p=${p.slug}" role="tab" aria-selected="${p.id === page.id}">${p.title}</a>`)}</div>` : ""}
    <div class="rules-layout ${contents.length > 2 ? "" : "plain"}">
      ${contents.length > 2 ? html`<nav class="rules-toc" aria-label="On this page"><h4>On this page</h4>
        <ol>${contents.map((h) => html`<li class="l${h.level}"><a href="#${h.id}">${h.text}</a></li>`)}</ol>
        <button type="button" class="btn small ghost" onclick="window.print()">Print these rules</button></nav>` : ""}
      <article class="prose rich rules-body">${page.summary ? html`<p class="lead">${page.summary}</p>` : ""}${body}</article>
    </div>
    ${page.gallery?.length ? html`<div><h3>Gallery</h3>${gallery(page.gallery)}</div>` : ""}
  </div>`);
}
