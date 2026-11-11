import { pastWinners, honoursOf, honoursBox } from "../core/past-winners.js";
import { html, mount, fmtDate, paragraphs } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table, playerHistory, loadCompetitions, articles, settings } from "../core/api.js";
import { playerRankings, frameWinner, breakPoints, EXT_PER_SEASON } from "../core/rules.js";
import { answered } from "../core/cueview.js";
import { buildBracket, competitionStandings, inEntry } from "../core/bracket.js";
import { listItems } from "../core/list-field.js";
import { breadcrumb, dataTable, avatar, badge, teamLink, urls, gallery, cueviewSection, handicapText, handicapMove, breakTag, notUpdatedTag, trophy } from "../core/components.js";
import { followButton } from "../core/my-snooker.js";
import { setTitle, adminEdit, sideContext } from "../core/router.js";
import { profileHero, heroLook, profileTabs, statTiles, profileSection, nextMatch, teamForm, matesGrid, newsRail, teamNewsOf, wireProfile } from "../core/profile.js";
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
  const [ctx, seasons, leagues, playerPast, comps, news, awards, site, pastWon] = await Promise.all([
    seasonContext(), table("seasons", "name"), table("leagues", "sort"),
    playerHistory(p.id), loadCompetitions(), articles(), table("awards", "sort").catch(() => []), settings().catch(() => ({})), pastWinners(),
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
  // Round 114: Past winners typed in by hand (Admin → Competitions → Past winners) count too.
  const myHonours = honoursOf(pastWon, { player: p });
  for (const h of myHonours) if (h.place === "Winner") addWin(h.title, `pw:${h.season}`, comps.competitions.find((c) => c.id === h.competition_id) ?? null);
  const trophies = [...cabinet.values()].sort((x, y) => y.seasons.size - x.seasons.size || x.name.localeCompare(y.name));

  // Round 73 (Rich): career stats and the Triple Crown —
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
  for (const h of myHonours) if (h.place === "Runner-up") finals.add(`${cleanName(h.title)}|pw:${h.season}`);
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

  // ── Round 116: the page laid out as Rich's mock-up (the same pieces as the team page — core/profile.js) ──
  const names = p.full_name.trim().split(/\s+/), surname = names.length > 1 ? names.pop() : "", first = names.join(" ");
  const squad = team ? ctx.playersOf(team.id) : [];
  const squadIds = new Set(squad.map((x) => x.id));
  // Player and team news: about this player first, then about their team-mates and their team.
  const teamNews = team ? teamNewsOf(news, team, squad).filter((a) => !playerNews.includes(a)) : [];
  const allNews = [...playerNews, ...teamNews];
  const hasCue = cueview.filter((q) => q.key !== "hand").length > 0;
  const initialsOf = (n) => String(n).replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const wonNames = new Set([...cabinet.keys()]);
  const compTile = myComps.length ? html`<span class="pp-comps">${myComps.map((x) => html`<a href="${urls.competition(x.c)}" class="${x.standing?.status === "Winner" || wonNames.has(cleanName(x.c.name).toLowerCase()) ? "is-won" : ""}" title="${x.c.name}${x.standing?.status ? ` — ${x.standing.status}` : ""}">${initialsOf(x.c.name)}</a>`)}</span>` : html`<b class="pp-mini__v">–</b>`;
  const minis = [
    ["Competitions", compTile, ""],     // not a link itself: each square inside it is one
    ...(gone ? [] : [["Form", html`<span class="pp-mini__form">${formBadge(form, { trend: true })}</span><small>out of 10</small>`, "#form"]]),
    ["League", html`<b class="pp-mini__v">${league ? league.short_name || league.name.replace(/ League$/i, "") : "–"}</b>`, league ? urls.standings(league) : ""],
    ...(gone || p.status === "not_playing" ? [] : [["Extra (Ext) games this season", html`<b class="pp-mini__v">${extThisSeason} of ${EXT_PER_SEASON}</b>`, ""]]),
  ];
  const about = [
    ...(pastTeams.length ? [["Past teams", pastTeams.join(", ")]] : []),
    ...(p.cueview?.hand ? [["Left or right handed", p.cueview.hand]] : []),
    ...(gone ? (lifeYears(p) ? [["Years", lifeYears(p)]] : []) : p.birth_date ? [["Birthday", fmtDate(p.birth_date)], ["Age", age]] : []),
  ];

  mount(view, html`<div class="wrap stack pp-page">
    <div>
      ${breadcrumb([["Home", "/"], ["Our Players", team ? `/players?team=${team.slug}` : "/players"], [p.full_name]])}
      ${profileHero({
        picture: avatar(p, "pp-hero__img"), small: surname ? first : "", big: surname || first, tone: gone ? "dark" : "",
        meta: [team ? html`<a class="pp-hero__team" href="${urls.team(team)}">${badge(team)}${team.name}</a>` : "",
          rank && !gone ? html`<span title="${league.name} ranking">Ranked <b>${rank.pos}</b></span>` : "",
          tag && !gone ? tag : p.position && p.position !== "Player" ? p.position.replace(/^Team /i, "") : ""],
        follow: gone ? "" : followButton("player", p.id, user), look: heroLook(team, site),
      })}
    </div>
    ${profileTabs([["Stats", "#stats"], team && !gone ? ["Fixtures", "#fixtures"] : null, squad.length > 1 ? ["Team", "#team"] : null, allNews.length ? ["News", "#news"] : null,
      ["Rankings", "#rankings"], ["Breaks", "#breaks"], ["Competitions", "#competitions"], ["CueView", "#cueview"], ["Frames", "#frames"], ["Career", "#career"]])}

    ${gone ? html`<div class="mem-banner"><p class="mem-banner-h">Sadly no longer with us${lifeYears(p) ? html` <span>${lifeYears(p)}</span>` : ""}</p>
      ${p.memorial ? html`<p>${p.memorial}</p>` : html`<p>${p.full_name} is remembered by everyone in the league. Their record stays here.</p>`}
      <a href="/in-memoriam">Sadly no longer with us: remembering the league's players</a></div>` : ""}

    <section class="pp-sec" id="stats"><div class="pp-sec__head"><h2>Player stats</h2></div>
      ${statTiles([["Handicap", html`${handicapText(p.handicap)}${handicapMove(p)}`], ["Frames played", total.played], ["Frames won", total.won],
        ["Win rate", pct(total.won, total.played)], ["Ranking points", total.pts], ["Highest break", total.best || "–"]])}
      <div class="pp-minis">${minis.map(([label, value, href]) => (href
        ? html`<a class="pp-mini" href="${href}" ${href.startsWith("#") ? html`data-pp-jump` : ""}><span>${label}</span>${value}</a>` : html`<div class="pp-mini"><span>${label}</span>${value}</div>`))}</div>
      <div class="pp-card pp-note"><span>Seasons</span><p>${seasonsText() || notUpdatedTag()}</p></div>
    </section>

    ${team && !gone ? profileSection("fixtures", "Next match", nextMatch(ctx, team.id)) : ""}
    ${team && !gone ? profileSection("team-form", "Team form", teamForm(ctx, team)) : ""}
    ${squad.length > 1 || (squad.length === 1 && !squadIds.has(p.id)) ? profileSection("team", "Team mates", matesGrid(squad, { skipId: p.id })) : ""}
    ${profileSection("news", team ? "Player and team news" : "Player news", newsRail(allNews))}

    <section class="pp-sec" id="cueview-sec"><div class="pp-sec__head"><h2>CueView</h2></div>
      ${hasCue ? cueviewSection(p.full_name, cueview.filter((q) => q.key !== "hand"))
        : html`<div class="pp-card pp-empty" id="cueview">${p.full_name.split(" ")[0]} has no CueView yet. <a href="/cueview?player=${p.slug || p.id}">Is this you? Send in your CueView →</a></div>`}
    </section>

    <section class="pp-sec" id="rankings"><div class="pp-sec__head"><h2>Season record</h2>${league ? html`<a class="sb-pill-link" href="${urls.standings(league)}#players">Full rankings</a>` : ""}</div>
    <div class="pp-card pp-tablecard">${dataTable([
      { label: "Season", cell: (r) => r.season?.name ?? "–" },
      { label: "League", cell: (r) => r.league?.name ?? "–", cls: "hide-sm" },
      { label: "Team", cell: (r) => r.team, cls: "hide-sm" },
      { label: "Played", cell: (r) => r.played, cls: "num" },
      { label: "Won", cell: (r) => r.won, cls: "num" },
      { label: "Lost", cell: (r) => r.lost, cls: "num" },
      { label: "Win %", cell: (r) => pct(r.won, r.played), cls: "num hide-sm" },
      { label: "Points scored", cell: (r) => r.scored, cls: "num hide-sm" },
      { label: "Best break", cell: (r) => breakTag(r.best), cls: "num" },
      { label: "Pts", cell: (r) => r.pts, cls: "num strong" },
    ], seasonRows.length ? [...seasonRows, { total: true, season: { name: "Total" }, league: { name: "–" }, team: "–", ...total }] : [],
    { rowClass: (r) => (r.total ? "total-row" : ""), empty: "Not updated yet." })}</div></section>

    <section class="pp-sec" id="breaks"><div class="pp-sec__head"><h2>Breaks</h2></div>
      <div class="pp-card pp-tablecard">${dataTable([
        { label: "Date", cell: (b) => { const fx = fixtureById.get(b.fixture_id) ?? ctx.fixture.get(b.fixture_id); return fx ? html`<a href="${urls.match(fx)}">${fmtDate(fx.starts_at)}</a>` : "–"; } },
        { label: "Break", cell: (b) => breakTag(b.value), cls: "num strong" },
        { label: "Points", cell: (b) => breakPoints(b.value) || "–", cls: "num" },
      ], [...playerPast.breaks].sort((a, b) => b.value - a.value), { empty: "No breaks of 30 or more yet.", phoneLimit: 8, more: "breaks" })}</div></section>

    <section class="pp-sec" id="competitions"><div class="pp-sec__head"><h2>Competitions</h2></div>
      <div class="pp-card pp-tablecard">${dataTable([
        { label: "Competition", cell: (x) => html`<a href="${urls.competition(x.c)}">${x.c.name}</a>` },
        { label: "Result", cell: (x) => x.standing?.status ?? "–" },
      ], myComps, { empty: "Not entered in any knockout competitions." })}</div></section>

    <section class="pp-sec" id="frames"><div class="pp-sec__head"><h2>Frame history</h2></div>
    <div class="pp-card pp-tablecard">${dataTable([
      { label: "Date", cell: (x) => html`<a href="${urls.match(x.fx)}">${fmtDate(x.fx.starts_at)}</a>` },
      { label: "Match", cell: (x) => `${teamName(x.fx.home_team_id)} vs ${teamName(x.fx.away_team_id)}`, cls: "hide-sm" },
      { label: "Frame", cell: (x) => x.fr.frame_no, cls: "num hide-sm" },
      { label: "Opponent", cell: (x) => { const o = opp(x); return o ? html`<a href="${urls.player(o)}">${o.full_name}</a>${x.fr[`${x.side}_ext`] ? html` <span class="ext-tag" title="Played as the extra player">Ext</span>` : ""}` : "–"; } },
      { label: "Score", cell: (x) => `${x.fr[`${x.side}_points`] ?? "–"} - ${x.fr[`${x.side === "home" ? "away" : "home"}_points`] ?? "–"}`, cls: "num" },
      { label: "Result", cell: (x) => { const w = frameWinner(x.fr); return w ? html`<span class="status ${w === x.side ? "approved" : "in_progress"}">${w === x.side ? "Won" : "Lost"}</span>` : "–"; } },
    ], frameRows, { empty: "Not updated yet.", phoneLimit: 12, more: "frames" })}</div></section>

    ${!gone && form?.n ? html`<section class="pp-sec"><div class="pp-sec__head"><h2>Form, match by match</h2></div>${formPanel(form, { name: p.full_name.split(" ")[0] })}</section>` : html`<span id="form"></span>`}

    <section class="pp-sec" id="career"><div class="pp-sec__head"><h2>Career</h2></div>
      ${statTiles(careerStats, "pp-stats--career")}
      ${crownNames.length ? html`<div class="pp-card"><h3 class="pp-h3">Triple Crowns</h3>
        <ul class="crown-list">${crownNames.map((name) => html`<li class="${crownWins(name) ? "won" : ""}"><span class="crown-badge">${trophy(crownThing(name) ?? { name }, "crown-trophy")}</span>
          <span class="crown-name">${name}</span><b class="crown-count">×${crownWins(name)}</b></li>`)}</ul></div>` : ""}
      ${trophies.length ? html`<div class="pp-card cabinet"><h3 class="pp-h3">Trophy cabinet</h3>
        <ul>${trophies.map((t) => html`<li>${trophy(t.thing, "cab-trophy")}<span class="cab-name">${t.name}</span><b class="cab-count">×${t.seasons.size}</b></li>`)}</ul></div>` : ""}
      ${myHonours.length ? honoursBox(myHonours) : ""}
      <div class="pp-card"><h3 class="pp-h3">Bio</h3>${bio ? html`<div class="prose">${paragraphs(bio)}</div>` : html`<p class="not-upd">Not updated yet</p>`}
        ${about.length ? html`<dl class="pp-about">${about.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>` : ""}</div>
      ${career.length ? html`<div class="pp-card"><h3 class="pp-h3">Career history</h3><ul class="pp-timeline">${career.map((line) => {
        const m = line.match(/^(\d{4}(?:\s*[–-]\s*\d{2,4})?)\s*[—–:-]\s*(.+)$/);
        return m ? html`<li><b>${m[1]}</b><span>${m[2]}</span></li>` : html`<li><span>${line}</span></li>`;
      })}</ul></div>` : ""}
      ${pastTeams.length ? html`<div class="pp-card"><h3 class="pp-h3">Past teams</h3><ul class="plain-list">${pastTeams.map((t) => {
        const known = ctx.teams.find((x) => x.name === t);
        return html`<li>${known ? teamLink(known) : t}</li>`;
      })}</ul></div>` : ""}
    </section>

    ${p.gallery?.length ? html`<section class="pp-sec"><div class="pp-sec__head"><h2>Pictures</h2></div>${gallery(p.gallery)}</section>` : ""}
  </div>`);
  wireProfile(view);
}
