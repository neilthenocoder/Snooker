// ─────────────────────────────────────────────────────────────
//  TWO-STEP LOGIN (Rich, round 22) — for the roles ticked under
//  Admin → Master Admin → Security → Two-step login.
//  After the password, the person types the 6-digit code from an
//  authenticator app on their phone (Google Authenticator, Microsoft
//  Authenticator, Authy…). The first time, they scan a QR code to add
//  the website to the app. Supabase keeps the secret; the database
//  refuses changes from these roles until the code has been given
//  in the session (session_ok() in supabase/schema.sql).
// ─────────────────────────────────────────────────────────────
import { html, mount, $ } from "./dom.js";
import { db } from "./db.js";
import { SITE, DEMO_MODE } from "../config.js";
import { refreshUser, signOut } from "./auth.js";

const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

/** The person's own two-step codes that are set up and working. */
export async function myFactors() {
  const data = unwrap(await db.auth.mfa.listFactors());
  return { verified: (data?.totp ?? []).filter((f) => f.status === "verified"), all: data?.all ?? [] };
}

/**
 * Draw the two-step step into `el`. `onDone(user)` runs once the code has been accepted;
 * `onCancel()` after "Log out" (the password login is undone).
 */
export async function twoStepPanel(el, { onDone, onCancel = () => {}, intro = "" } = {}) {
  let factorId = null, setup = null;
  try {
    const { verified, all } = await myFactors();
    if (verified.length) factorId = verified[0].id;
    else {
      // A half-finished setup from before is removed first, so a fresh QR code can be made.
      for (const f of all.filter((x) => x.status !== "verified")) await db.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      const data = unwrap(await db.auth.mfa.enroll({ factorType: "totp", friendlyName: `${SITE.name} ${new Date().toISOString().slice(0, 16)}`, issuer: SITE.name }));
      factorId = data.id; setup = data.totp;
    }
  } catch (err) {
    mount(el, html`<div class="notice error">Two-step login could not be started: ${err.message}</div>
      <div class="btn-row"><button type="button" class="btn ghost" data-ts-cancel>Log out</button></div>`);
    $("[data-ts-cancel]", el).addEventListener("click", async () => { await signOut(); onCancel(); });
    return;
  }
  mount(el, html`<div class="ts">
    ${intro ? html`<div class="notice">${intro}</div>` : ""}
    ${setup ? html`<h3 class="ts-h">Set up two-step login</h3>
      <ol class="ts-steps">
        <li>On your phone, open an authenticator app — <b>Google Authenticator</b>, <b>Microsoft Authenticator</b> or <b>Authy</b> (free in the app store).</li>
        <li>Press <b>+</b> (add an account) and scan this code:</li>
      </ol>
      <div class="ts-qr">${setup.qr_code ? html`<img src="${setup.qr_code}" alt="QR code for the authenticator app" width="190" height="190">` : ""}</div>
      <p class="muted ts-secret">Can't scan it? Choose “enter a setup key” in the app and type: <code>${setup.secret ?? ""}</code></p>
      <p><b>3.</b> Type the 6-digit code the app now shows:</p>`
    : html`<h3 class="ts-h">Two-step login</h3><p>Open the authenticator app on your phone and type the 6-digit code it shows for ${SITE.name}.</p>`}
    ${DEMO_MODE ? html`<p class="notice">Demo: any phone app is pretended — type <b>123456</b>.</p>` : ""}
    <form class="form ts-form" data-ts-form>
      <div data-ts-error></div>
      <label>Code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required placeholder="123 456"></label>
      <div class="btn-row"><button class="btn">${setup ? "Turn on two-step login" : "Continue"}</button><button type="button" class="btn ghost" data-ts-cancel>Log out</button></div>
    </form></div>`);
  $("[name=code]", el)?.focus();
  $("[data-ts-cancel]", el).addEventListener("click", async () => { await signOut(); onCancel(); });
  $("[data-ts-form]", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button:not([type=button])");
    btn.disabled = true;
    try {
      const code = e.target.elements.code.value.replace(/\s+/g, "");
      unwrap(await db.auth.mfa.challengeAndVerify({ factorId, code }));
      onDone(await refreshUser());
    } catch (err) {
      mount($("[data-ts-error]", el), html`<div class="notice error">${/invalid|expired/i.test(err.message) ? "That code isn't right (or has just run out). Type the code the app shows now." : err.message}</div>`);
      btn.disabled = false;
    }
  });
}
