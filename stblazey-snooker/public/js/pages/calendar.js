// The calendar: the whole season as one list, month by month, with a strip of months along
// the top to jump between them (it follows the page as you scroll). Each line has what it is,
// when and where, and buttons to go further. Filter by team; download an .ics file so players
// can add their matches to their phone. Key dates (Admin → Key dates) and bye weeks are in it too.
import { html, mount, $, fmtTime, ukDay, todayUK } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadCompetitions, table } from "../core/api.js";
import { buildBracket, isEntry, roundName } from "../core/bracket.js";
import { addDays } from "../core/schedule.js";
import { breadcrumb, urls } from "../core/components.js";
import { SITE } from "../config.js";
import { setTitle, adminEdit } from "../core/router.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function calendar(view, { query }) {
  setTitle("Calendar");
  adminEdit("fixtures");
  const [ctx, compData, venues, keyDates] = await Promise.all([seasonContext(), loadCompetitions(), table("venues", "name"), table("key_dates", "starts_on").catch(() => [])]);
  let teamId = query.get("team") ?? "";
  let month = (query.get("month") ?? todayUK().slice(0, 7));

  // Every event: league fixtures plus cup matches with a date.
  const events = [
    ...ctx.fixtures.map((f) => ({
      id: f.id, when: f.starts_at, href: urls.match(f), kind: "league", status: f.status,
      score: ctx.hasResult(f) ? `${ctx.scoreOf(f).home} - ${ctx.scoreOf(f).away}` : "", venueHref: ctx.venue.get(f.venue_id) ? urls.venue(ctx.venue.get(f.venue_id)) : "",
      title: `${ctx.team.get(f.home_team_id)?.name} v ${ctx.team.get(f.away_team_id)?.name}`,
      sub: ctx.league.get(f.league_id)?.name ?? "", teams: [f.home_team_id, f.away_team_id], venue: ctx.venue.get(f.venue_id)?.name,
    })),
    ...compData.competitions.flatMap((c) => {
      const b = buildBracket(compData.entries.filter((e) => e.competition_id === c.id), compData.matches.filter((m) => m.competition_id === c.id));
      return b.rounds.flat().filter((m) => !m.isBye && m.row.starts_at).map((m) => {
        const e = (id) => (isEntry(id) ? b.entryById.get(id) : null);
        const team = (x) => x?.team_id ?? ctx.player.get(x?.player_id)?.team_id;
        return {
          id: m.row.id, when: m.row.starts_at, href: `/cup-match/${m.row.no ?? m.row.id}`, kind: "cup", status: m.row.status,
          score: m.row.score_a != null ? `${m.row.score_a} - ${m.row.score_b}` : "", more: ["The competition", urls.competition(c)],
          title: `${e(m.a)?.name ?? "TBC"} v ${e(m.b)?.name ?? "TBC"}`, sub: `${c.name} · ${roundName(m.round, b.totalRounds)}`,
          teams: [team(e(m.a)), team(e(m.b))].filter(Boolean), venue: venues.find((v) => v.id === m.row.venue_id)?.name,
        };
      });
    }),
    ...keyDates.filter((d) => d.is_active !== false).map((d) => {
      const comp = compData.competitions.find((c) => c.id === d.competition_id);
      return { id: d.id, when: `${d.starts_on}T00:00:00.000Z`, day: d.starts_on, until: d.ends_on && d.ends_on > d.starts_on ? d.ends_on : null, allDay: true, kind: "key", status: "",
        href: d.url || (comp ? urls.competition(comp) : "/calendar"), title: d.title, sub: [d.details, comp?.name].filter(Boolean).join(" · "), teams: [] };
    }),
    // Bye weeks: an all-day note on the night a team sits out.
    ...(ctx.byes ?? []).map((b) => {
      const t = ctx.team.get(b.team_id);
      return { id: b.id, when: `${b.bye_on}T00:00:00.000Z`, day: b.bye_on, allDay: true, kind: "bye", status: "",
        href: t ? urls.team(t) : "/fixtures", title: `${t?.name ?? "A team"}: bye week`, sub: ctx.league.get(b.league_id)?.name ?? "", teams: [b.team_id] };
    }),
  ].filter((e) => e.status !== "postponed").sort((a, b) => a.when.localeCompare(b.when));
  const dayOf = (e) => e.day ?? ukDay(e.when);
  const shown = (e) => !teamId || (e.allDay && e.kind !== "bye") || e.teams.includes(teamId);
  const noon = (day) => new Date(`${day}T12:00:00Z`);
  const part = (day, opts) => noon(day).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
  const today = todayUK();
  // The months the season covers (first event to last), so the strip always shows the whole season.
  const first = (events[0] ? dayOf(events[0]) : today).slice(0, 7), last = (events.at(-1) ? dayOf(events.at(-1)) : today).slice(0, 7);
  const months = [];
  for (let d = new Date(`${first < today.slice(0, 7) ? first : today.slice(0, 7)}-01T12:00:00Z`); d.toISOString().slice(0, 7) <= (last > today.slice(0, 7) ? last : today.slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1)) months.push(d.toISOString().slice(0, 7));
  if (!months.includes(month)) month = months.includes(today.slice(0, 7)) ? today.slice(0, 7) : months[0];
  const calIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2Zm12 8H5v10h14Z"/></svg>`;
  const pinIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/></svg>`;

  // One line of the list: what it is, when and where, and the buttons to go further.
  const item = (e) => {
    const done = ["submitted", "approved", "completed"].includes(e.status), live = e.status === "in_progress";
    const tag = { league: e.sub, cup: e.sub, key: "Key date", bye: "Bye week" }[e.kind];
    return html`<article class="cal-item ${e.kind} ${live ? "live" : ""}">
      <div class="cal-main">
        <small class="cal-tag">${tag}${live ? html` <span class="live-dot">Live</span>` : ""}</small>
        <h3><a href="${e.href}">${e.title}</a></h3>
        <p class="cal-when">${calIcon}<span>${e.allDay ? (e.until ? `${part(e.day, { weekday: "short", day: "numeric", month: "short" })} – ${part(e.until, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}` : e.kind === "bye" ? "No match this week" : "All day")
          : html`<b>${fmtTime(e.when)}</b>`}${e.score ? html` <span class="res-score done">${e.score}</span>` : ""}</span></p>
        ${e.venue ? html`<p class="cal-where">${pinIcon}<span>${e.venue}</span></p>` : e.kind === "key" && e.sub ? html`<p class="cal-where"><span>${e.sub}</span></p>` : ""}
      </div>
      <div class="cal-btns">
        ${e.kind === "league" || e.kind === "cup" ? html`<a class="cal-btn" href="${e.href}">${live ? "Follow it live" : done ? "Result & scorecard" : "Match preview"}</a>` : ""}
        ${e.more ? html`<a class="cal-btn" href="${e.more[1]}">${e.more[0]}</a>` : ""}
        ${e.venueHref ? html`<a class="cal-btn" href="${e.venueHref}">Venue</a>` : ""}
        ${e.kind === "key" && e.href !== "/calendar" ? html`<a class="cal-btn" href="${e.href}" ${/^https?:/.test(e.href) ? html`target="_blank" rel="noopener"` : ""}>More</a>` : ""}
      </div></article>`;
  };

  const draw = () => {
    const mine = events.filter(shown);
    const byMonth = new Map(months.map((m) => [m, new Map()]));
    for (const e of mine) { const d = dayOf(e), days = byMonth.get(d.slice(0, 7)); if (days) (days.get(d) ?? days.set(d, []).get(d)).push(e); }
    mount($("[data-cal]", view), html`${months.map((m) => { const days = [...byMonth.get(m)];
      return html`<section class="cal-month" id="month-${m}" data-month-section="${m}">
        <h2>${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</h2>
        ${days.length ? days.map(([d, list]) => html`<div class="cal-day-group ${d === today ? "today" : d < today ? "past" : ""}">
          <time class="cal-tile" datetime="${d}"><small>${part(d, { weekday: "short" })}</small><b>${Number(d.slice(8))}</b><span>${part(d, { month: "short" })}</span></time>
          <div class="cal-items">${list.map(item)}</div></div>`)
        : html`<div class="empty box">Nothing in ${MONTHS[Number(m.slice(5)) - 1]}${teamId ? " for this team" : ""}.</div>`}
      </section>`; })}`);
    strip();
  };
  const strip = () => mount($("[data-months]", view), html`${months.map((m) => html`<button type="button" class="${m === month ? "on" : ""}" data-month="${m}">
    <b>${MONTHS[Number(m.slice(5)) - 1].slice(0, 3)}</b><span>${m.slice(0, 4)}</span></button>`)}`);
  const go = (m, smooth = true) => {
    month = m; strip();
    document.getElementById(`month-${m}`)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    $("[data-months] .on", view)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    history.replaceState(null, "", `/calendar?${new URLSearchParams({ ...(teamId ? { team: teamId } : {}), month })}`);
  };

  mount(view, html`<div class="wrap cal">
    ${breadcrumb([["Home", "/"], ["Calendar"]])}
    <h1>Calendar ${ctx.season?.name ?? ""}</h1>
    <div class="cal-top">
      <label class="cal-team"><span class="sr-only">Show matches for</span>
        <select data-team><option value="">All teams</option>${ctx.leagues.map((l) => html`<optgroup label="${l.name}">${ctx.teamsIn(l.id).map((t) => html`<option value="${t.id}" ${t.id === teamId ? "selected" : ""}>${t.name}</option>`)}</optgroup>`)}</select></label>
      <button type="button" class="cal-arrow" data-step="-1" aria-label="Earlier month">‹</button>
      <div class="cal-months" data-months></div>
      <button type="button" class="cal-arrow" data-step="1" aria-label="Later month">›</button>
    </div>
    <div class="cal-tools">
      <span class="cal-key"><i class="league"></i>League <i class="cup"></i>Cup${keyDates.length ? html` <i class="key"></i>Key date` : ""}${ctx.byes?.length ? html` <i class="bye"></i>Bye week` : ""}</span>
      <button class="btn small blue" data-ics>Add to my phone calendar (.ics)</button>
    </div>
    <div data-cal></div>
  </div>`);
  draw();
  // Open on the month asked for (or this month), without the page jumping about.
  if (month !== months[0]) setTimeout(() => go(month, false), 0);

  $("[data-team]", view).addEventListener("change", (e) => { teamId = e.target.value; draw(); go(month, false); });
  const onClick = (e) => {
    const mBtn = e.target.closest("[data-month]");
    if (mBtn) return go(mBtn.dataset.month);
    const step = e.target.closest("[data-step]");
    if (step) { const next = months[months.indexOf(month) + Number(step.dataset.step)]; if (next) go(next); return; }
    if (e.target.closest("[data-ics]")) downloadIcs(events.filter((x) => shown(x) && Date.parse(x.when) > Date.now() - 864e5), teamId ? ctx.team.get(teamId)?.name : "All matches");
  };
  view.addEventListener("click", onClick);
  // As the page scrolls, the strip follows the month on screen.
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { ticking = false;
      const line = ($(".cal-top", view)?.getBoundingClientRect().bottom ?? 0) + 60;   // just under the strip of months
      const on = [...view.querySelectorAll("[data-month-section]")].filter((sec) => sec.getBoundingClientRect().top <= line).at(-1)?.dataset.monthSection;
      if (on && on !== month) { month = on; strip(); $("[data-months] .on", view)?.scrollIntoView({ block: "nearest", inline: "center" }); }
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => { view.removeEventListener("click", onClick); window.removeEventListener("scroll", onScroll); };   // the page container is reused, so tidy up
}

/** Build and download an iCalendar file of the given events. */
function downloadIcs(events, label) {
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s) => String(s ?? "").replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//St Blazey Snooker//Fixtures//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(`${label} – ${SITE.name}`)}`];
  const dayStamp = (day, add = 0) => addDays(day, add).replace(/-/g, "");
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@stblazey-snooker`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      // Key dates are all-day entries (the end day is the day after the last one, as calendars expect).
      ...(e.allDay ? [`DTSTART;VALUE=DATE:${dayStamp(e.day)}`, `DTEND;VALUE=DATE:${dayStamp(e.until ?? e.day, 1)}`]
        : [`DTSTART:${stamp(e.when)}`, `DTEND:${stamp(new Date(Date.parse(e.when) + 3 * 3600e3).toISOString())}`]),
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
