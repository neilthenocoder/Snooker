// ─────────────────────────────────────────────────────────────
//  HELP & SUPPORT REQUESTS (round 55 — Rich: "a support ticket which certain roles get based on a
//  support enquiry dropdown category list"). Shared by the public page (/support), the dashboard's
//  Support inbox and the demo database. The database side is in supabase/schema.sql (round 55).
// ─────────────────────────────────────────────────────────────
import { html, fmtAgo } from "./dom.js";

/** A request's status: what the league sees, what the sender sees, and its colour (the site's status colours). */
export const SUPPORT_STATUS = {
  new: { label: "New", mine: "Sent — waiting for the league", cls: "sup-new" },
  in_progress: { label: "In progress", mine: "Being looked at", cls: "sup-progress" },
  waiting: { label: "Waiting for their reply", mine: "The league has answered", cls: "sup-waiting" },
  resolved: { label: "Resolved", mine: "Sorted", cls: "sup-resolved" },
};
export const supportStatus = (s, mine = false) => {
  const st = SUPPORT_STATUS[s] ?? SUPPORT_STATUS.new;
  return html`<span class="status plain sup-pill ${st.cls}">${mine ? st.mine : st.label}</span>`;
};

/** The officer roles a category can be given to (captains and players send requests; they don't answer them). */
export const SUPPORT_ROLES = ["league_admin", "league_secretary", "competition_secretary", "chairman", "vice_chairman", "president", "committee_member"];

/** The standard categories — the same as the ones schema.sql adds the first time (the demo uses these). */
export const DEFAULT_SUPPORT_CATEGORIES = [
  ["Scorecards & results", "A result or scorecard that looks wrong, or trouble entering one", ["league_admin", "league_secretary"]],
  ["Fixtures & rearranging a match", "Dates, venues, postponements and rearranged matches", ["league_admin", "league_secretary"]],
  ["Handicaps", "A question about a player's handicap", ["league_admin", "league_secretary", "competition_secretary"]],
  ["Competitions & entries", "Entering a competition, draws, deadlines and cup matches", ["league_admin", "competition_secretary"]],
  ["Players, teams & registration", "Joining the league, signing or moving a player, team details", ["league_admin", "league_secretary"]],
  ["My login & account", "Logging in, passwords and your account", ["league_admin"]],
  ["Website problem or idea", "Something not working on the website, or an idea to make it better", ["league_admin"]],
  ["Sponsorship & advertising", "Sponsoring the league or advertising on the website", ["chairman", "committee_member"]],
  ["Something else", "Anything else for the league", ["league_admin", "chairman"]],
];

/** Requests the sender has sent from this browser without a login: [{ no, token, subject }] — so /support can list them. */
const KEY = "sbdsl-support-mine";
export function rememberedRequests() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function rememberRequest(r) {
  try { localStorage.setItem(KEY, JSON.stringify([r, ...rememberedRequests().filter((x) => x.token !== r.token)].slice(0, 20))); } catch { /* not remembered */ }
}

/** Does this login look after any support requests? (Mirrors handles_any_support() in schema.sql.) */
export const handlesSupport = (user) => user?.profile?.role === "admin" || (user?.supportCats ?? []).length > 0;
/** …and requests in this category? */
export const handlesCategory = (user, categoryId) => user?.profile?.role === "admin" || (user?.supportCats ?? []).includes(categoryId);

/** "just now", "25 min ago", "3 hours ago" — then the usual "2 days ago"… (support answers move within the hour). */
export function ago(iso) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60e3);
  if (!(m >= 0)) return fmtAgo(iso);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 24 * 60) { const h = Math.round(m / 60); return `${h} hour${h === 1 ? "" : "s"} ago`; }
  return fmtAgo(iso);
}
