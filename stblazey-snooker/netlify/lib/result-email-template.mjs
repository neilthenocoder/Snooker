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
export function resultEmail(m, { copyFor = null } = {}) {
  const won = (f) => (f.homePoints > f.awayPoints ? "home" : f.awayPoints > f.homePoints ? "away" : null);
  const score = m.frames.reduce((s, f) => { const w = won(f); if (w) s[w]++; return s; }, { home: 0, away: 0 });
  const breaks = m.frames.flatMap((f) => [...f.homeBreaks.map((v) => [f.homePlayer, v]), ...f.awayBreaks.map((v) => [f.awayPlayer, v])]).sort((a, b) => b[1] - a[1]);
  const link = (path) => `${String(m.siteUrl || "").replace(/\/$/, "")}${path}`;
  // copyFor: the team of a captain / vice captain getting their own copy of the card (no "approve" button for them).
  const subject = `${copyFor ? "Your result as submitted" : "Result submitted"}: ${m.home} ${score.home}–${score.away} ${m.away}${m.league ? ` (${m.league})` : ""}`;

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
      <div style="font-size:20px;font-weight:bold;margin-top:4px">${copyFor ? "Your match result, as submitted" : "A result is waiting for approval"}</div>
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
      <p style="margin:20px 0 6px">${copyFor ? `<a href="${esc(link(m.matchPath))}" style="display:inline-block;background:#0b8a12;color:#fff;font-weight:bold;text-decoration:none;padding:12px 18px">View the match page</a>`
        : `<a href="${esc(link("/admin/results"))}" style="display:inline-block;background:#0b8a12;color:#fff;font-weight:bold;text-decoration:none;padding:12px 18px">Check and approve it</a>
        &nbsp; <a href="${esc(link(m.matchPath))}" style="color:#c10033;font-weight:bold">View the match page</a>`}</p>
    </div>
    <p style="font-size:12px;color:#777;margin:12px 4px">${copyFor
      ? `You are getting this copy because you are a captain or vice captain of ${esc(copyFor)}. If something on the card is wrong, tell the results secretary before it is approved.`
      : `You are getting this because your address is listed under Admin → Emails on the ${esc(m.siteName)} website. Until it is approved, a captain can still correct the card.`}</p>
  </div></body></html>`;

  const text = [`${m.siteName} — ${copyFor ? "your match result, as submitted" : "a result is waiting for approval"}`, "",
    `${m.league || "League match"} · ${ukDate(m.startsAt)}${m.venue ? ` · ${m.venue}` : ""}`,
    `${m.home} ${score.home} – ${score.away} ${m.away}`, "",
    ...m.frames.map((f) => `Frame ${f.no}: ${f.homePlayer} ${f.homePoints} – ${f.awayPoints} ${f.awayPlayer}`),
    ...(breaks.length ? ["", `Breaks: ${breaks.map(([who, v]) => `${who} ${v}`).join(", ")}`] : []),
    "", `Submitted by ${m.submittedBy || "a captain"}.`, ...(m.photoUrl ? [`Scorecard photo: ${m.photoUrl}`] : []),
    "", ...(copyFor ? [] : [`Check and approve it: ${link("/admin/results")}`]), `Match page: ${link(m.matchPath)}`,
    "", copyFor ? `You are getting this copy because you are a captain or vice captain of ${copyFor}.` : "You are getting this because your address is listed under Admin → Emails."].join("\n");
  return { subject, html, text };
}

/** The email the "Send a test email" buttons send (which: "results" or "entries"). */
export function testEmail(siteName, siteUrl, sentBy, which = "results") {
  const what = which === "entries" ? "each time someone enters a competition on the website's entry form" : "each time a captain submits a scorecard";
  const subject = `Test email from the ${siteName} website`;
  const text = `This is a test from the ${siteName} website (${siteUrl}).\n\nIf you can read this, the emails are set up correctly: from now on this address gets an email ${what}.\n\nSent by ${sentBy || "an admin"}.`;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#f9f8ee;margin:0"><div style="max-width:560px;margin:0 auto;padding:20px 14px">
    <div style="background:#111;color:#fff;padding:16px 18px;border-bottom:5px solid #e8003d;font-size:20px;font-weight:bold">Test email — it works</div>
    <div style="background:#fff;padding:18px;font-size:15px;line-height:1.5"><p style="margin-top:0">This is a test from the <b>${esc(siteName)}</b> website.</p>
    <p>If you can read this, the emails are set up correctly: from now on this address gets an email ${esc(what)}.</p>
    <p style="margin-bottom:0;color:#555">Sent by ${esc(sentBy || "an admin")}.</p></div></div></body></html>`;
  return { subject, html, text };
}

