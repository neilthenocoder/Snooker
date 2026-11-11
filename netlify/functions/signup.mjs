// ─────────────────────────────────────────────────────────────
//  Netlify Function: people creating their own login (round 111).
//  URL: /.netlify/functions/signup
//
//  Rich: "on launch it would prompt everyone to sign up and login … admin can turn it off".
//  The welcome set-up (public/js/core/onboard.js) asks first-time visitors to make an account.
//  This only works while the Master Admin allows it: Admin → Site settings → Home page →
//  "Welcome set-up" → "People can make their own login" ticked, and today on or before the
//  "until" date. Everything is checked HERE, on the server — the website only shows the form.
//
//  • Every account made this way is a plain Player login. Nobody can give themselves a role,
//    a team or a player profile: the league links those afterwards (Admin → Logins).
//  • The person must confirm their email address before they can log in: we email them a link
//    (Resend — the same service as the result emails).
//  • Guards against robots: a hidden field people never fill in, a form filled in too fast,
//    the "common login names" list (Admin → Security), at most 3 accounts an hour from one
//    connection and 60 an hour in all.
//
//  Needs (Netlify → Site configuration → Environment variables):
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESULTS_EMAIL_FROM (or SIGNUP_EMAIL_FROM)
//  Supabase → Authentication → URL Configuration: the website's address must be in "Redirect URLs".
//  Supabase → Authentication → "Allow new users to sign up": leave it OFF, always (see step 5).
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const SITE_NAME = "St Blazey & District Snooker League";
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
const PER_IP_HOUR = 3, ALL_HOUR = 60;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

/** Is "make your own login" open today? Same rule as signupOpen() in public/js/core/onboard.js. */
export function signupOpen(site) {
  const h = site?.home_sections ?? {};
  if (!h.onboard_on || !h.onboard_signup) return false;
  const until = String(h.onboard_until ?? "").slice(0, 10);
  return !until || ukToday() <= until;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "The website isn't set up for new logins yet. Please ask the league." });
  if (!RESEND_API_KEY) return json(500, { error: "The website can't send the confirmation email yet, so new logins can't be made. Please ask the league." });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "Invalid request." });
  const email = String(body.email ?? "").trim().toLowerCase();
  const full_name = String(body.full_name ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const password = String(body.password ?? "");

  // 1. Robots: the hidden field must be empty, and nobody types a name, an email and a password in under 3 seconds.
  if (body.website || Number(body.took_ms) < 3000) return json(400, { error: "Please try again." });

  // 2. Is it open?
  const { data: site } = await sb.from("settings").select("home_sections").eq("id", 1).maybeSingle();
  if (!signupOpen(site)) return json(403, { error: "Making your own login has closed. Your login will come from the league — ask your captain or the league secretary." });

  // 3. The details.
  if (full_name.length < 2) return json(400, { error: "Please type your name." });
  if (!EMAIL.test(email) || email.length > 254) return json(400, { error: "That doesn't look like an email address." });
  if (password.length < 8 || password.length > 72) return json(400, { error: "Your password needs at least 8 characters." });
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return json(400, { error: "Your password needs at least one letter and one number." });
  if (password.toLowerCase().includes(email.split("@")[0]) && email.split("@")[0].length > 3) return json(400, { error: "Please don't use your email address in your password." });
  const { data: sec } = await sb.from("security_settings").select("block_common_names, common_names").eq("id", 1).maybeSingle();
  if (sec?.block_common_names !== false) {
    const local = email.split("@")[0];
    const common = String(sec?.common_names ?? "admin\nadministrator\nroot\ntest\nuser\nguest").split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (common.includes(local)) return json(400, { error: `“${local}@…” can't be used for a login. Please use your own email address.` });
  }

  // 4. Not too many at once (counted in the activity log, which keeps only a one-way code of the connection, never the address itself).
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipCode = createHash("sha256").update(`${ip}|${SUPABASE_URL}`).digest("hex").slice(0, 24);
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const { data: recent } = await sb.from("audit_log").select("changes").eq("action", "signed up").gte("created_at", hourAgo).limit(500);
  if ((recent ?? []).length >= ALL_HOUR) return json(429, { error: "Lots of people are signing up right now. Please try again in an hour." });
  if ((recent ?? []).filter((r) => r.changes?.from === ipCode).length >= PER_IP_HOUR) return json(429, { error: "Too many new logins from here. Please try again in an hour." });

  // 5. Make the login (not confirmed yet), then a one-time link that confirms the email and logs them in.
  //    Both are the server's own (admin) calls, so Supabase's "Allow new users to sign up" switch can stay OFF: it only
  //    closes Supabase's public sign-up door, which nobody should use — the dates and checks above are the only way in.
  const siteUrl = String(process.env.SITE_URL || process.env.URL || new URL(req.url).origin).replace(/\/+$/, "");
  const { data: made, error: makeErr } = await sb.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name } });
  if (makeErr) {
    // Someone with this email already has a login: say so plainly (they can log in, or ask the league to reset their password).
    if (/already|registered|exists/i.test(makeErr.message)) return json(409, { error: "There's already a login with this email address. Log in instead — or ask the league to reset your password." });
    return json(400, { error: "That login couldn't be made. Please try again." });
  }
  const { data: link, error: linkErr } = await sb.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${siteUrl}/?welcome=confirmed` } });
  if (linkErr) { await sb.auth.admin.deleteUser(made.user.id); return json(400, { error: "That login couldn't be made. Please try again." }); }
  const id = made.user.id;
  const { error: pErr } = await sb.from("profiles").insert({ id, email, full_name, role: "player", team_role: null, team_id: null, player_id: null });
  if (pErr) { await sb.auth.admin.deleteUser(id); return json(400, { error: "That login couldn't be made. Please try again." }); }
  await sb.from("audit_log").insert({ actor_id: id, actor: full_name, action: "signed up", table_name: "profiles", row_id: id, label: `${full_name} made their own login (welcome set-up)`, changes: { from: ipCode } }).then(() => {}, () => {});

  // 6. The email with the link.
  const from = process.env.SIGNUP_EMAIL_FROM || process.env.RESULTS_EMAIL_FROM || `${SITE_NAME} <onboarding@resend.dev>`;
  const url = link.properties?.action_link;
  const htmlBody = `<!doctype html><html><body style="margin:0;background:#F9F9F9;font-family:Inter,Arial,sans-serif;color:#15201B">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:20px;padding:32px">
  <h1 style="margin:0 0 12px;font-size:24px">Confirm your email, ${esc(full_name.split(" ")[0])}</h1>
  <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#5B6660">Press the button to finish making your ${esc(SITE_NAME)} login. Then you can log in with this email address and the password you chose.</p>
  <p style="margin:0 0 28px"><a href="${esc(url)}" style="display:inline-block;background:#F1002A;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:999px">Confirm my email</a></p>
  <p style="margin:0;font-size:13px;line-height:1.5;color:#5B6660">Didn't ask for a login? Ignore this email and nothing happens.</p></div></div></body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: `Confirm your email — ${SITE_NAME}`, html: htmlBody,
      text: `Confirm your email to finish making your ${SITE_NAME} login: ${url}\n\nDidn't ask for a login? Ignore this email.` }),
  });
  if (!res.ok) {
    await sb.auth.admin.deleteUser(id);     // no email, no login: they can try again
    return json(502, { error: "The confirmation email couldn't be sent, so the login wasn't made. Please try again later." });
  }
  return json(200, { ok: true, confirm: true });
};
