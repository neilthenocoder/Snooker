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

export const isAdmin = (user) => user?.profile?.role === "admin";
export const isCaptain = (user) => ["captain", "vice_captain"].includes(user?.profile?.role);
/** Anyone with a login that isn't the admin: captains, vice captains and players. */
export const isMember = (user) => !!user?.profile && !isAdmin(user);
export const ROLE_LABEL = { admin: "League admin", captain: "Team Captain", vice_captain: "Vice Captain", player: "Player" };

/** Forget the cached login details (after the profile changes). */
export function refreshUser() { cached = undefined; return getUser(); }

/** Mirrors can_edit_fixture() in supabase/schema.sql. */
export function canEditFixture(user, fx) {
  if (isAdmin(user)) return true;
  return isCaptain(user)
    && [fx.home_team_id, fx.away_team_id].includes(user.profile.team_id)
    && ["scheduled", "in_progress", "submitted"].includes(fx.status);
}

/** Mirrors can_edit_comp_match() in supabase/schema.sql. `entries` are the two entrants. */
export function canEditCompMatch(user, match, entries, players) {
  if (isAdmin(user)) return true;
  if (!isCaptain(user) || match.status === "completed" || !user.profile.team_id) return false;
  return entries.some((e) => e && (e.team_id === user.profile.team_id || players.find((p) => p.id === e.player_id)?.team_id === user.profile.team_id));
}
