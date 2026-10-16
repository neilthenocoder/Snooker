// ─────────────────────────────────────────────────────────────
//  Admin → Newsletter → Campaigns (Rich, round 22): write a newsletter from blocks
//  (header, headings H1–H5, body text, links and buttons, images, columns, social
//  icons, footer), see it as it will arrive, send yourself a test, then send it to
//  everyone subscribed. The email is built with tables (core/newsletter-render.js)
//  and sent by netlify/functions/newsletter.mjs through Resend.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$, toast, fmtDate, fmtTime, confirmBox } from "../core/dom.js";
import { campaigns, subscribers, save, remove, settings, newsletterSend, invalidate } from "../core/api.js";
import { getUser } from "../core/auth.js";
import { panel, dataTable } from "../core/components.js";
import { SITE } from "../config.js";
import { uploadImage } from "../core/upload.js";
import { pickImage } from "./picker.js";
import { friendly } from "./crud.js";
import { renderNewsletter, BLOCK_TYPES, STARTER_BLOCKS } from "../core/newsletter-render.js";

const STATUS = { draft: "Draft", sending: "Sending…", sent: "Sent" };
const TYPE_NAME = Object.fromEntries(BLOCK_TYPES);
const blank = (type) => ({ header: { title: SITE.name, subtitle: "", logo: true, bg: "#000000", color: "#ffffff" }, heading: { level: 2, text: "", align: "left" },
  text: { text: "", align: "left" }, button: { text: "Find out more", url: "/", style: "button", align: "left", color: "" }, image: { url: "", alt: "", link: "", caption: "" },
  columns: { count: 2, cols: [{}, {}, {}] }, divider: {}, spacer: { size: 24 }, social: {}, footer: { text: SITE.name } }[type]);

export async function campaignsPage(el) {
  const [list, subs] = await Promise.all([campaigns().catch(() => []), subscribers().catch(() => [])]);
  const live = subs.filter((s) => s.status === "subscribed").length;
  mount(el, html`
    <div class="notice">Write a newsletter from blocks, check it in the preview, send yourself a test, then send it to the <b>${live}</b> subscriber${live === 1 ? "" : "s"}.
      Everyone gets their own copy with an <b>Unsubscribe</b> link at the bottom. People sign up with the pop-up or the link at the bottom of every page (Newsletter → Sign-up pop-up).</div>
    <div class="toolbar"><button class="btn green" data-nl-new>+ New campaign</button></div>
    ${panel("Campaigns", dataTable([
      { label: "Subject", cell: (c) => html`<b>${c.subject}</b>` },
      { label: "Status", cell: (c) => html`<span class="nl-status s-${c.status}">${STATUS[c.status]}</span>${c.status !== "draft" ? html` <small class="muted">${c.sent_count} of ${c.total_count}</small>` : ""}` },
      { label: "Sent", cell: (c) => (c.sent_at ? `${fmtDate(c.sent_at)} ${fmtTime(c.sent_at)}` : "–"), cls: "hide-sm" },
      { label: "", cls: "right", cell: (c) => html`<span class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">
        <button class="btn small secondary" data-nl-edit="${c.id}">${c.status === "draft" ? "Edit" : c.status === "sending" ? "Carry on sending" : "View"}</button>
        <button class="btn small ghost" data-nl-copy="${c.id}">Duplicate</button>
        <button class="btn small" data-nl-del="${c.id}">Delete</button></span>` },
    ], list, { empty: "No campaigns yet — press “New campaign”." }))}`);

  el.onclick = async (e) => {
    const t = e.target;
    try {
      if (t.matches("[data-nl-new]")) { const c = await save("newsletter_campaigns", { subject: "League news", preheader: "", blocks: STARTER_BLOCKS(SITE.name), status: "draft" }); return editor(el, c); }
      if (t.dataset.nlEdit) return editor(el, list.find((c) => c.id === t.dataset.nlEdit));
      if (t.dataset.nlCopy) { const c = list.find((x) => x.id === t.dataset.nlCopy); const n = await save("newsletter_campaigns", { subject: `${c.subject} (copy)`, preheader: c.preheader, blocks: c.blocks, status: "draft" }); toast("Copied"); return editor(el, n); }
      if (t.dataset.nlDel) {
        const c = list.find((x) => x.id === t.dataset.nlDel);
        if (!(await confirmBox(`“${c.subject}” is deleted for good${c.status === "sent" ? " (the emails already sent are not affected)" : ""}.`, { title: "Delete this campaign?", ok: "Delete" }))) return;
        await remove("newsletter_campaigns", c.id); toast("Deleted"); return campaignsPage(el);
      }
    } catch (err) { toast(friendly(err), "error"); }
  };
}

