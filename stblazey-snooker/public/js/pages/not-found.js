import { html, mount } from "../core/dom.js";
import { setTitle } from "../core/router.js";

export default function notFound(view) {
  setTitle("Page not found");
  mount(view, html`<div class="wrap"><h1>Page not found</h1>
    <p>Sorry, we couldn't find that page. <a href="/" style="color:var(--red);font-weight:700">Back to the home page</a></p></div>`);
}
