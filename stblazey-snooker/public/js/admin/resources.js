// ─────────────────────────────────────────────────────────────
//  ADMIN SECTIONS — describe a table here and the dashboard builds
//  its list, search, filters, add/edit form and delete button for
//  you (see admin/crud.js). To add a field, add one line.
//
//  Field types: text, email, password, textarea, number, checkbox,
//               date, datetime, select (options), ref (another table),
//               slug (auto-filled from `from` when left blank),
//               image (upload / pick from library), gallery (several images),
//               tags (pick several rows of another table, e.g. players),
//               list (add as many short text items as you like, e.g. past teams),
//               file (a PDF: upload it or paste a link), range (a slider between min and max),
//               heading (a section title in the form, not a field)
//  Section options: pageSize: 50 pages a long list with ‹ › arrows (otherwise the first 100 rows show),
//               flag: { … } marks rows waiting to be looked at as NEW (see players).
//  Options:     in: "column" stores the field inside a JSON column,
//               store: "name" makes a ref save the name instead of the id,
//               help: "…" shows a hint under the label,
//               options: (row) => [...] works a select's choices out from the row being edited,
//               formatted: true on a textarea = headings, bullets and tables can be typed (core/markup.js) — adds the help line and a Preview button.
//  Section hooks: validate(row) → problem text, beforeSave(row, refs), afterSave(), onInput(form, changedElement).
// ─────────────────────────────────────────────────────────────
import { HOME_SECTIONS } from "../core/home-blocks.js";
import { html } from "../core/dom.js";
import { adminUsers } from "../core/db.js";
import { STATUSES } from "../core/rules.js";

/**
 * Round 54 (Rich): how complete a fixture's scorecard is, as a coloured pill in the Fixtures list —
 * green finished, yellow under way or waiting for approval, red postponed or overdue, grey still to come.
 */
export function fixtureState(f) {
  const past = Date.parse(f.starts_at) < Date.now() - 6 * 36e5;
  if (f.status === "approved") return { cls: "approved", label: "Complete", rank: 5 };
  if (f.status === "submitted") return { cls: "submitted", label: "Waiting for approval", rank: 1 };
  if (f.status === "in_progress") return { cls: "in_progress", label: "In progress", rank: 2 };
  if (f.status === "postponed") return { cls: "postponed", label: "Postponed", rank: 3 };
  if (past) return { cls: "postponed", label: "No scorecard yet", rank: 0 };
  return { cls: "scheduled", label: "To come", rank: 4 };
}
import { CUEVIEW } from "../core/cueview.js";
import { ROLE_LABEL, TEAM_ROLE_LABEL } from "../core/auth.js";
import { refreshShell } from "../core/router.js";
import { FONTS, LAYOUT_GROUPS, LAYOUT_LABELS, TEXT_SIZES, parseFontEmbed } from "../core/branding.js";
import { MEETING_KINDS, PLAYER_STATUS, footerSuggestions } from "../core/terms.js";
import { CONTACT_RULE } from "../core/comp-deadlines.js";
import { HEADLINE_MAX } from "../core/components.js";
import { AD_PAGES } from "../core/ads.js";
import { save, seoPages, saveSeoPage, deleteSeoPage, allRows, upsertRow } from "../core/api.js";

/** Fill in an award's shown name from the player or team picked for it (unless a different name was typed). */
function awardName(row, refs, prefix) {
  const linked = refs.players.find((p) => p.id === row[`${prefix}_player_id`])?.full_name ?? refs.teams.find((t) => t.id === row[`${prefix}_team_id`])?.name;
  const typed = row[`${prefix}_name`];
  const isAuto = !typed || refs.players.some((p) => p.full_name === typed) || refs.teams.some((t) => t.name === typed);
  return linked && isAuto ? linked : typed ?? null;
}
const awardSideFields = (prefix, label) => [
  { type: "heading", label, help: "Pick a player or a team. Type a name only for a pair, or for someone who isn't in the players list." },
  { name: `${prefix}_player_id`, label: "Player", type: "ref", ref: "players" },
  { name: `${prefix}_team_id`, label: "Team", type: "ref", ref: "teams" },
  { name: `${prefix}_name`, label: `Name as shown (filled in from the player or team — type here for a pair, e.g. “A. Smith & B. Jones”)`, short: label, type: "text", wide: true },
  { name: `${prefix}_image_url`, label: `${label}'s picture (optional — otherwise the player's photo or the team's emblem is used)`, type: "image", folder: "awards", maxSize: 1200 },
];

/** The fonts in a pasted Google Fonts embed link (Admin → Branding → Fonts). */
const pastedFonts = (text) => parseFontEmbed(text)?.families ?? [];
const fontOptions = (builtIn) => (row) => ["", ...new Set([...builtIn.slice(1), ...pastedFonts(row.font_embed)])];

