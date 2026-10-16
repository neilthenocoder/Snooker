// ─────────────────────────────────────────────────────────────
//  Netlify Function: the website's version history (Admin → Master Admin → Version history — Rich, round 22).
//  URL: /.netlify/functions/site-versions
//    { action: "list" }                 every update ("deploy") of the site Netlify has, newest first, and which one is live
//    { action: "restore", deploy_id }  put an earlier update back live (Netlify's "Publish deploy")
//  Master Admin only. Needs, in Netlify → Site configuration → Environment variables:
//    NETLIFY_AUTH_TOKEN   a personal access token (Netlify → User settings → Applications → New access token) — "Contains secret values"
//    NETLIFY_SITE_ID      optional: Netlify gives functions the site's id itself; if the list says it can't find the site,
//                         copy "Site ID" from Site configuration → General → Site details into this.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const API = "https://api.netlify.com/api/v1";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NETLIFY_AUTH_TOKEN } = process.env;
  const siteId = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables." });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } = {}, error } = await sb.auth.getUser(token);
  if (error || !user) return json(401, { error: "Please log in again." });
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return json(403, { error: "Only the Master Admin can see the version history." });
  if (!NETLIFY_AUTH_TOKEN) return json(400, { error: "NETLIFY_AUTH_TOKEN isn't set yet. In Netlify: User settings → Applications → Personal access tokens → New access token; then Site configuration → Environment variables → add NETLIFY_AUTH_TOKEN (tick “Contains secret values”) and redeploy." });
  if (!siteId) return json(400, { error: "Netlify didn't say which site this is: add NETLIFY_SITE_ID (Site configuration → General → Site details → Site ID) to the environment variables and redeploy." });
  const netlify = async (path, init = {}) => {
    const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(res.status === 401 ? "Netlify didn't accept the access token (NETLIFY_AUTH_TOKEN) — make a new one." : res.status === 404 ? "Netlify can't find this site — check NETLIFY_SITE_ID." : body?.message || `Netlify answered ${res.status}`);
    return body;
  };
  let body;
  try { body = await req.json(); } catch { body = {}; }
  try {
    if (body.action === "restore") {
      if (!/^[0-9a-f]{24}$/i.test(String(body.deploy_id ?? ""))) return json(400, { error: "Which version?" });
      await netlify(`/sites/${siteId}/deploys/${body.deploy_id}/restore`, { method: "POST" });
      return json(200, { ok: true });
    }
    const [site, deploys] = await Promise.all([netlify(`/sites/${siteId}`), netlify(`/sites/${siteId}/deploys?per_page=40`)]);
    const live = site.published_deploy?.id ?? null;
    return json(200, {
      live,
      url: site.ssl_url || site.url,
      deploys: deploys.map((d) => ({
        id: d.id, state: d.state, created_at: d.created_at, published_at: d.published_at, title: d.title, branch: d.branch, commit_ref: d.commit_ref,
        commit_url: d.commit_url, committer: d.committer, context: d.context, error_message: d.error_message, permalink: d.links?.permalink ?? d.deploy_ssl_url ?? null,
        manual: !d.commit_ref, locked: !!d.locked, live: d.id === live,
      })),
    });
  } catch (err) {
    return json(502, { error: err.message || "Netlify couldn't be reached." });
  }
};
