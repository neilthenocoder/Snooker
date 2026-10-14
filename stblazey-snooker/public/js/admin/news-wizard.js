// ─────────────────────────────────────────────────────────────
//  Admin → Website → Write news step by step
//  The same news article as Admin → News, one question at a time, for anyone who finds the full form a lot
//  (Rich, round 20): headline → category → sub headline → the story → a quote → pictures → this week's
//  results, league positions and breaks → check and publish. Every answer is kept on this device as it is
//  typed, so closing the page by mistake loses nothing. Saved articles are edited in Admin → News as usual.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, todayUK, fmtDate } from "../core/dom.js";
import { table, save } from "../core/api.js";
import { slugify } from "../core/schedule.js";
import { uploadImage } from "../core/upload.js";
import { pickImage } from "./picker.js";
import { getUser } from "../core/auth.js";

const DRAFT = "sbdsl-news-draft";
const STEPS = [
  ["title", "Headline"], ["category", "Category"], ["lead", "Sub headline"], ["body", "The story"],
  ["quote", "A quote"], ["pictures", "Pictures"], ["weekly", "Results & tables"], ["check", "Check & publish"],
];
const blank = () => ({ step: 0, title: "", category: "", lead: "", body: "", quote_text: "", quote_author: "",
  image_url: "", circle_image_url: "", weekly: false, league_id: "", week_ending: "", show_results: true, show_standings: true, show_breaks: true,
  published_at: todayUK() });

const readDraft = () => { try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); return d && typeof d === "object" ? { ...blank(), ...d } : null; } catch { return null; } };
const keepDraft = (s) => { try { localStorage.setItem(DRAFT, JSON.stringify(s)); } catch { /* this device keeps nothing: the article still saves */ } };
const dropDraft = () => { try { localStorage.removeItem(DRAFT); } catch { /* nothing kept */ } };
const hasWords = (s) => !!(s.title || s.lead || s.body || s.image_url);

