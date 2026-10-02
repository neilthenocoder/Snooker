// Fixture calendar: month grid (list on phones), filter by team,
// and an .ics download so players can add their matches to their phone.
import { html, mount, $, fmtTime, ukDay, todayUK } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadCompetitions, table } from "../core/api.js";
import { buildBracket, isEntry, roundName } from "../core/bracket.js";
import { addDays } from "../core/schedule.js";
import { breadcrumb, urls } from "../core/components.js";
import { SITE } from "../config.js";
import { setTitle, adminEdit } from "../core/router.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function calendar(view, { query }) {
  setTitle("Calendar");
  adminEdit("fixtures");
  const [ctx, compData, venues] = await Promise.all([seasonContext(), loadCompetitions(), table("venues", "name")]);
  let teamId = query.get("team") ?? "";
  let month = (query.get("month") ?? todayUK().slice(0, 7));

  // Every event: league fixtures plus cup matches with a date.
  const events = [
    ...ctx.fixtures.map((f) => ({
      id: f.id, when: f.starts_at, href: urls.match(f), kind: "league", status: f.status,
      title: `${ctx.team.get(f.home_team_id)?.name} v ${ctx.team.get(f.away_team_id)?.name}`,
      sub: ctx.league.get(f.league_id)?.name ?? "", teams: [f.home_team_id, f.away_team_id], venue: ctx.venue.get(f.venue_id)?.name,
    })),
    ...compData.competitions.flatMap((c) => {
      const b = buildBracket(compData.entries.filter((e) => e.competition_id === c.id), compData.matches.filter((m) => m.competition_id === c.id));
      return b.rounds.flat().filter((m) => !m.isBye && m.row.starts_at).map((m) => {
        const e = (id) => (isEntry(id) ? b.entryById.get(id) : null);
        const team = (x) => x?.team_id ?? ctx.player.get(x?.player_id)?.team_id;
        return {
          id: m.row.id, when: m.row.starts_at, href: `/cup-match/${m.row.id}`, kind: "cup", status: m.row.status,
          title: `${e(m.a)?.name ?? "TBC"} v ${e(m.b)?.name ?? "TBC"}`, sub: `${c.name} · ${roundName(m.round, b.totalRounds)}`,
          teams: [team(e(m.a)), team(e(m.b))].filter(Boolean), venue: venues.find((v) => v.id === m.row.venue_id)?.name,
        };
      });
    }),
  ].filter((e) => e.status !== "postponed").sort((a, b) => a.when.localeCompare(b.when));

  const draw = () => {
    const mine = events.filter((e) => !teamId || e.teams.includes(teamId));
    const [y, m] = month.split("-").map(Number);
    const first = `${month}-01`;
    const startDow = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = Array.from({ length: Math.ceil((startDow + daysInMonth) / 7) * 7 }, (_, i) => addDays(first, i - startDow));
    const byDay = new Map();
    for (const e of mine) (byDay.get(ukDay(e.when)) ?? byDay.set(ukDay(e.when), []).get(ukDay(e.when))).push(e);
    const shift = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
    const today = todayUK();
    const monthEvents = mine.filter((e) => ukDay(e.when).startsWith(month));
    const ev = (e) => html`<a class="cal-ev ${e.kind} ${e.status === "in_progress" ? "live" : ""}" href="${e.href}" title="${e.sub}">
      <b>${fmtTime(e.when)}</b> ${e.title}</a>`;

    mount($("[data-cal]", view), html`
      <div class="cal-bar">
        <button class="btn small ghost" data-month="${shift(-1)}">‹ ${MONTHS[(m + 10) % 12]}</button>
        <h2>${MONTHS[m - 1]} ${y}</h2>
        <button class="btn small ghost" data-month="${shift(1)}">${MONTHS[m % 12]} ›</button>
      </div>
      <div class="cal-grid" role="grid">
        ${DAYS.map((d) => html`<div class="cal-dow">${d}</div>`)}
        ${cells.map((d) => html`<div class="cal-day ${d.slice(0, 7) !== month ? "other" : ""} ${d === today ? "today" : ""}">
          <span class="cal-num">${Number(d.slice(8))}</span>${(byDay.get(d) ?? []).map(ev)}</div>`)}
      </div>
      <div class="cal-list">${monthEvents.length ? monthEvents.map((e) => html`<a class="cal-row ${e.kind}" href="${e.href}">
          <span class="cal-date">${new Date(e.when).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: SITE.timeZone })}<b>${fmtTime(e.when)}</b></span>
          <span><strong>${e.title}</strong><small>${e.sub}${e.venue ? ` · ${e.venue}` : ""}</small></span></a>`)
        : html`<div class="empty">No matches this month${teamId ? " for this team" : ""}.</div>`}</div>`);
    history.replaceState(null, "", `/calendar?${new URLSearchParams({ ...(teamId ? { team: teamId } : {}), month })}`);
  };

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Calendar"]])}
    <h1>Match calendar</h1>
    <div class="toolbar">
      <label style="font-weight:700">Show matches for
        <select data-team><option value="">All teams</option>${ctx.leagues.map((l) => html`<optgroup label="${l.name}">${ctx.teamsIn(l.id).map((t) => html`<option value="${t.id}" ${t.id === teamId ? "selected" : ""}>${t.name}</option>`)}</optgroup>`)}</select></label>
      <button class="btn small blue" data-ics>Add to my phone calendar (.ics)</button>
      <span class="cal-key"><i class="league"></i>League <i class="cup"></i>Cup</span>
    </div>
    <div data-cal></div>
  </div>`);
  draw();

  $("[data-team]", view).addEventListener("change", (e) => { teamId = e.target.value; draw(); });
  const onClick = (e) => {
    const mBtn = e.target.closest("[data-month]");
    if (mBtn) { month = mBtn.dataset.month; draw(); }
    if (e.target.closest("[data-ics]")) downloadIcs(events.filter((x) => (!teamId || x.teams.includes(teamId)) && Date.parse(x.when) > Date.now() - 864e5), teamId ? ctx.team.get(teamId)?.name : "All matches");
  };
  view.addEventListener("click", onClick);
  return () => view.removeEventListener("click", onClick);   // the page container is reused, so tidy up
}

/** Build and download an iCalendar file of the given events. */
function downloadIcs(events, label) {
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s) => String(s ?? "").replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//St Blazey Snooker//Fixtures//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(`${label} – ${SITE.name}`)}`];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@stblazey-snooker`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(e.when)}`, `DTEND:${stamp(new Date(Date.parse(e.when) + 3 * 3600e3).toISOString())}`,
      `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.sub)}`, ...(e.venue ? [`LOCATION:${esc(e.venue)}`] : []),
      `URL:${location.origin}${e.href}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  a.download = `${label.replace(/[^\w]+/g, "-").toLowerCase()}-fixtures.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
