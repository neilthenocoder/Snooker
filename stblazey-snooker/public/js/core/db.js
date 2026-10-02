// Picks the real Supabase client or the in-browser demo database.
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_MODE } from "../config.js";
import { demoClient, demoAdminUsers, resetDemo } from "./demo-client.js";

let client = demoClient;
if (!DEMO_MODE) {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
export const db = client;
export { resetDemo };

/** Unwraps a Supabase response: returns data or throws a readable error. */
export async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/** Account management (needs the service key, so it runs on a Netlify Function). */
export async function adminUsers(body) {
  if (DEMO_MODE) return demoAdminUsers(body);
  const { data: { session } } = await db.auth.getSession();
  const res = await fetch("/.netlify/functions/admin-users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
