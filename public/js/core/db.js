// Picks the real Supabase client or the in-browser demo database.
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_MODE } from "../config.js";
import { SCHEMA_VERSION } from "./version.js";

// Round 116 (speed): the in-browser demo database and its sample league (two files, about 110 KB) used to be
// downloaded by every visitor to the LIVE site and never used. They are now fetched only in demo mode.
let client, demo = null;
if (DEMO_MODE) { demo = await import("./demo-client.js"); client = demo.demoClient; }
else {
  // One exact version (not "the newest 2.x"): what the site runs only changes when this line does.
  // To move to a newer one, change the number here and test the site.
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm");
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // Remembered for the next visit: boot.js opens the connection to the database before any script asks for it.
  try { localStorage.setItem("sbdsl-db-origin", new URL(SUPABASE_URL).origin); } catch { /* not remembered */ }
}
export const db = client;
export const resetDemo = (...args) => demo?.resetDemo(...args);

export { SCHEMA_VERSION };
export const DB_BEHIND = "The database has not been updated for this version of the website yet. Whoever looks after the website needs to run supabase/schema.sql in Supabase (SQL Editor → paste the whole file → Run). Nothing is lost — try again after that.";
/** Does this error mean "the database is missing a table, column or function the website expects"? */
export const isBehindError = (message) => /in the schema cache|Could not find the (table|function)|column [^ ]+ (of relation [^ ]+ )?does not exist|relation [^ ]+ does not exist|function [^ ]+ does not exist/i.test(String(message ?? ""));

/** Unwraps a Supabase response: returns data or throws a readable error. */
export async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(isBehindError(error.message) ? `${DB_BEHIND} (Detail: ${error.message})` : error.message);
  return data;
}

let version = null;
/**
 * The database's version number: 0 when it is older than this check, null when it could not be asked
 * (no connection, say — never a reason to raise the alarm).
 */
export function databaseVersion() {
  version ??= (async () => {
    const { data, error } = await client.rpc("schema_version");
    if (!error) return Number(data) || 0;
    return error.code === "PGRST202" || isBehindError(error.message) ? 0 : null;
  })().catch(() => null);
  return version;
}
/** True only when the database answered and is older than the website. */
export const databaseBehind = async () => { const v = await databaseVersion(); return v !== null && v < SCHEMA_VERSION; };

/** Call one of the site's Netlify Functions as the logged-in person. */
export async function callFunction(name, body) {
  const { data: { session } } = await db.auth.getSession();
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

/** Account management (needs the service key, so it runs on a Netlify Function). */
export async function adminUsers(body) {
  if (DEMO_MODE) return demo.demoAdminUsers(body);
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

/** Round 111: someone making their own Player login in the welcome set-up (netlify/functions/signup.mjs checks it's open). */
export async function selfSignup(body) {
  if (DEMO_MODE) return demo.demoSelfSignup(body);
  const res = await fetch("/.netlify/functions/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "That didn't work — please try again.");
  return json;
}
