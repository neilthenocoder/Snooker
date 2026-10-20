// ─────────────────────────────────────────────────────────────
//  Admin → Website → News to approve (Master Admin only — Rich, round 21)
//  News written by anyone but the Master Admin does not go live straight away: pressing Publish marks it
//  "waiting for approval" (the database does this — guard_article() in supabase/schema.sql). Here the
//  Master Admin reads each one, then puts it live or sends it back as a draft for the writer.
// ─────────────────────────────────────────────────────────────
import { html, mount, toast, fmtDate } from "../core/dom.js";
import { articleList, save, invalidate, selectAll } from "../core/api.js";
import { db } from "../core/db.js";

/** How many are waiting (the red number in the menu): from the light list. The page itself reads them in full. */
export const waitingNews = async () => (await articleList()).filter((a) => a.awaiting_approval && !a.is_published);
const waitingInFull = () => selectAll(() => db.from("articles").select("*").eq("awaiting_approval", true).eq("is_published", false).order("published_at"));

export async function newsApprovePage(el, { onChange = () => {} } = {}) {
  const draw = async () => {
    invalidate();
    const list = (await waitingInFull()).sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)));
    mount(el, html`<div class="notice">News written by anyone except the Master Admin waits here until you approve it. <b>Approve and publish</b> puts it on the website;
        <b>Send back</b> keeps it off the website as a draft, which its writer can change and send again. Changes to an article that is already live don't need approving.</div>
      ${list.length ? html`<div class="stack">${list.map((a) => html`<article class="appr">
          ${a.image_url ? html`<img src="${a.image_url}" alt="" loading="lazy">` : html`<div class="appr-ph"></div>`}
          <div class="appr-body">
            <small>${a.category} · ${fmtDate(a.published_at)}${a.author ? ` · by ${a.author}` : ""}</small>
            <h3>${a.title}</h3>
            ${a.lead || a.excerpt ? html`<p class="appr-lead">${a.lead || a.excerpt}</p>` : ""}
            <p class="appr-text">${String(a.body ?? "").slice(0, 400)}${String(a.body ?? "").length > 400 ? "…" : ""}</p>
            <div class="btn-row">
              <button type="button" class="btn green" data-approve="${a.id}">Approve and publish</button>
              <a class="btn secondary" href="/news/${a.slug}" target="_blank" rel="noopener">Read it in full</a>
              <a class="btn ghost" href="/admin/articles?edit=${a.id}">Change it first</a>
              <button type="button" class="btn ghost" data-back="${a.id}">Send back</button>
            </div>
          </div></article>`)}</div>`
        : html`<div class="empty box">Nothing waiting — every article has been dealt with.</div>`}`);
  };
  el.onclick = async (e) => {
    const ok = e.target.closest("[data-approve]"), back = e.target.closest("[data-back]");
    if (!ok && !back) return;
    const id = (ok ?? back).dataset[ok ? "approve" : "back"];
    (ok ?? back).disabled = true;
    try {
      await save("articles", ok ? { id, is_published: true, awaiting_approval: false } : { id, is_published: false, awaiting_approval: false });
      toast(ok ? "Approved — it's on the website" : "Sent back as a draft");
      await draw(); onChange();
    } catch (err) { toast(err.message, "error"); (ok ?? back).disabled = false; }
  };
  await draw();
}
