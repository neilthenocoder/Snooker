import { html, mount, $, readForm, toast } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { isCaptain, isAdmin, canEditFixture, changePassword } from "../core/auth.js";
import { breadcrumb, panel, fixturesTable, urls, statusBadge } from "../core/components.js";
import { setTitle, navigate } from "../core/router.js";
import { mustLogin } from "./scorecard.js";

export default async function captain(view, { user }) {
  setTitle("My team");
  if (!user) return mustLogin(view);
  if (isAdmin(user)) return navigate("/admin", { replace: true });
  const ctx = await seasonContext();
  const team = ctx.team.get(user.profile?.team_id);
  if (!isCaptain(user) || !team) {
    return mount(view, html`<div class="wrap"><h1>My team</h1><div class="notice error">Your account isn't linked to a team yet. Please contact the league secretary.</div></div>`);
  }
  const role = user.profile.role === "vice_captain" ? "Vice Captain" : "Team Captain";

  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["My team"]])}
      <h1>${team.name} – ${ctx.season?.name}</h1>
      <p>Logged in as <b>${user.profile.full_name || user.email}</b> (${role}). You can enter and edit scorecards for your own
        team's matches until the league secretary approves them.</p></div>
    ${panel(`${team.name} fixtures`, fixturesTable(ctx, ctx.fixturesFor(team.id), {
      actions: (f) => canEditFixture(user, f)
        ? html`<a class="btn small" href="${urls.scorecard(f)}">${ctx.hasResult(f) ? "Edit scorecard" : "Enter scorecard"}</a>`
        : html`${statusBadge(f.status)} <a href="${urls.match(f)}">View</a>`,
    }))}
    ${panel("Change your password", html`<form class="form" id="pw-form" style="max-width:420px">
      <label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
      <label>Repeat new password<input name="repeat" type="password" minlength="8" autocomplete="new-password" required></label>
      <button class="btn secondary">Update password</button></form>`)}
  </div>`);

  $("#pw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { password, repeat } = readForm(e.target);
    if (password !== repeat) return toast("Passwords don't match", "error");
    try { await changePassword(password); e.target.reset(); toast("Password updated"); } catch (err) { toast(err.message, "error"); }
  });
}