export const RESOURCES = {
  fixtures: {
    label: "Fixtures", table: "fixtures", order: "starts_at",
    filters: ["season_id", "league_id", "status"],
    // Rich, round 54: the latest match night at the top (no scrolling miles to find it), then the ones coming up.
    sorts: [
      ["latest", "latest match night first", (a, b) => { const now = Date.now() + 12 * 36e5, pa = Date.parse(a.starts_at) <= now, pb = Date.parse(b.starts_at) <= now;
        return pa !== pb ? (pa ? -1 : 1) : pa ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at); }],
      ["oldest", "date, oldest first", (a, b) => a.starts_at.localeCompare(b.starts_at)],
      ["newest", "date, newest first", (a, b) => b.starts_at.localeCompare(a.starts_at)],
      ["attention", "needs attention first", (a, b) => fixtureState(a).rank - fixtureState(b).rank || b.starts_at.localeCompare(a.starts_at)],
    ],
    // Moving a postponed match to the date that has been agreed (Rich): the date goes in, the match is back on.
    onInput: (form, el) => {
      const when = form.querySelector("[data-new-date]"), status = form.elements.status, wrap = form.querySelector("[data-new-date-wrap]");
      if (!when || !status) return;
      if (el === status) wrap.hidden = status.value !== "postponed";
      if (el === when && when.value) { form.elements.starts_at.value = when.value; status.value = "scheduled"; wrap.querySelector("small").textContent = "Done — the match moves to this date and is back on (press Save)."; }
    },
    columns: ["starts_at", "home_team_id", "away_team_id", "league_id", "status"],
    fields: [
      { name: "season_id", label: "Season", type: "ref", ref: "seasons", required: true },
      { name: "league_id", label: "League", type: "ref", ref: "leagues", required: true },
      { name: "home_team_id", label: "Home team", type: "ref", ref: "teams", required: true },
      { name: "away_team_id", label: "Away team", type: "ref", ref: "teams", required: true },
      { name: "venue_id", label: "Venue (leave blank for home team's venue)", type: "ref", ref: "venues" },
      { name: "starts_at", label: "Date & time", type: "datetime", required: true },
      { name: "status", label: "Status", type: "select", options: STATUSES, default: "scheduled", cellOf: (r) => { const st = fixtureState(r); return html`<span class="status ${st.cls}">${st.label}</span>`; } },
      { type: "custom", render: (row) => html`<label data-new-date-wrap ${row?.status === "postponed" ? "" : "hidden"}>New date, if one has been agreed <span class="muted" style="font-weight:400">(optional)</span>
        <input type="datetime-local" data-new-date><small class="help">Put the agreed date in and the match moves to it and is back on the fixture list.</small></label>` },
      { name: "notes", label: "Notes (shown on the match page)", type: "textarea" },
      { type: "heading", label: "Old results (optional)", help: "Only for results from before this website that have no frame-by-frame scorecard: type the final score and set the status to Approved. Leave blank for normal matches." },
      { name: "home_score", label: "Home frames won", type: "number" },
      { name: "away_score", label: "Away frames won", type: "number" },
    ],
    // Matches being played right now stand out in the list.
    rowClass: (row) => (row.status === "in_progress" ? "live-row" : row.status === "postponed" ? "off-row" : ""),
    validate: (row) => (row.home_team_id === row.away_team_id ? "A team can't play itself."
      : (row.home_score == null) !== (row.away_score == null) ? "Enter both final scores, or leave both blank." : null),
    beforeSave: (row, refs) => ({ ...row, venue_id: row.venue_id || refs.teams.find((t) => t.id === row.home_team_id)?.venue_id || null }),
    rowActions: [{ label: "Scorecard", href: (row) => `/scorecard/${row.code || row.id}` }],
  },
  competitions: {
    label: "Competitions", table: "competitions", order: "sort", filters: ["season_id", "kind"],
    // Rich, round 54: newest season first (the same cups come round every year, so the names repeat).
    sorts: [
      ["season", "newest season first", (a, b, refs) => { const sn = (r) => refs.seasons?.find((x) => x.id === r.season_id)?.name ?? ""; return sn(b).localeCompare(sn(a)) || (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name); }],
      ["name", "name", (a, b) => a.name.localeCompare(b.name)],
    ],
    columns: ["trophy_url", "name", "kind", "league_ids", "season_id", "entries_open"],
    // Round 73 (Rich): a heading for each season, newest first.
    groupBy: (r, refs) => refs.seasons?.find((x) => x.id === r.season_id)?.name ?? "No season set",
    groupSort: (a, b) => (a === "No season set") - (b === "No season set") || b.localeCompare(a),
    intro: "Create the competition here. Then press its green “Manage” button to add entrants, make the draw, enter results and score matches live (the same page is under Competitions → Draws & results, and there's a Manage button on the competition's own page when you're logged in). A plate competition (for those knocked out in the first round) is created from its main competition's Manage page.",
    fields: [
      { name: "name", label: "Competition name", type: "text", required: true },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "name" },
      { name: "season_id", label: "Season", type: "ref", ref: "seasons" },
      { name: "kind", label: "Type", type: "select", options: ["Team", "Singles", "Doubles", "Other"], default: "Team" },
      { name: "league_ids", label: "Open to (which leagues can enter — leave empty for every league)", short: "Open to", type: "tags", ref: "leagues", empty: "All leagues" },
      { name: "handicap", label: "Handicap competition (scorecards show each player's handicap and the head start)", type: "checkbox" },
      // Round 73 (Rich): Bill Toms and Willie Thomas — the away player gets 5 extra points on top of the handicap start.
      { name: "away_start", label: "Away player's extra start (points on top of the handicap start, every frame — e.g. 5; 0 for none. Handicap competitions only)", short: "Away start", type: "number", default: 0, min: 0, max: 100 },
      // Round 72 (Rich): St Blazey's competitions have no seeds, so it's off unless ticked.
      { name: "seeded", label: "Seeded competition (entrants are ranked, and the draw can keep the top seeds apart). Leave unticked for a fully random draw", type: "checkbox" },
      { name: "draw_mode", label: "Draw", type: "select", options: ["bracket", "redraw"], default: "bracket",
        help: "bracket = winners follow the fixed bracket. redraw = a fresh random draw is made every round." },
      { name: "best_of", label: "Frames per match (best of)", type: "number", default: 5 },
      { name: "sort", label: "Display order", type: "number", default: 1 },
      { name: "image_url", label: "Picture (winner photo, venue… — the banner of the competition's page: 16:9, e.g. 1600 × 900 — the same shape everywhere it appears)", type: "image", folder: "competitions", maxSize: 1600 },
      // Rich, round 34: the box on the Competitions page (and the home page card) shows the trophy OR fills with the picture.
      { name: "card_style", label: "The competition's box on the Competitions page and home page shows", type: "select", options: ["", "trophy", "picture"],
        labels: { "": "Automatic: the picture if there is one (with the trophy in the corner), otherwise the trophy", trophy: "The trophy, in the middle of the dark box", picture: "The picture, filling the whole box" } },
      { name: "trophy_url", label: "Trophy (a cut-out picture of the trophy: transparent PNG or SVG — shown wherever the competition appears; a placeholder cup is used until you add one)", short: "Trophy", type: "image", folder: "trophies", maxSize: 700 },
      { name: "info", label: "Competition information (rules, dates, format)", type: "textarea" },
      { name: "parent_id", label: "Plate competition of (leave empty for a normal competition)", type: "ref", ref: "competitions" },
      { type: "heading", label: "Entry form", help: "Tick “Open for entries” and the competition appears on the website's entry form (/enter). Entries wait under Competitions → Entries to approve until the fee has been paid. The bank details and the days allowed to pay are under Website → Site settings." },
      { name: "entries_open", label: "Open for entries on the website", short: "Entries open", type: "checkbox" },
      { name: "entry_fee", label: "Entry fee (as you want it shown, e.g. £5 per player)", type: "text", placeholder: "£5 per player" },
      { name: "entry_closes", label: "Entries close on (optional — the form stops taking entries after this day)", type: "date" },
    ],
    validate: (row) => (row.parent_id && row.parent_id === row.id ? "A competition can't be its own plate." : null),
    // Round 72 (Rich: "took me a while to find out how to edit a comp live"): one clear button to run the competition.
    rowActions: [{ label: "Manage", title: "Entrants, draw, results & live scoring", cls: "green", href: (row) => `/admin/draws?c=${row.id}` }, { label: "View", href: (row) => `/competition/${row.slug}` }],
  },
  byes: {
    label: "Bye weeks", table: "byes", order: "bye_on", filters: ["season_id", "league_id", "team_id"], columns: ["bye_on", "team_id", "league_id", "season_id"],
    intro: "A league with an odd number of teams leaves one team without a match on each match night. A bye week shows in that team's fixture list and on the calendar. It is not a match: it has no scorecard and counts for nothing in the table. The fixture generator adds bye weeks by itself; add or change one here by hand.",
    fields: [
      { name: "season_id", label: "Season", type: "ref", ref: "seasons", required: true },
      { name: "league_id", label: "League", type: "ref", ref: "leagues", required: true },
      { name: "team_id", label: "Team with no match that night", short: "Team", type: "ref", ref: "teams", required: true },
      { name: "bye_on", label: "Date", type: "date", required: true },
    ],
  },
  teams: {
    label: "Teams", table: "teams", order: "name", filters: ["league_id"],
    columns: ["logo_url", "name", "league_id", "venue_id", "active"],
    fields: [
      { name: "name", label: "Team name", type: "text", required: true },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "name" },
      { name: "league_id", label: "League", type: "ref", ref: "leagues", required: true },
      { name: "venue_id", label: "Home venue", type: "ref", ref: "venues" },
      { name: "logo_url", label: "Team emblem (shown in league tables, scorecards and the shield box)", short: "Emblem", type: "image", folder: "teams", maxSize: 400 },
      { name: "active", label: "Playing this season (untick for a team from past seasons — it stays in the history but leaves this season's lists)", short: "Playing", type: "checkbox", default: true },
    ],
  },
  players: {
    label: "Players", table: "players", order: "full_name", filters: ["team_id", "status"],
    rowClass: (row) => (row.needs_review ? "todo-row" : ""),
    pageSize: 50,   // 50 players at a time, with ‹ › arrows to move through the rest
    // Players added by a captain are marked NEW and listed first until someone has looked at them:
    // saving the player, or pressing "Mark as checked", clears it.
    // “Accept” (or saving the player) clears the mark. “Reject” turns the captain's request down: a brand-new
    // player is removed; someone who was already on the website goes back to having no team.
    flag: { field: "needs_review", column: "full_name", tag: "NEW", clear: "Accept", clearAll: (n) => `Accept all ${n}`, cleared: (n) => (n > 1 ? `${n} players accepted` : "Player accepted"),
      banner: (n) => `${n} player${n > 1 ? "s were" : " was"} added by a captain and ${n > 1 ? "are" : "is"} waiting for you — at the top of the list, marked NEW. Press Edit to set the handicap (saving accepts them), press “Accept” to accept as they are, or “Reject” to turn the request down.`,
      reject: {
        label: "Reject",
        confirm: (row) => (row.review_from === "no_team"
          ? `Turn down the request to add ${row.full_name}? They go back to having no team. Their profile and results are kept. If the captain has put them on a team sheet or a scorecard, change that too.`
          : `Turn down the request and remove ${row.full_name}? Their name is taken off any scorecard or team sheet they have been put on. This can't be undone.`),
        run: (row, { save, remove }) => (row.review_from === "no_team"
          ? save("players", { id: row.id, team_id: null, status: "no_team", needs_review: false, review_from: null }) : remove("players", row.id)),
        done: (row) => (row.review_from === "no_team" ? `${row.full_name} is back to having no team` : `${row.full_name} removed`),
      } },
    columns: ["avatar_url", "full_name", "team_id", "position", "handicap", "status"],
    validate: (row) => (row.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug) ? "The web address can only have small letters, numbers and dashes (e.g. sam-bolitho)." : null),
    // "No team at the moment" means just that: the player leaves their team's list.
    beforeSave: (row) => ({ ...row, team_id: row.status === "no_team" ? null : row.team_id }),
    // Round 53 (Rich): the "Sadly passed away" tick box and the Status list stay in step — tick it and the player is
    // "Sadly no longer with us" (they go to that page on the website); untick it and they are "Not playing".
    onInput: (form, el) => {
      const tick = form.querySelector("[data-passed-away]"), status = form.elements.status;
      if (!tick || !status) return;
      if (el === tick) status.value = tick.checked ? "deceased" : (status.dataset.before && status.dataset.before !== "deceased" ? status.dataset.before : "not_playing");
      else if (el === status) { tick.checked = status.value === "deceased"; if (status.value !== "deceased") status.dataset.before = status.value; }
    },
    rowActions: [{ label: "View", href: (row) => `/player/${row.slug || row.id}` }],
    fields: [
      { name: "full_name", label: "Full name", type: "text", required: true },
      { name: "team_id", label: "Team", type: "ref", ref: "teams" },
      { name: "position", label: "Position", type: "select", options: ["Player", "Team Captain", "Vice Captain"], default: "Player" },
      { name: "handicap", label: "Handicap (leave empty if not known yet: it shows as “Not updated yet”)", type: "number", default: 0, placeholder: "Not updated yet" },
      { name: "status", label: "Status", type: "select", options: Object.keys(PLAYER_STATUS), labels: PLAYER_STATUS, default: "playing",
        help: "“Not playing” and “No longer with us” take the player out of squad lists, scorecards and entry forms. Their results, breaks and profile page stay." },
      { type: "custom", render: (row) => html`<label class="check passed-away"><input type="checkbox" data-passed-away ${row?.status === "deceased" ? "checked" : ""}>
        <span><b>Sadly passed away</b> <small class="muted">— they are shown on the “Sadly no longer with us” page, and their page carries a tribute (fill in “In memoriam” below)</small></span></label>` },
      { name: "birth_date", label: "Birthday (optional)", type: "date" },
      { name: "avatar_url", label: "Photo (shown as a circle — square photos work best)", type: "image", folder: "players", maxSize: 600, round: true },
      { type: "heading", label: "Profile", help: "Players with a login can fill these in themselves under My area → Profile, and anyone can send a CueView in on the website (League → CueViews to approve)." },
      { name: "bio", label: "Bio", type: "textarea", rows: 5 },
      { name: "career_history", label: "Career history (one achievement per line, e.g. “2019 — League singles champion”)", type: "textarea", rows: 5 },
      { name: "past_teams", label: "Past teams (add as many as you like, with years if known — teams played for on this website are added automatically)", type: "list",
        add: "+ Add another past team", placeholder: "e.g. St Blazey A (2015–2019)", suggest: "teams" },
      { name: "gallery", label: "Pictures (16:9, e.g. 1600 × 900)", type: "gallery" },
      { type: "heading", label: "In memoriam", help: "Only for a player whose status is “Sadly no longer with us”: they are listed on the “Sadly no longer with us” page (/in-memoriam) and their own page carries a tribute." },
      { name: "died_on", label: "Date they died (optional — only the year is shown)", type: "date" },
      { name: "memorial", label: "A few words of tribute (optional)", type: "textarea", rows: 3 },
      { name: "memorial_story", label: "Their story in the league (optional — clubs, titles, famous matches, memories; shown on the In memoriam page under “Read their story”)", type: "textarea", rows: 8, formatted: true },
      { name: "memorial_gallery", label: "Pictures for their story (optional — 16:9, e.g. 1600 × 900)", type: "gallery" },
      { type: "heading", label: "Web address" },
      { name: "slug", label: "Web address (auto — the end of /player/…; leave empty and it is made from the name)", type: "text", placeholder: "made from the name" },
      { type: "heading", label: "CueView interview", help: "Leave any question blank to hide it on the player's page." },
      { name: "cueview_featured", label: "Show this CueView on the home page", type: "checkbox" },
      ...CUEVIEW.map((q) => ({ name: q.key, in: "cueview", label: q.label, type: q.long ? "textarea" : q.options ? "select" : "text", options: q.options, wide: true })),
    ],
  },
  venues: {
    label: "Venues", table: "venues", order: "name", columns: ["image_url", "name", "address", "phone"],
    fields: [
      { name: "name", label: "Venue name", type: "text", required: true },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "name" },
      { name: "address", label: "Postal address", type: "text", wide: true },
      { name: "phone", label: "Telephone", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "contact_name", label: "Contact name", type: "text" },
      { name: "map_url", label: "Google Map (optional)", type: "text", help: "Leave blank to place the map from the address, or paste a Google Maps link or embed code." },
      { name: "logo_url", label: "Club emblem (leave empty to use the emblem of a team based here)", short: "Emblem", type: "image", folder: "teams", maxSize: 400 },
      { name: "image_url", label: "Main photo (16:9, e.g. 1600 × 900 — it is shown that shape)", type: "image", folder: "venues", maxSize: 1600 },
      { name: "description", label: "Description", type: "textarea" },
      { name: "quote", label: "Quote", type: "textarea", rows: 3 },
      { name: "gallery", label: "Photo gallery (16:9, e.g. 1600 × 900)", type: "gallery" },
    ],
  },
  leagues: {
    label: "Leagues", table: "leagues", order: "sort", columns: ["logo_url", "name", "short_name", "sort", "promote_count", "relegate_count"],
    intro: "Add a league here and it appears automatically on the home page, the fixtures page and the League page. Then add its teams under Teams and create its fixtures with the Fixture generator.",
    // An emptied number box means "none".
    beforeSave: (row) => ({ ...row, promote_count: row.promote_count ?? 0, relegate_count: row.relegate_count ?? 0 }),
    fields: [
      { name: "name", label: "League name", type: "text", required: true },
      { name: "short_name", label: "Short name (e.g. Victory)", type: "text" },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "name" },
      { name: "sort", label: "Display order", type: "number", default: 1 },
      { name: "logo_url", label: "League emblem (shown on the league's table page and the League page)", short: "Emblem", type: "image", folder: "teams", maxSize: 400 },
      { name: "trophy_url", label: "League trophy (a cut-out picture: transparent PNG or SVG — shown beside the league's table and on presentation night; a placeholder cup is used until you add one)", short: "Trophy", type: "image", folder: "trophies", maxSize: 700 },
      { type: "heading", label: "Promotion and relegation", help: "How many teams go up and down at the end of the season. In this season's table the promotion places are marked with a green P and the relegation places with a red R (and a pink row). Type 0 for none — the highest league promotes nobody, the lowest relegates nobody. Change the numbers whenever the committee changes the rule." },
      { name: "promote_count", label: "Teams promoted from this league (the top of the table)", short: "Up", type: "number", default: 0, min: 0, max: 10 },
      { name: "relegate_count", label: "Teams relegated from this league (the bottom of the table)", short: "Down", type: "number", default: 0, min: 0, max: 10 },
      { type: "heading", label: "Weekly shield", help: "Whoever holds the shield defends it every match night. If they lose, the winners take it." },
      { name: "shield_name", label: "Shield name (e.g. Victory League Runabout Shield)", type: "text" },
      { name: "shield_team_id", label: "Holder at the start of the season", type: "ref", ref: "teams" },
      { name: "shield_image_url", label: "Picture of the shield (or its trophy). Shown small beside the holders on the home page and on the shield's own page — a cut-out picture works best: transparent PNG or SVG. A gold shield is drawn until you add one", short: "Shield picture", type: "image", folder: "trophies", maxSize: 600 },
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
    columns: ["email", "full_name", "role", "team_role", "team_id", "player_id"],
    intro: "The Master Admin can do everything. What each other officer role can see and do is decided by the Master Admin under Master Admin → Roles & permissions. Captains and Vice Captains enter scorecards for their own team; a Player login has no tools at all: it gets My Snooker, the player's own page for the team they follow (it does not need linking to a player or a team; link it to a player only if they should also edit that player's profile). An officer who also plays can be given captain or vice captain rights for their team as well. Share passwords privately — people can change theirs after logging in.",
    fields: [
      { name: "email", label: "Email (their login)", type: "email", required: true, createOnly: true },
      { name: "full_name", label: "Name", type: "text", required: true },
      { name: "role", label: "Role", type: "select", options: Object.keys(ROLE_LABEL), labels: ROLE_LABEL, default: "captain" },
      { name: "team_role", label: "Team rights (for an officer who is also a captain or vice captain)", short: "Team rights", type: "select",
        options: ["", ...Object.keys(TEAM_ROLE_LABEL)], labels: { "": "– none –", ...TEAM_ROLE_LABEL } },
      { name: "team_id", label: "Team (leave empty to use the player's team; optional for a Player login)", type: "ref", ref: "teams" },
      { name: "player_id", label: "Player profile (optional: lets them edit their own profile)", type: "ref", ref: "players" },
      { name: "password", label: "Password (leave blank to keep the current one)", type: "password", requiredOnCreate: true, minLength: 8 },
    ],
    // A Player login needs no link at all: they choose the team to follow themselves (My Snooker).
    validate: (row) => ((["captain", "vice_captain"].includes(row.role) || row.team_role) && !row.team_id && !row.player_id ? "Captains and vice captains must be linked to a team." : null),
    // Logins need the secret service key, so they go through the Netlify Function.
    save: (row) => adminUsers({ action: row.id ? "update" : "create", ...row }),
    remove: (row) => adminUsers({ action: "delete", id: row.id }),
  },
  articles: {
    label: "News", table: "articles", order: "published_at", desc: true, filters: ["category"],
    columns: ["image_url", "published_at", "title", "category", "hub_featured", "featured", "is_published"],
    intro: "“Featured news” puts an article in the big boxes at the top of the News page (the newest four that are ticked; if none is ticked, the newest four articles). “Show in the home page banner” articles rotate in the home page's big banner. Add more categories under Website → News categories.",
    fields: [
      { name: "title", label: `Headline (up to ${HEADLINE_MAX} characters, so it fits the home page banner in three lines)`, short: "Headline", type: "text", required: true, wide: true, maxLength: HEADLINE_MAX },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "title" },
      { name: "category", label: "Main category", short: "Category", type: "ref", ref: "categories", store: "name", required: true },
      { name: "published_at", label: "Date", type: "date", required: true },
      { name: "more_categories", label: "More categories (the article is also listed under these tabs of the News page)", short: "More categories", type: "tags", ref: "categories", store: "name" },
      { name: "author", label: "Written by (shown as “By …”; leave empty to use the name under Site settings → News)", short: "Written by", type: "text", placeholder: "Rich Pearson" },
      { name: "competition_id", label: "Competition (optional)", type: "ref", ref: "competitions" },
      { name: "player_ids", label: "Players this article is about (it appears under “Player news” on their pages)", type: "tags", ref: "players" },
      { name: "is_published", label: "Published", type: "checkbox", default: true },
      { name: "hub_featured", label: "Featured news (the big boxes at the top of the News page)", short: "Featured", type: "checkbox" },
      { name: "featured", label: "Show in the home page banner", short: "Home banner", type: "checkbox", default: true },
      { name: "breaking", label: "Breaking news (it pops up for everyone on the website in red, and is listed behind the bell with a red number on it)", short: "Breaking", type: "checkbox" },
      { type: "heading", label: "Pictures and video" },
      { name: "image_url", label: "Main picture (16:9, e.g. 1600 × 900 — every picture on the site is this shape, so it fits exactly)", type: "image", folder: "news", maxSize: 1800 },
      { name: "circle_image_url", label: "Circle image (square works best — leave blank to use the background image)", type: "image", folder: "news", maxSize: 600, round: true },
      { name: "video_url", label: "Video (optional): paste the link to a YouTube or Vimeo video, or to a video file (.mp4)", short: "Video", type: "text", wide: true, placeholder: "https://www.youtube.com/watch?v=…",
        help: "It is shown in the article, above the text. Type [video] on its own line in the text to put it somewhere else." },
      { type: "heading", label: "Text" },
      { name: "excerpt", label: "Intro (shown on news cards and in the Latest News box)", type: "textarea", rows: 2 },
      { name: "lead", label: "Lead text (bold opening paragraph)", type: "textarea", rows: 3 },
      { name: "body", label: "Match report / article text", type: "textarea", rows: 12,
        help: "Blank line = new paragraph. Type [quote] on its own line where the quote box should go (otherwise it goes after the first paragraph)." },
      { type: "heading", label: "Social preview (optional)", help: "What a link to this article shows when it is shared on Facebook, WhatsApp, X and the rest: the headline, a line of text and a picture. Leave these empty and the intro and the background image are used." },
      { name: "social_image_url", label: "Picture for the preview (wide: 1200 × 630 is ideal)", type: "image", folder: "news", maxSize: 1200, format: "jpeg" },
      { name: "social_description", label: "Text for the preview (a sentence or two — leave empty to use the intro)", type: "textarea", rows: 2 },
      { name: "quote_text", label: "Quote (optional)", type: "textarea", rows: 2 },
      { name: "quote_author", label: "Quote by", type: "text" },
      { type: "heading", label: "CueView interview (optional)", help: "For an interview with anyone — a professional, a guest, a past player. It appears on the article in the CueView style. Leave any question blank to hide it." },
      { name: "cueview_name", label: "Who is the interview with", type: "text" },
      { name: "cueview_featured", label: "Show this CueView on the home page", type: "checkbox" },
      ...CUEVIEW.map((q) => ({ name: q.key, in: "cueview", label: q.label, type: q.options ? "select" : "text", options: q.options, wide: true })),
      { name: "cueview_extra", label: "More questions (your own)", type: "textarea", rows: 6,
        help: "Type a question on one line and the answer on the next. Leave a blank line before the next question." },
      { type: "heading", label: "Weekly round-up (optional)", help: "Adds tables under the article for the week ending on the date you choose." },
      { name: "league_id", label: "League (leave on All leagues to show both)", type: "ref", ref: "leagues", empty: "All leagues (both)" },
      { name: "week_ending", label: "Week ending (leave blank to use the article date)", type: "date" },
      { name: "show_breaks", label: "Show top breaks of the week", type: "checkbox" },
      { name: "show_results", label: "Show team results of the week", type: "checkbox" },
      { name: "show_standings", label: "Show team standings", type: "checkbox" },
      { name: "show_photos", label: "Show match night photos (the ones home captains add to that week's matches)", type: "checkbox", default: true },
    ],
  },
  categories: {
    label: "News categories", table: "categories", order: "sort", columns: ["name", "sort"],
    intro: "Categories are the tabs along the top of the News page (after “All”). “Position” decides their order: 1 comes first, then 2, 3… A category with no articles has no tab. Renaming a category doesn't move existing articles — edit those too.",
    fields: [
      { name: "name", label: "Category name", type: "text", required: true },
      { name: "sort", label: "Position among the tabs of the News page (1 = first)", short: "Position", type: "number", default: 1, min: 1 },
    ],
  },
  announcements: {
    label: "Announcements", table: "announcements", order: "sort", columns: ["text", "url", "sort", "is_active"],
    intro: "Short announcements that scroll across the very top of the home page (the “ticker”) and, if you like, through the feature box lower down. Visitors can stop the ticker with the button on its right, and click an announcement that has a link. Switch each place on or off, and set the speed, under Website → Site settings.",
    fields: [
      { name: "text", label: "Announcement (keep it short — one line)", short: "Announcement", type: "text", required: true, wide: true, placeholder: "Entries for the Christmas Handicap close on Friday" },
      { name: "url", label: "Link (optional — where it goes when clicked)", short: "Link", type: "text", placeholder: "/enter or https://…" },
      { name: "sort", label: "Order (1 = first)", short: "Order", type: "number", default: 1 },
      { name: "is_active", label: "Show this announcement", short: "Showing", type: "checkbox", default: true },
      { name: "show_in_feature", label: "Also show it in the home page's feature box (the coloured strip under the four buttons)", type: "checkbox", default: true },
      { name: "label", label: "Label in the feature box (leave empty for “Announcement”)", type: "text", placeholder: "Announcement" },
      { name: "starts_on", label: "Show from (optional)", type: "date" },
      { name: "ends_on", label: "Stop showing after (optional)", type: "date" },
    ],
    validate: (row) => (String(row.text ?? "").length > 160 ? "Please keep an announcement under 160 characters." : row.starts_on && row.ends_on && row.ends_on < row.starts_on ? "“Stop showing after” is before “Show from”." : null),
  },
  notices: {
    label: "Notifications", table: "notices", order: "created_at", desc: true, filters: ["kind"], columns: ["kind", "title", "ends_on", "is_active"],
    intro: "Send everyone a notification: breaking news, an important update or an offer. Anyone on the website at that moment gets a pop-up in the corner; everyone else sees a red number on the bell the next time they visit, and the message in the list behind it for 14 days (or until the day you choose). Each visitor chooses which of the three kinds they want, behind the bell. To make a news article breaking news instead, tick “Breaking news” on the article.",
    fields: [
      { name: "kind", label: "What kind of notification", short: "Kind", type: "select", options: ["breaking", "update", "offer"], labels: { breaking: "Breaking news", update: "Important update", offer: "Offer" }, default: "update" },
      { name: "title", label: "The message (one line — this is what pops up)", short: "Message", type: "text", required: true, wide: true, placeholder: "Tonight's Bethel A v Bugle match is postponed" },
      { name: "body", label: "A little more (optional — shown in the list behind the bell)", type: "textarea", rows: 3 },
      { name: "url", label: "Link (optional — where a press on it goes)", short: "Link", type: "text", placeholder: "/news/… or https://…" },
      { name: "ends_on", label: "Stop showing after (optional — otherwise it stays in the list for 14 days)", short: "Until", type: "date" },
      { name: "is_active", label: "Send it (untick to take it down, or to write one and send it later)", short: "Sent", type: "checkbox", default: true },
    ],
    validate: (row) => (String(row.title ?? "").length > 140 ? "Please keep the message under 140 characters." : String(row.body ?? "").length > 500 ? "Please keep the extra text under 500 characters." : null),
    // The time it was sent: what the 14 days, and each visitor's “new” count, are measured from.
    beforeSave: (row) => ({ ...row, created_at: row.created_at || new Date().toISOString() }),
  },
  pages: {
    label: "Info pages", table: "pages", order: "sort", columns: ["title", "sort", "show_in_league", "show_in_footer", "show_in_rules"],
    intro: "Pages can appear as tiles on the League page (History, Help…), as links in the footer (Privacy Policy, Contact Us…), or both. Tick “Show on the Rules page” for each set of rules: they become the tabs of the Rules page (/rules), each with its own contents list.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Web address (auto)", type: "slug", from: "title" },
      { name: "summary", label: "Tile text", type: "text" },
      { name: "body", label: "Page text", type: "textarea", rows: 16, formatted: true },
      { name: "gallery", label: "Picture gallery (16:9, e.g. 1600 × 900)", type: "gallery" },
      { name: "sort", label: "Display order", type: "number", default: 1 },
      { name: "show_in_league", label: "Show as a tile on the League page", type: "checkbox", default: true },
      { name: "show_in_footer", label: "Show as a link in the footer (to choose the links and their order yourself, or add other pages: Site settings → Footer)", short: "Footer", type: "checkbox" },
      { name: "show_in_rules", label: "Show on the Rules page (/rules) as one of its tabs — e.g. “League rules” and “Rules of the game”", short: "Rules page", type: "checkbox" },
      // Rich, round 23: each page's SEO is set here as well (the same as Website → SEO → Page settings for this page).
      { type: "heading", label: "SEO", help: "How this page shows up in Google and when it is shared. Leave the boxes empty to use the site's own title, description and picture (Website → SEO)." },
      { name: "seo_title", label: "SEO title (about 60 letters)", type: "text", wide: true, maxLength: 120 },
      { name: "seo_description", label: "SEO description (about 160 letters)", type: "textarea", rows: 2 },
      { name: "seo_image", label: "Page image (the picture when the page is shared — 1200 × 630 is ideal)", type: "image", folder: "branding", maxSize: 1200, format: "jpeg" },
      { name: "seo_index", label: "Search engines — show this page in Google and other search engines", type: "checkbox", default: true },
      { name: "seo_search", label: "Site search — show this page in the website's own search", type: "checkbox", default: true },
    ],
    load: async (rows) => { const seo = await seoPages().catch(() => []); return rows.map((r) => { const s = seo.find((x) => x.path === `/page/${r.slug}`);
      return { ...r, seo_title: s?.title ?? "", seo_description: s?.description ?? "", seo_image: s?.image_url ?? "", seo_index: !s?.noindex, seo_search: !s?.hide_in_search }; }); },
    save: async (row) => {
      const { seo_title, seo_description, seo_image, seo_index, seo_search, ...page } = row;
      const saved = await save("pages", page);
      const path = `/page/${saved.slug}`, any = seo_title || seo_description || seo_image || !seo_index || !seo_search;
      if (any) await saveSeoPage({ path, title: seo_title || null, description: seo_description || null, image_url: seo_image || null, noindex: !seo_index, hide_in_search: !seo_search });
      else await deleteSeoPage(path).catch(() => {});
      return saved;
    },
    rowActions: [{ label: "View", href: (row) => (row.show_in_rules ? `/rules?p=${row.slug}` : `/page/${row.slug}`) }],
  },
  merchandise: {
    label: "Merchandise", table: "merchandise", order: "sort", columns: ["image_url", "name", "price", "sort", "is_active"],
    intro: "What the league sells: shirts, towels, chalk, anything. Each item shows on the Merchandise page (/merchandise) with its picture, price and options. Nothing is paid for on the website: give an item its own link to order it, or write how to order under Website → Site settings → Merchandise page.",
    fields: [
      { name: "name", label: "Item", type: "text", required: true, placeholder: "League polo shirt" },
      { name: "price", label: "Price (as you want it shown)", short: "Price", type: "text", placeholder: "£18" },
      { name: "image_url", label: "Picture (16:9, e.g. 1600 × 900 — it is shown that shape)", short: "Picture", type: "image", folder: "merchandise", maxSize: 1200 },
      { name: "sort", label: "Display order", type: "number", default: 1 },
      { name: "description", label: "Description", type: "textarea", rows: 4, wide: true },
      { name: "options", label: "Options, with commas between them (sizes, colours…)", short: "Options", type: "text", wide: true, placeholder: "S, M, L, XL, XXL" },
      { name: "url", label: "Link to order it (optional: a shop page, or mailto:someone@example.com)", short: "Order link", type: "text", wide: true, placeholder: "https://…" },
      { name: "is_active", label: "Show on the website", short: "Shown", type: "checkbox", default: true },
    ],
  },
  sponsors: {
    label: "Sponsors", table: "sponsors", order: "sort", columns: ["image_url", "name", "package_id", "url", "sort"],
    intro: "Each sponsor's banner at the bottom of every page opens that sponsor's own page on this website, written here. Their website is one click further on.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "url", label: "Their website", type: "text", placeholder: "https://…" },
      { name: "image_url", label: "Banner image (736×104 works well)", type: "image", folder: "sponsors", maxSize: 1000 },
      { name: "sort", label: "Display order", type: "number", default: 1 },
      { name: "package_id", label: "Sponsorship package (Gold, Silver, Bronze… — Website → Sponsorship packages)", short: "Package", type: "ref", ref: "sponsor_packages" },
      { type: "heading", label: "The sponsor's page", help: "What visitors see when they click the banner. Leave it all empty and the page simply thanks the sponsor and links to their website." },
      { name: "about", label: "About the sponsor", type: "textarea", rows: 8, formatted: true },
      { name: "photo_url", label: "Photo (their premises, van, team… — 16:9, e.g. 1600 × 900)", type: "image", folder: "sponsors", maxSize: 1400 },
      { name: "address", label: "Address", type: "text", wide: true },
      { name: "phone", label: "Telephone", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "slug", label: "Web address (auto — the end of /sponsor/…; leave empty and it is made from the name)", type: "text", placeholder: "made from the name" },
    ],
    validate: (row) => (row.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug) ? "The web address can only have small letters, numbers and dashes." : null),
    rowActions: [{ label: "View", href: (row) => `/sponsor/${row.slug || row.id}` }],
  },
  key_dates: {
    label: "Key dates", table: "key_dates", order: "starts_on", columns: ["starts_on", "title", "competition_id", "is_active"],
    intro: "The dates everyone needs to know — “20 October: round 1 of the Team Handicap starts”. The next few are shown in the Key dates box on the home page, and all of them appear on the calendar. A date drops off the home page by itself once it has passed. How many are shown (or whether the box shows at all) is under Website → Site settings.",
    fields: [
      { name: "starts_on", label: "Date", type: "date", required: true },
      { name: "ends_on", label: "Until (optional — for something that lasts several days, e.g. the Christmas break)", short: "Until", type: "date" },
      { name: "title", label: "What is happening (keep it short)", short: "Key date", type: "text", required: true, wide: true, placeholder: "Team Handicap: round 1 starts" },
      { name: "details", label: "More detail (optional — a line of small print)", type: "text", wide: true, placeholder: "Matches to be played by Sunday 1 November" },
      { name: "competition_id", label: "Competition (optional — the date then links to it and shows its trophy)", short: "Competition", type: "ref", ref: "competitions" },
      { name: "url", label: "Link (optional — instead of the competition)", type: "text", placeholder: "/enter or https://…" },
      { name: "is_active", label: "Show this date", short: "Showing", type: "checkbox", default: true },
    ],
    validate: (row) => (row.ends_on && row.ends_on < row.starts_on ? "“Until” is before the date." : null),
  },
  meetings: {
    label: "Meetings", table: "meetings", order: "held_on", desc: true, filters: ["kind"], columns: ["held_on", "kind", "title", "venue", "is_published"],
    intro: "The AGM and committee meetings, shown on the Meetings page (/meetings). Add a meeting before it happens (date, place, agenda) and it shows as the next meeting; afterwards, come back and add the minutes — typed in, or as a PDF.",
    fields: [
      { name: "kind", label: "Type of meeting", short: "Type", type: "select", options: MEETING_KINDS, labels: Object.fromEntries(MEETING_KINDS.map((k) => [k, k])), default: "Committee Meeting" },
      { name: "held_on", label: "Date", type: "date", required: true },
      { name: "time_text", label: "Time (as you want it shown)", type: "text", placeholder: "7.30pm" },
      { name: "venue", label: "Where", type: "text", list: true, placeholder: "Bethel Social Club" },
      { name: "title", label: "Title (optional — otherwise the type of meeting is used)", short: "Title", type: "text", wide: true, placeholder: "Annual General Meeting 2026" },
      { name: "summary", label: "Agenda or a short summary", type: "textarea", rows: 5, formatted: true },
      { name: "minutes", label: "Minutes (typed in — optional)", type: "textarea", rows: 14, formatted: true },
      { name: "document_url", label: "Minutes or agenda as a PDF (optional)", type: "file", folder: "meetings" },
      { name: "is_published", label: "Show on the website (untick to keep it as a draft only officers can see)", short: "On the website", type: "checkbox", default: true },
    ],
    rowActions: [{ label: "View", href: () => "/meetings" }],
  },
  awards: {
    label: "Presentation awards", table: "awards", order: "sort", columns: ["trophy_url", "name", "winner_name", "runner_up_name", "sort"],
    fields: [
      { name: "name", label: "Award or trophy", short: "Award", type: "text", required: true, placeholder: "Victory League Highest Break" },
      { name: "season_id", label: "Season", type: "ref", ref: "seasons", required: true },
      { name: "sort", label: "Order on the page (1 = first)", short: "Order", type: "number", default: 1 },
      { name: "trophy_url", label: "Trophy picture (a cut-out: transparent PNG or SVG. Leave empty to use the trophy of the competition or league below — or the placeholder cup)", short: "Trophy", type: "image", folder: "trophies", maxSize: 700 },
      { type: "heading", label: "What it is for", help: "Optional. Linking the award lets “Fill in from the results” find the winner, and makes the award's name a link." },
      { name: "competition_id", label: "Competition", type: "ref", ref: "competitions" },
      { name: "league_id", label: "League", type: "ref", ref: "leagues" },
      ...awardSideFields("winner", "Winner"),
      ...awardSideFields("runner_up", "Runner-up"),
      { type: "heading", label: "Small print" },
      { name: "note", label: "Note (optional — e.g. “A break of 92” or “Presented by the Mills family”)", type: "text", wide: true },
    ],
    beforeSave: (row, refs) => ({ ...row, winner_name: awardName(row, refs, "winner"), runner_up_name: awardName(row, refs, "runner_up") }),
  },
  // Branding and Site settings are two forms on the same single row of the settings table.
  branding: {
    label: "Branding", table: "settings", order: "id", single: true, afterSave: () => refreshShell(),
    validate: (row) => (row.font_embed && !parseFontEmbed(row.font_embed) ? "That doesn't look like a Google Fonts embed link — it should contain an address starting https://fonts.googleapis.com/css2?family=…"
      : row.loader_seconds != null && (row.loader_seconds < 0 || row.loader_seconds > 10) ? "The loading screen time must be between 0 and 10 seconds."
      : Object.values(row.text_sizes ?? {}).some((v) => v !== "" && v != null && (v < 8 || v > 90)) ? "Text sizes must be between 8 and 90 pixels." : null),
    // Empty text-size boxes are simply left out, so those sizes stay standard.
    beforeSave: (row) => ({ ...row, loader_seconds: row.loader_seconds ?? 0,
      text_sizes: Object.fromEntries(Object.entries(row.text_sizes ?? {}).filter(([, v]) => v !== "" && v != null)) }),
    // Pasting an embed link offers its fonts in the two lists at once (no need to save first).
    onInput: (form, target) => {
      if (target.name !== "font_embed") return;
      for (const name of ["font_head", "font_body"]) {
        const select = form.elements[name];
        for (const family of pastedFonts(target.value)) if (![...select.options].some((o) => o.value === family)) select.add(new Option(family, family));
      }
    },
    intro: "How the website looks. Leave a colour or font on “standard” to keep the original. Changes show as soon as you press Save.",
    fields: [
      { type: "heading", label: "Logos" },
      { name: "logo_url", label: "Main logo (SVG or PNG — shown top left, at the height of the menu)", type: "image", folder: "branding", maxSize: 400 },
      { name: "logo_light_url", label: "Logo for a light header (a dark version of the logo, used when the header is Light cream — leave empty and the main logo is shown darkened)", type: "image", folder: "branding", maxSize: 400 },
      { name: "loading_logo_url", label: "Loading logo (pulses in the middle of the black loading screen — leave empty to use the main logo)", type: "image", folder: "branding", maxSize: 600 },
      { name: "favicon_url", label: "Favicon (the little browser-tab icon — square; kept as a PNG so every browser shows it. Leave empty to use the app icon below)", type: "image", folder: "branding", maxSize: 128, format: "png" },
      { type: "heading", label: "App icon (phone home screen and installed app)", help: "What a phone shows when someone adds the website to their home screen, and a computer for the installed app. Upload one square picture — the badge on its own, 512 × 512 or bigger; PNG or SVG with a clear background is best — and the four sizes phones and browsers ask for are made from it. Choose the background colour first: iPhones and round Android icons fill the space around the badge with it. Phones that already added the site may keep the old icon until it is removed and added again." },
      { name: "app_icon_bg", label: "Background colour behind the badge", type: "color", default: "#000000" },
      { name: "app_icons", label: "App icon", type: "appicon" },
      { type: "heading", label: "Look", help: "Calm (standard since round 43): plenty of white space, black and red only, and a quiet menu where the page you are on is underlined. Classic: the colourful menu buttons and coloured section headers from before. The menu and section colours below are only used by the Classic look." },
      { name: "site_look", label: "Look of the website", type: "select", options: ["calm", "classic"], default: "calm",
        labels: { calm: "Calm — white space, black and red (standard)", classic: "Classic — colourful menu and section headers" } },
      { name: "strip_style", label: "Live & upcoming strip (calm look)", type: "select", options: ["light", "dark"], default: "light",
        labels: { light: "Light grey with white cards (standard)", dark: "Black" } },
      { name: "header_style", label: "Header behind the logo and menu (calm look)", type: "select", options: ["black", "grey", "light"], default: "black",
        labels: { black: "Black (standard)", grey: "Dark grey", light: "Light cream (#fbfaef) — upload the logo for a light header below" } },
      // Round 50 (Rich): the phone menu (the ☰ button) — the new cream one, or the colour blocks from before. Kept in
      // home_sections, so no database change is needed.
      { name: "menu_style", in: "home_sections", label: "Phone menu (the ☰ button, calm look)", type: "select", options: ["cream", "blocks"], default: "cream",
        labels: { cream: "Cream — the logo on top, the main pages as rows like the desktop menu, the rest underneath (standard)", blocks: "Colour blocks — the coloured buttons on black, as before" } },
      { type: "heading", label: "Menu and section colours (Classic look)", help: "Each menu button has its own colour, and the pages in that part of the site use it for their headers." },
      { name: "color_home", label: "Home (standard: brown)", type: "color", optional: true, default: "#4b2019" },
      { name: "color_competitions", label: "Competitions & Handicaps (standard: gold)", type: "color", optional: true, default: "#fbb61a" },
      { name: "color_fixtures", label: "Fixtures (standard: green)", type: "color", optional: true, default: "#0b8a12" },
      { name: "color_league", label: "League (standard: white)", type: "color", optional: true, default: "#ffffff" },
      { name: "color_news", label: "News (standard: blue)", type: "color", optional: true, default: "#0088e0" },
      { name: "color_login", label: "My area, My Snooker and login pages (standard: red)", type: "color", optional: true, default: "#e8003d" },
      { name: "section_colors", label: "Colour-code each section: its table headers match its menu button", type: "checkbox", default: true },
      { type: "heading", label: "Other colours" },
      { name: "color_primary", label: "Main colour (standard: red — buttons, the line under the menu, headers that have no section colour)", type: "color", optional: true, default: "#e8003d" },
      { name: "color_background", label: "Page background (standard: cream)", type: "color", optional: true, default: "#f9f8ee" },
      { type: "heading", label: "Fonts", help: "Pick from the lists — or, for any other Google font, paste its embed link in the box underneath and it joins both lists." },
      { name: "font_head", label: "Headings and menu", type: "select", options: fontOptions(FONTS.head), labels: { "": `${FONTS.head[0]} (standard)` } },
      { name: "font_body", label: "Body text", type: "select", options: fontOptions(FONTS.body), labels: { "": `${FONTS.body[0]} (standard)` } },
      { name: "font_embed", label: "Google Fonts embed link (optional)", type: "textarea", rows: 3,
        placeholder: '<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">',
        help: "On fonts.google.com choose your font(s), press “Get font”, then “Get embed code”, and copy the code under “Embed code in the <head> of your html” (the @import version works too). Paste it here: the fonts in it appear in the two lists above straight away — choose them there, then Save." },
      { type: "heading", label: "Text sizes", help: "The size of each kind of text, in pixels. Leave a box empty to keep the standard size (shown in grey). Phones keep their own smaller page titles and menu so nothing runs off the screen." },
      ...TEXT_SIZES.map(([key, label, px]) => ({ name: key, in: "text_sizes", label, type: "number", min: 8, max: 90, placeholder: `${px} (standard)` })),
      { type: "heading", label: "Page layout", help: "For each part of the site: “Right sidebar” puts the side boxes (latest results, breaks, rankings) on the right of every page in it, and adds them to pages that don't normally have any. “Full width” lets every page use the whole width — a page's own side boxes move underneath it." },
      ...LAYOUT_GROUPS.map(([key, label]) => ({ name: key, in: "page_layouts", label, type: "select", options: ["auto", "sidebar", "full"], labels: LAYOUT_LABELS, default: "auto" })),
      { name: "sidebar_layout", label: "Which side a sidebar goes on", type: "select", options: ["right", "left"], default: "right", labels: { right: "Right (standard)", left: "Left" } },
      { type: "heading", label: "Loading screen", help: "The black screen with the logo pulsing in the middle. The loading logo is at the top of this page." },
      { name: "loader_show", label: "Show the loading screen", type: "checkbox", default: true },
      { name: "loader_every_page", label: "Show it on every page (untick: only when the website is first opened — moving between pages is then instant)", short: "Every page", type: "checkbox", default: false },
      { name: "loader_seconds", label: "Show it for at least (seconds, when the site is first opened — 0 = only for as long as the page really takes to load)", short: "Seconds", type: "number", default: 0, min: 0, max: 10, step: 0.5 },
    ],
  },
  settings: {
    label: "Site settings", table: "settings", order: "id", single: true, afterSave: () => refreshShell(), live: liveStripPreview,
    fields: [
      { type: "heading", tab: "Home page", label: "Home page style and sections", help: "Standard: the home page is about news and promotion — the latest news, competitions, players and teams — and the tables and rankings live in each visitor's My Snooker page. Tick the blocks to show and number them to set their order (1 = first). The Competitions / Calendar / Handicaps / Fixtures links, the feature box and the key dates always sit at the top. Everything: the earlier home page, with every league table, the breaks and the rankings." },
      { name: "home_style", label: "Home page style", type: "select", options: ["standard", "full"], default: "standard",
        labels: { standard: "Standard — news and promotion, the blocks below (standard)", full: "Everything — every table, the breaks and the rankings (as before)" } },
      { type: "heading", tab: "Home page", label: "Home page sections", help: "For the Standard style. Tick a block to show it; the number beside it sets the order (1 = first, empty = the order listed here)." },
      ...HOME_SECTIONS.flatMap(([key, label, std], i) => [
        { name: key, in: "home_sections", label: `Show: ${label}`, type: "checkbox", default: std },
        { name: `${key}_pos`, in: "home_sections", label: "Order on the page", type: "number", min: 1, max: 30, placeholder: String(i + 1) },
      ]),
      // Round 48: the guided tour (core/guide.js). Kept in home_sections, so no database change is needed for it.
      { type: "heading", tab: "Home page", label: "Welcome guide", help: "A short guided tour that lights up each part of a logged-in person's My Snooker page with a note: their team, next match, the table, My Snooker settings and so on. It starts by itself the first time they open My Snooker on a phone or computer. Anyone can start it again from their account menu or the footer (“Show me around”)." },
      { name: "guide_on", in: "home_sections", label: "Show the welcome guide the first time someone opens My Snooker", type: "checkbox", default: true },
      { type: "heading", tab: "Home page", label: "Season promotion", help: "A big block for the months with no snooker (about April to September): when the new season starts (the first league match on the calendar, or a key date with “season” in its name), the next key dates — AGM, presentation night, entries closing — and a button inviting new players and teams. Leave the words empty to use the standard ones." },
      { name: "promo_mode", label: "When to show it", type: "select", options: ["auto", "always", "never"], default: "auto",
        labels: { auto: "By itself between seasons — no league match in the last 2 weeks or the next 3 (standard)", always: "All the time", never: "Never" } },
      { name: "promo_title", label: "Headline (empty: “The new season starts …” with the date)", type: "text", placeholder: "The new season starts Tuesday 15 September 2027" },
      { name: "promo_text", label: "Words under the headline (empty: free to join for players and teams…)", type: "textarea" },
      { name: "promo_button", label: "Button words", type: "text", placeholder: "Join the league" },
      { name: "promo_url", label: "Button link (a page on this site such as /page/contact-us, or a full web address)", type: "text", placeholder: "/page/contact-us" },
      { type: "heading", tab: "Home page", label: "Home page banner", help: "The logo, colours and fonts are under Website → Branding." },
      { name: "hero_image_url", label: "Home page banner background (16:9, e.g. 1920 × 1080 — leave blank for the standard photo)", type: "image", folder: "branding", maxSize: 2000 },
      { name: "hero_count", label: "How many news articles rotate in the banner", type: "number", default: 4 },
      { name: "hero_layout", label: "Banner layout", type: "select", options: ["side", "white", "big", "text"], default: "side",
        labels: { side: "Headline with the article's picture beside it", white: "White: headline on the left, big picture on the right",
          big: "Big: the article's picture across the whole banner", text: "Headline only (the background photo above)" } },
      { name: "hero_bg", label: "Banner background colour (behind the headline and picture — empty for the standard grey)", type: "color", optional: true, default: "#ececec" },
      { type: "heading", tab: "Home page", label: "Player of the week" },
      { name: "player_of_week_show", label: "Show on the home page", type: "checkbox" },
      { name: "player_of_week_id", label: "Player", type: "ref", ref: "players" },
      { name: "player_of_week_text", label: "Why (one or two sentences)", type: "textarea", rows: 2 },
      { type: "heading", tab: "Home page", label: "Team of the week" },
      { name: "team_of_week_show", label: "Show on the home page", type: "checkbox" },
      { name: "team_of_week_id", label: "Team", type: "ref", ref: "teams" },
      { name: "team_of_week_text", label: "Why (one or two sentences)", type: "textarea", rows: 2 },
      { type: "heading", tab: "Home page", label: "Player of the month", help: "Shown beside the player and team of the week, with their form (a mark out of 10 from their last 6 matches). The Form guide page (/form) shows who is in form, to help you choose." },
      { name: "player_of_month_show", label: "Show on the home page", type: "checkbox" },
      { name: "player_of_month_id", label: "Player", type: "ref", ref: "players" },
      { name: "player_of_month_text", label: "Why (one or two sentences)", type: "textarea", rows: 2 },
      { type: "heading", tab: "Home page", label: "Team of the month" },
      { name: "team_of_month_show", label: "Show on the home page", type: "checkbox" },
      { name: "team_of_month_id", label: "Team", type: "ref", ref: "teams" },
      { name: "team_of_month_text", label: "Why (one or two sentences)", type: "textarea", rows: 2 },
      { type: "heading", tab: "Home page", label: "Other home page boxes" },
      { name: "cueviews_show", label: "Show CueViews (pick which ones under Players → “Show this CueView on the home page”)", type: "checkbox" },
      { name: "shields_show", label: "Show who holds each league's shield", type: "checkbox" },
      { type: "heading", tab: "Captains & competitions", label: "Captains: the Manage team box", help: "A box at the bottom of the home page that only captains and vice captains see, in the days before their team's next match. It takes them to My area → Manage team, where they pick who plays each frame (it is then on the scorecard on the night) and can add a new player. They can close the box; it comes back for the next match." },
      { name: "squad_box_days", label: "Show it this many days before the match (0 = never show it)", type: "number", default: 3, min: 0, max: 14 },
      { type: "heading", tab: "Captains & competitions", label: "Scorecard reminders", help: "The morning after a league match night, the captains (and vice captains) of the home team get an email if their match still has no result entered. One reminder per match. Needs the RESEND_API_KEY on Netlify, like the result emails." },
      { name: "reminders_on", label: "Email captains when a scorecard hasn't been entered by the next morning", type: "checkbox", default: true },
      { name: "reminders_both", label: "Email the away team's captains as well", type: "checkbox", default: false },
      // Round 73 (Rich: "I love the WST career stats and Triple Crown"): the three competitions that make up the
      // league's Triple Crown — the league to decide (Singles, Doubles, Team competition or league, probably).
      { type: "heading", tab: "Players", label: "Player pages: the Triple Crown", help: "Every player's page shows their career stats (titles, finals, highest break, centuries) and, once three competitions are chosen here, the Triple Crown: how many times they have won each one. Type the competition's name as it is in the draw or on Presentation night (any season)." },
      { name: "triple_crown", label: "The three Triple Crown competitions", type: "list", add: "+ Add a competition", placeholder: "e.g. Rees Singles", max: 80, wide: true,
        suggestions: (refs) => [...new Set((refs.competitions ?? []).map((c) => c.name))].sort(), needs: ["competitions"] },
      { type: "heading", tab: "Captains & competitions", label: "Competitions: deadline warnings", help: "Players (and captains, for team competitions) are warned in their own area — and in a bar on the home page in the last week — about their cup matches as each round's deadline comes up: who is at home, and who must contact whom. The deadlines and the “contact by” dates are set for each round under Draws & results." },
      { name: "comp_warn_days", label: "Start warning this many days before a round's deadline", type: "number", default: 14, min: 1, max: 60 },
      { name: "comp_contact_rule", label: "What the away player is told when the home player hasn't been in touch by the “contact by” date", type: "textarea", placeholder: CONTACT_RULE },
      { type: "heading", tab: "Home page", label: "Home page: feature box", help: "A coloured strip under the Competitions / Calendar / Handicaps / Fixtures buttons — for announcing something new." },
      { name: "feature_show", label: "Show the feature box", type: "checkbox" },
      { name: "feature_label", label: "Pulsing label (e.g. NEW)", type: "text", default: "NEW" },
      { name: "feature_text", label: "Text", type: "text", wide: true, placeholder: "Try our step-by-step scorecard — log in to find out more" },
      { name: "feature_url", label: "Link (where it goes when clicked)", type: "text", placeholder: "/login or https://…" },
      { name: "feature_bg", label: "Background colour", type: "color", default: "#0b84e0" },
      { name: "feature_announcements", label: "Also show the announcements in this box, after the text above (each one can be left out under Website → Announcements)", type: "checkbox", default: true },
      { name: "feature_style", label: "When there is more than one message", type: "select", options: ["scroll", "rotate"], default: "scroll",
        labels: { scroll: "Scroll across, like the ticker", rotate: "Show one at a time, changing every few seconds" } },
      { type: "heading", tab: "Home page", label: "Home page: key dates", help: "The box of dates coming up. Add the dates themselves under Website → Key dates." },
      { name: "key_dates_show", label: "Show the Key dates box (when there is at least one date coming up)", type: "checkbox", default: true },
      { name: "key_dates_count", label: "How many dates to show", type: "number", default: 5, min: 1, max: 12 },
      { type: "heading", tab: "Home page", label: "Home page: Latest News box", help: "Only used when “Side column: top box” (further down) is set to Latest news. Choose what it shows, so it doesn't repeat what's in the banner." },
      { name: "latest_news_mode", label: "Show", type: "select", options: ["newest", "not_banner", "category", "picked"], default: "newest",
        labels: { newest: "The newest articles", not_banner: "The newest articles that aren't in the banner", category: "The newest articles from one category", picked: "The articles I choose below" } },
      { name: "latest_news_count", label: "How many articles", type: "number", default: 1 },
      { name: "latest_news_category", label: "Category (for “one category”)", type: "ref", ref: "categories", store: "name" },
      { name: "latest_news_ids", label: "Chosen articles (for “the articles I choose”)", type: "tags", ref: "articles" },
      { type: "heading", tab: "Strip & results", label: "Home page: Live & upcoming strip", help: "The row of match cards under the banner. Results stay on it for a while after a match, with a label: Completed, Pending (a league result waiting for approval) or Walkover. Postponed matches show too, labelled Postponed. Choose how long results stay, and the colours of the labels." },
      { name: "strip_result_hours", label: "How long a result stays on the strip, in hours (0 = don't show results; standard 48). A cup result typed in later counts from when it was typed in.", short: "Results stay (hours)", type: "number", default: 48, min: 0, max: 336 },
      { name: "strip_live_color", label: "“Live” label and the edge of a live card (standard: green, like the Live button)", type: "color", optional: true, default: "#19a33a" },
      { name: "strip_soon_color", label: "“Live soon” label (standard: orange)", type: "color", optional: true, default: "#ff8a00" },
      { name: "strip_done_color", label: "“Completed” label (standard: green)", type: "color", optional: true, default: "#2f7d32" },
      { name: "strip_pending_color", label: "“Pending” label — a league result waiting for approval (standard: yellow)", type: "color", optional: true, default: "#f2b705" },
      { name: "strip_walkover_color", label: "“Walkover” label (standard: red)", type: "color", optional: true, default: "#c4112f" },
      { name: "strip_postponed_color", label: "“Postponed” label — shown from the match's date until a week ahead (standard: red)", type: "color", optional: true, default: "#c4112f" },
      { type: "custom", render: () => stripPreview() },
      { name: "strip_line", label: "A thin line along the top of the strip", type: "select", options: ["none", "red", "yellow", "grey"], default: "red",
        labels: { none: "None", red: "Red — the main colour (standard)", yellow: "Yellow", grey: "Grey" } },
      { type: "heading", tab: "Strip & results", label: "Side column: top box", help: "The box at the top of the side column on the home page and other pages with a sidebar. It has a button to the full results page (/results)." },
      { name: "side_box_mode", label: "Show", type: "select", options: ["results", "league", "cup", "news", "off"], default: "results",
        labels: { results: "Latest league and competition results together (standard)", league: "Latest league results only", cup: "Latest competition results only", news: "Latest news (as it used to be — set up in the Latest News box section above)", off: "Nothing" } },
      { name: "side_box_title", label: "Heading (leave empty for “Latest Results”)", type: "text", placeholder: "Latest Results" },
      { name: "side_box_count", label: "How many results", type: "number", default: 5, min: 1, max: 20 },
      { name: "side_box_league", label: "Only this league (leave empty for every league)", type: "ref", ref: "leagues" },
      { type: "heading", tab: "Strip & results", label: "Announcements ticker", help: "The thin line of announcements that scrolls across the very top of the home page. Add the announcements themselves under Website → Announcements." },
      { name: "ticker_show", label: "Show the ticker on the home page (when there is at least one announcement)", type: "checkbox", default: true },
      { name: "ticker_pace", label: "Speed (1 = very slow, 3 = standard, 10 = fast — it also sets the speed of the feature box when that scrolls)", short: "Speed", type: "range", min: 1, max: 10, step: 1, default: 3 },
      { type: "heading", tab: "Celebrations", label: "Celebrations", help: "For the big moments — a new highest break, new league leaders, a new leader of the player rankings, the winner of a competition — everyone who is on the website at that moment sees a burst of confetti in the ball colours and a card saying what happened. It shows once, lasts a few seconds and can be closed. Each visitor can switch celebrations off for themselves (the bell in the menu)." },
      { name: "celebrate_breaks", label: "Celebrate a new highest break", type: "select", options: ["season", "week", "off"], default: "season",
        labels: { season: "When it is the highest of the season in its league or competition (standard)", week: "Also when it is the highest of the week", off: "Never" } },
      { name: "celebrate_leaders", label: "Celebrate new league leaders (a different team goes top of a league table)", type: "checkbox", default: true },
      { name: "celebrate_rankings", label: "Celebrate a new leader of the player rankings", type: "checkbox", default: true },
      { name: "celebrate_winners", label: "Celebrate the winner of a competition (when the final is finished)", type: "checkbox", default: true },
      { type: "heading", tab: "Captains & competitions", label: "Competition entry form", help: "Shown to players at the end of the entry form (/enter). Which competitions are open is set on each competition." },
      { name: "entry_intro", label: "Introduction at the top of the form (optional)", type: "textarea", rows: 2 },
      { name: "bacs_details", label: "How to pay — the league's bank details (BACS)", type: "textarea", rows: 4,
        placeholder: "Account name: St Blazey & District Snooker League\nSort code: 00-00-00\nAccount number: 00000000\nReference: your name + competition" },
      { name: "entry_pay_days", label: "Days allowed to pay (unpaid entries are removed after this)", type: "number", default: 7 },
      { type: "heading", tab: "News & pages", label: "News", help: "Whose name goes on an article when its own “Written by” box is empty." },
      { name: "news_author", label: "Articles are by (standard name)", type: "text", placeholder: "St Blazey & District Snooker League" },
      { type: "heading", tab: "News & pages", label: "Merchandise page", help: "The words on /merchandise. The items themselves are under Website → Merchandise." },
      { name: "merch_intro", label: "Introduction at the top of the page (optional)", type: "textarea", rows: 2 },
      { name: "merch_how", label: "How to order (who to speak to, how to pay, when it arrives)", type: "textarea", rows: 4,
        placeholder: "To order, speak to a committee member on a match night or email …\nPay by bank transfer or cash. Orders go in at the end of each month." },
      { type: "heading", tab: "Site", label: "Maintenance mode", help: "While this is on, visitors see a holding page with your message instead of the website. Anyone who is logged in still sees the full site, so you can keep working — and captains can still log in to enter results." },
      { name: "maintenance_on", label: "Switch the public website off for now", type: "checkbox" },
      { name: "maintenance_text", label: "Message for visitors", type: "textarea", rows: 2, placeholder: "We're making a few improvements to the website. Please check back shortly." },
      { type: "heading", tab: "Site", label: "Footer", help: "The very bottom of every page: the row of links (Privacy Policy, Contact Us…) and the copyright line under it. The partner logos come from Sponsors, and the social icons are set just below." },
      { name: "footer_links", label: "Links in the bottom menu, in the order they should appear. Start typing and pick one of the website's pages — or type what the link should say, then | and where it goes (a web address, or an email address). Leave this empty to show every info page ticked “Show as a link in the footer”.",
        type: "list", add: "+ Add another link", placeholder: "Privacy Policy | /page/privacy-policy", suggest: "pages", suggestions: (refs) => footerSuggestions(refs.pages), max: 240, wide: true },
      { name: "footer_copyright", label: "Copyright line: whose website it is (the © and this year are added for you)", type: "text", placeholder: "St Blazey and District Snooker", wide: true },
      { name: "footer_credit_show", label: "Show a credit after the copyright line", type: "checkbox", default: true },
      { name: "footer_credit_text", label: "The credit", type: "text", placeholder: "Created by White River Design Studio" },
      { name: "footer_credit_url", label: "Where the credit links to (optional)", type: "text", placeholder: "https://…" },
      { type: "heading", tab: "Site", label: "Sharing on social media", help: "What a link to the website shows when it is shared on Facebook, WhatsApp, X and the rest: a title, a line of text and a picture. News articles have their own (News → the article → Social preview); every other page uses these. The services keep a copy of a preview for a while, so a change can take a few days to show on a link that was shared before." },
      { name: "social_title", label: "Title (leave empty to use the league's name)", type: "text", placeholder: "St Blazey and District Snooker League", wide: true },
      { name: "social_description", label: "Text (a sentence or two)", type: "textarea", rows: 2, placeholder: "Fixtures, results, league tables, breaks and rankings for the St Blazey and District Snooker League, established 1941." },
      { name: "social_image_url", label: "Picture (wide: 1200 × 630 is ideal — the logo on a coloured background, or a photo of the club)", type: "image", folder: "branding", maxSize: 1200, format: "jpeg" },
      { type: "heading", tab: "Site", label: "Social links (footer)", help: "Paste the full address of each page. Blank ones aren't shown." },
      { name: "facebook_url", label: "Facebook", type: "text", placeholder: "https://www.facebook.com/…" },
      { name: "x_url", label: "X (Twitter)", type: "text", placeholder: "https://x.com/…" },
      { name: "instagram_url", label: "Instagram", type: "text", placeholder: "https://www.instagram.com/…" },
      { name: "youtube_url", label: "YouTube", type: "text", placeholder: "https://www.youtube.com/…" },
    ],
  },
  // ── Round 22 ───────────────────────────────────────────────────
  popups: {
    label: "Pop-up adverts", table: "popups", order: "sort", columns: ["image_url", "name", "kind", "frequency", "ends_on", "is_active"],
    intro: "Promotions and offers that pop up over the home page. Choose “Text, picture and a button” to write a heading and a few words with a picture and a link, or “One whole picture” to use a ready-made advert image (it becomes the link). Only one pop-up shows at a time — the first one in the order that is switched on and in its dates. Each visitor sees it once, once a day, or every time they open the home page, as you choose; changing a pop-up shows it again to everyone. Visitors close it with the × or by pressing outside it.",
    fields: [
      { name: "name", label: "Name (only seen here)", short: "Name", type: "text", required: true, placeholder: "Christmas handicap entries" },
      { name: "kind", label: "What it shows", short: "Kind", type: "select", options: ["content", "image"], labels: { content: "Text, picture and a button", image: "One whole picture (a ready-made advert)" }, default: "content" },
      { name: "heading", label: "Heading (text adverts)", type: "text", placeholder: "Entries close Friday!", wide: true },
      { name: "body", label: "Text (text adverts — a sentence or two)", type: "textarea", rows: 3 },
      { name: "image_url", label: "Picture (a whole-picture advert: 16:9, e.g. 1600 × 900 — it is shown that shape)", short: "Picture", type: "image", folder: "branding", maxSize: 1400 },
      { name: "link_url", label: "Link (where a press on the button or the picture goes — optional)", type: "text", placeholder: "/enter or https://…" },
      { name: "button_text", label: "Button text (text adverts)", type: "text", placeholder: "Find out more" },
      { name: "frequency", label: "How often each visitor sees it", short: "Shown", type: "select", options: ["once", "daily", "every"], labels: { once: "Once (again only if it is changed)", daily: "Once a day", every: "Every time they open the home page" }, default: "once" },
      { name: "delay_seconds", label: "Seconds after the home page opens", type: "number", default: 2, min: 0, max: 120 },
      { name: "starts_on", label: "Show from (optional)", type: "date" },
      { name: "ends_on", label: "Stop showing after (optional)", short: "Until", type: "date" },
      { name: "sort", label: "Order (1 = first — only the first that is on shows)", type: "number", default: 1 },
      { name: "is_active", label: "Switched on", short: "On", type: "checkbox", default: true },
    ],
    validate: (row) => (row.kind === "image" && !row.image_url ? "A whole-picture advert needs a picture." : row.kind === "content" && !row.heading && !row.body ? "Write a heading or some text for the advert." : row.starts_on && row.ends_on && row.ends_on < row.starts_on ? "“Stop showing after” is before “Show from”." : null),
    beforeSave: (row) => ({ ...row, updated_at: new Date().toISOString() }),
  },
  market_categories: {
    label: "Marketplace categories", table: "market_categories", order: "sort", columns: ["name", "sort"],
    intro: "The categories people choose from when they put up an advert, shown as buttons along the top of the marketplace.",
    fields: [
      { name: "name", label: "Category", type: "text", required: true },
      { name: "sort", label: "Order (1 = first)", short: "Order", type: "number", default: 1, min: 1 },
    ],
  },
  subscribers: {
    label: "Subscribers", table: "newsletter_subscribers", order: "created_at", desc: true, filters: ["status"], columns: ["email", "name", "status", "source", "created_at"], pageSize: 50,
    intro: "Everyone who has signed up to the newsletter (the pop-up, the footer link or /newsletter), and anyone you add by hand. Campaigns go to everyone who is “Subscribed”. People leave with the link at the bottom of every newsletter — they then show as “Unsubscribed” and get nothing more. Please only add people who have asked to get the newsletter.",
    fields: [
      { name: "email", label: "Email address", type: "email", required: true },
      { name: "name", label: "Name (optional)", type: "text" },
      { name: "status", label: "Status", type: "select", options: ["subscribed", "unsubscribed"], default: "subscribed" },
      { name: "source", label: "Where they signed up", short: "From", type: "select", options: ["website", "added by hand", "imported"], default: "added by hand" },
      { name: "created_at", label: "Signed up (filled in for you)", short: "Signed up", type: "datetime", createOnly: true },
    ],
    validate: (row) => (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email ?? "").trim()) ? "That doesn't look like an email address." : null),
    beforeSave: (row) => { const r = { ...row, email: String(row.email).trim().toLowerCase() }; delete r.created_at; if (r.status === "unsubscribed" && !r.unsubscribed_at) r.unsubscribed_at = new Date().toISOString(); if (r.status === "subscribed") r.unsubscribed_at = null; return r; },
  },
  newsletter_setup: {
    label: "Newsletter sign-up", table: "settings", order: "id", single: true, afterSave: () => refreshShell(),
    fields: [
      { type: "heading", label: "The sign-up pop-up", help: "A box that asks visitors for their email address a few seconds after they open the website. Each visitor sees it once; if they press × it asks again a month later, and never again once they have signed up. Not on the home page while a pop-up advert is showing." },
      { name: "newsletter_popup_on", label: "Show the sign-up pop-up", type: "checkbox" },
      { name: "newsletter_delay", label: "Seconds before it appears", type: "number", default: 10, min: 3, max: 120 },
      { name: "newsletter_title", label: "Heading", type: "text", placeholder: "Get the league news by email", wide: true },
      { name: "newsletter_text", label: "Text", type: "textarea", rows: 3, placeholder: "Results, competition draws, presentation night and league news — straight to your inbox. Unsubscribe any time with the link at the bottom of every email." },
      { name: "newsletter_footer_link", label: "Show “✉ Sign up to the newsletter” at the bottom of every page", type: "checkbox", default: true },
    ],
  },
  // ── Round 23 ───────────────────────────────────────────────────
  ads: {
    label: "Side adverts", table: "ads", order: "sort", filters: ["target"], columns: ["image_url", "name", "target", "target_ref", "ends_on", "is_active"],
    intro: "Paid adverts at the top of the side column (or, on a page without one, a strip under the heading). Show one everywhere, or only on one venue's page (an advert for that club), one team, one competition, one league, or a kind of page — presentation night (the band, the tickets), in memoriam (a florist)… An advert aimed at the page comes first; at most two show at once. Nothing shows until an advert is added.",
    fields: [
      { name: "name", label: "Name (only seen here — e.g. the advertiser)", short: "Name", type: "text", required: true },
      { name: "image_url", label: "Advert picture (300 × 250 or 600 × 500 works well in the side column)", short: "Picture", type: "image", folder: "sponsors", maxSize: 1000 },
      { name: "heading", label: "Heading (optional — for a text advert, or under the picture)", type: "text" },
      { name: "body", label: "Text (optional)", type: "textarea", rows: 2 },
      { name: "link_url", label: "Link (where a press on it goes)", type: "text", placeholder: "https://… or /sponsor/…" },
      { name: "button_text", label: "Button text (optional)", type: "text", placeholder: "Book tickets" },
      { name: "target", label: "Where it shows", short: "Shows on", type: "select", options: ["all", "page", "venue", "team", "competition", "league"], default: "all",
        labels: { all: "Every page", page: "A kind of page", venue: "One venue's page", team: "One team's page", competition: "One competition", league: "One league's table" } },
      { name: "target_ref", label: "Which one — start typing and choose (a venue, team, competition, league or kind of page, to match “Where it shows”)", short: "Which", type: "text", wide: true,
        needs: ["venues", "teams", "competitions", "leagues"],
        choices: (refs) => [...AD_PAGES.map(([v, l]) => [v, `Kind of page: ${l}`]), ...(refs.venues ?? []).map((v) => [v.slug, `Venue: ${v.name}`]), ...(refs.teams ?? []).map((t) => [t.slug, `Team: ${t.name}`]),
          ...(refs.competitions ?? []).map((c) => [c.slug, `Competition: ${c.name}`]), ...(refs.leagues ?? []).map((l) => [l.slug, `League: ${l.name}`])] },
      { name: "sponsor_id", label: "Sponsor it belongs to (optional)", type: "ref", ref: "sponsors" },
      { name: "starts_on", label: "Show from (optional)", type: "date" },
      { name: "ends_on", label: "Stop showing after (optional)", short: "Until", type: "date" },
      { name: "sort", label: "Order (1 = first)", type: "number", default: 1 },
      { name: "is_active", label: "Switched on", short: "On", type: "checkbox", default: true },
    ],
    validate: (row) => (!row.image_url && !row.heading ? "An advert needs a picture or a heading." : row.target !== "all" && !String(row.target_ref ?? "").trim() ? "Choose which page it shows on." : null),
  },
  sponsor_packages: {
    label: "Sponsorship packages", table: "sponsor_packages", order: "sort", columns: ["name", "price", "period", "includes_advert", "is_active"],
    intro: "The packages businesses can buy — Gold, Silver, Bronze… They are shown on the Sponsorship page (/sponsorship) in this order. Put a sponsor on a package under Website → Sponsors.",
    fields: [
      { name: "name", label: "Package name", type: "text", required: true, placeholder: "Gold" },
      { name: "price", label: "Price", type: "text", placeholder: "£250" },
      { name: "period", label: "For how long", type: "text", placeholder: "a season" },
      { name: "colour", label: "Colour", type: "color", default: "#d4a017" },
      { name: "summary", label: "One line about it", type: "text", wide: true },
      { name: "benefits", label: "What they get — one per line", type: "textarea", rows: 6, placeholder: "Banner at the bottom of every page" },
      { name: "includes_advert", label: "Includes a side advert on the website", type: "checkbox", default: true },
      { name: "sort", label: "Order (1 = first)", type: "number", default: 1 },
      { name: "is_active", label: "Show on the Sponsorship page", short: "Showing", type: "checkbox", default: true },
    ],
  },
  downloads: {
    label: "Downloads", table: "downloads", order: "sort", filters: ["category"], columns: ["title", "category", "members_only", "is_active"],
    intro: "Files for clubs and players on the League downloads page (/downloads): posters for the club wall, the rules, competition entry forms… PDF, Word, Excel, PowerPoint or a picture, up to 5 MB. “Logged-in only” files are for people with a league login (the standard).",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "category", label: "Category", type: "text", list: true, default: "General", placeholder: "Posters, Rules, Entry forms…" },
      { name: "file_url", label: "The file", type: "file", folder: "downloads", anyDoc: true, required: true },
      { name: "description", label: "A line about it (optional)", type: "textarea", rows: 2 },
      { name: "members_only", label: "Logged-in only", short: "Logged in", type: "checkbox", default: true },
      { name: "sort", label: "Order (1 = first)", type: "number", default: 1 },
      { name: "is_active", label: "Show it", short: "Showing", type: "checkbox", default: true },
    ],
  },
  hall_of_fame: {
    label: "Hall of Fame", table: "hall_of_fame", order: "created_at", desc: true, filters: ["status", "category"], columns: ["title", "category", "subject", "year", "status", "featured"],
    intro: "Achievements past and present, and memories sent in on the “Share a memory” form (/hall-of-fame/submit). Sent-in memories arrive as “Pending” (highlighted): read them, tidy them if needed, and set them to “Approved” to put them on the Hall of Fame page.",
    fields: [
      { name: "status", label: "Status", type: "select", options: ["pending", "approved", "rejected"], labels: { pending: "Pending (not on the website)", approved: "Approved (on the website)", rejected: "Not used" }, default: "approved" },
      { name: "category", label: "Category", type: "text", list: true, default: "Hall of Fame", placeholder: "Hall of Fame, Champions, History, Memories…" },
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "subject", label: "Who it is about (a person or a team)", type: "text" },
      { name: "player_id", label: "Player (optional — links to their page)", type: "ref", ref: "players" },
      { name: "team_id", label: "Team (optional)", type: "ref", ref: "teams" },
      { name: "year", label: "Year or season", type: "text", placeholder: "1987 or 1986–87" },
      { name: "achievements", label: "Achievements — one per line", type: "textarea", rows: 4 },
      { name: "body", label: "The story", type: "textarea", rows: 10, formatted: true },
      { name: "images", label: "Pictures (16:9, e.g. 1600 × 900)", type: "gallery" },
      { name: "quote", label: "A quote (optional)", type: "textarea", rows: 2 },
      { name: "quote_by", label: "Who said it", type: "text" },
      { name: "featured", label: "Feature it at the top of the Hall of Fame page", short: "Featured", type: "checkbox" },
      { name: "submitted_by", label: "Sent in by", type: "text" },
      { name: "contact", label: "Their contact details (private — never shown on the website)", type: "text" },
      { name: "sort", label: "Order (1 = first)", type: "number", default: 1 },
    ],
    // The sender's contact details live in their own private table (hall_of_fame_contacts).
    load: async (rows) => { const c = await allRows("hall_of_fame_contacts").catch(() => []); return rows.map((r) => ({ ...r, contact: c.find((x) => x.entry_id === r.id)?.contact ?? "" })); },
    save: async (row) => {
      const { contact, ...entry } = row;
      const saved = await save("hall_of_fame", entry);
      await upsertRow("hall_of_fame_contacts", { entry_id: saved.id, contact: contact || null }, "entry_id").catch(() => {});
      return saved;
    },
    rowActions: [{ label: "View", href: (row) => `/hall-of-fame/${row.no ?? row.id}` }],
    rowClass: (row) => (row.status === "pending" ? "hl" : ""),
  },
  page_settings_23: {
    label: "Page introductions", table: "settings", order: "id", single: true,
    intro: "The few lines of text at the top of these pages — what visitors read first. Leave a box empty to use the standard wording.",
    fields: [
      { type: "heading", label: "Sponsorship page (/sponsorship)" },
      { name: "sponsorship_intro", label: "Text at the top", type: "textarea", rows: 4 },
      { name: "sponsorship_contact", label: "How to get in touch (name, email, phone)", type: "textarea", rows: 2 },
      { type: "heading", label: "League downloads (/downloads)" },
      { name: "downloads_intro", label: "Text at the top", type: "textarea", rows: 3 },
      { type: "heading", label: "Hall of Fame (/hall-of-fame)" },
      { name: "hof_intro", label: "Text at the top", type: "textarea", rows: 3 },
    ],
  },
};

