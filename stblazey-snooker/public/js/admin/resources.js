// ─────────────────────────────────────────────────────────────
//  ADMIN SECTIONS — describe a table here and the dashboard builds
//  its list, search, filters, add/edit form and delete button for
//  you (see admin/crud.js). To add a field, add one line.
//
//  Field types: text, email, password, textarea, number, checkbox,
//               date, datetime, select (options), ref (another table),
//               slug (auto-filled from `from` when left blank)
// ─────────────────────────────────────────────────────────────
import { adminUsers } from "../core/db.js";
import { STATUSES } from "../core/rules.js";

export const RESOURCES = {
  fixtures: {
    label: "Fixtures", table: "fixtures", order: "starts_at",
    filters: ["season_id", "league_id", "status"],
    columns: ["starts_at", "home_team_id", "away_team_id", "league_id", "status"],
    fields: [
      { name: "season_id", label: "Season", type: "ref", ref: "seasons", required: true },
      { name: "league_id", label: "League", type: "ref", ref: "leagues", required: true },
      { name: "home_team_id", label: "Home team", type: "ref", ref: "teams", required: true },
      { name: "away_team_id", label: "Away team", type: "ref", ref: "teams", required: true },
      { name: "venue_id", label: "Venue (leave blank for home team's venue)", type: "ref", ref: "venues" },
      { name: "starts_at", label: "Date & time", type: "datetime", required: true },
      { name: "status", label: "Status", type: "select", options: STATUSES, default: "scheduled" },
      { name: "notes", label: "Notes (shown on the match page)", type: "textarea" },
    ],
    validate: (row) => (row.home_team_id === row.away_team_id ? "A team can't play itself." : null),
    beforeSave: (row, refs) => ({ ...row, venue_id: row.venue_id || refs.teams.find((t) => t.id === row.home_team_id)?.venue_id || null }),
    rowActions: [{ label: "Scorecard", href: (row) => `/scorecard/${row.id}` }],
  },
  teams: {
    label: "Teams", table: "teams", order: "name", filters: ["league_id"],
    columns: ["name", "league_id", "venue_id"],
    fields: [
      { name: "name", label: "Team name", type: "text", required: true },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "name" },
      { name: "league_id", label: "League", type: "ref", ref: "leagues", required: true },
      { name: "venue_id", label: "Home venue", type: "ref", ref: "venues" },
      { name: "logo_url", label: "Logo image URL", type: "text" },
    ],
  },
  players: {
    label: "Players", table: "players", order: "full_name", filters: ["team_id"],
    columns: ["full_name", "team_id", "position", "handicap"],
    fields: [
      { name: "full_name", label: "Full name", type: "text", required: true },
      { name: "team_id", label: "Team", type: "ref", ref: "teams" },
      { name: "position", label: "Position", type: "select", options: ["Player", "Team Captain", "Vice Captain"], default: "Player" },
      { name: "handicap", label: "Handicap", type: "number", default: 0 },
      { name: "avatar_url", label: "Photo URL", type: "text" },
    ],
  },
  venues: {
    label: "Venues", table: "venues", order: "name", columns: ["name", "address"],
    fields: [
      { name: "name", label: "Venue name", type: "text", required: true },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "name" },
      { name: "address", label: "Address", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
  leagues: {
    label: "Leagues", table: "leagues", order: "sort", columns: ["name", "short_name", "sort"],
    fields: [
      { name: "name", label: "League name", type: "text", required: true },
      { name: "short_name", label: "Short name (e.g. Victory)", type: "text" },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "name" },
      { name: "sort", label: "Display order", type: "number", default: 1 },
    ],
  },
  seasons: {
    label: "Seasons", table: "seasons", order: "name", columns: ["name", "is_current"],
    fields: [
      { name: "name", label: "Season (e.g. 2027-2028)", type: "text", required: true },
      { name: "is_current", label: "This is the current season", type: "checkbox" },
    ],
  },
  accounts: {
    label: "Logins", table: "profiles", order: "email", filters: ["role", "team_id"],
    columns: ["email", "full_name", "role", "team_id"],
    intro: "Create a login for each captain and vice captain. They can only enter scorecards for their own team. Share the password privately — they can change it after logging in.",
    fields: [
      { name: "email", label: "Email (their login)", type: "email", required: true, createOnly: true },
      { name: "full_name", label: "Name", type: "text", required: true },
      { name: "role", label: "Role", type: "select", options: ["captain", "vice_captain", "admin"], default: "captain" },
      { name: "team_id", label: "Team (captains only)", type: "ref", ref: "teams" },
      { name: "password", label: "Password (leave blank to keep the current one)", type: "password", requiredOnCreate: true, minLength: 8 },
    ],
    validate: (row) => (row.role !== "admin" && !row.team_id ? "Captains must be linked to a team." : null),
    // Logins need the secret service key, so they go through the Netlify Function.
    save: (row) => adminUsers({ action: row.id ? "update" : "create", ...row }),
    remove: (row) => adminUsers({ action: "delete", id: row.id }),
  },
  articles: {
    label: "News & competitions", table: "articles", order: "published_at", desc: true, filters: ["category"],
    columns: ["published_at", "title", "category", "is_published"],
    intro: "Use the category \"Competitions\" for competition pages — they appear on the Competitions page and the home page.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "title" },
      { name: "category", label: "Category", type: "text", required: true, list: "categories" },
      { name: "published_at", label: "Date", type: "date", required: true },
      { name: "image_url", label: "Image URL", type: "text" },
      { name: "excerpt", label: "Summary (one or two sentences)", type: "textarea" },
      { name: "body", label: "Article text (blank line = new paragraph)", type: "textarea" },
      { name: "is_published", label: "Published", type: "checkbox", default: true },
    ],
  },
  pages: {
    label: "Info pages", table: "pages", order: "sort", columns: ["title", "sort"],
    intro: "These appear as tiles on the \"League\" page (Rules, History, Help…).",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "title" },
      { name: "summary", label: "Tile text", type: "text" },
      { name: "body", label: "Page text (blank line = new paragraph)", type: "textarea" },
      { name: "sort", label: "Display order", type: "number", default: 1 },
    ],
  },
  sponsors: {
    label: "Sponsors", table: "sponsors", order: "sort", columns: ["name", "url", "sort"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "url", label: "Website", type: "text" },
      { name: "image_url", label: "Banner image URL (736×104 works well)", type: "text" },
      { name: "sort", label: "Display order", type: "number", default: 1 },
    ],
  },
};
