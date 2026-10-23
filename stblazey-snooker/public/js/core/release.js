// ─────────────────────────────────────────────────────────────
//  THE WEBSITE'S VERSION NUMBER (Rich, round 22: "versioning control and a version number").
//  Raise SITE_VERSION with every update and say what changed in CHANGES. Admin → Master Admin →
//  Version history shows it against the update Netlify is serving, and remembers it for that update.
//  It is shown in the dashboard only — never on the public pages (Security → Hide version).
// ─────────────────────────────────────────────────────────────
export const SITE_VERSION = "1.42.0";
export const CHANGES = [
  "Softer page and box colours; alerts in soft yellow; table stripes back, the leader bigger on soft yellow and the bottom places on soft red; breaks in green, podium in black",
  "Branding → Look: the Live & upcoming strip light or black, and the header black or dark grey (run schema.sql — version 31)",
  "Flatter look like WST: no outlines or shadows on boxes, menu words in red, the Live & upcoming strip light with white cards, nothing pulses",
  "League tables no longer shade the top and bottom rows; breaks shown in red; side-column rankings show the top ten with the leader pinned in a black row",
  "Rounds that are mostly byes are called Pre-qualifier; match previews count down to the start (days, hours, minutes, seconds); a Share button on every page; the Rules page back button fixed",
  "New calm look (standard): white space, black and red, one quiet menu with the current page underlined; Classic look still available under Branding → Look (run schema.sql — version 30 to switch)",
  "Latest Results box: competition results now show by standard alongside league results (new option for league only)",
  "My Snooker: Team news and Latest news shown as small versions of the news page; Live & upcoming heading readable on the white banner; World Snooker wording removed",
  "Latest Results box (home page): newest date at the top — results go by the day they were played, so the latest competition results (e.g. Team Handicap) show first; a result with no date goes by the day it was entered",
  "Competition draws made on paper: a side can be a Bye or the Winner of another match (“St Neot or Mevagissey C”) — winners drop in by themselves (run schema.sql — version 29)",
  "Dashboard Overview: Tonight (every match of the night with Approve / Scorecard / Postpone), Needs you (everything waiting, grouped) and Your recent changes with Undo",
  "Dashboard search finds players, teams, venues, leagues, competitions, news and matches; Site settings is split into tabs, with a preview of the strip's label colours",
  "Captains get an email the morning after if their scorecard hasn't been entered (Site settings → Captains & competitions) — run schema.sql (version 28)",
  "Postponed matches: Suggest dates finds free weeknights for both teams; match pages can make a result picture to share; new Season wrapped page (/wrapped)",
  "Home page strip: postponed matches show with a Postponed label, and Walkover has its own colour (Site settings) — run schema.sql (version 27)",
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
