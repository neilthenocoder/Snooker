// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.24.0";
export const CHANGES = [
  "Fixed: “<input type=” showing on phone lists (Suggested handicaps) and the link checker on phones",
  "Suggested handicaps: the rules explained on the page in plain English",
  "Latest results: tap a result to open a short summary, with a button to the full match statistics",
  "Match chat: a button near the top opens the chat from the bottom of the screen; invite your team; the league can close the chat for one match",
  "Admin menu: the Website list split into News, Pages & content, Sponsors & adverts, Community, Look & settings and Tools",
  "Add to home screen: never offered again once added, and a “Don't show this again” button",
].join("\n");
