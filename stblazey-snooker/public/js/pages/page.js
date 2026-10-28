import { html, mount, $ } from "../core/dom.js";
import { table } from "../core/api.js";
import { markup } from "../core/markup.js";
import { breadcrumb, gallery } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

// ── FAQs (round 54, Rich: "FAQs like play.wst.tv/help — expanders") ──────────────────────────────
// In any info page's text, a line starting "??" is a question; the lines under it (until the next "??" or a
// "# heading") are its answer, which can use all the usual formatting. Each question opens and closes.
// The Help page (/page/help) has a built-in set below until the league writes its own.
const BUILT_IN_FAQS = `# Getting started
?? How do I log in?
Press **Log in** at the top of any page (on a phone it is also in the ☰ menu). Your login — an email address and a password — comes from the league secretary.
?? I have forgotten my password
Ask the league secretary to set a new one for you, or send a request from **Contact the league** (choose *My login & account*). Once you are logged in you can change it yourself under **Password & details** in your menu.
?? How do I find my way around?
The main pages are along the top: Home, Fixtures, League, Competitions, News and Live. Everything else is under **More**. You can also press the magnifying glass and type what you are looking for — "fixtures", "league tables", a player or a team. **Help: show me around** at the bottom of every page gives you a quick guided tour.
?? Can I have the website on my phone like an app?
Yes. Open the ☰ menu and press **Add to home screen**. On an iPhone you can also press the Share button in Safari and choose **Add to Home Screen**. It then opens full screen, like an app, and keeps itself up to date.
# My Snooker
?? What is My Snooker?
Your own page of the league, built round your team and the players you follow: your next match, where your team is in the table, your ranking, your breaks, results, fixtures and news. Open it with the ★ (on a phone) or **My Snooker** in your menu.
?? How do I choose my team or follow players?
Open **My Snooker settings** in your menu, or press **☆ Follow** on any team or player page. You can follow as many as you like.
?? Can I choose what I see, and in what order?
Yes. In **My Snooker settings**, tick the sections you want and use the ↑ and ↓ buttons to put the most important ones first. Press **Save my choices** when you are done.
# Scores & results
?? How is a scorecard entered?
Captains (and vice captains) enter their team's scorecard from **My team**, frame by frame, and add a photo of the paper scorecard. The league secretary then checks and approves it.
?? When do results appear on the website?
As soon as a captain submits the scorecard — marked as waiting for approval — and for good once the league secretary approves it.
?? A result looks wrong. What should I do?
Speak to your captain, or send it to the league from **Contact the league** (choose *Scorecards & results*) — it goes straight to the person who can correct it.
?? Why do the match times look different on my phone?
The website shows times in your own time zone. In the UK you will always see UK time; if you are abroad, you see your local time, with UK time alongside on the match page.
# Competitions
?? How do I enter a competition?
Use **Enter a competition** (search for it, or find it on the Competitions page) while entries are open.
?? Where do I find my next cup match?
Open **Competitions**, then the competition, to see the draw, the round deadlines and the dates of the matches.
# Contacting the league
?? How do I ask the league something or report a problem?
Use **Contact the league** (at the bottom of this page, in the footer, or in your account menu). Log in, choose what it is about and it goes straight to the person who looks after that. You get a reference number and the answer by email.
?? Where do I see the answer?
By email, and under **Help & support** in your account menu, which lists all your requests. You can reply from there too.
# Notifications & the app
?? How do I turn notifications on or off?
Press the bell at the top. You can switch each kind on or off — results, breaks, news and more.
?? The news on my phone looks out of date
The website refreshes itself whenever you come back to it, and every few minutes while it is open. If something still looks old, close it and open it again.`;

/** Split an info page's text into ordinary text and FAQs. */
function faqParts(text) {
  const parts = [];
  let plain = [], faq = null;
  const flushPlain = () => { if (plain.join("").trim()) parts.push({ plain: plain.join("\n") }); plain = []; };
  const flushFaq = () => { if (faq) { const last = parts.at(-1); if (last?.faqs) last.faqs.push(faq); else parts.push({ faqs: [faq] }); faq = null; } };
  for (const line of String(text ?? "").split("\n")) {
    const q = line.match(/^\s*\?\?\s*(.+)$/);
    if (q) { flushPlain(); flushFaq(); faq = { q: q[1].trim(), a: [] }; }
    else if (faq && /^\s*#/.test(line)) { flushFaq(); plain.push(line); }
    else if (faq) faq.a.push(line);
    else plain.push(line);
  }
  flushPlain(); flushFaq();
  return parts;
}
const hasFaqs = (text) => /^\s*\?\?/m.test(String(text ?? ""));

/** An info page (Admin → Info pages). The text can use headings, bullets and tables — see core/markup.js — and FAQs. */
export default async function page(view, { params }) {
  const p = (await table("pages", "sort")).find((x) => x.slug === params.slug);
  if (!p) return notFound(view);
  setTitle(p.title);
  adminEdit("pages", p.id);
  const ownFaqs = hasFaqs(p.body);
  const builtIn = !ownFaqs && params.slug === "help";
  const parts = [...faqParts(p.body), ...(builtIn ? [{ plain: "## Frequently asked questions" }, ...faqParts(BUILT_IN_FAQS)] : [])];
  const anyFaqs = parts.some((x) => x.faqs);
  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Our League", "/league"], [p.title]])}
    <h1>${p.title}</h1>
    ${anyFaqs ? html`<label class="faq-search"><span class="sr-only">Search the questions</span><input type="search" placeholder="Search the questions — e.g. password, scorecard, notifications" data-faq-q autocomplete="off"></label>` : ""}
    <div class="prose rich" data-faq-body>${parts.map((x) => (x.plain ? markup(x.plain)
      : html`<div class="faq-list">${x.faqs.map((f) => html`<details class="faq"><summary>${f.q}</summary><div class="faq-a">${markup(f.a.join("\n"))}</div></details>`)}</div>`))}</div>
    <p class="faq-none" data-faq-none hidden>No questions match. Try another word, or <a href="/support">ask the league</a>.</p></div>
    ${params.slug === "help" || /contact/.test(params.slug) ? html`<section class="sup-cta"><div><h2>${params.slug === "help" ? "Still need help?" : "Send the league a message"}</h2><p>Send the league your question or problem. It goes straight to the person who looks after it, and the answer comes back by email.</p></div>
      <a class="btn green" href="/support?from=/page/${params.slug}">Contact the league</a></section>` : ""}
    ${p.gallery?.length ? html`<div><h3 style="margin-top:0">Gallery</h3>${gallery(p.gallery)}</div>` : ""}
  </div>`);
  // Typing in the search box shows only the questions with those words (and opens them).
  const q = $("[data-faq-q]", view);
  q?.addEventListener("input", () => {
    const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const d of view.querySelectorAll(".faq")) {
      const hit = words.every((w) => d.textContent.toLowerCase().includes(w));
      d.hidden = !hit; d.open = !!words.length && hit; if (hit) shown++;
    }
    $("[data-faq-none]", view).hidden = shown > 0;
  });
}
