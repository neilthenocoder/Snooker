// ─────────────────────────────────────────────────────────────
//  Netlify Function: check web addresses for the link checker
//  (Admin → Website → Link checker — Rich, round 22).   URL: /.netlify/functions/link-check
//  A browser may not look at other websites, so the dashboard sends the addresses here (25 at a time)
//  and gets back what each website answered: 200 = fine, 404 = page not found, and so on.
//  Officers with "News & website" or "Settings & branding" (and the Master Admin) only.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const MAX = 25, WAIT_MS = 8000;
// Never asked about: addresses inside a private network (this is not a way into anyone's router).
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?|.*\.(local|internal|localhost))$/i;

async function check(url) {
  let u;
  try { u = new URL(url); } catch { return { url, status: 0, note: "Not a web address" }; }
  if (!/^https?:$/.test(u.protocol)) return { url, status: 0, note: "Not a web address" };
  if (PRIVATE.test(u.hostname)) return { url, status: 0, note: "Private address — not checked" };
  const ask = async (method) => fetch(u, { method, redirect: "follow", signal: AbortSignal.timeout(WAIT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkChecker; +https://www.netlify.com)", Accept: "*/*", ...(method === "GET" ? { Range: "bytes=0-2047" } : {}) } });
  try {
    let res = await ask("HEAD");
    // Some websites don't answer HEAD properly: ask again the normal way.
    if ([403, 405, 501].includes(res.status) || res.status >= 500) res = await ask("GET");
    const moved = res.url && res.url !== u.href ? res.url : null;
    return { url, status: res.status === 206 ? 200 : res.status, moved };
  } catch (err) {
    return { url, status: 0, note: /timeout|aborted/i.test(String(err?.name) + err?.message) ? "No answer (timed out)" : "Couldn't connect" };
  }
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables." });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } = {}, error } = await sb.auth.getUser(token);
  if (error || !user) return json(401, { error: "Please log in again." });
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const { data: perm } = await sb.from("role_permissions").select("areas").eq("role", me?.role ?? "").maybeSingle();
  if (!(me?.role === "admin" || ["website", "settings"].some((a) => (perm?.areas ?? []).includes(a)))) return json(403, { error: "Your login can't use the link checker." });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  const urls = [...new Set((Array.isArray(body.urls) ? body.urls : []).map(String))].slice(0, MAX);
  return json(200, { results: await Promise.all(urls.map(check)) });
};
