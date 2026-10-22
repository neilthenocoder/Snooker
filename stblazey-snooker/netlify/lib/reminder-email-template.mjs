// The words and layout of the "please enter your result" reminder (round 40). No database or network here.
// Used by netlify/functions/scorecard-reminders.mjs.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ukDate = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

/** r = { siteName, siteUrl, league, home, away, startsAt, venue, scorecardPath, matchPath, team, started } → { subject, html, text } */
export function reminderEmail(r) {
  const link = (path) => `${String(r.siteUrl || "").replace(/\/$/, "")}${path}`;
  const subject = `Reminder: please enter the result — ${r.home} v ${r.away} (${ukDate(r.startsAt)})`;
  const what = r.started
    ? "The scorecard was started but hasn't been submitted yet."
    : "There's no result on the website for this match yet.";
  const html = `<!doctype html><html><body style="margin:0;background:#f9f8ee;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:620px;margin:0 auto;padding:20px 14px">
    <div style="background:#111;color:#fff;padding:16px 18px;border-bottom:5px solid #e8003d">
      <div style="font-size:13px;color:#fbb61a;font-weight:bold">${esc(r.siteName)}</div>
      <div style="font-size:20px;font-weight:bold;margin-top:4px">Your match result is still needed</div>
    </div>
    <div style="background:#fff;padding:18px">
      <p style="margin:0 0 4px;color:#555;font-size:14px">${esc(r.league || "League match")} · ${esc(ukDate(r.startsAt))}${r.venue ? ` · ${esc(r.venue)}` : ""}</p>
      <p style="font-size:20px;font-weight:bold;margin:8px 0 14px">${esc(r.home)} v ${esc(r.away)}</p>
      <p style="font-size:15px;margin:0 0 6px">${what} Please enter the frames and press <b>Submit final result</b> — it only takes a couple of minutes on your phone.</p>
      <p style="margin:20px 0 6px"><a href="${esc(link(r.scorecardPath))}" style="display:inline-block;background:#0b8a12;color:#fff;font-weight:bold;text-decoration:none;padding:12px 18px">Enter the scorecard</a>
        &nbsp; <a href="${esc(link(r.matchPath))}" style="color:#c10033;font-weight:bold">View the match page</a></p>
      <p style="font-size:13px;color:#555;margin:16px 0 0">If the match was postponed, open the scorecard and press <b>Mark postponed</b> (or tell the results secretary).</p>
    </div>
    <p style="font-size:12px;color:#777;margin:12px 4px">You are getting this because you are a captain or vice captain of ${esc(r.team)}. It is sent once per match, the morning after.</p>
  </div></body></html>`;
  const text = [`${r.siteName} — your match result is still needed`, "", `${r.league || "League match"} · ${ukDate(r.startsAt)}${r.venue ? ` · ${r.venue}` : ""}`,
    `${r.home} v ${r.away}`, "", what, "Please enter the frames and press Submit final result.", "", `Enter the scorecard: ${link(r.scorecardPath)}`,
    "", `You are getting this because you are a captain or vice captain of ${r.team}.`].join("\n");
  return { subject, html, text };
}
