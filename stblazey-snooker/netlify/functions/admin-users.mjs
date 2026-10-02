// ─────────────────────────────────────────────────────────────
//  Netlify Function: create / update / delete captain and player logins.
//  URL: /.netlify/functions/admin-users
//  Runs on Netlify's servers (never in the browser) because it
//  needs the Supabase SERVICE ROLE key, which must stay secret.
//
//  Set these in Netlify → Site configuration → Environment variables:
//    SUPABASE_URL               (same as in public/js/config.js)
//    SUPABASE_SERVICE_ROLE_KEY  (Supabase → Project Settings → API keys → secret/service_role)
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ROLES = ["admin", "captain", "vice_captain", "player"];

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables." });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Who is asking? Must be a logged-in admin.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } = {}, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return json(401, { error: "Please log in again." });
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return json(403, { error: "Only the league admin can manage logins." });

  // 2. Validate input.
  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  const { action, id, email, password, full_name, role = "captain", player_id = null } = body;
  let { team_id = null } = body;
  if (["create", "update"].includes(action)) {
    if (!ROLES.includes(role)) return json(400, { error: "Unknown role." });
    // A login linked to a player belongs to that player's team unless a team is chosen.
    if (player_id && !team_id) {
      const { data: pl } = await sb.from("players").select("team_id").eq("id", player_id).maybeSingle();
      team_id = pl?.team_id ?? null;
    }
    if (["captain", "vice_captain"].includes(role) && !team_id) return json(400, { error: "Captains must be linked to a team." });
    if (role === "player" && !player_id) return json(400, { error: "A player login must be linked to a player." });
    if (password && String(password).length < 8) return json(400, { error: "Passwords must be at least 8 characters." });
  }
  if (["update", "delete"].includes(action) && !id) return json(400, { error: "Missing account id." });
  if (action === "delete" && id === user.id) return json(400, { error: "You can't delete your own login." });

  // 3. Do it.
  try {
    if (action === "create") {
      if (!email || !password) return json(400, { error: "Email and password are required." });
      const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      const { error: pErr } = await sb.from("profiles").insert({ id: data.user.id, email, full_name, role, team_id, player_id });
      if (pErr) { await sb.auth.admin.deleteUser(data.user.id); throw pErr; }
      return json(200, { ok: true, id: data.user.id });
    }
    if (action === "update") {
      if (password) {
        const { error } = await sb.auth.admin.updateUserById(id, { password });
        if (error) throw error;
      }
      const { error } = await sb.from("profiles").update({ full_name, role, team_id, player_id }).eq("id", id);
      if (error) throw error;
      return json(200, { ok: true });
    }
    if (action === "delete") {
      const { error } = await sb.auth.admin.deleteUser(id); // profile row is removed automatically
      if (error) throw error;
      return json(200, { ok: true });
    }
    return json(400, { error: "Unknown action." });
  } catch (err) {
    return json(400, { error: err.message || "Something went wrong." });
  }
};
