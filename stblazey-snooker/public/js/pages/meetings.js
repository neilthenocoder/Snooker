// /meetings — the AGM and committee meetings: the next one, then the minutes of past ones
// by year. Added in Admin → Meetings; the minutes can be typed (with headings and bullets)
// or attached as a PDF.
import { html, mount, fmtDate, todayUK } from "../core/dom.js";
import { table, articles } from "../core/api.js";
import { markup } from "../core/markup.js";
import { MEETING_KINDS } from "../core/terms.js";
import { breadcrumb, articleCard } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

const longDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function meetings(view, { query }) {
  setTitle("AGM & committee meetings");
  adminEdit("meetings");
  const [all, news] = await Promise.all([table("meetings", "held_on").catch(() => []), articles().catch(() => [])]);
  const shown = all.filter((m) => m.is_published !== false);
  const kind = query.get("kind") ?? "";
  const kinds = MEETING_KINDS.filter((k) => shown.some((m) => m.kind === k));
  const list = shown.filter((m) => !kind || m.kind === kind);
  const today = todayUK();
  const coming = list.filter((m) => m.held_on >= today);
  const past = list.filter((m) => m.held_on < today).reverse();
  const years = [...new Set(past.map((m) => m.held_on.slice(0, 4)))];
  const related = news.filter((a) => /meeting|agm/i.test(a.category ?? "")).slice(0, 4);
  const where = (m) => [m.time_text, m.venue].filter(Boolean).join(" · ");

  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Meetings"]])}
      <h1>AGM &amp; committee meetings</h1>
      ${kinds.length > 1 ? html`<div class="chips"><a class="tag-link ${kind ? "" : "on"}" href="/meetings">All meetings</a>
        ${kinds.map((k) => html`<a class="tag-link ${k === kind ? "on" : ""}" href="/meetings?kind=${encodeURIComponent(k)}">${k}</a>`)}</div>` : ""}</div>

    ${coming.length ? html`<div class="meet-next">${coming.map((m) => html`<div class="meet-card next">
      <p class="meet-when">${coming.indexOf(m) === 0 ? "Next meeting" : "Coming up"}</p>
      <h2>${m.title || m.kind}</h2>
      <p class="meet-date">${longDate(m.held_on)}${where(m) ? html`<span>${where(m)}</span>` : ""}</p>
      ${m.summary ? html`<div class="rich">${markup(m.summary)}</div>` : ""}
      ${m.document_url ? html`<a class="btn small secondary" href="${m.document_url}" target="_blank" rel="noopener">Open the agenda / papers</a>` : ""}</div>`)}</div>` : ""}

    ${years.length ? years.map((y) => html`<div><h3 class="meet-year">${y}</h3>
      ${past.filter((m) => m.held_on.startsWith(y)).map((m) => html`<details class="meet-card" ${past[0] === m ? "open" : ""}>
        <summary><span class="status plain">${m.kind}</span><strong>${m.title || m.kind}</strong><small>${fmtDate(m.held_on)}${m.venue ? ` · ${m.venue}` : ""}</small></summary>
        <div class="meet-body">
          ${m.summary ? html`<div class="rich meet-summary">${markup(m.summary)}</div>` : ""}
          ${m.minutes ? html`<h4>Minutes</h4><div class="rich">${markup(m.minutes)}</div>` : ""}
          ${!m.summary && !m.minutes && !m.document_url ? html`<p class="muted">The minutes haven't been added yet.</p>` : ""}
          ${m.document_url ? html`<a class="btn small secondary" href="${m.document_url}" target="_blank" rel="noopener">Open the minutes (PDF)</a>` : ""}
        </div></details>`)}</div>`)
      : coming.length ? "" : html`<div class="empty box">No meetings have been added yet.</div>`}

    ${related.length ? html`<div><h3>Meeting news</h3><div class="cards">${related.map(articleCard)}</div></div>` : ""}
  </div>`);
}
