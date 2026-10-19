// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.27.0";
export const CHANGES = [
  "Real league data: supabase/real-league.sql clears the test players, fixtures and news and loads the real league and its players",
  "“Not updated yet” where the league hasn't added something: handicaps, bios, CueViews, player stats, and matches played without a result on the website",
  "A handicap can now be left empty until the league sets it",
  "Form is one season at a time",
].join("\n");
