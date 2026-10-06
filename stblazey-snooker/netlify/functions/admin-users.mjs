// ─────────────────────────────────────────────────────────────
//  Netlify Function: create / update / delete logins (officers, captains, players).
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
const ROLES = ["admin", "league_admin", "competition_secretary", "league_secretary", "committee_member", "president", "vice_chairman", "chairman", "captain", "vice_captain", "player"];
const TEAM_ROLES = ["captain", "vice_captain"];

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables." });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Who is asking? The Master Admin, or a role the Master Admin has given "Logins" to
  //    (Admin → Roles & permissions — the role_permissions table).
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } = {}, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return json(401, { error: "Please log in again." });
  const { data: me } = await sb.from("profiles").select("role, full_name, email").eq("id", user.id).maybeSingle();
  const { data: perms } = await sb.from("role_permissions").select("role, areas");
  const areasOf = (r) => (perms ?? []).find((p) => p.role === r)?.areas ?? [];
  const master = me?.role === "admin";
  const mine = areasOf(me?.role);
  if (!master && !mine.includes("people")) return json(403, { error: "Your login isn't allowed to manage logins." });
  // Nobody can hand out more than they have themselves: a role is "within reach" when everything it can do, the caller can do too.
  const withinReach = (r) => master || (r !== "admin" && areasOf(r).every((a) => mine.includes(a)));

  // 2. Validate input.
  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  const { action, id, email, password, full_name, role = "captain", player_id = null } = body;
  let { team_id = null } = body;
  const team_role = TEAM_ROLES.includes(body.team_role) ? body.team_role : null;
  if (["create", "update"].includes(action)) {
    if (!ROLES.includes(role)) return json(400, { error: "Unknown role." });
    // A login linked to a player belongs to that player's team unless a team is chosen.
    if (player_id && !team_id) {
      const { data: pl } = await sb.from("players").select("team_id").eq("id", player_id).maybeSingle();
      team_id = pl?.team_id ?? null;
    }
    if ((TEAM_ROLES.includes(role) || team_role) && !team_id) return json(400, { error: "Captains and vice captains must be linked to a team." });
    if (role === "admin" && !master) return json(403, { error: "Only the Master Admin can create another Master Admin." });
    if (!withinReach(role)) return json(403, { error: "You can't give a login a role that is allowed more than your own. Ask the Master Admin." });
    if (role === "player" && !player_id) return json(400, { error: "A player login must be linked to a player." });
    if (password && String(password).length < 8) return json(400, { error: "Passwords must be at least 8 characters." });
  }
  if (["update", "delete"].includes(action) && !id) return json(400, { error: "Missing account id." });
  if (action === "delete" && id === user.id) return json(400, { error: "You can't delete your own login." });
  // Only the Master Admin can change or remove a Master Admin's login — or any login that is allowed more than the caller.
  let target = null;
  if (["update", "delete"].includes(action)) {
    ({ data: target } = await sb.from("profiles").select("role, email, full_name").eq("id", id).maybeSingle());
    if (target?.role === "admin" && !master) return json(403, { error: "Only the Master Admin can change a Master Admin login." });
    if (target && !withinReach(target.role)) return json(403, { error: "That login is allowed more than your own, so only the Master Admin can change it." });
  }
  // Logins are written with the secret key, so the database can't tell who did it: note it in the activity log here.
  const log = (what, label, changes = null) => sb.from("audit_log").insert({ actor_id: user.id, actor: me.full_name || me.email, action: what, table_name: "profiles", row_id: id ?? null, label, changes }).then(() => {}, () => {});

  // 3. Do it.
  try {
    if (action === "create") {
      if (!email || !password) return json(400, { error: "Email and password are required." });
      const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      const { error: pErr } = await sb.from("profiles").insert({ id: data.user.id, email, full_name, role, team_role, team_id, player_id });
      if (pErr) { await sb.auth.admin.deleteUser(data.user.id); throw pErr; }
      await log("added", `${full_name || email} (${role})`);
      return json(200, { ok: true, id: data.user.id });
    }
    if (action === "update") {
      if (password) {
        const { error } = await sb.auth.admin.updateUserById(id, { password });
        if (error) throw error;
      }
      const { error } = await sb.from("profiles").update({ full_name, role, team_role, team_id, player_id }).eq("id", id);
      if (error) throw error;
      await log("changed", full_name || target?.email, { ...(target && target.role !== role ? { role: [target.role, role] } : {}), ...(password ? { password: null } : {}) });
      return json(200, { ok: true });
    }
    if (action === "delete") {
      const { error } = await sb.auth.admin.deleteUser(id); // profile row is removed automatically
      if (error) throw error;
      await log("removed", target?.full_name || target?.email || "A login");
      return json(200, { ok: true });
    }
    return json(400, { error: "Unknown action." });
  } catch (err) {
    return json(400, { error: err.message || "Something went wrong." });
  }
};
