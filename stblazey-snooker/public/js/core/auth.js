// Who is logged in, and what are they allowed to do (UI only —
// the database enforces the same rules with row-level security).
import { db, run } from "./db.js";
import { loginGate, loginWait, loginRecord } from "./api.js";

let cached;

/** Wait for something at most `ms` milliseconds (then go on as if it had failed). */
const within = (promise, ms) => Promise.race([promise, new Promise((_, no) => setTimeout(() => no(new Error("timed out")), ms))]);

export async function getUser() {
  if (cached !== undefined) return cached;
  // Reading the saved login can hang on a phone (an old login whose refresh never answers, Safari holding a lock
  // after the tab slept). Rather than keep the loading screen up forever, go on as logged out after 8 seconds.
  let session = null;
  try { ({ data: { session } } = await within(db.auth.getSession(), 8000)); }
  catch (err) { console.warn("Could not read the saved login:", err.message); return (cached = null); }
  if (!session) return (cached = null);
  const profile = await run(db.from("profiles").select("*").eq("id", session.user.id).maybeSingle()).catch(() => null);
  // What this role may use in the dashboard — set by the Master Admin under Admin → Roles & permissions.
  const [perms, gate, aal] = await Promise.all([
    profile?.role && profile.role !== "admin" ? run(db.from("role_permissions").select("*").eq("role", profile.role).maybeSingle()).catch(() => null) : null,
    loginGate(), currentAal()]);
  // Two-step login (Admin → Master Admin → Security): a role that needs it has to have used it in this session,
  // or the database refuses everything it tries to change. The website then asks for the code first (see mfaNeeded in main.js).
  const mfaNeeded = !!profile?.role && (gate.mfa_roles ?? []).includes(profile.role) && aal !== "aal2";
  return (cached = { ...session.user, profile, areas: perms?.areas ?? DEFAULT_AREAS[profile?.role] ?? [], mfaNeeded, aal });
}

/** "aal1" (password only) or "aal2" (password and a code from the phone app) — what this session has used. */
export async function currentAal() {
  try { const { data } = await db.auth.mfa.getAuthenticatorAssuranceLevel(); return data?.currentLevel ?? "aal1"; } catch { return "aal1"; }
}

/** Who may log in at the moment (Admin → Master Admin → Security → Login access). */
export const accessAllows = (access, role) => access === "master" ? role === "admin"
  : access === "officers" ? !["captain", "vice_captain", "player"].includes(role) : true;
const ACCESS_TEXT = { officers: "Logins are only open to league officers at the moment.", master: "Logins are closed at the moment while the website is being looked after." };

/**
 * Log in from either login form, with the league's own rules (Admin → Master Admin → Security):
 * too many wrong passwords from one place → wait; logins only open to some roles → refused.
 * Returns the user; user.mfaNeeded means the two-step code must be asked for next (core/two-step.js).
 */
