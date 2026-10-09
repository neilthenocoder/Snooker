// ─────────────────────────────────────────────────────────────
//  MY SNOOKER — a logged-in person's own view of the league: the
//  teams and players they follow, in the sections they chose.
//  The same view is used on their own page (/myteam) and, if they
//  ask for it, at the top of the home page.
//  What they chose is in profiles.my_prefs (see myPrefs() in auth.js);
//  it is changed under My area → My Snooker, or with a Follow button.
// ─────────────────────────────────────────────────────────────
import { html, mount, fmtDate, fmtTime } from "./dom.js";
import { seasonContext } from "./context.js";
import { articles, loadCompetitions, setMyPrefs } from "./api.js";
import { myPrefs, mySnookerOn, refreshUser } from "./auth.js";
import { buildBracket, isEntry, roundName } from "./bracket.js";
import { answered } from "./cueview.js";
import { panel, dataTable, leagueTablePanel, playerLink, handicapTag, urls, badge, avatar, resultText, articleThumb, picture, outcomeTag } from "./components.js";
import { refreshShell } from "./router.js";

/** Every section someone can have on their page: [key, name, what it shows]. This is also the order they appear in. */
export const SECTIONS = [
  ["next", "Next match", "When and where your team plays next"],
  ["team", "Team summary", "League position, played, won, points and the last five results"],
  ["results", "Results", "Every game played, each with its frame-by-frame page"],
  ["fixtures", "Fixtures", "The matches to come, with bye weeks"],
  ["comps", "Competitions", "Cup matches for the teams and players you follow"],
  ["team_news", "Team news", "Articles about your teams and players"],
  ["news", "Latest news", "The newest articles — all of them, or only the categories you choose"],
  ["handicaps", "Team & handicaps", "The team's players, their handicaps and ranking points"],
  ["players", "Players I follow", "Handicap, frames, ranking points and best break of each player you follow"],
  ["breaks", "Breaks", "Your team's breaks of 30 or more"],
  ["table", "League table", "The table, with your team picked out"],
  ["rankings", "Rankings", "The top of the league's player rankings"],
  ["cueviews", "CueViews", "CueViews of the players you follow and your team's players"],
];
const MAIN = ["next", "team", "results", "fixtures", "comps", "team_news", "news"];   // the wide column; the rest sit beside it

const star = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9Z"/></svg>`;

// ── Follow buttons (team and player pages) ─────────────────────
/** A "Follow" / "Following" button. kind = "team" | "player". Clicks are handled once, in main.js (toggleFollow). */
export function followButton(kind, id, user) {
  const on = !!user?.profile && myPrefs(user)[`${kind}s`].includes(id);
  return html`<button type="button" class="follow-btn ${on ? "on" : ""}" data-follow="${kind}:${id}" aria-pressed="${on ? "true" : "false"}"
    title="${on ? "On your My Snooker page — press to stop following" : "Add to your My Snooker page"}">${star}<span>${on ? "Following" : "Follow"}</span></button>`;
}
/** The shape set_my_prefs() expects (sections are left out when they have every section). */
export const prefsToSave = (p) => ({ place: p.place, teams: p.teams, players: p.players, cats: p.cats, ...(p.sections ? { sections: p.sections } : {}) });
/** Add or remove one team or player from what this login follows. Returns true if they follow it now. */
export async function toggleFollow(user, kind, id) {
  const p = myPrefs(user), key = `${kind}s`;
  const now = !p[key].includes(id);
  p[key] = now ? [...p[key], id] : p[key].filter((x) => x !== id);
  await setMyPrefs(true, prefsToSave(p));
  await refreshUser(); await refreshShell();
  return now;
}

// ── the view ───────────────────────────────────────────────────
/** Everything the view needs, loaded once. */
export async function mySnookerData() {
  const [ctx, news, comps] = await Promise.all([seasonContext(), articles().catch(() => []), loadCompetitions().catch(() => ({ competitions: [], entries: [], matches: [] }))]);
  return { ctx, news, comps };
}

