import { html, mount, $, readForm } from "../core/dom.js";
import { signIn, homeFor } from "../core/auth.js";
import { DEMO_MODE } from "../config.js";
import { breadcrumb } from "../core/components.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";

export default async function login(view, { user }) {
  setTitle("Login");
  if (user) return navigate(homeFor(user), { replace: true });
  mount(view, html`<div class="wrap" style="max-width:520px">
    ${breadcrumb([["Home", "/"], ["Login"]])}
    <h1>Log in</h1>
    ${DEMO_MODE ? html`<div class="notice demo-logins"><b>Demo logins</b> — click one to fill it in:
      ${[["Master Admin", "admin@demo.test", "admin123"], ["Captain (Bethel A)", "captain@demo.test", "captain123"], ["Player", "player@demo.test", "player123"], ["Player (not linked to anyone)", "fan@demo.test", "fan12345"],
         ["Competition Secretary + Captain", "compsec@demo.test", "compsec123"], ["Committee Member", "committee@demo.test", "committee123"]]
        .map(([who, email, pw]) => html`<button type="button" data-demo="${email}|${pw}"><b>${who}</b> ${email} / ${pw}</button>`)}</div>` : ""}
    <form class="form" id="login-form">
      <div id="login-error"></div>
      <label>Email<input name="email" type="email" autocomplete="username" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn" type="submit">Log in</button>
      <p class="muted" style="font-size:13px;margin-bottom:0">Accounts are created by the league secretary. Players: your login opens <b>My Snooker</b>, your own page for your team. Forgotten your password? Ask them to reset it.</p>
    </form>
  </div>`);

  view.querySelector(".demo-logins")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-demo]");
    if (!b) return;
    const [email, pw] = b.dataset.demo.split("|");
    $("#login-form").elements.email.value = email;
    $("#login-form").elements.password.value = pw;
  });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const { email, password } = readForm(e.target);
      const u = await signIn(email, password);
      await refreshShell();
      navigate(homeFor(u));
    } catch (err) {
      mount($("#login-error"), html`<div class="notice error">${err.message}</div>`);
      btn.disabled = false;
    }
  });
}
