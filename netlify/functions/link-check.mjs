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
// Never asked about: addresses inside a private network (this is not a way into anyone's router or the host's own
// network). Round 116 security review: checked on EVERY hop of a redirect (a public page may not bounce the checker
// to a private address), IPv6 and numeric spellings included, and only the ordinary web ports.
const PRIVATE_NAME = /^(localhost|.*\.(local|internal|localhost|lan|home|corp|intranet))$/i;
const PRIVATE_V4 = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.[02]\.|198\.1[89]\.|22[4-9]\.|2[3-5]\d\.)/;
function refused(u) {
  if (!/^https?:$/.test(u.protocol)) return "Not a web address";
  if (u.username || u.password) return "Not checked (the address has a login in it)";
  if (u.port && !["80", "443"].includes(u.port)) return "Not checked (an unusual port)";
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || PRIVATE_NAME.test(host)) return "Private address — not checked";
  if (host.includes(":")) return /^(::1?|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:|::ffff:|64:ff9b:)/.test(host) || host === "::" ? "Private address — not checked" : "";
  // Anything that is only digits and dots (or a hex/octal/whole-number spelling of an IP address) must be a public IPv4 address.
  if (/^[0-9.]+$/.test(host) || /^0x/i.test(host)) return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) && !PRIVATE_V4.test(host) && host.split(".").every((n) => Number(n) <= 255) ? "" : "Private address — not checked";
  if (!host.includes(".")) return "Private address — not checked";
  return "";
}

async function check(url) {
  let u;
  try { u = new URL(url); } catch { return { url, status: 0, note: "Not a web address" }; }
  const no = refused(u);
  if (no) return { url, status: 0, note: no };
  // Redirects are followed by hand (5 at most) so that each address on the way is checked too.
  const ask = async (method) => {
    let at = u;
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(at, { method, redirect: "manual", signal: AbortSignal.timeout(WAIT_MS),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkChecker; +https://www.netlify.com)", Accept: "*/*", ...(method === "GET" ? { Range: "bytes=0-2047" } : {}) } });
      const to = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!to) return { res, at };
      let next;
      try { next = new URL(to, at); } catch { return { res, at }; }
      if (refused(next)) return { res: { status: 0 }, at, note: "Redirects to a private address — not followed" };
      at = next;
    }
    return { res: { status: 0 }, at, note: "Too many redirects" };
  };
  try {
    let got = await ask("HEAD");
    // Some websites don't answer HEAD properly: ask again the normal way.
    if (!got.note && ([403, 405, 501].includes(got.res.status) || got.res.status >= 500)) got = await ask("GET");
    if (got.note) return { url, status: 0, note: got.note };
    const moved = got.at.href !== u.href ? got.at.href : null;
    return { url, status: got.res.status === 206 ? 200 : got.res.status, moved };
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
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "Invalid request." });
  const urls = [...new Set((Array.isArray(body?.urls) ? body.urls : []).map((x) => String(x).slice(0, 2000)))].slice(0, MAX);
  return json(200, { results: await Promise.all(urls.map(check)) });
};
