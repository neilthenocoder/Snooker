// The words and layout of the Help & support emails (round 55). No database or network here.
// Used by netlify/functions/support-email.mjs.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const paras = (t) => esc(t).split(/\n{2,}/).map((p) => `<p style="margin:0 0 10px">${p.replace(/\n/g, "<br>")}</p>`).join("");

function layout({ siteName, heading, body, button, buttonUrl, foot }) {
  return `<!doctype html><html><body style="margin:0;background:#f9f8ee;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:620px;margin:0 auto;padding:20px 14px">
    <div style="background:#111;color:#fff;padding:16px 18px;border-bottom:5px solid #e8003d">
      <div style="font-size:13px;color:#fbb61a;font-weight:bold">${esc(siteName)}</div>
      <div style="font-size:20px;font-weight:bold;margin-top:4px">${esc(heading)}</div>
    </div>
    <div style="background:#fff;padding:18px;font-size:15px;line-height:1.5">${body}
      ${button ? `<p style="margin:18px 0 4px"><a href="${esc(buttonUrl)}" style="display:inline-block;background:#0b8a12;color:#fff;font-weight:bold;text-decoration:none;padding:12px 18px">${esc(button)}</a></p>` : ""}
    </div>
    <p style="font-size:12px;color:#777;margin:12px 4px">${esc(foot)}</p>
  </div></body></html>`;
}
const quote = (who, text) => `<div style="border-left:4px solid #e6e6e0;padding:8px 12px;margin:12px 0;background:#faf9f4">
  <div style="font-size:12px;color:#666;margin-bottom:6px">${esc(who)}</div>${paras(text)}</div>`;

/** To the officers who look after the category: a new request, or the sender's answer. */
export function toLeague({ siteName, link, t, message, isNew }) {
  const subject = `${isNew ? "New support request" : "Reply on support request"} #${t.no}: ${t.subject}`;
  const body = `<p style="margin:0 0 6px;color:#555;font-size:14px">${esc(t.category)} · from <b>${esc(t.name)}</b> (${esc(t.email)})</p>
    <h2 style="font-size:18px;margin:0 0 6px">${esc(t.subject)}</h2>${quote(isNew ? "Their request" : "Their reply", message)}`;
  const foot = `You are getting this because your role looks after “${t.category}” requests (Admin → Support categories). Answer on the website so the conversation stays in one place.`;
  return { subject, html: layout({ siteName, heading: isNew ? "A new support request" : "They have replied", body, button: "Open it in the dashboard", buttonUrl: link, foot }),
    text: `${subject}\n\n${t.category} · from ${t.name} (${t.email})\n\n${message}\n\nOpen it: ${link}\n\n${foot}` };
}

/** To the sender: we have your request (with their private link). */
export function received({ siteName, link, t, message }) {
  const subject = `We have your request #${t.no}: ${t.subject}`;
  const body = `<p style="margin:0 0 10px">Hello ${esc(t.name.split(" ")[0])},</p><p style="margin:0 0 10px">Thank you — your request has gone to the right person at the league, who will answer as soon as they can. Your reference is <b>#${t.no}</b>.</p>
    ${quote("You wrote", message)}<p style="margin:0">You can see the league's answers and reply at any time from the link below.</p>`;
  const foot = `Keep this email: the link is private to you. You sent this request from the ${siteName} website.`;
  return { subject, html: layout({ siteName, heading: "We have your request", body, button: "See your request", buttonUrl: link, foot }),
    text: `Hello ${t.name.split(" ")[0]},\n\nThank you — your request has gone to the league. Your reference is #${t.no}.\n\nYou wrote:\n${message}\n\nSee the answers and reply: ${link}\n\n${foot}` };
}

/** To the sender: the league has answered. */
export function answered({ siteName, link, t, message, who, resolved }) {
  const subject = `Re: your request #${t.no}: ${t.subject}`;
  const body = `<p style="margin:0 0 10px">Hello ${esc(t.name.split(" ")[0])},</p><p style="margin:0 0 10px">The league has answered your request <b>#${t.no}</b>.</p>
    ${quote(who, message)}${resolved ? `<p style="margin:0">The league has marked it as sorted. If it isn't, just reply from the link below and it opens again.</p>` : `<p style="margin:0">To answer, use the link below.</p>`}`;
  const foot = `Please answer on the website rather than replying to this email. The link is private to you.`;
  return { subject, html: layout({ siteName, heading: "The league has answered", body, button: "Read and reply", buttonUrl: link, foot }),
    text: `Hello ${t.name.split(" ")[0]},\n\nThe league has answered your request #${t.no}.\n\n${who}:\n${message}\n\nRead and reply: ${link}\n\n${foot}` };
}
