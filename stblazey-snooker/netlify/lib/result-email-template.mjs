// The words and layout of the "result submitted" email. No database or network here,
// so it can be read (and changed) on its own. Used by netlify/functions/result-email.mjs.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ukDate = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** "a@x.com, b@y.org; c@z.net" → ["a@x.com", "b@y.org", "c@z.net"] (at most 10, obviously wrong ones dropped). */
export function parseRecipients(text) {
  return [...new Set(String(text ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s)))].slice(0, 10);
}

/**
 * m = { siteName, siteUrl, league, home, away, startsAt, venue, submittedBy, matchPath, photoUrl,
 *       frames: [{ no, homePlayer, homePoints, awayPlayer, awayPoints, homeBreaks: [..], awayBreaks: [..] }] }
 * Returns { subject, html, text }.
 */
export function resultEmail(m) {
  const won = (f) => (f.homePoints > f.awayPoints ? "home" : f.awayPoints > f.homePoints ? "away" : null);
  const score = m.frames.reduce((s, f) => { const w = won(f); if (w) s[w]++; return s; }, { home: 0, away: 0 });
  const breaks = m.frames.flatMap((f) => [...f.homeBreaks.map((v) => [f.homePlayer, v]), ...f.awayBreaks.map((v) => [f.awayPlayer, v])]).sort((a, b) => b[1] - a[1]);
  const link = (path) => `${String(m.siteUrl || "").replace(/\/$/, "")}${path}`;
  const subject = `Result submitted: ${m.home} ${score.home}–${score.away} ${m.away}${m.league ? ` (${m.league})` : ""}`;

  const row = (f) => { const w = won(f); const b = (list) => (list.length ? ` <span style="color:#666">(break${list.length > 1 ? "s" : ""} ${list.join(", ")})</span>` : "");
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e6e0;text-align:center;color:#666">${f.no}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e6e0;text-align:right;${w === "home" ? "font-weight:bold" : ""}">${esc(f.homePlayer)}${b(f.homeBreaks)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e6e0;text-align:center;white-space:nowrap;font-weight:bold">${f.homePoints} – ${f.awayPoints}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e6e0;${w === "away" ? "font-weight:bold" : ""}">${esc(f.awayPlayer)}${b(f.awayBreaks)}</td></tr>`; };

  const html = `<!doctype html><html><body style="margin:0;background:#f9f8ee;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:620px;margin:0 auto;padding:20px 14px">
    <div style="background:#111;color:#fff;padding:16px 18px;border-bottom:5px solid #e8003d">
      <div style="font-size:13px;color:#fbb61a;font-weight:bold">${esc(m.siteName)}</div>
      <div style="font-size:20px;font-weight:bold;margin-top:4px">A result is waiting for approval</div>
    </div>
    <div style="background:#fff;padding:18px">
      <p style="margin:0 0 4px;color:#555;font-size:14px">${esc(m.league || "League match")} · ${esc(ukDate(m.startsAt))}${m.venue ? ` · ${esc(m.venue)}` : ""}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:10px 0 16px"><tr>
        <td style="width:40%;text-align:right;font-size:18px;font-weight:bold;padding:8px">${esc(m.home)}</td>
        <td style="width:20%;text-align:center;font-size:26px;font-weight:bold;background:#111;color:#fff;padding:8px;white-space:nowrap">${score.home} – ${score.away}</td>
        <td style="width:40%;font-size:18px;font-weight:bold;padding:8px">${esc(m.away)}</td></tr></table>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#e6e6e0"><th style="padding:8px 10px">#</th><th style="padding:8px 10px;text-align:right">${esc(m.home)}</th><th style="padding:8px 10px">Score</th><th style="padding:8px 10px;text-align:left">${esc(m.away)}</th></tr>
        ${m.frames.map(row).join("")}
      </table>
      ${breaks.length ? `<p style="font-size:14px;margin:14px 0 0"><b>Breaks:</b> ${breaks.map(([who, v]) => `${esc(who)} ${v}`).join(", ")}</p>` : ""}
      <p style="font-size:14px;margin:14px 0 0">Submitted by <b>${esc(m.submittedBy || "a captain")}</b>.${m.photoUrl ? ` <a href="${esc(m.photoUrl)}" style="color:#c10033">See the photo of the paper scorecard</a>.` : ""}</p>
      <p style="margin:20px 0 6px"><a href="${esc(link("/admin/results"))}" style="display:inline-block;background:#0b8a12;color:#fff;font-weight:bold;text-decoration:none;padding:12px 18px">Check and approve it</a>
        &nbsp; <a href="${esc(link(m.matchPath))}" style="color:#c10033;font-weight:bold">View the match page</a></p>
    </div>
    <p style="font-size:12px;color:#777;margin:12px 4px">You are getting this because your address is listed under Admin → Result emails on the ${esc(m.siteName)} website. Until it is approved, a captain can still correct the card.</p>
  </div></body></html>`;

  const text = [`${m.siteName} — a result is waiting for approval`, "",
    `${m.league || "League match"} · ${ukDate(m.startsAt)}${m.venue ? ` · ${m.venue}` : ""}`,
    `${m.home} ${score.home} – ${score.away} ${m.away}`, "",
    ...m.frames.map((f) => `Frame ${f.no}: ${f.homePlayer} ${f.homePoints} – ${f.awayPoints} ${f.awayPlayer}`),
    ...(breaks.length ? ["", `Breaks: ${breaks.map(([who, v]) => `${who} ${v}`).join(", ")}`] : []),
    "", `Submitted by ${m.submittedBy || "a captain"}.`, ...(m.photoUrl ? [`Scorecard photo: ${m.photoUrl}`] : []),
    "", `Check and approve it: ${link("/admin/results")}`, `Match page: ${link(m.matchPath)}`].join("\n");
  return { subject, html, text };
}

/** The email the "Send a test email" button sends. */
export function testEmail(siteName, siteUrl, sentBy) {
  const subject = `Test email from the ${siteName} website`;
  const text = `This is a test from the ${siteName} website (${siteUrl}).\n\nIf you can read this, result emails are set up correctly: from now on this address gets an email each time a captain submits a scorecard.\n\nSent by ${sentBy || "an admin"}.`;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#f9f8ee;margin:0"><div style="max-width:560px;margin:0 auto;padding:20px 14px">
    <div style="background:#111;color:#fff;padding:16px 18px;border-bottom:5px solid #e8003d;font-size:20px;font-weight:bold">Test email — it works</div>
    <div style="background:#fff;padding:18px;font-size:15px;line-height:1.5"><p style="margin-top:0">This is a test from the <b>${esc(siteName)}</b> website.</p>
    <p>If you can read this, result emails are set up correctly: from now on this address gets an email each time a captain submits a scorecard.</p>
    <p style="margin-bottom:0;color:#555">Sent by ${esc(sentBy || "an admin")}.</p></div></div></body></html>`;
  return { subject, html, text };
}
