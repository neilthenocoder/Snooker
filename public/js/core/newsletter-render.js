// ─────────────────────────────────────────────────────────────
//  NEWSLETTER EMAIL — turns a campaign's blocks into the email itself.
//  Built with tables and inline styles, as email has to be (Rich: "email
//  newsletter code is supposed to be in tables"): Outlook, Gmail and the
//  phone apps all show it the same. 600px wide, and it shrinks on phones.
//  Used by the builder's preview (admin/newsletter.js) AND by the sending
//  function (netlify/functions/newsletter.mjs), so what you see is what goes.
//  No browser or server code in here: plain text in, plain text out.
//
//  A campaign: { subject, preheader, blocks: [ … ] }. The blocks:
//    header   { title, subtitle, logo (true/false), bg, color }
//    heading  { level 1–5, text, align }
//    text     { text, align }          **bold**  *italic*  [link text](https://…)  — a blank line = new paragraph
//    button   { text, url, style "button" | "link", color, align }
//    image    { url, alt, link, caption }
//    columns  { count 2 | 3, cols: [{ image, heading, text, link, linkText }] }
//    divider  {}            spacer { size }
//    social   { }           (the Facebook / X / Instagram / YouTube links from Site settings)
//    footer   { text }      (the unsubscribe link is always added under everything)
// ─────────────────────────────────────────────────────────────
export const BLOCK_TYPES = [
  ["header", "Header"], ["heading", "Heading"], ["text", "Body text"], ["button", "Link / button"], ["image", "Image"],
  ["columns", "Columns"], ["divider", "Divider"], ["spacer", "Space"], ["social", "Social icons"], ["footer", "Footer"],
];
export const UNSUBSCRIBE = "{{unsubscribe}}";
const FONT = "Arial, Helvetica, sans-serif";
const SIZES = { 1: 30, 2: 25, 3: 21, 4: 18, 5: 16 };
const SOCIAL = [["facebook_url", "Facebook", "f", "#1877f2"], ["x_url", "X", "X", "#000000"], ["instagram_url", "Instagram", "IG", "#d6249f"], ["youtube_url", "YouTube", "YT", "#ff0000"]];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HEX = /^#[0-9a-f]{6}$/i;
const color = (c, fallback) => (HEX.test(String(c ?? "")) ? c : fallback);
const align = (a) => (["left", "center", "right"].includes(a) ? a : "left");

/** A link from the dashboard, made safe and absolute (a page of the site, /news/…, gets the site's address in front). */
export function emailHref(u, siteUrl = "") {
  const v = String(u ?? "").trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
  if (/^\/(?!\/)/.test(v)) return `${String(siteUrl).replace(/\/+$/, "")}${v}`;
  return "";
}
/** **bold**, *italic* and [links](…) inside escaped text. */
function inline(text, siteUrl, linkColor) {
  return esc(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => { const h = emailHref(url.replace(/&amp;/g, "&"), siteUrl); return h ? `<a href="${esc(h)}" style="color:${linkColor};text-decoration:underline;">${label}</a>` : label; })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\n/g, "<br>");
}
const paras = (text, siteUrl, style, linkColor) => String(text ?? "").split(/\n\s*\n/).filter((p) => p.trim())
  .map((p) => `<p style="margin:0 0 14px;${style}">${inline(p.trim(), siteUrl, linkColor)}</p>`).join("");
const row = (inner, pad = "0 32px") => `<tr><td style="padding:${pad};">${inner}</td></tr>`;

