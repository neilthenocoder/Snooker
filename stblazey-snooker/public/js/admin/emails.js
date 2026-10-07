// Admin → Result emails: who is emailed when a captain submits a scorecard, and a button
// to send a test. The addresses live in their own private table (never sent to visitors);
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
  mount(el, html`
    <div class="notice">When a captain presses <b>Submit final result</b>, the people below get one email about that match: the score, every frame, the breaks, who submitted it, and a button straight to <b>Results to approve</b>.
      One email per submitted card: pressing the button twice doesn't send two. If you send a card back to the captain and it is submitted again, you are told again.</div>
    ${panel("Result emails", html`<form class="form" data-email-form>
      <label class="check"><input type="checkbox" name="on" ${row.results_email_on ? "checked" : ""}> Send an email when a scorecard is submitted</label>
      <label>Send to <span class="muted" style="font-weight:400">(one email address per line — the results secretary, and anyone else who should know; up to 10)</span>
        <textarea name="to" style="min-height:96px" placeholder="results.secretary@example.com">${row.results_email_to ?? ""}</textarea></label>
      <div class="btn-row"><button class="btn">Save</button>
        <button type="button" class="btn secondary" data-email-test>Send a test email</button></div>
      <p class="muted" data-email-result style="margin:14px 0 0"></p>
    </form>`)}
    <div class="box prose" style="margin-top:22px;font-size:14px">
      <h3 style="margin-top:0">Before the first email can be sent</h3>
      <ol>
        <li>Create a free account at <b>resend.com</b> and make an API key (it starts with <code>re_</code>).</li>
        <li>In Netlify → Site configuration → Environment variables, add <code>RESEND_API_KEY</code> with that key, then redeploy the site.</li>
        <li>Until the league's own domain is verified in Resend, emails can only go to <b>the email address of the Resend account itself</b> — so put that address in “Send to” for the first test.</li>
        <li>To email anyone else: in Resend → Domains, add the league's domain, add the DNS records it shows, wait for “Verified”, then add <code>RESULTS_EMAIL_FROM</code> in Netlify (for example <code>St Blazey Snooker &lt;results@your-domain.co.uk&gt;</code>) and redeploy.</li>
      </ol>
      <p style="margin:0">The full walk-through, with screens to look for, is in the README under “Result emails”.</p>
    </div>`);

  const form = $("[data-email-form]", el), out = $("[data-email-result]", el);
  const read = () => ({ id: 1, results_email_on: form.elements.on.checked, results_email_to: addresses(form.elements.to.value).join("\n"), updated_at: new Date().toISOString() });
  const problem = (r) => {
    const list = addresses(r.results_email_to), bad = list.find((x) => !EMAIL.test(x));
    return bad ? `“${bad}” doesn't look like an email address.` : list.length > 10 ? "Ten addresses at most, please." : r.results_email_on && !list.length ? "Add at least one address, or untick the box." : null;
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const r = read(), bad = problem(r);
    if (bad) return toast(bad, "error");
    try { await save("private_settings", r); form.elements.to.value = r.results_email_to; toast("Saved"); }
    catch (err) { toast(friendly(err), "error"); }
  };
  $("[data-email-test]", el).onclick = async (e) => {
    const r = read(), bad = problem(r);
    if (bad) return toast(bad, "error");
    if (!addresses(r.results_email_to).length) return toast("Add the address to send the test to first", "error");
    e.target.disabled = true;
    out.textContent = "Sending…";
    try {
      if (!DEMO_MODE) await save("private_settings", r);     // the test goes to the saved addresses
      const res = await testResultEmail();
      out.textContent = `Sent to ${res.to.join(", ")} from ${res.from}. Check the inbox (and the spam folder the first time).${res.testMode ? " This is still Resend's test sender: it only delivers to the Resend account's own address until the league's domain is verified." : ""}`;
      toast("Test email sent");
    } catch (err) { out.textContent = err.message; toast("The test email wasn't sent — see the message under the buttons", "error"); }
    finally { e.target.disabled = false; }
  };
}
