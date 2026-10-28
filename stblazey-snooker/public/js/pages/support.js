// ─────────────────────────────────────────────────────────────
//  CONTACT THE LEAGUE — Help & support requests (round 55, Rich: "a support function … players can add a
//  support ticket which certain roles get based on a support enquiry dropdown category list").
//    /support          the form, and "Your requests"
//    /support/:token   one request: the conversation with the league, and a box to answer back (the link in the emails).
//  Round 57 (Neil): logged-in people only — the database refuses requests and replies without a login.
//  Each category goes to the roles chosen under Admin → Support categories (the Master Admin always gets it).
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, fmtDate, fmtTime, paragraphs } from "../core/dom.js";
import { supportCategories, submitSupport, supportThread, supportReply, myTickets, sendSupportEmail, listen } from "../core/api.js";
import { breadcrumb } from "../core/components.js";
import { setTitle, navigate } from "../core/router.js";
import { uploadImage } from "../core/upload.js";
import { DEMO_MODE } from "../config.js";
import { supportStatus, ago } from "../core/support.js";
import { loginWall } from "../core/login-wall.js";

const crumbs = (last) => breadcrumb([["Home", "/"], ["Help", "/page/help"], ...(last ? [["Contact the league", "/support"], [last]] : [["Contact the league"]])]);

export default async function supportPage(view, { params, user }) {
  if (!user) return loginWall(view, { crumbs: crumbs(), title: params.token ? "Log in to see your request" : "Log in to contact the league",
    text: params.token ? "Log in to read the league's answer to your request and reply to it." : "Questions and problems go to the league from your own login, so the right person can answer you — and you can follow every request here." });
  if (params.token) return thread(view, params.token, user);
  return contactForm(view, user);
}

/** A screenshot box (logged in only — pictures go on the website's own storage). */
function shotField(user) {
  return user ? html`<div class="sup-shot-field"><label class="btn small secondary">Add a screenshot <span class="muted">(optional)</span><input type="file" accept="image/*" hidden data-sup-shot></label>
      <span data-sup-shot-show></span><input type="hidden" name="image_url"></div>` : "";
}
function wireShot(root) {
  root.addEventListener("change", async (e) => {
    if (!e.target.matches("[data-sup-shot]")) return;
    const label = e.target.closest("label"), form = e.target.closest("form");
    label.classList.add("busy");
    try {
      const url = await uploadImage(e.target.files[0], { folder: "support", maxSize: 1600, library: false });
      form.elements.image_url.value = url;
      mount($("[data-sup-shot-show]", form), html`<img class="sup-shot small" src="${url}" alt="Your screenshot"> <button type="button" class="linkish" data-sup-shot-rm>Remove</button>`);
    } catch (err) { toast(err.message, "error"); }
    label.classList.remove("busy"); e.target.value = "";
  });
  root.addEventListener("click", (e) => {
    if (!e.target.matches("[data-sup-shot-rm]")) return;
    const form = e.target.closest("form"); form.elements.image_url.value = ""; mount($("[data-sup-shot-show]", form), "");
  });
}