function block(b, ctx) {
  const { siteUrl, accent, site } = ctx;
  switch (b.type) {
    case "header": {
      const bg = color(b.bg, "#000000"), fg = color(b.color, "#ffffff");
      const logo = b.logo !== false && ctx.logoUrl ? `<img src="${esc(ctx.logoUrl)}" alt="${esc(ctx.siteName)}" width="90" style="display:block;margin:0 auto 12px;border:0;max-width:90px;height:auto;">` : "";
      return `<tr><td align="center" bgcolor="${bg}" style="background:${bg};padding:28px 32px;text-align:center;">${logo}`
        + (b.title ? `<h1 style="margin:0;font:bold 26px/1.25 ${FONT};color:${fg};">${esc(b.title)}</h1>` : "")
        + (b.subtitle ? `<p style="margin:8px 0 0;font:15px/1.4 ${FONT};color:${fg};opacity:.85;">${esc(b.subtitle)}</p>` : "")
        + `</td></tr>`;
    }
    case "heading": {
      const lv = Math.min(5, Math.max(1, Number(b.level) || 2));
      return row(`<h${lv} style="margin:22px 0 10px;font:bold ${SIZES[lv]}px/1.25 ${FONT};color:#111111;text-align:${align(b.align)};">${esc(b.text)}</h${lv}>`);
    }
    case "text": return row(paras(b.text, siteUrl, `font:16px/1.6 ${FONT};color:#333333;text-align:${align(b.align)};`, accent));
    case "button": {
      const href = emailHref(b.url, siteUrl);
      if (!href || !b.text) return "";
      const c = color(b.color, accent);
      if (b.style === "link") return row(`<p style="margin:0 0 16px;text-align:${align(b.align)};font:bold 16px ${FONT};"><a href="${esc(href)}" style="color:${c};text-decoration:underline;">${esc(b.text)}</a></p>`);
      return row(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align(b.align) === "left" ? "left" : align(b.align)}" style="margin:6px 0 20px;"><tr>
        <td bgcolor="${c}" style="background:${c};border-radius:4px;"><a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font:bold 16px ${FONT};color:#ffffff;text-decoration:none;">${esc(b.text)}</a></td></tr></table>`);
    }
    case "image": {
      if (!b.url) return "";
      const img = `<img src="${esc(b.url)}" alt="${esc(b.alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;">`;
      const href = emailHref(b.link, siteUrl);
      return row(`${href ? `<a href="${esc(href)}">${img}</a>` : img}${b.caption ? `<p style="margin:8px 0 0;font:13px/1.4 ${FONT};color:#777777;">${esc(b.caption)}</p>` : ""}`, "6px 32px 18px");
    }
    case "columns": {
      const n = Number(b.count) === 3 ? 3 : 2, cols = (Array.isArray(b.cols) ? b.cols : []).slice(0, n);
      while (cols.length < n) cols.push({});
      const w = Math.floor(536 / n) - 12;
      const cell = (c) => {
        const href = emailHref(c.link, siteUrl);
        return `<td class="col" valign="top" width="${w}" style="width:${w}px;padding:0 6px 16px;">`
          + (c.image ? `${href ? `<a href="${esc(href)}">` : ""}<img src="${esc(c.image)}" alt="" width="${w}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;margin:0 0 10px;">${href ? "</a>" : ""}` : "")
          + (c.heading ? `<h3 style="margin:0 0 6px;font:bold 17px/1.3 ${FONT};color:#111111;">${esc(c.heading)}</h3>` : "")
          + (c.text ? paras(c.text, siteUrl, `font:14px/1.55 ${FONT};color:#444444;`, accent) : "")
          + (href && c.linkText ? `<p style="margin:0;font:bold 14px ${FONT};"><a href="${esc(href)}" style="color:${accent};">${esc(c.linkText)} →</a></p>` : "")
          + `</td>`;
      };
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 6px;"><tr>${cols.map(cell).join("")}</tr></table>`, "0 26px");
    }
    case "divider": return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #e1e1e1;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`, "10px 32px 18px");
    case "spacer": return `<tr><td style="height:${Math.min(80, Math.max(8, Number(b.size) || 24))}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
    case "social": {
      const links = SOCIAL.map(([key, name, letter, bg]) => [emailHref(site?.[key]), name, letter, bg]).filter(([h]) => h);
      if (!links.length) return "";
      return row(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:6px auto 18px;"><tr>${links.map(([h, name, letter, bg]) =>
        `<td style="padding:0 5px;"><a href="${esc(h)}" title="${name}" style="display:inline-block;width:36px;height:36px;line-height:36px;border-radius:18px;background:${bg};color:#ffffff;font:bold 13px/36px ${FONT};text-align:center;text-decoration:none;">${letter}</a></td>`).join("")}</tr></table>`);
    }
    case "footer": return `<tr><td bgcolor="#f2f2f2" style="background:#f2f2f2;padding:20px 32px;">${paras(b.text, siteUrl, `font:13px/1.5 ${FONT};color:#666666;text-align:center;`, "#666666")}</td></tr>`;
    default: return "";
  }
}