// ── Site settings: preview of the strip's labels (round 40) ──────
/** The six labels of the home page strip, drawn in the colours chosen above (they change as you pick). */
function stripPreview() {
  const labels = [["live", "Live"], ["soon", "Live soon"], ["done", "Completed"], ["pending", "Pending"], ["walkover", "Walkover"], ["postponed", "Postponed"]];
  return html`<div class="strip-preview" data-strip-preview><span class="muted">Preview:</span>${labels.map(([k, l]) => html`<span class="sp-tag" data-sp="${k}">${l}</span>`)}</div>`;
}
const STANDARD = { live: "#19a33a", soon: "#ff8a00", done: "#2f7d32", pending: "#f2b705", walkover: "#c4112f", postponed: "#c4112f" };
const inkFor = (c) => { const n = parseInt(c.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111" : "#fff"; };
function liveStripPreview(form) {
  const box = form.querySelector("[data-strip-preview]");
  if (!box) return;
  for (const k of Object.keys(STANDARD)) {
    const name = `strip_${k}_color`, own = form.querySelector(`[data-own-color="${name}"]`)?.checked;
    const c = own ? form.elements[name]?.value : STANDARD[k];
    const tag = box.querySelector(`[data-sp="${k}"]`);
    if (tag && /^#[0-9a-f]{6}$/i.test(c)) { tag.style.background = c; tag.style.color = inkFor(c); }
  }
}
