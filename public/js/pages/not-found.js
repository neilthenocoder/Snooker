// The "page not found" page. In snooker a foul gives four points away — so a missing
// page is "Foul. Four away." The cue ball rolls into the corner pocket once (not at all
// for visitors who ask for reduced motion).
import { html, mount } from "../core/dom.js";
import { setTitle } from "../core/router.js";

export default function notFound(view) {
  setTitle("Page not found");
  view.classList.add("flush");
  const path = location.pathname.length > 60 ? `${location.pathname.slice(0, 57)}…` : location.pathname;
  mount(view, html`<section class="nf">
    <div class="nf-table" aria-hidden="true">
      <span class="nf-pocket"></span>
      <span class="nf-ball white"></span>
      <span class="nf-ball red r1"></span><span class="nf-ball red r2"></span><span class="nf-ball black"></span>
    </div>
    <div class="wrap nf-body">
      <p class="nf-code"><span>4</span><span class="nf-zero"></span><span>4</span></p>
      <h1>Foul. Four away.</h1>
      <p class="nf-lead">There's no page at <b>${path}</b>. The link may be an old one, or the page has been moved.</p>
      <div class="btn-row">
        <a class="btn" href="/">Back to the home page</a>
        <a class="btn secondary" href="/fixtures">Fixtures</a>
        <a class="btn secondary" href="/results">Results</a>
        <a class="btn secondary" href="/league">League</a>
        <button type="button" class="btn ghost" data-search-open>Search the site</button>
      </div>
    </div>
  </section>`);
}
