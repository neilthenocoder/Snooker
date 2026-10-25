// Admin → Emails: who is emailed when a captain submits a scorecard (plus the Master Admin and
// the captains' copies) and when someone enters competitions, and buttons to send a test. The addresses live in their own private table (never sent to visitors);
// the email itself is sent by the Netlify function netlify/functions/result-email.mjs
// through Resend (resend.com). Setting it up is in the README: "Result emails".
import { html, mount, $, toast } from "../core/dom.js";
import { privateSettings, save, testResultEmail } from "../core/api.js";
import { DEMO_MODE } from "../config.js";
import { panel } from "../core/components.js";
import { friendly } from "./crud.js";

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const addresses = (text) => String(text ?? "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

export async function emailsPage(el) {
  const row = (await privateSettings().catch(() => null)) ?? { id: 1, results_email_on: false, results_email_to: "" };
  const on = (v, standard) => (v === undefined || v === null ? standard : v);
  mount(el, html`
    <div class="notice">The league's automatic emails. <b>Results:</b> when a captain presses <b>Submit final result</b>, the people below get one email about that match — the score, every frame, the breaks, who submitted it, and a button to <b>Results to approve</b>.
      The Master Admin is copied on every one, and the captains and vice captains of both teams get their own copy of the card. <b>Entries:</b> each time someone enters competitions on the entry form, the competition secretary gets an email with the entries, fees and pay-by dates.</div>
    ${panel("Result emails", html`<form class="form" data-email-form>
      <label class="check"><input type="checkbox" name="on" ${row.results_email_on ? "checked" : ""}> Send an email when a scorecard is submitted</label>
      <label>Send to <span class="muted" style="font-weight:400">(one email address per line — the results secretary, and anyone else who should know; up to 10)</span>
        <textarea name="to" style="min-height:96px" placeholder="results.secretary@example.com">${row.results_email_to ?? ""}</textarea></label>
      <label class="check"><input type="checkbox" name="master" ${on(row.results_copy_master, true) ? "checked" : ""}> Always send a copy to the Master Admin (every result)</label>
      <label class="check"><input type="checkbox" name="captains" ${on(row.results_copy_captains, true) ? "checked" : ""}> Send the captains and vice captains of both teams a copy of their card (to the email address they log in with)</label>
      <div class="btn-row form-actions"><button class="btn">Save</button>
        <button type="button" class="btn secondary" data-email-test="results">Send a test email</button></div>
      <p class="muted" data-email-result="results" style="margin:14px 0 0"></p>
    </form>`)}
    ${panel("Competition entry emails", html`<form class="form" data-entries-form>
      <label class="check"><input type="checkbox" name="on" ${row.entries_email_on ? "checked" : ""}> Email the competition secretary when someone enters on the entry form</label>
      <label>Send to <span class="muted" style="font-weight:400">(one email address per line — the competition secretary; up to 10)</span>
        <textarea name="to" style="min-height:76px" placeholder="competition.secretary@example.com">${row.entries_email_to ?? ""}</textarea></label>
      <div class="btn-row form-actions"><button class="btn">Save</button>
        <button type="button" class="btn secondary" data-email-test="entries">Send a test email</button></div>
      <p class="muted" data-email-result="entries" style="margin:14px 0 0"></p>
    </form>`, { color: "yellow" })}
    <div class="box prose" style="margin-top:22px;font-size:14px">
      <h3 style="margin-top:0">Before the first email can be sent</h3>
      <ol>
        <li>Create a free account at <b>resend.com</b> and make an API key (it starts with <code>re_</code>).</li>
        <li>In Netlify → Site configuration → Environment variables, add <code>RESEND_API_KEY</code> with that key, then redeploy the site.</li>
        <li>Until the league's own domain is verified in Resend, emails can only go to <b>the email address of the Resend account itself</b> — so put that address in “Send to” for the first test. (The copies to the Master Admin and the captains need the domain verified.)</li>
        <li>To email anyone else: in Resend → Domains, add the league's domain, add the DNS records it shows, wait for “Verified”, then add <code>RESULTS_EMAIL_FROM</code> in Netlify (for example <code>St Blazey Snooker &lt;results@your-domain.co.uk&gt;</code>) and redeploy.</li>
      </ol>
      <p style="margin:0">The full walk-through, with screens to look for, is in the README under “Result emails”.</p>
    </div>`);

  const results = $("[data-email-form]", el), entries = $("[data-entries-form]", el);
  // Both forms save the one private row, so each save sends everything on the page.
  const read = () => ({ id: 1,
    results_email_on: results.elements.on.checked, results_email_to: addresses(results.elements.to.value).join("\n"),
    results_copy_master: results.elements.master.checked, results_copy_captains: results.elements.captains.checked,
    entries_email_on: entries.elements.on.checked, entries_email_to: addresses(entries.elements.to.value).join("\n"),
    updated_at: new Date().toISOString() });
  const problem = (r) => {
    for (const [list, onFlag, what] of [[addresses(r.results_email_to), r.results_email_on && !r.results_copy_master && !r.results_copy_captains, "result emails"], [addresses(r.entries_email_to), r.entries_email_on, "entry emails"]]) {
      const bad = list.find((x) => !EMAIL.test(x));
      if (bad) return `“${bad}” doesn't look like an email address.`;
      if (list.length > 10) return "Ten addresses at most, please.";
      if (onFlag && !list.length) return `Add at least one address for the ${what}, or untick its box.`;
    }
    return null;
  };
  const store = async () => {
    const r = read(), bad = problem(r);
    if (bad) { toast(bad, "error"); return null; }
    await save("private_settings", r);
    results.elements.to.value = r.results_email_to; entries.elements.to.value = r.entries_email_to;
    return r;
  };
  for (const form of [results, entries]) form.onsubmit = async (e) => {
    e.preventDefault();
    try { if (await store()) toast("Saved"); } catch (err) { toast(friendly(err), "error"); }
  };
  el.querySelectorAll("[data-email-test]").forEach((btn) => { btn.onclick = async () => {
    const which = btn.dataset.emailTest, out = $(`[data-email-result="${which}"]`, el);
    const list = addresses((which === "entries" ? entries : results).elements.to.value);
    if (!list.length) return toast("Add the address to send the test to first", "error");
    btn.disabled = true;
    out.textContent = "Sending…";
    try {
      if (!DEMO_MODE && !(await store())) return;     // the test goes to the saved addresses
      const res = await testResultEmail(which);
      out.textContent = `Sent to ${res.to.join(", ")} from ${res.from}. Check the inbox (and the spam folder the first time).${res.testMode ? " This is still Resend's test sender: it only delivers to the Resend account's own address until the league's domain is verified." : ""}`;
      toast("Test email sent");
    } catch (err) { out.textContent = err.message; toast("The test email wasn't sent — see the message under the buttons", "error"); }
    finally { btn.disabled = false; }
  }; });
}
