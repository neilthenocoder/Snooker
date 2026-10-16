// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.22.0";
export const CHANGES = [
  "Breaks highlighted everywhere (league and competition)",
  "Live scoring: balls can't be pressed once they are off the table",
  "My Snooker: competitions follow the team chosen at the top",
  "Home page banner: landscape picture, headlines kept to three lines",
  "Newsletter: sign-up pop-up, subscribers, campaigns and an email builder",
  "Pop-up adverts on the home page",
  "Snooker marketplace with approval, categories and search",
  "Match night chat",
  "SEO (site and page settings, sitemap), menu creator, link checker, performance",
  "Security (custom login address, login access, two-step login, common names, login limits) and version history",
].join("\n");
