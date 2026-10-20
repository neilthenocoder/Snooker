// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.28.0";
export const CHANGES = [
  "The league's past seasons (2018-19 to 2025-26) brought across from the old website: supabase/legacy/ (one file per season)",
  "Calendar: pressing a month or an arrow now goes to that month (it used to stop half way)",
  "New home page banner layout: white, headline on the left and picture on the right",
].join("\n");