// ── the builder ──────────────────────────────────────────────────
const field = (label, input, cls = "") => html`<label class="${cls}">${label}${input}</label>`;
const sel = (key, value, options) => html`<select data-k="${key}">${options.map(([v, l]) => html`<option value="${v}" ${String(v) === String(value ?? "") ? "selected" : ""}>${l}</option>`)}</select>`;
const txt = (key, value, ph = "") => html`<input data-k="${key}" value="${value ?? ""}" placeholder="${ph}">`;
const area = (key, value, ph = "", rows = 4) => html`<textarea data-k="${key}" rows="${rows}" placeholder="${ph}">${value ?? ""}</textarea>`;
const ALIGN = [["left", "Left"], ["center", "Centre"], ["right", "Right"]];
const imagePick = (key, value) => html`<div class="nlb-img">${value ? html`<img src="${value}" alt="">` : html`<span class="muted">No picture</span>`}
  <span class="btn-row"><button type="button" class="btn small blue" data-pick="${key}">Choose from library</button>
  <label class="btn small secondary">Upload<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-upload-img="${key}"></label>
  ${value ? html`<button type="button" class="btn small ghost" data-clear-img="${key}">Remove</button>` : ""}</span></div>`;

function blockFields(b) {
  switch (b.type) {
    case "header": return html`${field("Title", txt("title", b.title))}${field("Line under it (optional)", txt("subtitle", b.subtitle, "October newsletter"))}
      <div class="grid-2">${field("Background", html`<input type="color" data-k="bg" value="${b.bg || "#000000"}">`)}${field("Writing", html`<input type="color" data-k="color" value="${b.color || "#ffffff"}">`)}</div>
      <label class="check"><input type="checkbox" data-k="logo" ${b.logo !== false ? "checked" : ""}> Show the league's logo</label>`;
    case "heading": return html`<div class="grid-2">${field("Size", sel("level", b.level ?? 2, [1, 2, 3, 4, 5].map((n) => [n, `H${n}${n === 1 ? " (biggest)" : n === 5 ? " (smallest)" : ""}`])))}${field("Line up", sel("align", b.align, ALIGN))}</div>${field("Heading", txt("text", b.text))}`;
    case "text": return html`${field("Text", area("text", b.text, "**bold**, *italic*, [link text](https://…) — a blank line starts a new paragraph", 6))}${field("Line up", sel("align", b.align, ALIGN))}`;
    case "button": return html`<div class="grid-2">${field("Words", txt("text", b.text))}${field("Link", txt("url", b.url, "/news or https://…"))}</div>
      <div class="grid-2">${field("Looks like", sel("style", b.style, [["button", "A button"], ["link", "An underlined link"]]))}${field("Line up", sel("align", b.align, ALIGN))}</div>
      ${field("Colour (empty = the league's red)", html`<span class="nlb-color"><input type="color" data-k="color" value="${b.color || "#e4002b"}"><button type="button" class="btn small ghost" data-k-clear="color">Standard</button></span>`)}`;
    case "image": return html`${imagePick("url", b.url)}<div class="grid-2">${field("Link when it is pressed (optional)", txt("link", b.link, "/news/… or https://…"))}${field("Description for screen readers", txt("alt", b.alt))}</div>${field("Caption under it (optional)", txt("caption", b.caption))}`;
    case "columns": return html`${field("Columns", sel("count", b.count ?? 2, [[2, "Two"], [3, "Three"]]))}
      <div class="nlb-cols c${Number(b.count) === 3 ? 3 : 2}">${(b.cols ?? []).slice(0, Number(b.count) === 3 ? 3 : 2).map((c, i) => html`<fieldset><legend>Column ${i + 1}</legend>
        ${imagePick(`cols.${i}.image`, c.image)}${field("Heading", txt(`cols.${i}.heading`, c.heading))}${field("Text", area(`cols.${i}.text`, c.text, "", 3))}
        ${field("Link", txt(`cols.${i}.link`, c.link, "/… or https://…"))}${field("Link words", txt(`cols.${i}.linkText`, c.linkText, "Read more"))}</fieldset>`)}</div>`;
    case "spacer": return field("Height (pixels)", html`<input type="number" data-k="size" min="8" max="80" value="${b.size ?? 24}">`);
    case "social": return html`<p class="muted" style="margin:0">Round buttons for the league's Facebook, X, Instagram and YouTube — the addresses under Website → Site settings → Social links.</p>`;
    case "footer": return field("Footer text (address, contact, a thank-you…)", area("text", b.text, "", 3));
    default: return html`<p class="muted" style="margin:0">A thin line across the email.</p>`;
  }
}

