// ─────────────────────────────────────────────────────────────
//  Netlify Function: the Help & support emails (round 55).   URL: /.netlify/functions/support-email
//   - a new request → the officers whose role looks after its category (Admin → Support categories), the
//     Master Admin, and a "we have your request" email to the sender with their private link;
//   - the league answers → the sender (never a private note);
//   - the sender answers back → whoever is looking after it (or the category's officers).
//  The website calls it straight after sending. No login is needed, because it can only ever send the email about
//  a request or message made in the last half hour that hasn't been emailed yet (emailed_at remembers) — it can't be
//  used to send anything else. Emails go with Resend, set up as for the result emails (RESEND_API_KEY, RESULTS_EMAIL_FROM).
//  Turned off with Admin → Emails → "Support request emails" (private_settings.support_email_on).
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { toLeague, received, answered } from "../lib/support-email-template.mjs";
import { parseRecipients } from "../lib/result-email-template.mjs";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const SITE_NAME = "St Blazey & District Snooker League";
const TEST_FROM = `${SITE_NAME} <onboarding@resend.dev>`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function send({ from, to, subject, html, text }, key, idempotencyKey) {
  if (!to.length) return null;
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    // One email per address, so nobody sees anyone else's.
    body: JSON.stringify(to.slice(0, 20).map((addr) => ({ from, to: [addr], subject, html, text }))),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`The email service refused it: ${body?.message || body?.error || res.status}`);
  return body.data ?? [];
}

/** The officers who look after this category, and the Master Admin. */
async function leagueAddresses(sb, ticket, onlyAssigned = false) {
  if (onlyAssigned && ticket.assigned_to) {
    const { data } = await sb.from("profiles").select("email").eq("id", ticket.assigned_to).maybeSingle();
    const list = parseRecipients(data?.email);
    if (list.length) return list;
  }
  const { data: cat } = ticket.category_id ? await sb.from("support_categories").select("roles").eq("id", ticket.category_id).maybeSingle() : { data: null };
  const roles = [...new Set(["admin", ...(cat?.roles ?? [])])];
  const { data } = await sb.from("profiles").select("email").in("role", roles);
  return parseRecipients((data ?? []).map((p) => p.email).join("\n"));
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables." });
  if (!RESEND_API_KEY) return json(200, { skipped: "RESEND_API_KEY isn't set." });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const from = process.env.RESULTS_EMAIL_FROM || TEST_FROM;
  const siteUrl = String(process.env.SITE_URL || process.env.URL || new URL(req.url).origin).replace(/\/$/, "");

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  const { data: cfg } = await sb.from("private_settings").select("support_email_on").eq("id", 1).maybeSingle();
  if (cfg && cfg.support_email_on === false) return json(200, { skipped: "Support emails are switched off." });
  if (!UUID.test(String(body.message_id ?? ""))) return json(400, { error: "No message." });

  // Claim the message: only one made in the last half hour, and only once.
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString(), stamp = new Date().toISOString();
  const { data: claimed } = await sb.from("support_messages").update({ emailed_at: stamp }).eq("id", body.message_id).is("emailed_at", null).gte("created_at", since).select("*");
  const m = claimed?.[0];
  if (!m) return json(200, { skipped: "Already emailed." });
  if (m.internal) return json(200, { skipped: "A private note — no email." });
  const { data: t } = await sb.from("support_tickets").select("*").eq("id", m.ticket_id).maybeSingle();
  if (!t) return json(404, { error: "Request not found." });

  const mine = `${siteUrl}/support/${t.token}`, inbox = `${siteUrl}/admin/support?t=${t.id}`;
  try {
    const { count } = await sb.from("support_messages").select("id", { count: "exact", head: true }).eq("ticket_id", t.id);
    const isNew = !m.from_league && count === 1;
    if (m.from_league) {
      await send({ from, to: parseRecipients(t.email), ...answered({ siteName: SITE_NAME, link: mine, t, message: m.body, who: String(m.author_name || "The league").split(" ")[0], resolved: t.status === "resolved" }) },
        RESEND_API_KEY, `support-${m.id}`);
    } else {
      const league = await leagueAddresses(sb, t, !isNew);
      await send({ from, to: league, ...toLeague({ siteName: SITE_NAME, link: inbox, t, message: m.body, isNew }) }, RESEND_API_KEY, `support-${m.id}`);
      if (isNew) await send({ from, to: parseRecipients(t.email), ...received({ siteName: SITE_NAME, link: mine, t, message: m.body }) }, RESEND_API_KEY, `support-${m.id}-sender`);
    }
    return json(200, { ok: true });
  } catch (err) {
    await sb.from("support_messages").update({ emailed_at: null }).eq("id", m.id);
    return json(502, { error: err.message || "The email could not be sent." });
  }
};
