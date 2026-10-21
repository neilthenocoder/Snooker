// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.35.0";
export const CHANGES = [
  "Draws & results: Save all changes — change several matches, then save them at once (changed rows are highlighted)",
  "Cup matches can be postponed (Draws & results or the cup scorecard); they show as Postponed and leave the home page strip",
  "Home page strip: results show Completed or Pending; how long they stay and the label colours are in Site settings (run schema.sql — version 26)",
  "Latest Results box: cup results typed in late now show as the latest; competition breaks say “New highest break of the competition (name)”; the classic scorecard's boxes line up",
  "Competitions: walkovers — give a match to one side without it being played (Draws & results, or the cup scorecard); they go through and the match shows W/O (run schema.sql — version 25)",
  "Match previews end with a head-to-head write-up from past league meetings: the last result, its best break, the overall record and the best break in the fixture",
  "Cup results typed into Draws & results now show on the home page strip and in Latest Results straight away, even when the match had no date (run schema.sql — version 24)",
  "Competitions: each competition's box can show its trophy or fill with a full picture (Admin → Competitions → Edit) — run schema.sql (version 23)",
  "Cup matches: one being scored shows as live on the home page and turns the LIVE button green, even with no date; the Live & upcoming strip keeps places for the next cup matches",
].join("\n");