async function editor(el, campaign) {
  const site = await settings();
  const user = await getUser();
  let c = { ...campaign, blocks: (Array.isArray(campaign.blocks) ? campaign.blocks : []).map((b) => ({ ...b })) };
  let dirty = false, phone = false;
  const locked = c.status !== "draft";

  const preview = () => {
    const host = $("[data-nl-preview]", el);
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>:host{display:block}a{pointer-events:none}${phone ? ".wrap{width:100%!important}.col{display:block!important;width:100%!important;max-width:100%!important}" : ""}</style>`
      + renderNewsletter(c, { site, siteName: SITE.name, siteUrl: location.origin, logoUrl: site.logo_url || "/assets/logo.svg", unsubscribeUrl: "#", preview: true });
  };
  const drawBlocks = () => {
    mount($("[data-nl-blocks]", el), html`${c.blocks.map((b, i) => html`<section class="nlb" data-i="${i}">
        <header class="nlb-head"><b>${TYPE_NAME[b.type] ?? b.type}</b>${locked ? "" : html`<span class="nlb-tools">
          <button type="button" data-move="-1" ${i ? "" : "disabled"} aria-label="Move up" title="Move up">↑</button>
          <button type="button" data-move="1" ${i < c.blocks.length - 1 ? "" : "disabled"} aria-label="Move down" title="Move down">↓</button>
          <button type="button" data-dup aria-label="Copy" title="Copy">⧉</button>
          <button type="button" data-del aria-label="Remove" title="Remove">✕</button></span>`}</header>
        <div class="nlb-body form">${blockFields(b)}</div></section>`)}
      ${locked ? "" : html`<div class="nlb-add"><span>Add a block:</span>${BLOCK_TYPES.map(([t, name]) => html`<button type="button" class="btn small ghost" data-add="${t}">+ ${name}</button>`)}</div>`}`);
    if (locked) $$("[data-nl-blocks] input, [data-nl-blocks] select, [data-nl-blocks] textarea, [data-nl-blocks] button", el).forEach((x) => { x.disabled = true; });
    preview();
  };

  mount(el, html`
    <div class="toolbar"><button type="button" class="btn ghost" data-nl-back>‹ All campaigns</button>
      <span class="nl-status s-${c.status}">${STATUS[c.status]}</span>${c.sent_at ? html`<small class="muted">${fmtDate(c.sent_at)} ${fmtTime(c.sent_at)} · ${c.sent_count} sent</small>` : ""}</div>
    ${locked ? html`<div class="notice ${c.status === "sending" ? "todo" : "ok"}">${c.status === "sending" ? html`This campaign was part-way through sending (${c.sent_count} of ${c.total_count}). Press <b>Carry on sending</b> to finish it.` : "This campaign has been sent, so it can't be changed. Use “Duplicate” on the list to send something like it again."}</div>` : ""}
    <div class="form box nl-top">
      <div class="grid-2"><label>Subject (the email's title in the inbox)<input data-top="subject" maxlength="200" value="${c.subject}" ${locked ? "disabled" : ""}></label>
        <label>Preview text (the grey line after the subject in most inboxes — optional)<input data-top="preheader" maxlength="200" value="${c.preheader ?? ""}" ${locked ? "disabled" : ""}></label></div>
      <div class="btn-row">
        ${locked ? "" : html`<button type="button" class="btn" data-nl-save>Save</button>`}
        <button type="button" class="btn secondary" data-nl-test>Send me a test</button>
        ${c.status === "sent" ? "" : html`<button type="button" class="btn green" data-nl-send>${c.status === "sending" ? "Carry on sending" : "Send to all subscribers"}</button>`}
        <span class="muted" data-nl-progress></span></div>
    </div>
    <div class="nl-build">
      <div class="nl-blocks" data-nl-blocks></div>
      <div class="nl-preview-col"><div class="nl-preview-bar"><b>Preview</b>
        <span class="seg"><button type="button" class="on" data-view="desk">Computer</button><button type="button" data-view="phone">Phone</button></span></div>
        <div class="nl-preview" data-nl-preview></div></div>
    </div>`);
  drawBlocks();

  const setPath = (obj, path, value) => {
    const parts = path.split(".");
    let o = obj;
    for (let n = 0; n < parts.length - 1; n++) { o[parts[n]] ??= /^\d+$/.test(parts[n + 1]) ? [] : {}; o = o[parts[n]]; o[parts[n + 1]] ??= n + 1 < parts.length - 1 ? {} : o[parts[n + 1]]; }
    o[parts.at(-1)] = value;
  };
  const blockOf = (t) => c.blocks[Number(t.closest("[data-i]")?.dataset.i)];
  const saveNow = async () => {
    if (!c.subject.trim()) throw new Error("Give the campaign a subject first.");
    const saved = await save("newsletter_campaigns", { id: c.id, subject: c.subject.trim(), preheader: c.preheader?.trim() || null, blocks: c.blocks, updated_at: new Date().toISOString() });
    c = { ...c, ...saved, blocks: c.blocks }; dirty = false;
  };

  el.oninput = (e) => {
    const t = e.target;
    if (t.dataset.top) { c[t.dataset.top] = t.value; dirty = true; return; }
    if (!t.dataset.k) return;
    const b = blockOf(t);
    const v = t.type === "checkbox" ? t.checked : t.type === "number" || t.dataset.k === "level" || t.dataset.k === "count" ? Number(t.value) : t.value;
    setPath(b, t.dataset.k, v);
    dirty = true;
    if (t.dataset.k === "count") drawBlocks(); else preview();
  };
  el.onchange = async (e) => {
    const t = e.target;
    if (t.tagName === "SELECT" && t.dataset.k) return el.oninput(e);
    if (!t.dataset.uploadImg) return;
    const file = t.files[0];
    if (!file) return;
    t.closest("label").classList.add("busy");
    try { setPath(blockOf(t), t.dataset.uploadImg, await uploadImage(file, { folder: "newsletter", maxSize: 1200, category: "General", format: "jpeg" })); dirty = true; drawBlocks(); }
    catch (err) { toast(err.message, "error"); t.closest("label")?.classList.remove("busy"); }
  };
  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.nlBack !== undefined) {
      if (dirty && !(await confirmBox("Your changes since the last save will be lost.", { title: "Leave without saving?", ok: "Leave" }))) return;
      invalidate(); return campaignsPage(el);
    }
    if (t.dataset.view) { phone = t.dataset.view === "phone"; $$("[data-view]", el).forEach((x) => x.classList.toggle("on", x === t)); $("[data-nl-preview]", el).classList.toggle("phone", phone); return preview(); }
    const b = t.closest("[data-i]") ? blockOf(t) : null, i = b ? c.blocks.indexOf(b) : -1;
    if (t.dataset.add) { c.blocks.push({ type: t.dataset.add, ...blank(t.dataset.add) }); dirty = true; drawBlocks(); return $$(".nlb", el).at(-1)?.scrollIntoView({ behavior: "smooth", block: "center" }); }
    if (t.dataset.move) { const j = i + Number(t.dataset.move); [c.blocks[i], c.blocks[j]] = [c.blocks[j], c.blocks[i]]; dirty = true; return drawBlocks(); }
    if (t.dataset.dup !== undefined) { c.blocks.splice(i + 1, 0, JSON.parse(JSON.stringify(b))); dirty = true; return drawBlocks(); }
    if (t.dataset.del !== undefined) { c.blocks.splice(i, 1); dirty = true; return drawBlocks(); }
    if (t.dataset.kClear) { b[t.dataset.kClear] = ""; dirty = true; return drawBlocks(); }
    if (t.dataset.pick) { const url = await pickImage({ folder: "newsletter", maxSize: 1200 }); if (url) { setPath(b, t.dataset.pick, url); dirty = true; drawBlocks(); } return; }
    if (t.dataset.clearImg) { setPath(b, t.dataset.clearImg, ""); dirty = true; return drawBlocks(); }
    const progress = (text) => mount($("[data-nl-progress]", el), text);
    try {
      if (t.dataset.nlSave !== undefined) { t.disabled = true; await saveNow(); toast("Saved"); t.disabled = false; return; }
      if (t.dataset.nlTest !== undefined) {
        const to = window.prompt("Send a test to which email address?", user?.email ?? "");
        if (!to) return;
        if (!locked) await saveNow();
        t.disabled = true; progress("Sending the test…");
        const r = await newsletterSend({ action: "test", campaign_id: c.id, to: to.trim() });
        progress(r.testMode ? "Test sent (Resend is in test mode: it only reaches your own Resend address until the domain is verified)." : `Test sent to ${to.trim()}.`);
        t.disabled = false; return;
      }
      if (t.dataset.nlSend !== undefined) {
        if (!locked) await saveNow();
        const people = (await subscribers()).filter((s) => s.status === "subscribed").length;
        if (c.status === "draft" && !people) return toast("Nobody has signed up yet, so there is nobody to send it to.", "error");
        if (c.status === "draft" && !(await confirmBox(`“${c.subject}” goes to ${people} subscriber${people === 1 ? "" : "s"} now. It can't be taken back once it has gone.`, { title: "Send the newsletter?", ok: `Send to ${people}` }))) return;
        t.disabled = true;
        for (let guard = 0; guard < 500; guard++) {
          const r = await newsletterSend({ action: "send", campaign_id: c.id });
          progress(r.done ? html`<b>Sent to ${r.sent ?? r.total} people.</b>` : `Sending… ${r.sent} of ${r.total}`);
          if (r.done) break;
        }
        toast("The newsletter has gone"); invalidate();
        return editor(el, (await campaigns()).find((x) => x.id === c.id) ?? c);
      }
    } catch (err) { progress(""); toast(err.message, "error"); t.disabled = false; }
  };
}