async function contactForm(view, user) {
  setTitle("Contact the league");
  const [cats, mine] = await Promise.all([
    supportCategories().then((c) => c.filter((x) => x.is_active)).catch(() => []),
    myTickets(user.id).catch(() => []),
  ]);
  const list = mine;
  const from = new URLSearchParams(location.search).get("from") || (document.referrer.startsWith(location.origin) ? new URL(document.referrer).pathname : "");
  const pre = new URLSearchParams(location.search).get("about");

  mount(view, html`<div class="wrap sup-page">
    ${crumbs()}
    <h1>Contact the league</h1>
    <p class="sup-lead">A question, a problem, or something on the website that isn't right? Send it here and it goes straight to the person at the league who looks after it. You'll get an answer by email, and you can follow it here.</p>
    <p class="sup-faq-hint">Many answers are already on the <a href="/page/help">Help page</a> — it's worth a quick look first.</p>
    ${list.length ? html`<section class="box sup-mine"><h2>Your requests</h2><ul>${list.map((r) => html`<li><a href="/support/${r.token}"><b>#${r.no}</b> ${r.subject}</a>
      ${r.status ? supportStatus(r.status, true) : ""}${r.updated_at ? html`<small class="muted">${ago(r.updated_at)}</small>` : ""}</li>`)}</ul></section>` : ""}
    ${!cats.length ? html`<div class="notice">The contact form isn't set up yet. Please speak to the league secretary.</div>` : html`
    <form class="form box sup-form" data-sup-form novalidate>
      <label>What is it about?
        <select name="category_id" required data-sup-cat><option value="">Choose one…</option>${cats.map((c) => html`<option value="${c.id}" ${pre && c.name.toLowerCase().includes(pre.toLowerCase()) ? "selected" : ""}>${c.name}</option>`)}</select>
        <small class="help" data-sup-cat-help></small></label>
      <label>In a few words<input name="subject" required minlength="3" maxlength="160" placeholder="e.g. Frame 4 score is the wrong way round"></label>
      <label>Tell us more<textarea name="message" rows="7" required minlength="5" maxlength="5000" placeholder="The more detail the better: which match, team or player, what you expected, what happened…"></textarea></label>
      ${shotField(user)}
      <p class="sup-from">From <b>${user.profile?.full_name || user.email}</b> — the answer is emailed to <b>${user.profile?.email || user.email}</b> and shows here.</p>
      <input type="hidden" name="name" value="${user.profile?.full_name || user.email}"><input type="hidden" name="email" value="${user.profile?.email || user.email}">
      <label class="sup-trap" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
      <input type="hidden" name="page_url" value="${from && from !== "/support" ? from : ""}">
      <div data-sup-error></div>
      <div class="btn-row"><button class="btn green">Send to the league</button></div>
    </form>`}
  </div>`);
  const form = $("[data-sup-form]", view);
  if (!form) return;
  const help = () => { $("[data-sup-cat-help]", view).textContent = cats.find((c) => c.id === form.elements.category_id.value)?.description ?? ""; };
  form.elements.category_id.addEventListener("change", help); help();
  wireShot(view);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries()), btn = form.querySelector("button:not([type=button])");
    const missing = [["category_id", "Please choose what your request is about"], ["subject", "Please say in a few words what it is about"], ["message", "Please tell us a little more"], ["name", "Please type your name"], ["email", "Please type your email address, so the league can answer you"]]
      .find(([k]) => !String(f[k] ?? "").trim());
    if (missing) { mount($("[data-sup-error]", view), html`<div class="notice error">${missing[1]}</div>`); form.elements[missing[0]].focus(); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      const r = await submitSupport(f);
      if (!r?.token) throw new Error("Something went wrong — please try again.");
      sendSupportEmail(r.message_id);
      window.scrollTo(0, 0);
      mount(view, html`<div class="wrap sup-page">${crumbs("Sent")}
        <div class="sup-done box"><span class="sup-done-tick" aria-hidden="true">✓</span>
          <h1>Thank you — it's with the league</h1>
          <p>Your reference is <b class="sup-ref">#${r.no}</b>. It has gone to the person who looks after <b>${cats.find((c) => c.id === f.category_id)?.name ?? "this"}</b>, who will answer as soon as they can.</p>
          <p>${DEMO_MODE ? "(On the live website we also email you a copy.)" : html`We've emailed a copy to <b>${f.email}</b>.`} You can come back to it any time from <b>Help &amp; support</b> in your account menu.</p>
          <div class="btn-row"><a class="btn" href="/support/${r.token}">See your request</a><a class="btn ghost" href="/">Back to the home page</a></div>
        </div></div>`);
    } catch (err) { mount($("[data-sup-error]", view), html`<div class="notice error">${err.message}</div>`); btn.disabled = false; btn.textContent = "Send to the league"; }
  });
}

async function thread(view, token, user) {
  let ticketId = null;
  const draw = async () => {
    const data = await supportThread(token).catch(() => null);
    if (!data?.ticket) {
      setTitle("Request not found");
      return mount(view, html`<div class="wrap sup-page">${crumbs("Not found")}<h1>We can't find that request</h1>
        <p>It may have been sent from a different login — log in as the person who sent it. Or <a href="/support">send a new request</a>.</p></div>`);
    }
    const { ticket: t, messages } = data;
    ticketId = t.id;
    setTitle(`Request #${t.no}`);
    let draft = ""; try { draft = sessionStorage.getItem(`sup-mine-${token}`) ?? ""; } catch { /* none */ }
    mount(view, html`<div class="wrap sup-page">
      ${crumbs(`#${t.no}`)}
      <div class="sup-head"><span class="sup-no">Request #${t.no}</span> ${supportStatus(t.status, true)}
        <h1>${t.subject}</h1>
        <p class="muted">${t.category} · sent ${fmtDate(t.created_at)} at ${fmtTime(t.created_at)}</p></div>
      ${t.status === "resolved" ? html`<div class="notice ok">The league has marked this as sorted. If it isn't, just reply below and it opens again.</div>`
        : t.status === "waiting" ? html`<div class="notice">The league has answered — reply below if you need to.</div>` : ""}
      <ol class="sup-thread">${messages.map((m) => html`<li class="sup-msg ${m.from_league ? "league" : "me"}">
        <div class="sup-msg-head"><b>${m.from_league ? `${m.author_name || "The league"} · the league` : "You"}</b><time title="${fmtDate(m.created_at)} ${fmtTime(m.created_at)}">${ago(m.created_at)}</time></div>
        <div class="sup-msg-body">${paragraphs(m.body)}</div>
        ${m.image_url ? html`<a href="${m.image_url}" target="_blank" rel="noopener"><img class="sup-shot" src="${m.image_url}" alt="Screenshot" loading="lazy"></a>` : ""}</li>`)}</ol>
      <form class="form box sup-reply" data-sup-answer>
        <label>Reply to the league<textarea name="body" rows="5" maxlength="5000" required placeholder="Type your reply…">${draft}</textarea></label>
        ${shotField(user)}
        <div class="btn-row"><button class="btn green">Send reply</button></div>
      </form>
    </div>`);
    const form = $("[data-sup-answer]", view);
    form.elements.body.addEventListener("input", () => { try { sessionStorage.setItem(`sup-mine-${token}`, form.elements.body.value); } catch { /* fine */ } });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button:not([type=button])");
      if (!form.elements.body.value.trim()) return form.elements.body.focus();
      btn.disabled = true;
      try {
        const mid = await supportReply({ token, body: form.elements.body.value, image: form.elements.image_url?.value || null });
        try { sessionStorage.removeItem(`sup-mine-${token}`); } catch { /* fine */ }
        sendSupportEmail(mid);
        toast("Reply sent to the league");
        await draw();
      } catch (err) { toast(err.message, "error"); btn.disabled = false; }
    });
  };
  await draw();
  wireShot(view);
  // Logged in: the league's answer appears as soon as it is sent (unless a reply is being typed).
  const stop = listen(["support_messages"], (_t, row) => {
    if (row.ticket_id === ticketId && row.from_league && !row.internal && view.isConnected && !$("[data-sup-answer] textarea", view)?.value.trim()) draw();
  });
  return () => stop();
}
