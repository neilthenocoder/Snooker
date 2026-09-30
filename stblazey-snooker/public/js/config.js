// ─────────────────────────────────────────────────────────────
//  SITE CONFIGURATION — the only file you need to edit to go live
// ─────────────────────────────────────────────────────────────
//
//  1. Leave SUPABASE_URL empty to run in DEMO MODE (sample data saved in
//     your browser only — great for testing on Netlify straight away).
//  2. Paste your Supabase project URL and anon/public key to go live.
//     The anon key is safe to publish: security is enforced by the
//     row-level-security rules in supabase/schema.sql.

export const SUPABASE_URL = "https://oxcwgeceuxkmuxwdyvby.supabase.co/rest/v1/";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94Y3dnZWNldXhrbXV4d2R5dmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NjY1NzQsImV4cCI6MjEwNjM0MjU3NH0.XlkOPaUA98Y2swiAJeVWUidaa4LhMXy-BKYk-Ya0Hcw";

export const SITE = {
  name: "St Blazey and District Snooker League",
  established: 1941,
  credit: { text: "Created by White River Design Studio", url: "#" },
  timeZone: "Europe/London",
};

export const DEMO_MODE = !SUPABASE_URL;
