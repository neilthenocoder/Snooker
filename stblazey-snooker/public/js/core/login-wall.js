// ─────────────────────────────────────────────────────────────
//  "Please log in" for the pages that change something on the website (Neil, round 57: "no one can do
//  anything to the website without being logged in"). Reading the website never needs a login; sending
//  anything to the league does — a support request, a competition entry, a CueView, a memory. The database
//  refuses the same things without a login (supabase/schema.sql, round 57).
// ─────────────────────────────────────────────────────────────
import { html, mount } from "./dom.js";

export function loginWall(view, { title, text, crumbs = "" }) {
  const back = location.pathname + location.search;
  mount(view, html`<div class="wrap login-wall">${crumbs}
    <div class="lw-box">
      <span class="lw-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3Zm3 4a2 2 0 0 1 1 3.7V19h-2v-1.3A2 2 0 0 1 12 14Z"/></svg></span>
      <h1>${title}</h1>
      <p>${text}</p>
      <div class="btn-row"><button type="button" class="btn green" data-account-open data-back="${back}">Log in</button><a class="btn ghost" href="/page/help">Help &amp; FAQs</a></div>
      <p class="muted lw-note">No login yet? The league secretary gives every player, captain and officer their own.</p>
    </div></div>`);
}
