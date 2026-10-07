// ─────────────────────────────────────────────────────────────
//  Netlify Function: email the results secretary when a captain
//  submits a scorecard.   URL: /.netlify/functions/result-email
//
//  The website calls it straight after "Submit results". It checks who
//  is asking, checks the match really is submitted, and sends ONE email
//  per submission (fixtures.submitted_email_at remembers it has gone; it is cleared
//  if the card is sent back to the captain, so a re-submitted card is emailed again).
//  Emails are sent with Resend (https://resend.com).
//
//  Netlify → Site configuration → Environment variables:
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (already there for the logins function)
//    RESEND_API_KEY        your Resend API key (starts "re_") — mark it "Contains secret values"
//    RESULTS_EMAIL_FROM    e.g.  St Blazey Snooker League <results@yourdomain.co.uk>
//                          Leave it out while testing: Resend's test address onboarding@resend.dev is used,
//                          which can only send to the email address of your own Resend account.
//    SITE_URL              optional — the website's address for the links in the email
//  Who the email goes to is set in the dashboard: Admin → Result emails.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { resultEmail, testEmail, parseRecipients } from "../lib/result-email-template.mjs";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const SITE_NAME = "St Blazey & District Snooker League";
const TEST_FROM = `${SITE_NAME} <onboarding@resend.dev>`;

async function send({ from, to, subject, html, text }, key, idempotencyKey) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = body?.message || body?.error || `Resend answered ${res.status}`;
    // The commonest first-time problem, said plainly.
    throw new Error(/only send testing emails to your own email address/i.test(why)
      ? "Resend is still in test mode: until your domain is verified it can only send to the email address of your own Resend account. Put that address in “Send to”, or verify your domain and set RESULTS_EMAIL_FROM."
      : `The email service refused it: ${why}`);
  }
  return body.id;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables." });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const from = process.env.RESULTS_EMAIL_FROM || TEST_FROM;
  const siteUrl = process.env.SITE_URL || req.headers.get("origin") || new URL(req.url).origin;

  // 1. Who is asking?
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } = {}, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return json(401, { error: "Please log in again." });
  const { data: me } = await sb.from("profiles").select("role, team_role, team_id, full_name, email").eq("id", user.id).maybeSingle();
  if (!me) return json(403, { error: "Your login has no profile." });
  const { data: perm } = await sb.from("role_permissions").select("areas").eq("role", me.role).maybeSingle();
  const can = (area) => me.role === "admin" || (perm?.areas ?? []).includes(area);

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  const { data: cfg } = await sb.from("private_settings").select("*").eq("id", 1).maybeSingle();
  const to = parseRecipients(cfg?.results_email_to);

  try {
    // ── "Send a test email" button in the dashboard ──
    if (body.action === "test") {
      if (!can("settings")) return json(403, { error: "Your login isn't allowed to change the email settings." });
      if (!RESEND_API_KEY) return json(400, { error: "RESEND_API_KEY isn't set in Netlify yet (Site configuration → Environment variables). Add it, then redeploy the site." });
      if (!to.length) return json(400, { error: "Type at least one email address in “Send to” and press Save first." });
      const id = await send({ from, to, ...testEmail(SITE_NAME, siteUrl, me.full_name || me.email) }, RESEND_API_KEY);
      return json(200, { ok: true, id, to, from, testMode: from === TEST_FROM });
    }

    // ── A captain has just submitted a card ──
    if (body.action === "submitted") {
      const { data: fx } = await sb.from("fixtures").select("*").eq("id", body.fixture_id).maybeSingle();
      if (!fx) return json(404, { error: "Match not found." });
      const captain = ["captain", "vice_captain"].includes(me.role) || ["captain", "vice_captain"].includes(me.team_role);
      if (!(can("matchnights") || (captain && [fx.home_team_id, fx.away_team_id].includes(me.team_id)))) return json(403, { error: "This isn't your match." });
      if (fx.status !== "submitted") return json(200, { skipped: "The match isn't waiting for approval." });
      if (!cfg?.results_email_on || !to.length) return json(200, { skipped: "Result emails are switched off." });
      if (!RESEND_API_KEY) return json(200, { skipped: "RESEND_API_KEY isn't set." });
      // Claim the match so two presses (or two captains) can't send two emails.
      const stamp = new Date().toISOString();
      const { data: claimed } = await sb.from("fixtures").update({ submitted_email_at: stamp }).eq("id", fx.id).is("submitted_email_at", null).select("id");
      if (!claimed?.length) return json(200, { skipped: "The email for this match has already been sent." });
      try {
        const [{ data: teams }, { data: league }, { data: venue }, { data: frames }, { data: breaks }] = await Promise.all([
          sb.from("teams").select("id, name").in("id", [fx.home_team_id, fx.away_team_id]),
          sb.from("leagues").select("name").eq("id", fx.league_id).maybeSingle(),
          fx.venue_id ? sb.from("venues").select("name").eq("id", fx.venue_id).maybeSingle() : Promise.resolve({ data: null }),
          sb.from("frames").select("*").eq("fixture_id", fx.id).order("frame_no"),
          sb.from("breaks").select("*").eq("fixture_id", fx.id),
        ]);
        const ids = [...new Set((frames ?? []).flatMap((f) => [f.home_player_id, f.away_player_id]).filter(Boolean))];
        const { data: players } = ids.length ? await sb.from("players").select("id, full_name").in("id", ids) : { data: [] };
        const name = (id) => players?.find((p) => p.id === id)?.full_name ?? "–";
        const team = (id) => teams?.find((t) => t.id === id)?.name ?? "?";
        const brk = (f, pid) => (breaks ?? []).filter((b) => b.frame_no === f.frame_no && b.player_id === pid).map((b) => b.value).sort((a, b) => b - a);
        const mail = resultEmail({
          siteName: SITE_NAME, siteUrl, league: league?.name, home: team(fx.home_team_id), away: team(fx.away_team_id),
          startsAt: fx.starts_at, venue: venue?.name, submittedBy: me.full_name || me.email,
          matchPath: `/match/${fx.code || fx.id}`, photoUrl: fx.scorecard_url,
          frames: (frames ?? []).map((f) => ({ no: f.frame_no, homePlayer: name(f.home_player_id), homePoints: f.home_points ?? 0, awayPlayer: name(f.away_player_id), awayPoints: f.away_points ?? 0,
            homeBreaks: brk(f, f.home_player_id), awayBreaks: brk(f, f.away_player_id) })),
        });
        const id = await send({ from, to, ...mail }, RESEND_API_KEY, `result-${fx.id}-${Date.parse(stamp)}`);
        return json(200, { ok: true, id });
      } catch (err) {
        // Nothing went out: let the next submit try again.
        await sb.from("fixtures").update({ submitted_email_at: null }).eq("id", fx.id);
        throw err;
      }
    }
    return json(400, { error: "Unknown action." });
  } catch (err) {
    return json(502, { error: err.message || "The email could not be sent." });
  }
};