export async function signInChecked(email, password) {
  const wait = Number(await loginWait(email)) || 0;
  if (wait > 0) throw new Error(`Too many wrong passwords. Please wait ${wait > 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`} and try again.`);
  let u;
  try { u = await signIn(email, password); }
  catch (err) { await loginRecord(email, false); throw err; }
  await loginRecord(email, true);
  const gate = await loginGate();
  if (!accessAllows(gate.access ?? "all", u?.profile?.role)) { await signOut(); throw new Error(ACCESS_TEXT[gate.access] ?? "Your login can't be used at the moment."); }
  return u;
}

export async function signIn(email, password) {
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  cached = undefined;
  return getUser();
}

export async function signOut() {
  await db.auth.signOut();
  cached = null;
}

export async function changePassword(password) {
  const { error } = await db.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

// ── roles ──────────────────────────────────────────────────────
/** Every role a login can have, with the name shown on screen. */
export const ROLE_LABEL = {
  admin: "Master Admin", league_admin: "League Admin",
  competition_secretary: "Competition Secretary", league_secretary: "League Secretary",
  committee_member: "Committee Member", president: "President", vice_chairman: "Vice Chairman", chairman: "Chairman",
  captain: "Captain", vice_captain: "Vice Captain", player: "Player",
};
export const TEAM_ROLE_LABEL = { captain: "Captain", vice_captain: "Vice Captain" };

/**
 * The parts ("areas") of the admin dashboard. The Master Admin always has all of them; for every
 * other role the Master Admin ticks which ones it gets (Admin → Roles & permissions). The same list
 * is enforced by the database: can_manage() in supabase/schema.sql.
 */
export const AREAS = [
  ["matchnights", "Match nights", "Approve results, edit any scorecard, rearrange postponed matches, score a match on the live scoreboard"],
  ["fixtures", "Fixtures", "Add and edit fixtures, the fixture generator"],
  ["league", "League", "Leagues, teams, players, venues, seasons"],
  ["handicaps", "Handicaps", "Change handicaps, run the yearly review"],
  ["competitions", "Competitions", "Competitions, entries to approve, draws, cup scorecards, presentation awards, key dates"],
  ["livescoring", "Live scoring (ball by ball)", "Score a match ball by ball: the live scoreboard for finals (Admin → Live scoreboard), and the “Ball by ball” view on any scorecard they can open. The only part that can be given to captains and vice captains too"],
  ["news", "Write news", "Write news articles with “Write news step by step”, and change their own (not other people's). Can be given to captains and vice captains too — they find it in My area → Write news"],
  ["website", "News & website", "News, categories, announcements, key dates, meetings, info pages and rules, sponsors, presentation awards, image library"],
  ["settings", "Settings & branding", "Site settings, home page, branding, result emails, statistics"],
  ["people", "Logins", "Create, change and remove logins (never a Master Admin's)"],
  ["newsletter", "Newsletter", "Newsletter campaigns (write and send them) and the list of people who have signed up"],
];
const ALL_AREAS = AREAS.map(([key]) => key);
/** The roles whose permissions can be set (everyone except the Master Admin, captains and players). */
export const OFFICER_ROLES = ["league_admin", "competition_secretary", "league_secretary", "committee_member", "president", "vice_chairman", "chairman"];
/**
 * Captains and vice captains have their team's tools by right (scorecards, Manage team…) and no part of the dashboard.
 * What can be switched on for them, role by role: live scoring (Rich, round 15: off unless ticked) and writing news
 * (Rich, round 21: officers only for now — it can be ticked for captains and vice captains later; never players or visitors).
 */
export const TEAM_ROLES = ["captain", "vice_captain"];
export const TEAM_ROLE_AREAS = ["livescoring", "news"];
/** Areas that are not a part of the dashboard: having one does not make someone "staff". */
const NOT_DASHBOARD = ["livescoring", "news"];
/** What each role starts with (also the fallback if the permissions table can't be read). */
export const DEFAULT_AREAS = {
  league_admin: ALL_AREAS,
  competition_secretary: ["handicaps", "competitions", "livescoring", "news"],
  league_secretary: ["league", "handicaps", "news"],
  committee_member: ["website", "settings", "news", "newsletter"], president: ["website", "settings", "news", "newsletter"], vice_chairman: ["website", "settings", "news", "newsletter"], chairman: ["website", "settings", "news", "newsletter"],
  captain: [], vice_captain: [],
};
/**
 * Which area each admin section belongs to. "master" = Master Admin only;
 * an array = every one of those areas is needed (importing writes to all three);
 * { any: [...] } = any one of them is enough.
 */
export const SECTION_AREA = {
  overview: "matchnights", results: "matchnights",
  fixtures: "fixtures", byes: "fixtures", generator: "fixtures", import: ["fixtures", "league", "matchnights"],
  leagues: "league", teams: "league", players: "league", venues: "league", seasons: "league",
  handicaps: "handicaps",
  competitions: "competitions", entries: "competitions", draws: "competitions",
  scoreboard: "livescoring", awards: { any: ["website", "competitions"] }, key_dates: { any: ["website", "competitions"] },
  meetings: "website", emails: "settings",
  accounts: "people", approvals: "master", roles: "master", activity: "master", backup: "master",
  articles: "website", write: { any: ["website", "news"] }, categories: "website", announcements: "website", notices: "website", media: { any: ["website", "news"] }, pages: "website", sponsors: "website", merchandise: "website",
  cueviews: "league",
  branding: "settings", settings: "settings", stats: "settings",
  // Round 22
  campaigns: "newsletter", subscribers: "newsletter", newsletter_setup: "newsletter",
  popups: "website", market: "website", market_categories: "website", comments: "website", links: "website",
  seo: "settings", menu: "settings", performance: "settings",
  security: "master", versions: "master",
  // Round 23
  handicap_suggest: "handicaps", ads: "website", sponsor_packages: "website", downloads: "website", hall_of_fame: "website", page_settings_23: "website",
};

const roleOf = (user) => user?.profile?.role;
/** The Master Admin: everything, always. */
export const isMaster = (user) => roleOf(user) === "admin";
/** Mirrors can_manage() in supabase/schema.sql. */
export const canManage = (user, area) => isMaster(user) || (!!user && (user.areas ?? []).includes(area));
/** Looks after match nights: may approve results and edit any scorecard. (Older name, kept for the pages that use it.) */
export const isAdmin = (user) => canManage(user, "matchnights");
/** Anyone with at least one part of the admin dashboard. */
export const isStaff = (user) => isMaster(user) || (user?.areas ?? []).some((a) => !NOT_DASHBOARD.includes(a));
/** May this person write news (Admin → Roles & permissions → Write news)? */
export const canWriteNews = (user) => canManage(user, "news");
/** May this person score a match ball by ball (Admin → Roles & permissions → Live scoring)? */
export const canLiveScore = (user) => canManage(user, "livescoring");
/** May this person open the given admin section? */
export const canOpenSection = (user, section) => {
  const need = SECTION_AREA[section];
  if (!need) return false;
  if (need === "master") return isMaster(user);
  if (need.any) return need.any.some((area) => canManage(user, area));
  return [need].flat().every((area) => canManage(user, area));
};
/** Captain or vice captain of a team — by role, or an officer who was given team rights. */
export const isCaptain = (user) => !!user?.profile?.team_id
  && (["captain", "vice_captain"].includes(roleOf(user)) || ["captain", "vice_captain"].includes(user.profile.team_role));
/** Has a "My Team" area: linked to a team or a player profile. */
export const isMember = (user) => !!user?.profile && (!!user.profile.team_id || !!user.profile.player_id || !isStaff(user));
/** "Competition Secretary · Captain" */
export const roleText = (profile) => [ROLE_LABEL[profile?.role] ?? "Member",
  !["captain", "vice_captain"].includes(profile?.role) && TEAM_ROLE_LABEL[profile?.team_role]].filter(Boolean).join(" · ");
// ── My Snooker ─────────────────────────────────────────────────
// Every login has it: a page of their own, built from the teams and players they follow.
// It only changes what THEY see — what a login may do in the dashboard is decided above, as before.
/**
 * What this login has chosen (profiles.my_prefs), tidied up:
 * { place: "page" | "home" | "both", teams: [ids], players: [ids], sections: [keys] | null (= all), cats: [news categories] }.
 * Until they choose, they follow the team their login belongs to and the player it is linked to.
 */
export function myPrefs(user) {
  const p = user?.profile ?? {}, saved = p.my_prefs ?? {};
  const list = (v) => (Array.isArray(v) ? v : []);
  const fresh = !("teams" in saved) && !("players" in saved);
  return {
    place: ["page", "home", "both"].includes(saved.place) ? saved.place : "page",
    teams: list(saved.teams).length ? [...saved.teams] : fresh ? [p.my_team_id || p.team_id].filter(Boolean) : [],
    players: list(saved.players).length ? [...saved.players] : fresh ? [p.player_id].filter(Boolean) : [],
    sections: Array.isArray(saved.sections) ? [...saved.sections] : null,
    cats: list(saved.cats),
  };
}
/** The first team a login follows (the one its page opens on). */
export const mySnookerTeamId = (user) => myPrefs(user).teams[0] ?? null;
/** Is My Snooker switched on for this login? (It is until they turn it off.) */
export const mySnookerOn = (user) => !!user?.profile && user.profile.my_snooker !== false;
/** Have they chosen anything to follow yet? */
export const mySnookerSetUp = (user) => { const p = myPrefs(user); return p.teams.length + p.players.length > 0; };
/**
 * Where My Snooker shows: always its own page (/myteam), never mixed into the home page (Rich, round 15).
 * "place" now only says what the Home button does: "page" (and the old "both") = Home opens My Snooker;
 * "home" = Home shows the normal home page and My Snooker stays in the menu. See mySnookerHome().
 */
export const mySnookerOnHome = () => false;
export const mySnookerOwnPage = (user) => mySnookerOn(user);
/**
 * Does Home take them to their My Snooker page? Yes, once it is switched on and set up (following a team or a player) —
 * unless they chose "Home shows the normal home page" (saved as place: "home"). Rich, round 16: it should stick.
 */
export const mySnookerHome = (user) => mySnookerOn(user) && mySnookerSetUp(user) && myPrefs(user).place !== "home";
/** A plain player login: no dashboard, no captain's tools. My Snooker is their home. */
export const isPlainPlayer = (user) => !!user?.profile && !isStaff(user) && !isCaptain(user);
/** Where someone lands after logging in: officers on the dashboard, captains in My Team, players on their own My Snooker page (or the home page, if that is where they put it). */
export const homeFor = (user) => (isStaff(user) ? "/admin" : !isPlainPlayer(user) ? "/my" : !mySnookerOn(user) ? "/my" : mySnookerOwnPage(user) ? "/myteam" : "/");

/** Forget the cached login details (after the profile changes). */
export function refreshUser() { cached = undefined; return getUser(); }

/** Mirrors can_edit_fixture() in supabase/schema.sql. */
export function canEditFixture(user, fx) {
  if (isAdmin(user)) return true;
  return isCaptain(user)
    && [fx.home_team_id, fx.away_team_id].includes(user.profile.team_id)
    && ["scheduled", "in_progress", "submitted"].includes(fx.status);
}

/** Match night photos: the HOME team's captain or vice captain (and admins). Mirrors set_match_photos(). */
export const MATCH_PHOTO_LIMIT = 12;
export const canAddMatchPhotos = (user, fx) => isAdmin(user) || (isCaptain(user) && user.profile.team_id === fx.home_team_id);

/** Captains can postpone their own match until it starts (admins: any time). */
export const canPostpone = (user, fx) => canEditFixture(user, fx) && (isAdmin(user) || fx.status === "scheduled");

/** Mirrors can_edit_comp_match() in supabase/schema.sql. `entries` are the two entrants. */
export function canEditCompMatch(user, match, entries, players) {
  if (canManage(user, "competitions")) return true;
  if (!isCaptain(user) || match.status === "completed") return false;
  return entries.some((e) => e && (e.team_id === user.profile.team_id || players.find((p) => p.id === e.player_id)?.team_id === user.profile.team_id));
}
