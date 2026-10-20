// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.30.0";
export const CHANGES = [
  "The old website's 528 news articles brought across (supabase/legacy/10–16): 186 league and competition articles live, the rest kept as drafts",
  "Fixed: choosing the White banner layout gave an error (run schema.sql — database version 21)",
  "“Live soon”: an orange pulsing label on a match that starts within the hour (home page strip, fixtures, match page, calendar, My Snooker)",
  "Latest results: each result is tagged with its league (green) or competition (gold); a proper arrow to open it",
  "My Snooker: Team & handicaps fits the side column (no sideways scrolling)",
  "Account menu: Write news and Form guide taken out for officers; the Master Admin can link his own player profile",
].join("\n");
