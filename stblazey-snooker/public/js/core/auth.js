// Who is logged in, and what are they allowed to do (UI only —
// the database enforces the same rules with row-level security).
import { db, run } from "./db.js";

let cached;

export async function getUser() {
  if (cached !== undefined) return cached;
  const { data: { session } } = await db.auth.getSession();
  if (!session) return (cached = null);
  const profile = await run(db.from("profiles").select("*").eq("id", session.user.id).maybeSingle()).catch(() => null);
  return (cached = { ...session.user, profile });
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

/** The parts of the admin dashboard each officer role may use (admins: all of them). */
const ROLE_AREAS = {
  competition_secretary: ["competitions"],
  league_secretary: ["league"],
  committee_member: ["website"], president: ["website"], vice_chairman: ["website"], chairman: ["website"],
};
/** Which part of the dashboard each admin section belongs to. */
export const SECTION_AREA = {
  overview: "matchnights", results: "matchnights",
  fixtures: "fixtures", generator: "fixtures", import: "fixtures",
  leagues: "league", teams: "league", players: "league", venues: "league", seasons: "league",
  competitions: "competitions", draws: "competitions",
  accounts: "people",
  articles: "website", categories: "website", media: "website", pages: "website", sponsors: "website", settings: "website", stats: "website",
};

const roleOf = (user) => user?.profile?.role;
/** Master Admin and League Admin: everything. */
export const isAdmin = (user) => ["admin", "league_admin"].includes(roleOf(user));
/** Mirrors can_manage() in supabase/schema.sql. */
export const canManage = (user, area) => isAdmin(user) || (ROLE_AREAS[roleOf(user)] ?? []).includes(area);
/** Anyone with at least one part of the admin dashboard. */
export const isStaff = (user) => isAdmin(user) || !!ROLE_AREAS[roleOf(user)];
/** May this person open the given admin section? */
export const canOpenSection = (user, section) => canManage(user, SECTION_AREA[section]);
/** Captain or vice captain of a team — by role, or an officer who was given team rights. */
export const isCaptain = (user) => !!user?.profile?.team_id
  && (["captain", "vice_captain"].includes(roleOf(user)) || ["captain", "vice_captain"].includes(user.profile.team_role));
/** Has a "My Team" area: linked to a team or a player profile. */
export const isMember = (user) => !!user?.profile && (!!user.profile.team_id || !!user.profile.player_id || !isStaff(user));
/** "Competition Secretary · Captain" */
export const roleText = (profile) => [ROLE_LABEL[profile?.role] ?? "Member",
  !["captain", "vice_captain"].includes(profile?.role) && TEAM_ROLE_LABEL[profile?.team_role]].filter(Boolean).join(" · ");
/** Where someone lands after logging in. */
export const homeFor = (user) => (isStaff(user) ? "/admin" : "/my");

/** Forget the cached login details (after the profile changes). */
export function refreshUser() { cached = undefined; return getUser(); }

/** Mirrors can_edit_fixture() in supabase/schema.sql. */
export function canEditFixture(user, fx) {
  if (isAdmin(user)) return true;
  return isCaptain(user)
    && [fx.home_team_id, fx.away_team_id].includes(user.profile.team_id)
    && ["scheduled", "in_progress", "submitted"].includes(fx.status);
}

/** Captains can postpone their own match until it starts (admins: any time). */
export const canPostpone = (user, fx) => canEditFixture(user, fx) && (isAdmin(user) || fx.status === "scheduled");

/** Mirrors can_edit_comp_match() in supabase/schema.sql. `entries` are the two entrants. */
export function canEditCompMatch(user, match, entries, players) {
  if (canManage(user, "competitions")) return true;
  if (!isCaptain(user) || match.status === "completed") return false;
  return entries.some((e) => e && (e.team_id === user.profile.team_id || players.find((p) => p.id === e.player_id)?.team_id === user.profile.team_id));
}