export async function newsWizardPage(el) {
  const [categories, leagues, articles, user] = await Promise.all([table("categories", "sort"), table("leagues", "sort"), table("articles", "published_at"), getUser()]);
  let s = readDraft() ?? blank();
  let busy = false;

  const draw = () => {
    const step = STEPS[s.step][0];
    mount(el, html`<div class="nw">
      <ol class="nw-steps" aria-label="Steps">${STEPS.map(([key, label], i) => html`<li class="${i < s.step ? "done" : i === s.step ? "on" : ""}">
        ${i < s.step ? html`<button type="button" data-go="${i}" title="Back to ${label}"><b>${i + 1}</b><span>${label}</span></button>` : html`<span><b>${i + 1}</b><span>${label}</span></span>`}</li>`)}</ol>
      <p class="nw-count">Step ${s.step + 1} of ${STEPS.length}</p>
      <form class="nw-card" data-nw novalidate>${body(step)}
        <div class="nw-buttons">
          ${s.step > 0 ? html`<button type="button" class="btn ghost" data-back>← Back</button>` : html`<span></span>`}
          ${step === "check"
            ? html`<span class="nw-go"><button type="button" class="btn secondary" data-publish="draft">Save as a draft</button><button type="button" class="btn green big" data-publish="now">Publish now</button></span>`
            : html`<span class="nw-go">${["quote", "pictures", "weekly"].includes(step) ? html`<button type="button" class="btn ghost" data-skip>Skip this step</button>` : ""}<button class="btn green big">Next →</button></span>`}
        </div>
      </form>
      <p class="muted nw-foot">Everything you type is kept on this device until the article is saved, so you can leave and carry on later.
        ${hasWords(s) ? html`<button type="button" class="linkish" data-restart>Start a new article instead</button>` : ""}
        To change an article after it is saved, use <a href="/admin/articles">News</a>.</p>
    </div>`);
    const first = el.querySelector("[data-nw] input:not([type=checkbox]):not([type=file]), [data-nw] textarea");
    if (first && step !== "check") first.focus({ preventScroll: true });
  };

  const tip = (text) => html`<p class="nw-tip">${text}</p>`;
  const body = (step) => {
    switch (step) {
      case "title": return html`<h2>What is the headline?</h2>
        ${tip("Short and clear, like “Bethel A go top after a 5–3 win”. It is the big line at the top of the article.")}
        <input name="title" maxlength="120" value="${s.title}" placeholder="Type the headline here" autocomplete="off" autocapitalize="sentences">`;
      case "category": return html`<h2>Which kind of news is it?</h2>
        ${tip("Press one. It decides which tab of the News page it goes under.")}
        <div class="nw-choices">${categories.map((c) => html`<button type="button" class="${s.category === c.name ? "on" : ""}" data-category="${c.name}">${c.name}</button>`)}</div>`;
      case "lead": return html`<h2>Add a sub headline</h2>
        ${tip("One or two sentences that sum the story up. It is shown in bold under the headline, and on the news cards around the website.")}
        <textarea name="lead" rows="3" maxlength="400" placeholder="For example: A 71 break from Sam Bolitho settled it in the last frame.">${s.lead}</textarea>`;
      case "body": return html`<h2>Now write the story</h2>
        ${tip("Write it as you would say it. To start a new paragraph, leave an empty line (press Enter twice).")}
        <textarea name="body" rows="14" placeholder="Type or paste the story here">${s.body}</textarea>`;
      case "quote": return html`<h2>Add a quote <span class="nw-optional">(if you have one)</span></h2>
        ${tip("Something a player or captain said. It is shown in a big quote box in the article.")}
        <label>The quote<textarea name="quote_text" rows="3" placeholder="“We knew it would go to the last frame…”">${s.quote_text}</textarea></label>
        <label>Who said it<input name="quote_author" value="${s.quote_author}" placeholder="Sam Bolitho, Bethel A captain" autocomplete="off"></label>`;
      case "pictures": return html`<h2>Add a picture <span class="nw-optional">(recommended)</span></h2>
        ${tip("Take a photo or choose one from your phone or computer. Any size is fine: it is made smaller for the website automatically (to about 300 KB).")}
        ${picture("image_url", "Main picture", "Shown wide across the top of the article and on the news cards.")}
        ${picture("circle_image_url", "Round picture (optional)", "A second picture shown in a circle — a player's face works well. Leave it and the main picture is used.")}`;
      case "weekly": return html`<h2>Add this week's results and tables? <span class="nw-optional">(optional)</span></h2>
        ${tip("The website fills these in by itself from the scorecards — you only tick what to show under the story.")}
        ${leagues.length > 1 ? html`<label>Which league<select name="league_id">${leagues.map((l) => html`<option value="${l.id}" ${String(s.league_id || leagues[0].id) === String(l.id) ? "selected" : ""}>${l.name}</option>`)}</select></label>` : ""}
        <div class="nw-ticks">
          <label class="nw-tick"><input type="checkbox" name="show_results" ${s.show_results ? "checked" : ""}><span><b>This week's results</b><small>Every team's result that week</small></span></label>
          <label class="nw-tick"><input type="checkbox" name="show_standings" ${s.show_standings ? "checked" : ""}><span><b>League positions</b><small>The league table as it stands</small></span></label>
          <label class="nw-tick"><input type="checkbox" name="show_breaks" ${s.show_breaks ? "checked" : ""}><span><b>Breaks</b><small>The best breaks of the week</small></span></label>
        </div>
        <label>The week ending<input type="date" name="week_ending" value="${s.week_ending || s.published_at}"></label>`;
      case "check": return html`<h2>Check it, then publish</h2>
        ${tip("Press “Change” beside anything to go back to it.")}
        <dl class="nw-sum">
          ${row(0, "Headline", s.title || "—")}
          ${row(1, "Category", s.category || "—")}
          ${row(2, "Sub headline", s.lead || "None")}
          ${row(3, "The story", s.body ? `${s.body.split(/\s+/).filter(Boolean).length} words` : "—")}
          ${row(4, "Quote", s.quote_text ? `“${s.quote_text.slice(0, 80)}${s.quote_text.length > 80 ? "…" : ""}”${s.quote_author ? ` — ${s.quote_author}` : ""}` : "None")}
          ${row(5, "Pictures", s.image_url ? html`<img src="${s.image_url}" alt="">${s.circle_image_url ? html`<img class="round" src="${s.circle_image_url}" alt="">` : ""}` : "None")}
          ${row(6, "Results & tables", s.weekly && (s.show_results || s.show_standings || s.show_breaks)
            ? [s.show_results && "results", s.show_standings && "league positions", s.show_breaks && "breaks"].filter(Boolean).join(", ") + ` — week ending ${fmtDate(s.week_ending || s.published_at)}` : "None")}
        </dl>
        <label>Date on the article<input type="date" name="published_at" value="${s.published_at}"></label>
        <p class="nw-tip">“Publish now” puts it on the website straight away. “Save as a draft” keeps it hidden — publish it later from News.</p>`;
      default: return "";
    }
  };
  const row = (i, label, value) => html`<div><dt>${label}</dt><dd>${value}</dd><button type="button" class="linkish" data-go="${i}">Change</button></div>`;
  const picture = (name, label, help) => html`<div class="nw-pic">
    <div class="nw-pic-show ${name === "circle_image_url" ? "round" : ""}">${s[name] ? html`<img src="${s[name]}" alt="">` : html`<span>No picture yet</span>`}</div>
    <div><b>${label}</b><small>${help}</small>
      <div class="btn-row"><label class="btn green">${s[name] ? "Use a different photo" : "Take or choose a photo"}<input type="file" accept="image/*" hidden data-photo="${name}"></label>
        <button type="button" class="btn secondary" data-library="${name}">Choose from my pictures</button>
        ${s[name] ? html`<button type="button" class="btn ghost" data-clear="${name}">Remove</button>` : ""}</div>
      <p class="nw-busy" data-busy="${name}" hidden>Making it ready for the website…</p></div></div>`;

  // Whatever is on the screen now goes into the draft.
  const collect = () => {
    const form = $("[data-nw]", el);
    if (!form) return;
    for (const f of form.elements) {
      if (!f.name) continue;
      s[f.name] = f.type === "checkbox" ? f.checked : f.value;
    }
    if (STEPS[s.step][0] === "weekly" && !s.league_id && leagues[0]) s.league_id = leagues[0].id;
    keepDraft(s);
  };
  const problem = () => {
    const step = STEPS[s.step][0];
    if (step === "title" && !s.title.trim()) return "Type a headline first.";
    if (step === "category" && !s.category) return "Press one of the categories.";
    if (step === "body" && !s.body.trim()) return "Write the story first (even a few lines).";
    return null;
  };
  const go = (i) => { collect(); s.step = Math.max(0, Math.min(STEPS.length - 1, i)); keepDraft(s); draw(); el.scrollIntoView({ block: "start", behavior: "smooth" }); };

  el.addEventListener("input", collect);
  el.addEventListener("submit", (e) => {
    e.preventDefault();
    collect();
    const bad = problem();
    if (bad) return toast(bad, "error");
    if (STEPS[s.step][0] === "weekly") s.weekly = s.show_results || s.show_standings || s.show_breaks;
    go(s.step + 1);
  });
  el.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-photo]");
    if (!input?.files?.[0]) return;
    const name = input.dataset.photo, note = $(`[data-busy="${name}"]`, el);
    note.hidden = false;
    try {
      s[name] = await uploadImage(input.files[0], { folder: "news", maxSize: name === "circle_image_url" ? 800 : 1800, category: "News" });
      keepDraft(s); draw(); toast("Picture added");
    } catch (err) { note.hidden = true; toast(err.message, "error"); }
  });
  el.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.closest("[data-back]")) return go(s.step - 1);
    if (t.closest("[data-go]")) return go(Number(t.closest("[data-go]").dataset.go));
    if (t.closest("[data-skip]")) {
      const step = STEPS[s.step][0];
      if (step === "quote") Object.assign(s, { quote_text: "", quote_author: "" });
      if (step === "weekly") s.weekly = false;
      keepDraft(s); s.step++; return draw();
    }
    const cat = t.closest("[data-category]");
    if (cat) { s.category = cat.dataset.category; keepDraft(s); return go(s.step + 1); }
    const lib = t.closest("[data-library]");
    if (lib) { const url = await pickImage({ folder: "news" }); if (url) { s[lib.dataset.library] = url; keepDraft(s); draw(); } return; }
    const clear = t.closest("[data-clear]");
    if (clear) { s[clear.dataset.clear] = ""; keepDraft(s); return draw(); }
    if (t.closest("[data-restart]")) {
      if (!confirm("Start a new article? What you have typed here so far is thrown away.")) return;
      dropDraft(); s = blank(); return draw();
    }
    const pub = t.closest("[data-publish]");
    if (pub && !busy) {
      collect();
      if (!s.title.trim() || !s.category || !s.body.trim()) { toast("The headline, category and story are needed — go back and add them.", "error"); return; }
      busy = true; pub.disabled = true;
      try {
        const saved = await save("articles", articleRow(s, pub.dataset.publish === "now", articles, user));
        dropDraft();
        const published = saved.is_published;
        s = blank();
        mount(el, html`<div class="nw"><div class="nw-card nw-done">
          <h2>${published ? "It's on the website" : "Saved as a draft"}</h2>
          <p>${published ? "Your article is published." : "It is saved but hidden. Publish it from News when it is ready."}</p>
          <div class="btn-row">${published ? html`<a class="btn green big" href="/news/${saved.slug}">See the article</a>` : ""}
            <a class="btn secondary" href="/admin/articles?edit=${saved.id}">Open it in News</a>
            <button type="button" class="btn ghost" data-again>Write another</button></div></div></div>`);
        $("[data-again]", el).onclick = () => draw();
      } catch (err) { toast(err.message, "error"); pub.disabled = false; }
      finally { busy = false; }
    }
  });
  draw();
}