/**
 * Draw someone's My Snooker into `el`. With more than one team followed there is a row of
 * team buttons; pressing one redraws the team sections for that team.
 * options: home = true for the shorter version at the top of the home page.
 * Returns a function that stops it listening.
 */
export async function mountMySnooker(el, user, { home = false, data = null } = {}) {
  const d = data ?? await mySnookerData();
  const { ctx } = d;
  const prefs = myPrefs(user);
  const teams = prefs.teams.map((id) => ctx.team.get(id)).filter(Boolean);
  let teamId = teams[0]?.id ?? null;
  const draw = () => mount(el, view(user, d, prefs, teams, teamId, home));
  draw();
  const onClick = (e) => {
    const btn = e.target.closest("[data-ms-team]");
    if (!btn) return;
    teamId = btn.dataset.msTeam; draw();
  };
  el.addEventListener("click", onClick);
  return () => el.removeEventListener("click", onClick);
}

function view(user, { ctx, news, comps }, prefs, teams, teamId, home) {
  const wants = (key) => !prefs.sections || prefs.sections.includes(key);
  const team = ctx.team.get(teamId);
  const league = team && ctx.league.get(team.league_id);
  const limit = home ? 5 : Infinity;                       // the home page shows the top of each list
  const more = home ? { href: "/myteam", label: "See it all on my page" } : null;
  const followed = prefs.players.map((id) => ctx.player.get(id)).filter(Boolean);

  // The chosen team's numbers.
  const fixtures = team ? ctx.fixturesFor(team.id) : [];
  const played = fixtures.filter((f) => ctx.hasResult(f) && f.status !== "in_progress").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const toCome = fixtures.filter((f) => !ctx.hasResult(f) || f.status === "in_progress");
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...toCome, ...(team ? ctx.byesFor(team.id) : []).filter((b) => b.bye_on >= today).map((b) => ({ ...b, bye: true, starts_at: `${b.bye_on}T12:00:00Z` }))]
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  const next = toCome.find((f) => f.status === "in_progress" || (f.status === "scheduled" && Date.parse(f.starts_at) > Date.now() - 6 * 36e5)) ?? toCome.find((f) => f.status === "scheduled");
  const opp = (f) => ctx.team.get(f.home_team_id === team.id ? f.away_team_id : f.home_team_id);
  const row = league ? ctx.standings(league.id).find((r) => r.team.id === team.id) : null;
  const squad = team ? ctx.playersOf(team.id) : [];
  const squadIds = new Set(squad.map((p) => p.id));
  const teamBreaks = (league ? ctx.breaksIn(league.id) : []).filter((b) => squadIds.has(b.player_id));
  // Any player's season line, whichever league their team is in.
  const lineOf = (p) => { const t = ctx.team.get(p.team_id); return t ? ctx.rankings(t.league_id).find((r) => r.player.id === p.id) : null; };
  const bestOf = (p) => { const t = ctx.team.get(p.team_id); return t ? ctx.breaksIn(t.league_id).find((b) => b.player_id === p.id)?.value : null; };
  const result = (f) => { const s = ctx.scoreOf(f), us = f.home_team_id === team.id ? s.home : s.away, them = f.home_team_id === team.id ? s.away : s.home; return { us, them, won: us > them, lost: us < them }; };
  const form = played.slice(0, 5).map((f) => ({ f, ...result(f) }));

  // Cup matches for the teams and players they follow.
  const allTeamIds = new Set(teams.map((t) => t.id)), followIds = new Set(followed.map((p) => p.id));
  const mine = (e) => e && (allTeamIds.has(e.team_id) || followIds.has(e.player_id) || allTeamIds.has(ctx.player.get(e.player_id)?.team_id));
  const cup = !wants("comps") ? [] : comps.competitions.filter((c) => !c.season_id || c.season_id === ctx.season?.id).flatMap((c) => {
    const b = buildBracket(comps.entries.filter((e) => e.competition_id === c.id), comps.matches.filter((m) => m.competition_id === c.id));
    return b.rounds.flat().filter((m) => !m.isBye && (mine(b.entryById.get(m.a)) || mine(b.entryById.get(m.b)))).map((m) => ({ c, b, m }));
  }).sort((x, y) => String(x.m.row.starts_at ?? "9").localeCompare(String(y.m.row.starts_at ?? "9")));
  const cupName = (b, id) => (isEntry(id) ? b.entryById.get(id).name : "To be decided");

  // News: about their teams and players, and the latest (all, or only the categories they chose).
  const aboutIds = new Set([...followIds, ...teams.flatMap((t) => ctx.playersOf(t.id).map((p) => p.id))]);
  const names = teams.map((t) => t.name.toLowerCase());
  const teamNews = news.filter((a) => (a.player_ids ?? []).some((id) => aboutIds.has(id)) || names.some((n) => `${a.title} ${a.excerpt ?? ""}`.toLowerCase().includes(n)));
  const inCats = (a) => !prefs.cats.length || [a.category, ...(a.more_categories ?? [])].some((c) => prefs.cats.includes(c));
  const latest = news.filter(inCats);
  const newsRow = (a) => html`<a class="ms-news" href="${urls.article(a)}">${picture(articleThumb(a), "", "ms-news-pic")}
    <span><small>${a.category} · ${fmtDate(a.published_at)}</small><strong>${a.title}</strong></span></a>`;
  // CueViews: followed players first, then the team's own.
  const cvPeople = [...new Map([...followed, ...squad].map((p) => [p.id, p])).values()].filter((p) => answered(p).length);

  const parts = {
    next: () => (!team ? "" : next ? html`<a class="next-match ms-next" href="${urls.match(next)}">
        <div><small>${next.status === "in_progress" ? "On now" : "Next match"} · ${fmtDate(next.starts_at)} ${fmtTime(next.starts_at)}</small>
          <strong>${next.home_team_id === team.id ? "Home" : "Away"} v ${opp(next)?.name}</strong>
          <span>${ctx.venue.get(next.venue_id)?.name ?? ""}</span></div>
        <span class="btn green">${next.status === "in_progress" ? "Follow it live" : "Match preview"}</span></a>`
      : html`<div class="notice" style="margin:0">No more matches scheduled for ${team.name} this season.</div>`),
    team: () => (!team ? "" : html`<div class="stats">
        <div class="stat"><b>${row?.p ? row.pos : "–"}</b>League position</div>
        <div class="stat"><b>${row?.p ?? 0}</b>Played</div>
        <div class="stat"><b>${row?.w ?? 0}</b>Won</div>
        <div class="stat"><b>${row?.pts ?? 0}</b>Points</div>
      </div>
      ${form.length ? html`<div class="ms-form"><span>Last ${form.length === 1 ? "match" : form.length}</span>
        ${form.map((x) => html`<a href="${urls.match(x.f)}" class="${x.won ? "w" : "l"}" title="${x.us}–${x.them} v ${opp(x.f)?.name ?? ""}">${x.won ? "W" : "L"}</a>`)}</div>` : ""}`),
    results: () => (!team ? "" : panel("Results", dataTable([
        { label: "Date", cell: (f) => fmtDate(f.starts_at) },
        { label: "Match", cell: (f) => html`<a href="${urls.match(f)}">${ctx.team.get(f.home_team_id)?.name} vs ${ctx.team.get(f.away_team_id)?.name}</a>` },
        { label: "Result", cell: (f) => html`<span class="res-score done">${resultText(ctx, f)}</span>`, cls: "num" },
        { label: "", cell: (f) => { const r = result(f); return outcomeTag(r.won ? "won" : r.lost ? "lost" : "drawn"); }, cls: "num" },
      ], played.slice(0, limit), { empty: "No matches played yet this season." }), { foot: more && played.length > limit ? more : null })),
    fixtures: () => (!team ? "" : panel(`Fixtures${ctx.season?.name ? ` · ${ctx.season.name}` : ""}`, dataTable([
        { label: "Date", cell: (f) => fmtDate(f.starts_at) },
        { label: "Match", cell: (f) => (f.bye ? html`<span class="bye-row"><b>Bye week</b> no match</span>`
          : html`<a href="${urls.match(f)}"><span class="ms-ha ${f.home_team_id === team.id ? "h" : "a"}">${f.home_team_id === team.id ? "Home" : "Away"}</span> v ${opp(f)?.name ?? "–"}</a>`) },
        { label: "Time", cell: (f) => (f.bye ? "–" : f.status === "postponed" ? "Postponed" : f.status === "in_progress" ? html`<span class="live-dot">Live</span>` : fmtTime(f.starts_at)), cls: "num" },
        { label: "Venue", cell: (f) => { const v = !f.bye && ctx.venue.get(f.venue_id); return v ? html`<a href="${urls.venue(v)}">${v.name}</a>` : "–"; }, cls: "hide-sm" },
      ], upcoming.slice(0, limit), { rowClass: (f) => (f.bye ? "is-bye" : ""), empty: "No more fixtures this season." }),
      { foot: more && upcoming.length > limit ? more : { href: `/calendar?team=${team.id}`, label: "See these on the calendar" } })),
    comps: () => (cup.length ? panel("Competitions", dataTable([
        { label: "Date", cell: ({ m }) => (m.row.starts_at ? fmtDate(m.row.starts_at) : "TBC") },
        { label: "Competition", cell: ({ c, b, m }) => html`<a href="${urls.competition(c)}">${c.name}</a> <small class="muted">${roundName(m.round, b.totalRounds)}</small>` },
        { label: "Match", cell: ({ b, m }) => html`<a href="/cup-match/${m.row.no ?? m.row.id}">${cupName(b, m.a)} v ${cupName(b, m.b)}</a>` },
        { label: "Score", cell: ({ m }) => (m.row.score_a != null ? html`<span class="res-score done">${m.row.score_a} - ${m.row.score_b}</span>` : "–"), cls: "num" },
      ], cup.slice(0, home ? 4 : 30)), { foot: { href: "/competitions", label: "All competitions" } }) : ""),
    team_news: () => (teamNews.length ? panel("Team news", html`<div class="ms-news-list">${teamNews.slice(0, home ? 3 : 5).map(newsRow)}</div>`, { color: "blue" }) : ""),
    news: () => (latest.length ? panel(prefs.cats.length ? "News you follow" : "Latest news", html`<div class="ms-news-list">${latest.slice(0, home ? 3 : 5).map(newsRow)}</div>`,
      { color: "blue", foot: { href: "/news", label: "All the news" } }) : ""),
    handicaps: () => (!team ? "" : panel(`${team.name}: team & handicaps`, dataTable([
        { label: "Player", cell: (p) => html`${playerLink(p)}${p.position && p.position !== "Player" ? html` <small class="muted">${p.position}</small>` : ""}` },
        { label: "Handicap", cell: (p) => handicapTag(p.handicap), cls: "num" },
        { label: "Played", cell: (p) => lineOf(p)?.played ?? 0, cls: "num" },
        { label: "Won", cell: (p) => lineOf(p)?.won ?? 0, cls: "num" },
        { label: "Pts", cell: (p) => lineOf(p)?.pts ?? 0, cls: "num strong" },
      ], squad, { highlight: (p) => followIds.has(p.id), empty: "No players listed yet." }), { foot: { href: "/handicaps", label: "Every team's handicaps" } })),
    players: () => (followed.length ? panel("Players I follow", html`<div class="ms-players">${followed.map((p) => { const l = lineOf(p); return html`<a class="ms-player" href="${urls.player(p)}">
        ${avatar(p, "ms-player-photo")}<span><strong>${p.full_name}</strong><small>${ctx.team.get(p.team_id)?.name ?? "No team this season"}</small></span>
        <dl><div><dt>Hcp</dt><dd>${handicapTag(p.handicap)}</dd></div><div><dt>Played</dt><dd>${l?.played ?? 0}</dd></div><div><dt>Won</dt><dd>${l?.won ?? 0}</dd></div>
          <div><dt>Pts</dt><dd>${l?.pts ?? 0}</dd></div><div><dt>Best</dt><dd>${bestOf(p) ?? "–"}</dd></div></dl></a>`; })}</div>`) : ""),
    breaks: () => (!team ? "" : panel(`${team.name} breaks`, dataTable([
        { label: "Player", cell: (b) => playerLink(b.player) },
        { label: "Date", cell: (b) => html`<a href="${urls.match(b.fixture)}">${fmtDate(b.fixture.starts_at)}</a>` },
        { label: "Break", cell: (b) => b.value, cls: "num strong" },
      ], teamBreaks.slice(0, limit), { empty: "No breaks of 30 or more yet this season." }))),
    table: () => (league ? leagueTablePanel(ctx, league, { highlightTeamId: team.id, ...(home ? { limit: 6 } : {}) }) : ""),
    rankings: () => { if (!league) return ""; const rows = ctx.rankings(league.id).slice(0, home ? 5 : 10);
      return panel(`${league.short_name || league.name} rankings`, dataTable([
        { label: "", cell: (r) => r.pos, cls: "num" },
        { label: "Player", cell: (r) => playerLink(r.player) },
        { label: "Won", cell: (r) => r.won, cls: "num" },
        { label: "Pts", cell: (r) => r.pts, cls: "num strong" },
      ], rows, { highlight: (r) => squadIds.has(r.player.id) || followIds.has(r.player.id), empty: "No frames played yet." }),
      { foot: { href: urls.season(ctx.season, "rankings", league), label: "The full rankings" } }); },
    cueviews: () => (cvPeople.length ? panel("CueViews", html`<div class="ms-news-list">${cvPeople.slice(0, home ? 3 : 6).map((p) => html`<a class="ms-news" href="${urls.player(p)}#cueview">
        ${avatar(p, "ms-news-pic round")}<span><small>${ctx.team.get(p.team_id)?.name ?? ""}</small><strong>${p.full_name}</strong></span></a>`)}</div>`) : ""),
  };

  const shown = SECTIONS.map(([key]) => key).filter(wants);
  // Only the sections that have something to show (a section with nothing in it leaves no gap).
  const drawn = shown.map((k) => [k, parts[k]()]).filter(([, body]) => body);
  const col = (keys) => drawn.filter(([k]) => keys.includes(k)).map(([k, body]) => html`<section class="ms-sec ms-sec-${k}">${body}</section>`);
  const side = drawn.filter(([k]) => !MAIN.includes(k));
  return html`
    ${teams.length > 1 ? html`<nav class="ms-teams" aria-label="The teams you follow">${teams.map((t) => html`<button type="button" class="${t.id === teamId ? "on" : ""}" data-ms-team="${t.id}">${badge(t)}<span>${t.name}</span></button>`)}</nav>` : ""}
    ${!team && !followed.length ? html`<div class="notice" style="margin:0">You are not following a team or a player yet. <a href="/my/snooker" style="font-weight:700;color:var(--red)">Choose who to follow</a></div>` : ""}
    <div class="ms-grid ${side.length && drawn.length > side.length ? "" : "one"}">
      ${drawn.length > side.length ? html`<div class="stack">${col(MAIN)}</div>` : ""}
      ${side.length ? html`<div class="stack">${col(side.map(([k]) => k))}</div>` : ""}
    </div>`;
}

/** Is there anything of theirs to show? (Used by the home page before it makes room for the block.) */
export const hasMySnooker = (user) => mySnookerOn(user) && (myPrefs(user).teams.length + myPrefs(user).players.length > 0);
export { star as mySnookerStar };