/**
 * The whole email. opts: { site (settings row), siteName, siteUrl, logoUrl, unsubscribeUrl (or leave the
 * {{unsubscribe}} mark in, to put each person's own link in when sending), preview: true for the builder }.
 */
export function renderNewsletter(campaign, opts = {}) {
  const ctx = { siteName: opts.siteName ?? "", siteUrl: opts.siteUrl ?? "", logoUrl: emailHref(opts.logoUrl, opts.siteUrl), site: opts.site ?? {}, accent: color(opts.accent, "#e4002b") };
  const blocks = Array.isArray(campaign?.blocks) ? campaign.blocks : [];
  const unsub = opts.unsubscribeUrl ?? UNSUBSCRIBE;
  const body = blocks.map((b) => block(b, ctx)).join("\n");
  const pre = campaign?.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(campaign.preheader)}</div>` : "";
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eeeeee" style="background:#eeeeee;">
<tr><td align="center" style="padding:24px 10px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;background:#ffffff;">
${body}
<tr><td style="padding:18px 32px 26px;text-align:center;font:12px/1.5 ${FONT};color:#888888;">You are getting this because you signed up to the ${esc(ctx.siteName)} newsletter.<br>
<a href="${esc(unsub)}" style="color:#888888;text-decoration:underline;">Unsubscribe</a></td></tr>
</table></td></tr></table>`;
  if (opts.preview) return `${pre}${table}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<title>${esc(campaign?.subject)}</title>
<style>body{margin:0;padding:0;}img{-ms-interpolation-mode:bicubic;}@media only screen and (max-width:620px){.wrap{width:100%!important;}.col{display:block!important;width:100%!important;max-width:100%!important;}}</style>
</head><body style="margin:0;padding:0;background:#eeeeee;">${pre}${table}</body></html>`;
}

/** The plain-text copy sent with it (for email apps that don't show pictures and colours). */
export function newsletterText(campaign, { siteUrl = "", siteName = "", unsubscribeUrl = UNSUBSCRIBE } = {}) {
  const plain = (t) => String(t ?? "").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, l, u) => `${l} (${emailHref(u, siteUrl) || u})`).replace(/\*\*?([^*]+)\*\*?/g, "$1");
  const out = [];
  for (const b of campaign?.blocks ?? []) {
    if (b.type === "header") out.push([b.title, b.subtitle].filter(Boolean).join("\n"));
    if (b.type === "heading") out.push(String(b.text ?? "").toUpperCase());
    if (b.type === "text" || b.type === "footer") out.push(plain(b.text));
    if (b.type === "button" && b.text) out.push(`${b.text}: ${emailHref(b.url, siteUrl)}`);
    if (b.type === "image" && b.caption) out.push(b.caption);
    if (b.type === "columns") for (const c of b.cols ?? []) out.push([c.heading, plain(c.text), c.link ? emailHref(c.link, siteUrl) : ""].filter(Boolean).join("\n"));
  }
  out.push(`—\nYou are getting this because you signed up to the ${siteName} newsletter. Unsubscribe: ${unsubscribeUrl}`);
  return out.filter((x) => String(x).trim()).join("\n\n");
}

/** A new campaign starts with these blocks. */
export const STARTER_BLOCKS = (siteName) => [
  { type: "header", title: siteName, subtitle: "Newsletter", logo: true, bg: "#000000", color: "#ffffff" },
  { type: "heading", level: 1, text: "Hello!", align: "left" },
  { type: "text", text: "Write your news here. **Bold** and *italic* work, and so do links: [the website](/).\n\nA blank line starts a new paragraph." },
  { type: "button", text: "Read more on the website", url: "/news", style: "button", align: "left" },
  { type: "divider" },
  { type: "social" },
  { type: "footer", text: `${siteName}` },
];
