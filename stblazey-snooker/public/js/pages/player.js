import { html, mount, $, fmtDate, paragraphs } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table, playerHistory, loadCompetitions, articles, settings } from "../core/api.js";
import { playerRankings, frameWinner, breakPoints, EXT_PER_SEASON } from "../core/rules.js";
import { answered } from "../core/cueview.js";
import { buildBracket, competitionStandings, inEntry } from "../core/bracket.js";
import { listItems } from "../core/list-field.js";
import { breadcrumb, panel, dataTable, avatar, teamLink, urls, gallery, articleCard, cueviewSection, handicapText, handicapMove, breakTag, notUpdatedTag, trophy } from "../core/components.js";
import { followButton } from "../core/my-snooker.js";
import { setTitle, navigate, adminEdit, sideContext } from "../core/router.js";
import { PLAYER_TAG } from "../core/terms.js";
import { lifeYears } from "./memoriam.js";
import { loadForm, formPanel, formBadge } from "../core/form.js";
import notFound from "./not-found.js";

export default async function player(view, { params, user }) {
  // The address is the player's short name (/player/sam-bolitho); the old long ids still work.
  const allPlayers = await table("players", "full_name");
  const p = allPlayers.find((x) => x.slug === params.id) ?? allPlayers.find((x) => x.id === params.id);
  if (!p) return notFound(view);
  if (p.slug && params.id !== p.slug) history.replaceState(null, "", `${urls.player(p)}${location.search}${location.hash}`);
  const [ctx, seasons, leagues, playerPast, comps, news, awards, site] = await Promise.all([
    seasonContext(), table("seasons", "name"), table("leagues", "sort"),
    playerHistory(p.id), loadCompetitions(), articles(), table("awards", "sort").catch(() => []), settings().catch(() => ({})),
  ]);
  // Form (Rich, round 25): a mark out of 10 from the last 6 matches this season.
  const form = await loadForm(ctx).then((f) => f.player(p.id)).catch(() => null);
  setTitle(p.full_name);
  adminEdit("players", p.id);
  sideContext({ player: p });

  const team = ctx.team.get(p.team_id);
  const league = team && ctx.league.get(team.league_id);
  const rank = league ? ctx.rankings(league.id).find((r) => r.player.id === p.id) : null;
  const fixtureById = new Map(playerPast.fixtures.map((f) => [f.id, f]));
  const teamName = (id) => ctx.team.get(id)?.name ?? "–";

  // One row per season + league, using the same maths as the rankings (rules.js).
  const groups = new Map();
  for (const fr of playerPast.frames) {
    const fx = fixtureById.get(fr.fixture_id);
    if (!fx) continue;
    const key = `${fx.season_id}|${fx.league_id}`;
    const g = groups.get(key) ?? groups.set(key, { season: seasons.find((s) => s.id === fx.season_id), league: leagues.find((l) => l.id === fx.league_id), fixtures: new Map(), frames: new Map() }).get(key);
    g.fixtures.set(fx.id, fx);
    (g.frames.get(fx.id) ?? g.frames.set(fx.id, []).get(fx.id)).push(fr);
  }
  const seasonRows = [...groups.values()].map((g) => {
    const [r] = playerRankings([p], [...g.fixtures.values()], g.frames, playerPast.breaks.filter((b) => g.fixtures.has(b.fixture_id)));
    const frames = [...g.frames.values()].flat();
    const side = (fr) => (fr.home_player_id === p.id ? "home" : "away");
    return {
      ...g, played: r?.played ?? 0, won: r?.won ?? 0, lost: r?.lost ?? 0, pts: r?.pts ?? 0, breakPts: r?.breakPts ?? 0,
      scored: frames.reduce((n, fr) => n + (Number(fr[`${side(fr)}_points`]) || 0), 0),
      best: Math.max(0, ...playerPast.breaks.filter((b) => g.fixtures.has(b.fixture_id)).map((b) => b.value)),
      team: teamName(frames[0] && fixtureById.get(frames[0].fixture_id)?.[`${side(frames[0])}_team_id`]),
    };
  }).sort((a, b) => (b.season?.name ?? "").localeCompare(a.season?.name ?? ""));
  const total = seasonRows.reduce((t, r) => ({ played: t.played + r.played, won: t.won + r.won, lost: t.lost + r.lost, pts: t.pts + r.pts, scored: t.scored + r.scored, best: Math.max(t.best, r.best) }), { played: 0, won: 0, lost: 0, pts: 0, scored: 0, best: 0 });
  const pct = (w, n) => (n ? `${Math.round((w / n) * 100)}%` : "–");

  // Frame-by-frame history, newest first.
  const frameRows = playerPast.frames.map((fr) => ({ fr, fx: fixtureById.get(fr.fixture_id), side: fr.home_player_id === p.id ? "home" : "away" }))
    .filter((x) => x.fx).sort((a, b) => b.fx.starts_at.localeCompare(a.fx.starts_at) || a.fr.frame_no - b.fr.frame_no);
  const opp = (x) => ctx.player.get(x.fr[`${x.side === "home" ? "away" : "home"}_player_id`]) ?? allPlayers.find((q) => q.id === x.fr[`${x.side === "home" ? "away" : "home"}_player_id`]);

  // Knockout competitions this player entered.
  const myComps = comps.entries.filter((e) => inEntry(e, p.id)).map((e) => {
    const c = comps.competitions.find((x) => x.id === e.competition_id);
    const b = buildBracket(comps.entries.filter((x) => x.competition_id === c.id), comps.matches.filter((m) => m.competition_id === c.id));
    return { c, standing: competitionStandings(b).find((r) => r.entry.id === e.id) };
  }).filter((x) => x.c);

  // Rich, round 46: the trophy cabinet — each competition this player has won, with its trophy and how many times
  // ("Singles ×5"). Wins come from the knockout draws on the website and from Presentation night (awards), so the
  // years before the website count too; the same competition in the same season is only counted once.
  const cabinet = new Map();
  const cleanName = (n) => String(n ?? "").replace(/\s*\b(19|20)\d{2}(\s*[-–\/]\s*(19|20)?\d{2})?\b/g, "").trim();
  const addWin = (name, seasonId, thing) => {
    const key = cleanName(name).toLowerCase(); if (!key) return;
    const row = cabinet.get(key) ?? cabinet.set(key, { name: cleanName(name), seasons: new Set(), thing: null }).get(key);
    row.seasons.add(seasonId ?? `${name}-${row.seasons.size}`);
    if (!row.thing?.trophy_url && thing?.trophy_url) row.thing = thing; else row.thing ??= thing;
  };
  for (const c of comps.competitions) {
    const mine = comps.entries.filter((x) => x.competition_id === c.id);
    if (!mine.some((e) => inEntry(e, p.id))) continue;
    const b = buildBracket(mine, comps.matches.filter((m) => m.competition_id === c.id));
    if (b.champion && inEntry(b.entryById.get(b.champion), p.id)) addWin(c.name, c.season_id, c);
  }
  for (const a of awards) if (a.winner_player_id === p.id) addWin(a.name, a.season_id, a.trophy_url ? a : comps.competitions.find((c) => c.id === a.competition_id) ?? a);
  const trophies = [...cabinet.values()].sort((x, y) => y.seasons.size - x.seasons.size || x.name.localeCompare(y.name));

  // Round 73 (Rich: "I love the WST feature for career stats and Triple Crown"): career stats, WST style —
  // titles, finals reached (won or runner-up), Triple Crown titles, highest break and centuries.
  const finals = new Set([...cabinet.values()].flatMap((t) => [...t.seasons].map((sid) => `${t.name}|${sid}`)));
  for (const c of comps.competitions) {
    const mine = comps.entries.filter((x) => x.competition_id === c.id);
    if (!mine.some((e) => inEntry(e, p.id))) continue;
    const b = buildBracket(mine, comps.matches.filter((m) => m.competition_id === c.id));
    const me = competitionStandings(b).find((r) => inEntry(r.entry, p.id));
    if (me?.status === "Runner-up") finals.add(`${cleanName(c.name)}|${c.season_id}`);
  }
  for (const a of awards) if (a.runner_up_player_id === p.id) finals.add(`${cleanName(a.name)}|${a.season_id ?? a.id}`);
  const crownNames = listItems(site.triple_crown).slice(0, 3);
  const crownWins = (name) => cabinet.get(cleanName(name).toLowerCase())?.seasons.size ?? 0;
  const crownThing = (name) => cabinet.get(cleanName(name).toLowerCase())?.thing ?? comps.competitions.find((c) => cleanName(c.name).toLowerCase() === cleanName(name).toLowerCase()) ?? null;
  const careerStats = [
    ...(crownNames.length ? [["Triple Crown titles", crownNames.reduce((n, x) => n + crownWins(x), 0)]] : []),
    ["Titles", trophies.reduce((n, t) => n + t.seasons.size, 0)],
    ["Finals", finals.size],
    ["Highest break", Math.max(0, ...playerPast.breaks.map((b) => b.value)) || "–"],
    ["Centuries", playerPast.breaks.filter((b) => b.value >= 100).length],
    ["Frames won", seasonRows.reduce((n, r) => n + r.won, 0)],
  ];

  const age = p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date)) / 3.15576e10) : null;
  const teammates = allPlayers.filter((x) => x.team_id === p.team_id);
  const gone = p.status === "deceased", tag = PLAYER_TAG[p.status];
  // Past teams: worked out from results, plus anything typed in for the years before this website.
  const pastTeams = [...new Set([...seasonRows.map((r) => r.team).filter((t) => t && t !== "–" && t !== team?.name),
    ...listItems(p.past_teams)])];
  const bio = p.bio || p.cueview?.biography || "";
  const career = String(p.career_history ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const playerNews = news.filter((a) => (a.player_ids ?? []).includes(p.id));
  const extThisSeason = frameRows.filter((x) => x.fx.season_id === ctx.season?.id && x.fr[`${x.side}_ext`]).length;
  const cueview = answered(p);
  // Rich, round 49: the Seasons line as a sentence — "This is your 6th season, and you have been playing in the
  // St Blazey & District league for 10 years" — instead of a list of season names (the list is in the Season record below).
  const seasonsText = () => {
    const names = [...new Set(seasonRows.map((r) => r.season?.name).filter(Boolean))].sort();
    if (!names.length) return "";
    const yearOf = (n) => Number(String(n).match(/\d{4}/)?.[0]) || null;
    const n = names.length, first = yearOf(names[0]), last = yearOf(names.at(-1)), now = yearOf(ctx.season?.name);
    const ord = (k) => `${k}${k % 10 === 1 && k % 100 !== 11 ? "st" : k % 10 === 2 && k % 100 !== 12 ? "nd" : k % 10 === 3 && k % 100 !== 13 ? "rd" : "th"}`;
    const mine = user?.profile?.player_id === p.id, firstName = p.full_name.trim().split(/\s+/)[0];
    const who = mine ? "your" : `${firstName}'s`, they = mine ? "you have" : `${firstName} has`;
    const playingNow = !gone && names.at(-1) === ctx.season?.name;
    const span = (to) => (first && to ? to - first : 0);
    if (playingNow) {
      const years = span(now);
      if (n === 1) return `This is ${who} first season in the St Blazey & District league.`;
      return `This is ${who} ${ord(n)} season${years >= 1 ? `, and ${they} been playing in the St Blazey & District league for ${years} year${years > 1 ? "s" : ""}` : ""}.`;
    }
    const years = span(last) + 1;
    return `${n} season${n > 1 ? "s" : ""} in the St Blazey & District league${n > 1 && first && last ? `, from ${names[0]} to ${names.at(-1)}` : ` (${names[0]})`}${years > n ? ` — ${years} years in all` : ""}.`;
  };
  const facts = [
    ["Position", p.position],
    ["Handicap", html`${handicapText(p.handicap)}${handicapMove(p)}`],
    ...(gone || !form?.n ? [] : [["Form", html`<a href="#form" class="form-link">${formBadge(form, { trend: true })} <small>out of 10</small></a>`]]),
    [gone || p.status === "not_playing" ? "Team" : "Current team", team ? teamLink(team) : "–"],
    ...(pastTeams.length ? [["Past teams", pastTeams.join(", ")]] : []),
    ["League", league ? html`<a href="${urls.standings(league)}">${league.name}</a>` : "–"],
    ...(myComps.length ? [["Competitions", myComps.map((x) => x.c.name).join(", ")]] : []),
    ["Seasons", seasonsText() || notUpdatedTag()],
    ...(p.cueview?.hand ? [["Left or right handed", p.cueview.hand]] : []),
    ...(gone || p.status === "not_playing" ? [] : [["Extra (Ext) games this season", `${extThisSeason} of ${EXT_PER_SEASON}`]]),
    ...(gone ? (lifeYears(p) ? [["Years", lifeYears(p)]] : []) : p.birth_date ? [["Birthday", fmtDate(p.birth_date)], ["Age", age]] : []),
  ];

  mount(view, html`<div class="wrap stack">
    <div>
      ${breadcrumb([["Home", "/"], ["Our Players", team ? `/players?team=${team.slug}` : "/players"], [p.full_name]])}
      <div class="player-head">
        <h1>${rank && !gone ? html`<span class="rank-badge" title="${league.name} ranking">${rank.pos}</span>` : ""}${p.full_name}${tag && !gone ? html` <span class="status plain player-status">${tag}</span>` : ""}${gone ? "" : followButton("player", p.id, user)}</h1>
        <div class="toolbar" style="margin:0">
          <label style="font-weight:700">Team
            <select data-team-filter><option value="">All teams</option>${ctx.teams.map((t) => html`<option value="${t.id}" ${t.id === p.team_id ? "selected" : ""}>${t.name}</option>`)}</select></label>
          <label style="font-weight:700">Player
            <select data-player-filter>${teammates.map((x) => html`<option value="${x.id}" ${x.id === p.id ? "selected" : ""}>${x.full_name}</option>`)}</select></label>
        </div>
      </div>
    </div>

    ${gone ? html`<div class="mem-banner"><p class="mem-banner-h">Sadly no longer with us${lifeYears(p) ? html` <span>${lifeYears(p)}</span>` : ""}</p>
      ${p.memorial ? html`<p>${p.memorial}</p>` : html`<p>${p.full_name} is remembered by everyone in the league. Their record stays here.</p>`}
      <a href="/in-memoriam">Sadly no longer with us: remembering the league's players</a></div>` : ""}

    <div class="player-card ${gone ? "in-memory" : ""}">
      ${avatar(p, "player-photo")}
      <dl class="facts">${facts.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
    </div>

    ${!gone && form?.n ? formPanel(form, { name: p.full_name.split(" ")[0] }) : ""}

    <section class="career" aria-label="Career stats"><h3>Career stats</h3>
      <dl class="career-stats">${careerStats.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl></section>
    ${crownNames.length ? html`<section class="career crowns" aria-label="Triple Crowns"><h3>Triple Crowns</h3>
      <ul class="crown-list">${crownNames.map((name) => html`<li class="${crownWins(name) ? "won" : ""}"><span class="crown-badge">${trophy(crownThing(name) ?? { name }, "crown-trophy")}</span>
        <span class="crown-name">${name}</span><b class="crown-count">×${crownWins(name)}</b></li>`)}</ul></section>` : ""}

    ${trophies.length ? html`<section class="cabinet" aria-label="Trophies won"><h3>Trophy cabinet</h3>
      <ul>${trophies.map((t) => html`<li>${trophy(t.thing, "cab-trophy")}<span class="cab-name">${t.name}</span><b class="cab-count">×${t.seasons.size}</b></li>`)}</ul></section>` : ""}
    ${html`<div class="profile-grid">
      <section class="profile-box wide"><h3>Bio</h3>${bio ? html`<div class="prose">${paragraphs(bio)}</div>` : html`<p class="not-upd">Not updated yet</p>`}</section>
      ${career.length ? html`<section class="profile-box"><h3>Career history</h3><ul class="timeline">${career.map((line) => {
        const m = line.match(/^(\d{4}(?:\s*[–-]\s*\d{2,4})?)\s*[—–:-]\s*(.+)$/);
        return m ? html`<li><b>${m[1]}</b><span>${m[2]}</span></li>` : html`<li><span>${line}</span></li>`;
      })}</ul></section>` : ""}
      ${pastTeams.length ? html`<section class="profile-box"><h3>Past teams</h3><ul class="plain-list">${pastTeams.map((t) => {
        const known = ctx.teams.find((x) => x.name === t);
        return html`<li>${known ? teamLink(known) : t}</li>`;
      })}</ul></section>` : ""}
    </div>`}

    ${p.gallery?.length ? html`<section><h3 style="margin-top:0">Pictures</h3>${gallery(p.gallery)}</section>` : ""}

    ${cueviewSection(p.full_name, cueview.filter((q) => q.key !== "hand"))}
    ${cueview.filter((q) => q.key !== "hand").length ? "" : html`<section class="cv-empty" id="cueview"><span>CueView</span><b class="not-upd">Not updated yet</b></section>`}
    ${cueview.filter((q) => q.key !== "hand").length ? "" : html`<a class="cv-invite" href="/cueview?player=${p.slug || p.id}"><b>Is this you?</b>
      <span>${p.full_name.split(" ")[0]} has no CueView yet. Answer a few questions about your snooker and it goes on this page.</span><i>Send in your CueView →</i></a>`}

    ${total.played ? "" : html`<div class="stats-empty"><b>Stats</b><span class="not-upd">Not updated yet</span></div>`}
    <div class="stats" style="${total.played ? "" : "display:none"}">
      ${[["Frames played", total.played], ["Frames won", total.won], ["Win rate", pct(total.won, total.played)],
         ["Ranking points", total.pts], ["Highest break", total.best || "–"]].map(([l, n]) => html`<div class="stat"><b>${n}</b>${l}</div>`)}
    </div>

    ${panel("Season record", dataTable([
      { label: "Season", cell: (r) => r.season?.name ?? "–" },
      { label: "League", cell: (r) => r.league?.name ?? "–", cls: "hide-sm" },
      { label: "Team", cell: (r) => r.team, cls: "hide-sm" },
      { label: "Played", cell: (r) => r.played, cls: "num" },
      { label: "Won", cell: (r) => r.won, cls: "num" },
      { label: "Lost", cell: (r) => r.lost, cls: "num" },
      { label: "Win %", cell: (r) => pct(r.won, r.played), cls: "num" },
      { label: "Points scored", cell: (r) => r.scored, cls: "num hide-sm" },
      { label: "Best break", cell: (r) => breakTag(r.best), cls: "num" },
      { label: "Ranking pts", cell: (r) => r.pts, cls: "num strong" },
    ], seasonRows.length ? [...seasonRows, { total: true, season: { name: "Total" }, league: { name: "–" }, team: "–", ...total }] : [],
    { rowClass: (r) => (r.total ? "total-row" : ""), empty: "Not updated yet." }))}

    <div class="grid-2" style="gap:30px;align-items:start">
      <div id="breaks">${panel("Breaks", dataTable([
        { label: "Date", cell: (b) => { const fx = fixtureById.get(b.fixture_id) ?? ctx.fixture.get(b.fixture_id); return fx ? html`<a href="${urls.match(fx)}">${fmtDate(fx.starts_at)}</a>` : "–"; } },
        { label: "Break", cell: (b) => breakTag(b.value), cls: "num strong" },
        { label: "Points", cell: (b) => breakPoints(b.value) || "–", cls: "num" },
      ], [...playerPast.breaks].sort((a, b) => b.value - a.value), { empty: "Not updated yet." }))}</div>
      ${panel("Competitions", dataTable([
        { label: "Competition", cell: (x) => html`<a href="${urls.competition(x.c)}">${x.c.name}</a>` },
        { label: "Result", cell: (x) => x.standing?.status ?? "–" },
      ], myComps, { empty: "Not entered in any knockout competitions." }))}
    </div>

    ${panel("Frame history", dataTable([
      { label: "Date", cell: (x) => html`<a href="${urls.match(x.fx)}">${fmtDate(x.fx.starts_at)}</a>` },
      { label: "Match", cell: (x) => `${teamName(x.fx.home_team_id)} vs ${teamName(x.fx.away_team_id)}`, cls: "hide-sm" },
      { label: "Frame", cell: (x) => x.fr.frame_no, cls: "num" },
      { label: "Opponent", cell: (x) => { const o = opp(x); return o ? html`<a href="${urls.player(o)}">${o.full_name}</a>` : "–"; } },
      { label: "", cell: (x) => (x.fr[`${x.side}_ext`] ? html`<span class="ext-tag" title="Played as the extra player">Ext</span>` : ""), cls: "num" },
      { label: "Score", cell: (x) => `${x.fr[`${x.side}_points`] ?? "–"} - ${x.fr[`${x.side === "home" ? "away" : "home"}_points`] ?? "–"}`, cls: "num" },
      { label: "Result", cell: (x) => { const w = frameWinner(x.fr); return w ? html`<span class="status ${w === x.side ? "approved" : "in_progress"}">${w === x.side ? "Won" : "Lost"}</span>` : "–"; } },
    ], frameRows, { empty: "Not updated yet." }))}

    <section id="news"><h3 style="margin-top:0">Player news</h3>
      ${playerNews.length ? html`<div class="cards">${playerNews.map(articleCard)}</div>` : html`<div class="empty box">No news about ${p.full_name} yet.</div>`}</section>
  </div>`);

  // Filters: pick a team to list its players, pick a player to open their page.
  $("[data-team-filter]").addEventListener("change", (e) => {
    const list = allPlayers.filter((x) => !e.target.value || x.team_id === e.target.value);
    mount($("[data-player-filter]"), html`<option value="">Choose a player…</option>${list.map((x) => html`<option value="${x.id}">${x.full_name}</option>`)}`);
  });
  $("[data-player-filter]").addEventListener("change", (e) => { if (e.target.value) navigate(`/player/${e.target.value}`); });
}
