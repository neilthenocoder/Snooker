// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.26.0";
export const CHANGES = [
  "Player of the month and Team of the month on the home page (Site settings), each with their form",
  "Form guide added to the menu (also to a menu already changed in Admin → Menu)",
  "My Snooker: a Form section — your own form, your team's, your teammates' and the players you follow — and a Form column in Team & handicaps",
  "My account menu: “My form” and “Form guide”; My area → Profile shows your form",
].join("\n");
