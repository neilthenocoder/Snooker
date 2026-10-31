// ─────────────────────────────────────────────────────────────
//  CHANGE THE WORDING ON A PAGE, ON THE PAGE ITSELF (Neil, round 79)
//  The Master Admin presses Edit → "Edit the wording on this page", clicks any heading, line or button and types.
//  Save keeps each change in settings.page_text as  "page|tag|the original words" → "the new words",
//  so a change follows the words wherever that kind of page shows them (e.g. "Fixtures & results" on every team page),
//  and a change to words that later change by themselves (a news headline edited in the dashboard) simply stops applying.
//  Only words are changed — never the layout or the styling. Words are set as plain text, never as HTML.
// ─────────────────────────────────────────────────────────────
import { html, mount, toast, confirmBox } from "./dom.js";
import { save, invalidate, table } from "./api.js";

// The things that can be edited: an element holding words only (no tags inside it).
const TAGS = "h1,h2,h3,h4,h5,h6,p,li,span,small,strong,b,em,i,a,button,label,dt,dd,figcaption,blockquote,summary,legend,th,caption,time,div";
// Never: form boxes, scores and live parts, the parts that update by themselves, and admin.
const SKIP = "input,textarea,select,option,script,style,svg,td,[contenteditable='false'],[data-no-edit],.live-strip,.strip-card,.sc-tiles,.res-line b,.ticker,.feature-box,.kd-row time,.badge,.form-chips,.fc,.cal-grid,.br-col,.tw-bar,.tw-menu,#admin-body";

const norm = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
const keyOf = (page, el, orig) => `${page}|${el.tagName.toLowerCase()}|${orig}`;
const isLeaf = (el) => el.childElementCount === 0 && norm(el.textContent).length > 0 && norm(el.textContent).length <= 500 && !el.closest(SKIP);

function leaves(root) {
  const out = [];
  if (root.nodeType !== 1) return out;
  if (root.matches?.(TAGS) && isLeaf(root)) out.push(root);
  for (const el of root.querySelectorAll(TAGS)) if (isLeaf(el)) out.push(el);
  return out;
}

/** Put the saved wording on the page — now, and whenever part of the page is drawn again. */
export function applyPageText(view, page, site) {
  const map = site?.page_text && typeof site.page_text === "object" ? site.page_text : {};
  const prefix = `${page}|`;
  const mine = Object.keys(map).filter((k) => k.startsWith(prefix));
  if (!mine.length) return () => {};
  const put = (root) => {
    for (const el of leaves(root)) {
      if (el.isContentEditable) continue;
      const now = norm(el.textContent);
      const orig = el.dataset.twOrig ?? now;
      const want = map[keyOf(page, el, orig)];
      if (want == null) continue;
      if (el.dataset.twOrig === undefined) el.dataset.twOrig = orig;
      if (now !== want) el.textContent = want;
    }
  };
  put(view);
  // Live parts and late-drawn parts: put the wording on what was just added (a moment later, all at once).
  let queued = new Set(), timer = null;
  const obs = new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) queued.add(n); else if (n.parentElement) queued.add(n.parentElement);
    clearTimeout(timer);
    timer = setTimeout(() => { const q = queued; queued = new Set(); for (const n of q) if (n.isConnected) put(n); }, 60);
  });
  obs.observe(view, { childList: true, subtree: true });
  return () => { obs.disconnect(); clearTimeout(timer); };
}

// ── Round 80 (Neil): words that come from the dashboard can't be clicked here ──────────────────────────
// A news headline, a team or player name and so on shows in many places; changed on one page it would only change there.
// So they are locked in editing mode (with a note to change them in the dashboard) and only the site's own wording is editable.
// Found three ways: inside a link to a record's page or inside an article's text; numbers, scores and dates;
// or the words are (or contain) a name or title from the database.
const HARD = ".rich, .article-body";        // an article's own text: always the dashboard's
const CONTENT = [".hero-text", ".hero-slide", ".feat-main", ".feat-card", ".story-card", ".cs-card", ".cf-card", ".cf-main",
  ".spotlight", ".team-tile", ".tile.with-emblem", ".comp-champ", ".res-line", ".res-meta",
  ...["news", "team", "player", "venue", "competition", "page", "sponsor", "match", "cup-match", "season", "hall-of-fame", "draw", "standings", "shield"].map((r) => `a[href^="/${r}/"]`)].join(",");
