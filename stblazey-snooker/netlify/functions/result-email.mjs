// ─────────────────────────────────────────────────────────────
//  Netlify Function: the league's emails.   URL: /.netlify/functions/result-email
//   - a captain submits a scorecard → the results secretary (and the Master Admin, always, unless switched off),
//     and a copy of the card to the captains and vice captains of both teams;
//   - someone enters competitions on the entry form → the competition secretary.
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
//    SITE_URL              optional — the website's address for the links in the email (Netlify's own URL is used otherwise)
//  Who the email goes to is set in the dashboard: Admin → Result emails.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { resultEmail, entriesEmail, testEmail, parseRecipients } from "../lib/result-email-template.mjs";

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

/** One email to each address (so nobody sees anyone else's address). Resend's batch endpoint: up to 100 at once. */
async function sendEach({ from, list, subject, html, text }, key, idempotencyKey) {
  if (!list.length) return [];
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify(list.slice(0, 100).map((to) => ({ from, to: [to], subject, html, text }))),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`The email service refused the copies: ${body?.message || body?.error || res.status}`);
  return body.data ?? [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Master Admin's address(es): they get every submitted result. */
async function masterEmails(sb) {
  const { data } = await sb.from("profiles").select("email").eq("role", "admin");
  return parseRecipients((data ?? []).map((p) => p.email).join("\n"));
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables." });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const from = process.env.RESULTS_EMAIL_FROM || TEST_FROM;
  // The website's address for the links in the email: SITE_URL if it is set, otherwise the address Netlify itself
  // gives this site (URL). Never the "origin" a browser sends, which the sender could make up.
  const siteUrl = process.env.SITE_URL || process.env.URL || new URL(req.url).origin;

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  const { data: cfg } = await sb.from("private_settings").select("*").eq("id", 1).maybeSingle();

  // ── New entries on the public entry form: no login needed (anyone can enter). It can only ever send the email
  //    about entries made in the last half hour that haven't been emailed yet — so it can't be used to send anything else. ──
  if (body.action === "entries") {
    const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x) => UUID.test(String(x))).slice(0, 20);
    const to = parseRecipients(cfg?.entries_email_to);
    if (!ids.length) return json(400, { error: "No entries." });
    if (!cfg?.entries_email_on || !to.length) return json(200, { skipped: "Entry emails are switched off." });
    if (!RESEND_API_KEY) return json(200, { skipped: "RESEND_API_KEY isn't set." });
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString(), stamp = new Date().toISOString();
    const { data: claimed } = await sb.from("competition_signups").update({ emailed_at: stamp }).in("id", ids).is("emailed_at", null).gte("created_at", since).select("*");
    if (!claimed?.length) return json(200, { skipped: "Already emailed." });
    try {
      const [{ data: comps }, { data: player }] = await Promise.all([
        sb.from("competitions").select("id, name, entry_fee").in("id", [...new Set(claimed.map((r) => r.competition_id))]),
        claimed[0].player_id ? sb.from("players").select("full_name").eq("id", claimed[0].player_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const comp = (id) => comps?.find((c) => c.id === id);
      const mail = entriesEmail({ siteName: SITE_NAME, siteUrl, player: player?.full_name || claimed[0].name, contact: claimed.find((r) => r.contact)?.contact || "",
        entries: claimed.map((r) => ({ competition: comp(r.competition_id)?.name ?? "A competition", name: r.name, fee: comp(r.competition_id)?.entry_fee, payBy: r.pay_by })) });
      const id = await send({ from, to, ...mail }, RESEND_API_KEY, `entries-${claimed.map((r) => r.id).sort().join("").slice(0, 200)}`);
      return json(200, { ok: true, id });
    } catch (err) {
      await sb.from("competition_signups").update({ emailed_at: null }).in("id", claimed.map((r) => r.id));
      return json(502, { error: err.message || "The email could not be sent." });
    }
  }

  // 1. Who is asking?
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } = {}, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return json(401, { error: "Please log in again." });
  const { data: me } = await sb.from("profiles").select("role, team_role, team_id, full_name, email").eq("id", user.id).maybeSingle();
  if (!me) return json(403, { error: "Your login has no profile." });
  const { data: perm } = await sb.from("role_permissions").select("areas").eq("role", me.role).maybeSingle();
  const can = (area) => me.role === "admin" || (perm?.areas ?? []).includes(area);

  const to = parseRecipients(cfg?.results_email_to);

  try {
    // ── "Send a test email" button in the dashboard ──
    if (body.action === "test") {
      if (!can("settings")) return json(403, { error: "Your login isn't allowed to change the email settings." });
      if (!RESEND_API_KEY) return json(400, { error: "RESEND_API_KEY isn't set in Netlify yet (Site configuration → Environment variables). Add it, then redeploy the site." });
      const entries = body.which === "entries";
      const list = entries ? parseRecipients(cfg?.entries_email_to) : to;
      if (!list.length) return json(400, { error: "Type at least one email address in “Send to” and press Save first." });
      const id = await send({ from, to: list, ...testEmail(SITE_NAME, siteUrl, me.full_name || me.email, entries ? "entries" : "results") }, RESEND_API_KEY);
      return json(200, { ok: true, id, to: list, from, testMode: from === TEST_FROM });
    }

    // ── A captain has just submitted a card ──
    if (body.action === "submitted") {
      const { data: fx } = await sb.from("fixtures").select("*").eq("id", body.fixture_id).maybeSingle();
      if (!fx) return json(404, { error: "Match not found." });
      const captain = ["captain", "vice_captain"].includes(me.role) || ["captain", "vice_captain"].includes(me.team_role);
      if (!(can("matchnights") || (captain && [fx.home_team_id, fx.away_team_id].includes(me.team_id)))) return json(403, { error: "This isn't your match." });
      if (fx.status !== "submitted") return json(200, { skipped: "The match isn't waiting for approval." });
      if (!cfg?.results_email_on) return json(200, { skipped: "Result emails are switched off." });
      if (!RESEND_API_KEY) return json(200, { skipped: "RESEND_API_KEY isn't set." });
      // Who gets it: the addresses in the dashboard, plus the Master Admin (every result, unless that is switched off) …
      const officials = [...new Set([...to, ...(cfg.results_copy_master !== false ? await masterEmails(sb) : [])].map((x) => x.toLowerCase()))].slice(0, 20);
      // … and a copy of the card for the captains and vice captains of both teams (one email each, their own team named).
      const copies = [];
      if (cfg.results_copy_captains !== false) {
        const { data: caps } = await sb.from("profiles").select("email, team_id, role, team_role").in("team_id", [fx.home_team_id, fx.away_team_id].filter(Boolean));
        for (const c of caps ?? []) {
          const isCap = ["captain", "vice_captain"].includes(c.role) || ["captain", "vice_captain"].includes(c.team_role);
          const [addr] = parseRecipients(c.email);
          if (isCap && addr && !officials.includes(addr.toLowerCase()) && !copies.some((x) => x.addr === addr.toLowerCase())) copies.push({ addr: addr.toLowerCase(), team: c.team_id });
        }
      }
      if (!officials.length && !copies.length) return json(200, { skipped: "Nobody to email: add an address under Admin → Emails." });
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
        const card = {
          siteName: SITE_NAME, siteUrl, league: league?.name, home: team(fx.home_team_id), away: team(fx.away_team_id),
          startsAt: fx.starts_at, venue: venue?.name, submittedBy: me.full_name || me.email,
          matchPath: `/match/${fx.code || fx.id}`, photoUrl: fx.scorecard_url,
          frames: (frames ?? []).map((f) => ({ no: f.frame_no, homePlayer: name(f.home_player_id), homePoints: f.home_points ?? 0, awayPlayer: name(f.away_player_id), awayPoints: f.away_points ?? 0,
            homeBreaks: brk(f, f.home_player_id), awayBreaks: brk(f, f.away_player_id) })),
        };
        const id = officials.length ? await send({ from, to: officials, ...resultEmail(card) }, RESEND_API_KEY, `result-${fx.id}-${Date.parse(stamp)}`) : null;
        // The captains' copies: a problem here (an old address, say) must not undo the email that has gone to the officials.
        let copied = 0, copyError = null;
        for (const teamId of [fx.home_team_id, fx.away_team_id]) {
          const list = copies.filter((c) => c.team === teamId).map((c) => c.addr);
          try { copied += (await sendEach({ from, list, ...resultEmail(card, { copyFor: team(teamId) }) }, RESEND_API_KEY, `result-copy-${fx.id}-${teamId}-${Date.parse(stamp)}`)).length || list.length; }
          catch (err) { copyError = err.message; }
        }
        if (!id && !copied && copyError) throw new Error(copyError);
        return json(200, { ok: true, id, officials: officials.length, copies: copied, ...(copyError ? { copyError } : {}) });
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
