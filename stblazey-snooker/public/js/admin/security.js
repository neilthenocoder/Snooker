// ─────────────────────────────────────────────────────────────
//  Admin → Master Admin → Security (Rich, round 22).
//  Site security: what protects the website, checked live (most of Rich's WordPress list —
//  XML-RPC, RSS feeds, system folders — doesn't exist on a site built like this one).
//  Login security, saved in security_settings (Master Admin only) and enforced by the database
//  (session_ok(), login_wait() in supabase/schema.sql) and the logins function:
//    custom login address · who may log in · two-step login by role · no common login names ·
//    a limit on wrong passwords. And the last logins, with who failed and from where.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$, toast, fmtDate, fmtTime, confirmBox } from "../core/dom.js";
import { securitySettings, save, loginAttempts, table, invalidate } from "../core/api.js";
import { adminUsers } from "../core/db.js";
import { getUser, currentAal, ROLE_LABEL } from "../core/auth.js";
import { panel, dataTable } from "../core/components.js";
import { twoStepPanel, myFactors } from "../core/two-step.js";
import { DEMO_MODE } from "../config.js";
import { friendly } from "./crud.js";

const ROLES = ["admin", "league_admin", "competition_secretary", "league_secretary", "committee_member", "president", "vice_chairman", "chairman", "captain", "vice_captain", "player"];
const SLUG = /^[a-z0-9][a-z0-9-]{2,40}$/;
const tick = (ok, text) => html`<span class="sec-tick ${ok ? "ok" : "warn"}" aria-hidden="true">${ok ? "✓" : "!"}</span><div><span class="sr-only">${ok ? "On" : "Check"}: </span>${text}</div>`;

async function headerCheck() {
  try {
    const res = await fetch("/", { method: "GET", cache: "no-store" });
    const h = (k) => res.headers.get(k) ?? "";
    return { csp: /script-src/.test(h("content-security-policy")), frames: /deny|sameorigin/i.test(h("x-frame-options")) || /frame-ancestors/.test(h("content-security-policy")),
      sniff: /nosniff/i.test(h("x-content-type-options")), hsts: !!h("strict-transport-security"), server: h("server"), powered: h("x-powered-by") };
  } catch { return null; }
}

