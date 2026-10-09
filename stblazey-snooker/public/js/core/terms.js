// Fixed lists of words that are used in more than one place (the public pages and the dashboard).

/** The kinds of meeting, in the order of the filter buttons on /meetings. */
export const MEETING_KINDS = ["AGM", "Committee Meeting", "Special General Meeting", "Captains' Meeting", "Other"];

/**
 * A player's status. "playing" and "no_team" appear in squad lists, scorecards and entry forms;
 * "not_playing" and "deceased" don't — but their results, breaks and profile page stay.
 */
export const PLAYER_STATUS = {
  playing: "Playing", no_team: "No team at the moment",
  not_playing: "Not playing (stopped / retired)", deceased: "Sadly no longer with us",
};
/** The short tag shown beside a player's name on the website (nothing for someone who is playing). */
export const PLAYER_TAG = { no_team: "No team at the moment", not_playing: "No longer playing", deceased: "Sadly no longer with us" };

/** Pages of the website offered when choosing the links at the very bottom of the site (Site settings → Footer). */
export const FOOTER_PAGES = [
  ["Rules", "/rules"], ["Calendar", "/calendar"], ["Fixtures & Results", "/fixtures"], ["Latest Results", "/results"], ["Competitions", "/competitions"],
  ["Enter a Competition", "/enter"], ["News", "/news"], ["Our League", "/league"], ["Our Players", "/players"], ["Handicaps", "/handicaps"],
  ["Venues", "/venues"], ["Seasons", "/seasons"], ["Season Archive", "/archive"], ["Meetings", "/meetings"], ["Merchandise", "/merchandise"],
  ["Presentation Night", "/presentation"], ["CueView Form", "/cueview"], ["Sadly No Longer With Us", "/in-memoriam"], ["Log in", "/login"],
];
/** What the dashboard offers as you type: every info page, then the pages above — each as "What it says | where it goes". */
export const footerSuggestions = (pages = []) => [...pages.map((p) => `${p.title} | /page/${p.slug}`), ...FOOTER_PAGES.map(([label, href]) => `${label} | ${href}`)];
/**
 * One footer link as it was typed → { label, href, outside }, or null when it leads nowhere.
 * "Privacy Policy | /page/privacy-policy", "Our Facebook group | https://facebook.com/…", "Email us | secretary@example.com",
 * or only the name of an info page or one of the pages above ("Rules").
 */
export function footerLink(text, pages = []) {
  const [left, ...rest] = String(text ?? "").split("|");
  let label = left.trim(), to = rest.join("|").trim();
  if (!label && !to) return null;
  if (!to) {
    const same = (x) => String(x).trim().toLowerCase() === label.toLowerCase();
    const page = pages.find((p) => same(p.title)), known = FOOTER_PAGES.find(([name]) => same(name));
    if (page) to = `/page/${page.slug}`;
    else if (known) to = known[1];
    else { to = label; }
  }
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(to)) to = `mailto:${to}`;
  else if (/^www\./i.test(to)) to = `https://${to}`;
  // Only ordinary links: a page of this website, a web address, an email address or a phone number.
  if (!/^(\/(?!\/)|https?:\/\/|mailto:|tel:)/i.test(to)) return null;
  if (!label || label === to) label = to.replace(/^(mailto:|tel:|https?:\/\/)/i, "").replace(/\/$/, "");
  return { label, href: to, outside: /^https?:/i.test(to) };
}
