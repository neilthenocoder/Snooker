// ─────────────────────────────────────────────────────────────
//  Netlify Scheduled Function: scorecard reminders (round 40).
//  Every morning (08:00 UK winter time / 09:00 summer time) it looks for league matches from the last week that
//  have started but have no result submitted, and emails the captains and vice captains of the home team
//  (and the away team too, if Site settings says so). Once per match: fixtures.reminder_sent_at remembers it.
//  Switch it off under Admin → Site settings → Captains & competitions → Scorecard reminders.
//
//  Uses the same environment variables as the result emails:
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESULTS_EMAIL_FROM (optional), SITE_URL (optional)
//  Netlify runs it by itself — nothing to set up beyond uploading the site. Its log is under
//  Netlify → Logs → Functions → scorecard-reminders.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { reminderEmail } from "../lib/reminder-email-template.mjs";

export const config = { schedule: "0 8 * * *" };

const SITE_NAME = "St Blazey & District Snooker League";
const TEST_FROM = `${SITE_NAME} <onboarding@resend.dev>`;
const valid = (s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(s ?? "").trim());

export default async () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) { console.log("Reminders skipped: environment variables missing."); return; }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: site } = await sb.from("settings").select("reminders_on, reminders_both").limit(1).maybeSingle();
  if (site && site.reminders_on === false) { console.log("Reminders are switched off in Site settings."); return; }
  const from = process.env.RESULTS_EMAIL_FROM || TEST_FROM;
  const siteUrl = process.env.SITE_URL || process.env.URL || "";

  // League matches from the last seven days that started at least ten hours ago and still have no result.
  const now = Date.now();
  const { data: due, error } = await sb.from("fixtures").select("*")
    .in("status", ["scheduled", "in_progress"]).is("reminder_sent_at", null)
    .gte("starts_at", new Date(now - 7 * 864e5).toISOString()).lte("starts_at", new Date(now - 10 * 3600e3).toISOString());
  if (error) { console.log("Reminders: could not read the fixtures —", error.message); return; }
  let sent = 0;
  for (const fx of due ?? []) {
    // Claim it first, so a second run can never send it twice.
    const { data: claimed } = await sb.from("fixtures").update({ reminder_sent_at: new Date().toISOString() }).eq("id", fx.id).is("reminder_sent_at", null).select("id");
    if (!claimed?.length) continue;
    const teamIds = [fx.home_team_id, ...(site?.reminders_both ? [fx.away_team_id] : [])].filter(Boolean);
    const [{ data: teams }, { data: league }, { data: venue }, { data: caps }] = await Promise.all([
      sb.from("teams").select("id, name").in("id", [fx.home_team_id, fx.away_team_id]),
      sb.from("leagues").select("name").eq("id", fx.league_id).maybeSingle(),
      fx.venue_id ? sb.from("venues").select("name").eq("id", fx.venue_id).maybeSingle() : Promise.resolve({ data: null }),
      sb.from("profiles").select("email, team_id, role, team_role").in("team_id", teamIds),
    ]);
    const team = (id) => teams?.find((t) => t.id === id)?.name ?? "?";
    const list = (caps ?? []).filter((c) => (["captain", "vice_captain"].includes(c.role) || ["captain", "vice_captain"].includes(c.team_role)) && valid(c.email));
    if (!list.length) { console.log(`No captain email for ${team(fx.home_team_id)} v ${team(fx.away_team_id)}.`); continue; }
    const emails = list.map((c) => ({ from, to: [c.email.trim()], ...reminderEmail({
      siteName: SITE_NAME, siteUrl, league: league?.name, home: team(fx.home_team_id), away: team(fx.away_team_id), startsAt: fx.starts_at,
      venue: venue?.name, scorecardPath: `/scorecard/${fx.code || fx.id}`, matchPath: `/match/${fx.code || fx.id}`, team: team(c.team_id), started: fx.status === "in_progress",
    }) }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `reminder-${fx.id}` },
      body: JSON.stringify(emails.slice(0, 100)),
    });
    if (!res.ok) {
      console.log(`Reminder for ${team(fx.home_team_id)} v ${team(fx.away_team_id)} refused:`, (await res.json().catch(() => ({})))?.message ?? res.status);
      await sb.from("fixtures").update({ reminder_sent_at: null }).eq("id", fx.id);   // try again tomorrow
      continue;
    }
    sent += emails.length;
  }
  console.log(`Scorecard reminders: ${sent} email(s) for ${(due ?? []).length} match(es).`);
};
