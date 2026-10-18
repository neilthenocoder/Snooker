// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.25.0";
export const CHANGES = [
  "Form guide: every player and team gets a form mark out of 10.0 from their last 6 matches this season (league and competitions)",
  "New Form guide page (/form): players and teams, sort by any column, pick a league, most in-form player and team",
  "Form on player pages, team pages (and each squad member), the league tables and rankings, and the player and team of the week",
].join("\n");
