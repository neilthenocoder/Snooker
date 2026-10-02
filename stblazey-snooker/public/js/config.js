// ─────────────────────────────────────────────────────────────
//  SITE CONFIGURATION — the only file you need to edit to go live
// ─────────────────────────────────────────────────────────────
//
//  1. Leave SUPABASE_URL empty to run in DEMO MODE (sample data saved in
//     your browser only — great for testing on Netlify straight away).
//  2. Paste your Supabase project URL and anon/public key to go live.
//     The anon key is safe to publish: security is enforced by the
//     row-level-security rules in supabase/schema.sql.

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export const SITE = {
  name: "St Blazey and District Snooker League",
  established: 1941,
  copyright: "St Blazey and District Snooker",
  credit: { text: "Created by White River Design Studio", url: "#" },
  timeZone: "Europe/London",
};

export const DEMO_MODE = !SUPABASE_URL;
