// ─────────────────────────────────────────────────────────────
//  Netlify Function: send a newsletter campaign.   URL: /.netlify/functions/newsletter
//  (Rich, round 22 — Admin → Newsletter → Campaigns.)
//
//  { action: "test", campaign_id, to }   one copy to an address of your choice (marked [TEST])
//  { action: "send", campaign_id }       the next 100 subscribers who haven't had it yet; the dashboard
//                                         keeps asking until everyone has (so a long list never times out).
//  Only logins with "Newsletter" (Admin → Roles & permissions) or the Master Admin may use it.
//  Each person gets their own email with their own unsubscribe link (and the "List-Unsubscribe"
//  header email apps use for their own Unsubscribe button). The email is built by the same code
//  as the preview in the dashboard: public/js/core/newsletter-render.js.
//
//  Netlify → Site configuration → Environment variables (the same as the result emails):
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
//    NEWSLETTER_EMAIL_FROM   e.g. St Blazey Snooker League <news@your-domain.co.uk>  (RESULTS_EMAIL_FROM is used if this isn't set)
//    SITE_URL                optional — the website's address for the links (Netlify's own address otherwise)
//  Resend's free plan sends up to 100 emails a day and 3,000 a month: a bigger list needs a paid plan.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { renderNewsletter, newsletterText, UNSUBSCRIBE } from "../../public/js/core/newsletter-render.js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const SITE_NAME = "St Blazey & District Snooker League";
const BATCH = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

async function resend(path, payload, key, idempotencyKey) {
  const res = await fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = body?.message || body?.error || `Resend answered ${res.status}`;
    throw new Error(/only send testing emails to your own email address/i.test(why)
      ? "Resend is still in test mode: until the league's domain is verified it can only send to the email address of your own Resend account."
      : `The email service refused it: ${why}`);
  }
  return body;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables." });
  if (!RESEND_API_KEY) return json(400, { error: "RESEND_API_KEY isn't set in Netlify yet (Site configuration → Environment variables). Add it, then redeploy the site." });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const from = process.env.NEWSLETTER_EMAIL_FROM || process.env.RESULTS_EMAIL_FROM || `${SITE_NAME} <onboarding@resend.dev>`;
  const siteUrl = (process.env.SITE_URL || process.env.URL || new URL(req.url).origin).replace(/\/+$/, "");

  // Who is asking? Newsletter officers and the Master Admin only (two-step login too, when their role needs it).
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } = {}, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return json(401, { error: "Please log in again." });
  const { data: me } = await sb.from("profiles").select("role, full_name, email").eq("id", user.id).maybeSingle();
  const { data: perm } = await sb.from("role_permissions").select("areas").eq("role", me?.role ?? "").maybeSingle();
  if (!(me?.role === "admin" || (perm?.areas ?? []).includes("newsletter"))) return json(403, { error: "Your login isn't allowed to send the newsletter." });
  const { data: sec } = await sb.from("security_settings").select("mfa_roles").eq("id", 1).maybeSingle();
  if ((sec?.mfa_roles ?? []).includes(me.role)) {
    const claims = JSON.parse(Buffer.from(String(token.split(".")[1] ?? ""), "base64url").toString() || "{}");
    if (claims.aal !== "aal2") return json(403, { error: "Please finish the two-step login first." });
  }

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  if (!UUID.test(String(body.campaign_id ?? ""))) return json(400, { error: "Which campaign?" });
  const { data: campaign } = await sb.from("newsletter_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
  if (!campaign) return json(404, { error: "Campaign not found." });
  const { data: site } = await sb.from("settings").select("*").eq("id", 1).maybeSingle();
  const html = renderNewsletter(campaign, { site: site ?? {}, siteName: SITE_NAME, siteUrl, logoUrl: site?.logo_url || "" });
  const text = newsletterText(campaign, { siteUrl, siteName: SITE_NAME });
  const personal = (s, url) => s.split(UNSUBSCRIBE).join(url);

  try {
    if (body.action === "test") {
      const to = String(body.to ?? "").trim();
      if (!EMAIL.test(to)) return json(400, { error: "Type the email address to send the test to." });
      const url = `${siteUrl}/unsubscribe`;
      const sent = await resend("/emails", { from, to: [to], subject: `[TEST] ${campaign.subject}`, html: personal(html, url), text: personal(text, url) }, RESEND_API_KEY);
      return json(200, { ok: true, id: sent.id, testMode: /onboarding@resend\.dev/.test(from) });
    }

    if (body.action === "send") {
      if (campaign.status === "sent") return json(200, { done: true, sent: campaign.sent_count, total: campaign.total_count });
      const { data: everyone } = await sb.from("newsletter_subscribers").select("id, email, token").eq("status", "subscribed").order("created_at").order("id");
      const list = everyone ?? [];
      const first = campaign.status === "draft";
      // The list is fixed when sending starts: people are taken in order, BATCH at a time.
      const total = first ? list.length : campaign.total_count;
      const offset = first ? 0 : campaign.sent_count;
      if (first) {
        const { data: claimed } = await sb.from("newsletter_campaigns").update({ status: "sending", total_count: total, sent_count: 0, updated_at: new Date().toISOString() })
          .eq("id", campaign.id).eq("status", "draft").select("id");
        if (!claimed?.length) return json(409, { error: "This campaign is already being sent — reload the page." });
      }
      const chunk = list.slice(offset, offset + BATCH);
      if (chunk.length) {
        await resend("/emails/batch", chunk.map((s) => {
          const url = `${siteUrl}/unsubscribe?t=${s.token}`;
          return { from, to: [s.email], subject: campaign.subject, html: personal(html, url), text: personal(text, url),
            headers: { "List-Unsubscribe": `<${url}>` } };
        }), RESEND_API_KEY, `nl-${campaign.id}-${offset}`);
      }
      const sent = offset + chunk.length, done = sent >= Math.min(total, list.length) || !chunk.length;
      await sb.from("newsletter_campaigns").update({ sent_count: sent, ...(done ? { status: "sent", sent_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() }).eq("id", campaign.id);
      return json(200, { ok: true, sent, total, done });
    }
    return json(400, { error: "Unknown action." });
  } catch (err) {
    return json(502, { error: err.message || "The newsletter could not be sent." });
  }
};