/**
 * New competition entries from the entry form, for the competition secretary.
 * e = { siteName, siteUrl, player, contact, entries: [{ competition, name, fee, payBy }] }
 */
export function entriesEmail(e) {
  const link = (path) => `${String(e.siteUrl || "").replace(/\/$/, "")}${path}`;
  const money = (n) => (Number(n) > 0 ? `£${Number(n).toFixed(2).replace(/\.00$/, "")}` : "–");
  const day = (iso) => (iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso)) : "–");
  const n = e.entries.length;
  const subject = `New competition entr${n > 1 ? "ies" : "y"}: ${e.entries.map((x) => x.competition).join(", ")} — ${e.player}`;
  const rows = e.entries.map((x) => `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e6e0;font-weight:bold">${esc(x.competition)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e6e0">${esc(x.name)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e6e0;white-space:nowrap">${esc(money(x.fee))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e6e0;white-space:nowrap">${esc(day(x.payBy))}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f9f8ee;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:620px;margin:0 auto;padding:20px 14px">
    <div style="background:#111;color:#fff;padding:16px 18px;border-bottom:5px solid #fbb61a">
      <div style="font-size:13px;color:#fbb61a;font-weight:bold">${esc(e.siteName)}</div>
      <div style="font-size:20px;font-weight:bold;margin-top:4px">New competition entr${n > 1 ? "ies" : "y"}</div>
    </div>
    <div style="background:#fff;padding:18px">
      <p style="margin:0 0 12px;font-size:15px"><b>${esc(e.player)}</b> entered on the website${e.contact ? ` — contact: <b>${esc(e.contact)}</b>` : ""}.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#e6e6e0"><th style="padding:8px 10px;text-align:left">Competition</th><th style="padding:8px 10px;text-align:left">Entry</th><th style="padding:8px 10px;text-align:left">Fee</th><th style="padding:8px 10px;text-align:left">Pay by</th></tr>
        ${rows}
      </table>
      <p style="font-size:14px;margin:14px 0 0">The entr${n > 1 ? "ies wait" : "y waits"} under <b>Entries to approve</b> until the fee is confirmed as paid.</p>
      <p style="margin:20px 0 6px"><a href="${esc(link("/admin/entries"))}" style="display:inline-block;background:#0b8a12;color:#fff;font-weight:bold;text-decoration:none;padding:12px 18px">Open Entries to approve</a></p>
    </div>
    <p style="font-size:12px;color:#777;margin:12px 4px">You are getting this because your address is listed for competition entries under Admin → Emails on the ${esc(e.siteName)} website.</p>
  </div></body></html>`;
  const text = [`${e.siteName} — new competition entr${n > 1 ? "ies" : "y"}`, "",
    `${e.player} entered on the website${e.contact ? ` (contact: ${e.contact})` : ""}.`, "",
    ...e.entries.map((x) => `${x.competition}: ${x.name} — fee ${money(x.fee)}, pay by ${day(x.payBy)}`), "",
    `Entries to approve: ${link("/admin/entries")}`].join("\n");
  return { subject, html, text };
}
