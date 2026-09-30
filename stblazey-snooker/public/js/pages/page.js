import { html, mount, paragraphs } from "../core/dom.js";
import { table } from "../core/api.js";
import { breadcrumb } from "../core/components.js";
import { setTitle } from "../core/router.js";
import notFound from "./not-found.js";

export default async function page(view, { params }) {
  const p = (await table("pages", "sort")).find((x) => x.slug === params.slug);
  if (!p) return notFound(view);
  setTitle(p.title);
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], [p.title]])}
    <h1>${p.title}</h1>
    <div class="prose">${paragraphs(p.body)}</div>
  </div>`);
}