/** The wizard's answers as a row of the articles table (the same columns Admin → News fills in). */
function articleRow(s, publish, existing, user) {
  const taken = new Set(existing.map((a) => a.slug));
  const base = slugify(s.title) || "news";
  let slug = base, n = 1;
  while (taken.has(slug)) slug = `${base}-${++n}`;
  const firstPara = s.body.split(/\n\s*\n/).map((p) => p.trim()).find(Boolean) ?? "";
  const intro = (s.lead || firstPara).replace(/\s+/g, " ").trim();
  const weekly = !!s.weekly;
  return {
    title: s.title.trim(), slug, category: s.category, published_at: s.published_at || todayUK(), is_published: publish,
    lead: s.lead.trim() || null, body: s.body.trim(),
    excerpt: intro.length > 180 ? `${intro.slice(0, 177).replace(/\s+\S*$/, "")}…` : intro || null,
    quote_text: s.quote_text.trim() || null, quote_author: s.quote_text.trim() ? s.quote_author.trim() || null : null,
    image_url: s.image_url || null, circle_image_url: s.circle_image_url || null,
    league_id: weekly ? s.league_id || null : null, week_ending: weekly ? s.week_ending || null : null,
    show_results: weekly && !!s.show_results, show_standings: weekly && !!s.show_standings, show_breaks: weekly && !!s.show_breaks,
    author: user?.profile?.full_name || null,
  };
}