const NUMBERS = /^[\d\s:–—\-\/.,+%()×x#·|]+$|^\d+(st|nd|rd|th)\b/i;
async function dashboardWords() {
  const pick = { teams: ["name", "short_name"], players: ["full_name"], venues: ["name"], leagues: ["name", "short_name"], competitions: ["name"],
    articles: ["title"], pages: ["title"], seasons: ["name"], sponsors: ["name"], hall_of_fame: ["title", "name"],
    key_dates: ["title"], announcements: ["text"], awards: ["name", "title"] };
  const words = new Set();
  await Promise.all(Object.entries(pick).map(([t, fields]) => table(t).then((rows) => {
    for (const r of rows ?? []) for (const f of fields) { const w = norm(r[f]).toLowerCase(); if (w.length >= 2) words.add(w); }
  }).catch(() => {})));
  return words;
}
function fromDashboard(el, words) {
  if (el.closest(HARD)) return true;
  const t = norm(el.textContent), low = t.toLowerCase();
  // In a card or link for a news story, team, player… everything is the dashboard's except short labels with no
  // figures in them ("Entrants", "Next match", "See the draw →"), which are the site's own wording.
  if (el.closest(CONTENT) && (t.length > 24 || /\d/.test(t) || words.has(low))) return true;
  if (NUMBERS.test(t)) return true;
  if (words.has(low)) return true;
  // A short line built round a name ("Bethel A fixtures & results") — but not a long explanation that happens to mention one.
  if (t.length <= 80) for (const w of words) if (w.length >= 5 && low.includes(w)) return true;
  return false;
}

/**
 * Editing mode. Every piece of wording gets a dotted outline when the mouse is over it; a click lets you type.
 * Links and buttons don't go anywhere while editing. The bar at the bottom saves, cancels or puts this page back.
 */
export async function startTextEditing(view, page, site, { done }) {
  if (document.body.classList.contains("tw-on")) return;
  document.body.classList.add("tw-on");
  const words = await dashboardWords();
  const map = { ...(site?.page_text ?? {}) };
  const marked = new Set();
  const mark = (root) => {
    for (const el of leaves(root)) {
      if (el.dataset.twOrig === undefined) el.dataset.twOrig = norm(el.textContent);
      if (!/\p{L}/u.test(el.dataset.twOrig)) continue;        // arrows and symbols on their own: nothing to edit
      // (wording already changed here stays editable, so it can be changed back)
      if (map[keyOf(page, el, el.dataset.twOrig)] == null && fromDashboard(el, words)) { el.classList.add("tw-lock"); continue; }
      el.classList.add("tw-ed"); marked.add(el);
    }
  };
  mark(view);

  const changed = () => [...marked].filter((el) => el.isConnected && norm(el.textContent) !== norm(map[keyOf(page, el, el.dataset.twOrig)] ?? el.dataset.twOrig));
  const bar = document.createElement("div");
  bar.className = "tw-bar";
  mount(bar, html`<div class="tw-in">
    <p><b>Editing the wording on this page</b><span>Click any outlined heading, line or button and type; Enter to finish. Names, headlines and results come from the dashboard, so they're changed there.</span></p>
    <div class="tw-btns"><button type="button" class="btn small ghost" data-tw="reset">Put this page back as it was</button>
      <button type="button" class="btn small ghost" data-tw="cancel">Cancel</button>
      <button type="button" class="btn small" data-tw="save">Save <i data-tw-count></i></button></div></div>`);
  document.body.append(bar);
  const count = () => { const n = changed().length; bar.querySelector("[data-tw-count]").textContent = n ? `(${n})` : ""; };

  const edit = (el) => {
    if (el.isContentEditable) return;
    try { el.contentEditable = "plaintext-only"; } catch { el.contentEditable = "true"; }
    if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
    el.classList.add("tw-now");
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  };
  const finish = (el) => {
    el.removeAttribute("contenteditable"); el.classList.remove("tw-now");
    const t = norm(el.textContent);
    if (!t) el.textContent = el.dataset.twOrig;            // emptied by mistake → the words come back
    else if (t !== el.textContent) el.textContent = t;
    el.classList.toggle("tw-changed", norm(el.textContent) !== el.dataset.twOrig);
    count();
  };

  // While editing nothing on the page navigates: clicks pick words instead.
  const onClick = (e) => {
    if (e.target.closest(".tw-bar")) return;
    if (!view.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    const el = e.target.closest(".tw-ed");
    if (el && !el.isContentEditable) return edit(el);
    if (e.target.closest(".tw-lock")) toast("This comes from the dashboard (news, teams, players, competitions…). Change it there and it changes everywhere it shows.");
  };
  const onKey = (e) => {
    const el = e.target.closest?.(".tw-now");
    if (!el) return;
    if (e.key === "Enter") { e.preventDefault(); el.blur(); }
    if (e.key === "Escape") { e.preventDefault(); el.textContent = map[keyOf(page, el, el.dataset.twOrig)] ?? el.dataset.twOrig; el.blur(); }
  };
  const onBlur = (e) => { if (e.target.classList?.contains("tw-now")) finish(e.target); };
  // Stop pasted pictures or formatting — words only.
  const onPaste = (e) => { if (!e.target.closest?.(".tw-now")) return; e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData?.getData("text/plain") ?? "").replace(/\s+/g, " ")); };
  window.addEventListener("click", onClick, true);
  // (and nothing on the page reacts to a press — no dragging the banner while choosing words)
  const onDown = (e) => { if (view.contains(e.target)) e.stopPropagation(); };
  window.addEventListener("pointerdown", onDown, true);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("focusout", onBlur, true);
  document.addEventListener("paste", onPaste, true);
  // Parts drawn later (a live strip turning over, a carousel) get outlined too.
  const obs = new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) mark(n); });
  obs.observe(view, { childList: true, subtree: true });

  const stop = () => {
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("focusout", onBlur, true);
    document.removeEventListener("paste", onPaste, true);
    obs.disconnect(); bar.remove();
    document.body.classList.remove("tw-on");
  };
  const store = async (next, message) => {
    for (const b of bar.querySelectorAll("button")) b.disabled = true;
    try {
      await save("settings", { id: site.id ?? 1, page_text: next });
      invalidate();
      toast(message);
      stop(); done();
    } catch (err) { toast(err.message, "error"); for (const b of bar.querySelectorAll("button")) b.disabled = false; }
  };
  bar.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-tw]");
    if (!b) return;
    document.querySelector(".tw-now")?.blur();
    if (b.dataset.tw === "cancel") { stop(); done(); return; }
    if (b.dataset.tw === "reset") {
      const mine = Object.keys(map).filter((k) => k.startsWith(`${page}|`));
      if (!mine.length) { toast("Nothing has been changed on this kind of page."); return; }
      if (!await confirmBox(`Put back the original wording on this kind of page? (${mine.length} change${mine.length === 1 ? "" : "s"})`, { ok: "Put it back" })) return;
      const next = { ...map }; for (const k of mine) delete next[k];
      return store(next, "The original wording is back.");
    }
    const list = changed();
    if (!list.length) { stop(); done(); return; }
    const next = { ...map };
    for (const el of list) {
      const k = keyOf(page, el, el.dataset.twOrig), t = norm(el.textContent);
      if (t === el.dataset.twOrig) delete next[k]; else next[k] = t;
    }
    store(next, `Saved — ${list.length} change${list.length === 1 ? "" : "s"} to the wording.`);
  });
  count();
}
