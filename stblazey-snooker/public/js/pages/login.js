import { html, mount, $, readForm } from "../core/dom.js";
import { signIn, isAdmin } from "../core/auth.js";
import { DEMO_MODE } from "../config.js";
import { breadcrumb } from "../core/components.js";
import { setTitle, navigate, refreshShell } from "../core/router.js";

export default async function login(view, { user }) {
  setTitle("Login");
  if (user) return navigate(isAdmin(user) ? "/admin" : "/captain", { replace: true });
  mount(view, html`<div class="wrap" style="max-width:520px">
    ${breadcrumb([["Home", "/"], ["Login"]])}
    <h1>Captain & admin login</h1>
    ${DEMO_MODE ? html`<div class="notice">Demo logins — admin: <b>admin@demo.test</b> / <b>admin123</b> · captain (Bethel A): <b>captain@demo.test</b> / <b>captain123</b></div>` : ""}
    <form class="form" id="login-form">
      <div id="login-error"></div>
      <label>Email<input name="email" type="email" autocomplete="username" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn" type="submit">Log in</button>
      <p class="muted" style="font-size:13px;margin-bottom:0">Accounts are created by the league secretary. Forgotten your password? Ask them to reset it.</p>
    </form>
  </div>`);

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const { email, password } = readForm(e.target);
      const u = await signIn(email, password);
      await refreshShell();
      navigate(isAdmin(u) ? "/admin" : "/captain");
    } catch (err) {
      mount($("#login-error"), html`<div class="notice error">${err.message}</div>`);
      btn.disabled = false;
    }
  });
}