export async function securityPage(el) {
  const [sec, attempts, profiles, me, aal, factors, headers] = await Promise.all([
    securitySettings().catch(() => null), loginAttempts(60), table("profiles", "full_name").catch(() => []), getUser(), currentAal(), myFactors().catch(() => ({ verified: [] })), headerCheck()]);
  const s = sec ?? { login_slug: null, hide_login_button: false, login_access: "all", mfa_roles: [], block_common_names: true, common_names: "admin\nadministrator\nroot\ntest\nuser\nguest", max_attempts: 5, lockout_minutes: 15 };
  const haveMfa = factors.verified.length > 0;
  const live = !DEMO_MODE && headers;
  const failed24 = attempts.filter((a) => !a.ok && Date.now() - Date.parse(a.at) < 864e5).length;

  mount(el, html`
    ${panel("Site security", html`<ul class="sec-list">
      <li>${tick(true, html`<b>Lock and protect system folders</b> — only the website's public files can be opened. The database is reached only through its security rules (every table checks who is asking), and the secret keys live in Netlify's settings, never in a file.`)}</li>
      <li>${tick(!(headers?.powered), html`<b>Hide version</b> — the pages don't say which version of the website they are or what it is built with${headers?.powered ? html` <em>(this server still names itself: “${headers.powered}”)</em>` : ""}. The version number is only shown here, in the dashboard (Version history).`)}</li>
      <li>${tick(true, html`<b>XML-RPC</b> — switched off for good: it is a WordPress feature, and this website isn't WordPress, so there is nothing to attack.`)}</li>
      <li>${tick(true, html`<b>RSS and Atom feeds</b> — the website has none, so nothing can be copied from them automatically.`)}</li>
      <li>${tick(live ? headers.csp && headers.frames && headers.sniff : true, html`<b>Advanced XSS protection</b> — everything typed into the website is made safe before it is shown, and the browser is told exactly where scripts may come from (Content-Security-Policy), so a script slipped into a page cannot run.
        ${live ? html`<br><small class="muted">Checked just now: Content-Security-Policy ${headers.csp ? "on" : "missing"} · no framing by other websites ${headers.frames ? "on" : "missing"} · no file-type guessing ${headers.sniff ? "on" : "missing"} · HTTPS only ${headers.hsts ? "on" : "missing"}</small>` : html`<br><small class="muted">The live check runs on the real website (Netlify sends these from public/_headers).</small>`}`)}</li>
    </ul>`)}

    <div class="sec-you ${haveMfa ? "ok" : ""}">${haveMfa ? html`<b>✓ Two-step login is set up for you</b>${aal === "aal2" ? " and used in this session." : " — but not used in this session yet."}`
      : html`<b>Your own two-step login isn't set up yet.</b> Set it up for yourself first — then you can make it a must for the Master Admin. <button type="button" class="btn small green" data-sec-setup>Set it up now</button>`}<div data-sec-2fa></div></div>
    <form class="form" data-sec-form>
    ${panel("Login security", html`
      <h3 class="sec-h">Custom login address</h3>
      <p class="muted">People who try to break in look for <code>/login</code>. Give the login page an address of your own instead: <code>/login</code> then shows “page not found”.
        (The log-in button in the menu bar still works unless you hide it below. Logins are checked by Supabase whichever way people arrive, so this hides the door rather than locking it.)</p>
      <label>The login page's address<span class="sec-slug"><span>${location.origin}/</span><input name="login_slug" value="${s.login_slug ?? ""}" placeholder="login" maxlength="41" pattern="[a-z0-9][a-z0-9\\-]{2,40}"></span>
        <small class="muted">Leave empty for /login. Small letters, numbers and dashes, at least 3 — e.g. <code>clubhouse-door</code>. Write it down: tell the officers and captains.</small></label>
      <label class="check"><input type="checkbox" name="hide_login_button" ${s.hide_login_button ? "checked" : ""}> Also hide the log-in button (the person in the menu bar) from visitors — people then log in only at the address above</label>

      <h3 class="sec-h">Login access</h3>
      <div class="sec-radios">${[["all", "Everyone with a login"], ["officers", "League officers only (captains, vice captains and players can't log in for now)"], ["master", "Only the Master Admin (everyone else is kept out while you work on something)"]]
        .map(([v, l]) => html`<label class="check"><input type="radio" name="login_access" value="${v}" ${s.login_access === v ? "checked" : ""}> ${l}</label>`)}</div>

      <h3 class="sec-h">Two-step login</h3>
      <p class="muted">After the password, a 6-digit code from an app on the person's phone (Google Authenticator, Microsoft Authenticator, Authy). Tick the roles that must use it: the first time each person logs in afterwards, they scan a QR code to set it up.
        Until they have given the code, the database refuses anything their login tries to change.</p>
      <p class="muted">${haveMfa ? "✓ Your own two-step login is set up (see the box above)." : "Set up your own two-step login first (the box above) — then you can make it a must for the Master Admin."}</p>
      <div class="sec-roles">${ROLES.map((r) => html`<label class="check"><input type="checkbox" name="mfa" value="${r}" ${s.mfa_roles?.includes(r) ? "checked" : ""}> ${ROLE_LABEL[r]}</label>`)}</div>
      <div class="sec-reset"><label>Someone lost their phone? Reset their two-step login (they set it up again next time they log in)
        <span class="btn-row"><select data-sec-who><option value="">Choose a login…</option>${profiles.map((p) => html`<option value="${p.id}">${p.full_name || p.email} — ${ROLE_LABEL[p.role] ?? p.role}</option>`)}</select>
        <button type="button" class="btn small ghost" data-sec-reset>Reset</button></span></label></div>

      <h3 class="sec-h">Disable common usernames</h3>
      <label class="check"><input type="checkbox" name="block_common_names" ${s.block_common_names ? "checked" : ""}> Don't allow new logins whose email starts with one of these names (they are the first ones people guess)</label>
      <label>Names, one per line<textarea name="common_names" rows="4">${s.common_names ?? ""}</textarea></label>

      <h3 class="sec-h">Limit login attempts</h3>
      <div class="grid-2"><label>Wrong passwords allowed in a row <small class="muted">(0 = no limit)</small><input type="number" name="max_attempts" min="0" max="50" value="${s.max_attempts}"></label>
        <label>Then wait (minutes)<input type="number" name="lockout_minutes" min="1" max="1440" value="${s.lockout_minutes}"></label></div>
      <p class="muted" style="margin-top:0">Counted for each email address from each place, so someone guessing can't lock the real person out from their own phone. Supabase also limits sign-ins on its side.</p>
      <div class="btn-row"><button class="btn">Save login security</button></div>`, { color: "yellow" })}
    </form>

    ${panel(html`Recent logins${failed24 ? html` <span class="nav-count">${failed24} failed today</span>` : ""}`, dataTable([
      { label: "When", cell: (a) => `${fmtDate(a.at)} ${fmtTime(a.at)}` },
      { label: "Email", cell: (a) => a.email },
      { label: "From", cell: (a) => a.ip ?? "–", cls: "hide-sm" },
      { label: "Result", cell: (a) => (a.ok ? html`<span class="tally win">✓</span> Logged in` : html`<span class="tally loss">✗</span> Wrong password`) },
    ], attempts, { empty: "No logins recorded yet." }))}`);

  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.secSetup !== undefined) {
      t.remove();
      return twoStepPanel($("[data-sec-2fa]", el), { intro: "Set up two-step login for your own login:", onDone: () => { toast("Two-step login is on for you"); invalidate(); securityPage(el); }, onCancel: () => location.assign("/") });
    }
    if (t.dataset.secReset !== undefined) {
      const id = $("[data-sec-who]", el).value, who = profiles.find((p) => p.id === id);
      if (!who) return toast("Choose a login first.", "error");
      if (!(await confirmBox(`${who.full_name || who.email}'s two-step login is removed. The next time they log in they scan a new QR code.`, { title: "Reset two-step login?", ok: "Reset" }))) return;
      try { const r = await adminUsers({ action: "reset_mfa", id }); toast(r.removed ? "Reset — they set it up again next time" : "They hadn't set it up yet"); } catch (err) { toast(friendly(err), "error"); }
    }
  };
  el.onsubmit = async (e) => {
    if (!e.target.matches("[data-sec-form]")) return;
    e.preventDefault();
    const f = e.target.elements, slug = f.login_slug.value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
    const mfa = $$("[name=mfa]:checked", e.target).map((x) => x.value);
    if (slug && !SLUG.test(slug)) return toast("The login address: small letters, numbers and dashes only, at least 3.", "error");
    if (slug && ["admin", "login", "my", "news", "team", "player", "match", "page", "fixtures", "league", "competitions", "live", "marketplace", "newsletter", "unsubscribe", "results", "calendar", "players", "seasons"].includes(slug)) return toast("That address is already a page of the website — choose another.", "error");
    if (f.hide_login_button.checked && !slug) return toast("Choose the login page's own address before hiding the log-in button.", "error");
    if (mfa.includes(me?.profile?.role) && aal !== "aal2") return toast("Set up two-step login for yourself first (and use it in this session) — otherwise your own login would be locked out.", "error");
    const row = { id: 1, login_slug: slug || null, hide_login_button: f.hide_login_button.checked, login_access: f.login_access.value, mfa_roles: mfa,
      block_common_names: f.block_common_names.checked, common_names: f.common_names.value.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean).join("\n"),
      max_attempts: Math.max(0, Math.min(50, Number(f.max_attempts.value) || 0)), lockout_minutes: Math.max(1, Math.min(1440, Number(f.lockout_minutes.value) || 15)), updated_at: new Date().toISOString() };
    if (slug !== (s.login_slug ?? "") && !(await confirmBox(slug ? `From now on the login page is ${location.origin}/${slug} — and ${location.origin}/login shows “page not found”. Make sure the officers and captains know.` : "The login page goes back to /login.", { title: "Change the login address?", ok: "Yes, change it" }))) return;
    const btn = e.target.querySelector("button:not([type=button])"); btn.disabled = true;
    try { await save("security_settings", row); toast("Login security saved"); invalidate(); securityPage(el); }
    catch (err) { toast(friendly(err), "error"); btn.disabled = false; }
  };
}
