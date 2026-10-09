// Who is logged in, and what are they allowed to do (UI only —
// the database enforces the same rules with row-level security).
import { db, run } from "./db.js";

let cached;

export async function getUser() {
  if (cached !== undefined) return cached;
  const { data: { session } } = await db.auth.getSession();
  if (!session) return (cached = null);
  const profile = await run(db.from("profiles").select("*").eq("id", session.user.id).maybeSingle()).catch(() => null);
  // What this role may use in the dashboard — set by the Master Admin under Admin → Roles & permissions.
  const perms = profile?.role && profile.role !== "admin"
    ? await run(db.from("role_permissions").select("*").eq("role", profile.role).maybeSingle()).catch(() => null) : null;
  return (cached = { ...session.user, profile, areas: perms?.areas ?? DEFAULT_AREAS[profile?.role] ?? [] });
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
  ["competitions", "Competitions", "Competitions, entries to approve, draws, cup scorecards, live scoreboard, presentation awards, key dates"],
  ["website", "News & website", "News, categories, announcements, key dates, meetings, info pages and rules, sponsors, presentation awards, image library"],
  ["settings", "Settings & branding", "Site settings, home page, branding, result emails, statistics"],
  ["people", "Logins", "Create, change and remove logins (never a Master Admin's)"],
];
const ALL_AREAS = AREAS.map(([key]) => key);
/** The roles whose permissions can be set (everyone except the Master Admin, captains and players). */
export const OFFICER_ROLES = ["league_admin", "competition_secretary", "league_secretary", "committee_member", "president", "vice_chairman", "chairman"];
/** What each role starts with (also the fallback if the permissions table can't be read). */
export const DEFAULT_AREAS = {
  league_admin: ALL_AREAS,
  competition_secretary: ["handicaps", "competitions"],
  league_secretary: ["league", "handicaps"],
  committee_member: ["website", "settings"], president: ["website", "settings"], vice_chairman: ["website", "settings"], chairman: ["website", "settings"],
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
  scoreboard: { any: ["competitions", "matchnights"] }, awards: { any: ["website", "competitions"] }, key_dates: { any: ["website", "competitions"] },
  meetings: "website", emails: "settings",
  accounts: "people", roles: "master", activity: "master", backup: "master",
  articles: "website", categories: "website", announcements: "website", media: "website", pages: "website", sponsors: "website", merchandise: "website",
  cueviews: "league",
  branding: "settings", settings: "settings", stats: "settings",
};

const roleOf = (user) => user?.profile?.role;
/** The Master Admin: everything, always. */
export const isMaster = (user) => roleOf(user) === "admin";
/** Mirrors can_manage() in supabase/schema.sql. */
export const canManage = (user, area) => isMaster(user) || (!!user && (user.areas ?? []).includes(area));
/** Looks after match nights: may approve results and edit any scorecard. (Older name, kept for the pages that use it.) */
export const isAdmin = (user) => canManage(user, "matchnights");
/** Anyone with at least one part of the admin dashboard. */
export const isStaff = (user) => isMaster(user) || (user?.areas ?? []).length > 0;
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
/** Should their choices show on the real home page / do they have the separate page as their start page? */
export const mySnookerOnHome = (user) => mySnookerOn(user) && mySnookerSetUp(user) && ["home", "both"].includes(myPrefs(user).place);
export const mySnookerOwnPage = (user) => mySnookerOn(user) && ["page", "both"].includes(myPrefs(user).place);
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
