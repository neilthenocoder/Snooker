// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.23.0";
export const CHANGES = [
  "Tables, rankings and breaks move live on match night (marked * until approved); live confetti with small print",
  "Add to home screen: one press on Chrome/Edge/Android, a picture guide on iPhone, in the menu and offered automatically",
  "SEO on the Info page editor",
  "Home page banner layouts: picture beside, big picture, or headline only",
  "Side adverts (everywhere or one venue / team / page), venue pages with their own side column",
  "Sponsorship packages page, League downloads, Hall of Fame with Share a memory",
  "In memoriam: each player's story and pictures",
  "Suggested handicaps for the yearly review",
  "Rules help search on the scorecards",
  "Latest results: emblems, score pills and more on hover",
].join("\n");
