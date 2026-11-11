// /newsletter — sign up to the league's newsletter (the same as the pop-up), and
// /unsubscribe?t=… — the link at the bottom of every newsletter (Rich, round 22).
import { html, mount, $ } from "../core/dom.js";
import { newsletterSubscribe, newsletterUnsubscribe, settings } from "../core/api.js";
import { breadcrumb } from "../core/components.js";
import { setTitle } from "../core/router.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function newsletterPage(view, { query, user }) {
  const leaving = location.pathname.startsWith("/unsubscribe");
  setTitle(leaving ? "Unsubscribe" : "Newsletter");
  const site = await settings();
  const shell = (title, body) => mount(view, html`<div class="wrap" style="max-width:620px">
    ${breadcrumb([["Home", "/"], [title]])}<h1>${title}</h1><div class="box nl-page">${body}</div></div>`);

  if (leaving) {
    const token = query.get("t") ?? "";
    if (!UUID.test(token)) return shell("Unsubscribe", html`<p>To stop getting the newsletter, use the <b>Unsubscribe</b> link at the bottom of any newsletter email — it is made for your address only.</p>
      <p class="muted">Can't find one? Email the league and ask to be taken off the list.</p>`);
    shell("Unsubscribe", html`<p data-nl-msg>Taking you off the list…</p>`);
    try {
      const who = await newsletterUnsubscribe(token);
      mount($("[data-nl-msg]", view), who === "unknown"
        ? html`That link is not on the list any more — you won't get any more newsletters.`
        : html`<b>Done — ${who} won't get any more newsletters.</b><br>Changed your mind? <a href="/newsletter">Sign up again</a>.`);
    } catch (err) { mount($("[data-nl-msg]", view), html`<span class="notice error">${err.message}</span>`); }
    return;
  }

  shell("Newsletter", html`<p>${site.newsletter_text || "Results, competition draws, presentation night and league news — straight to your inbox. Unsubscribe any time with the link at the bottom of every email."}</p>
    <form class="form" data-nl-form style="max-width:420px">
      <label>Your name <span class="muted">(optional)</span><input name="name" autocomplete="name" maxlength="120" value="${user?.profile?.full_name ?? ""}"></label>
      <label>Email address<input name="email" type="email" autocomplete="email" required maxlength="254" value="${user?.email ?? ""}"></label>
      <div data-nl-error></div><button class="btn green">Sign me up</button></form>`);
  $("[data-nl-form]", view).addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await newsletterSubscribe(e.target.elements.email.value.trim(), e.target.elements.name.value.trim());
      try { localStorage.setItem("sbds-newsletter", JSON.stringify("subscribed")); } catch { /* not remembered */ }
      mount(e.target, html`<p class="notice ok" style="margin:0"><b>You're signed up — thank you!</b> Every newsletter has a link at the bottom to unsubscribe.</p>`);
    } catch (err) { mount($("[data-nl-error]", view), html`<div class="notice error">${err.message}</div>`); btn.disabled = false; }
  });
}
