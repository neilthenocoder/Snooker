// ─────────────────────────────────────────────────────────────
//  THE SIDE COLUMN THAT FOLLOWS THE PAGE — used when Admin →
//  Branding → Page layout gives a part of the site a sidebar.
//  The boxes are chosen from what the page is about:
//    a competition  → its highest break, its breaks, its news, its dates
//    a team, a match, a league table, a player → that league only
//    the news pages → latest news and the categories
//    other competition pages → the competitions as a whole
//  Anything else gets the standard boxes (components.js: sidebar()).
// ─────────────────────────────────────────────────────────────
import { html, fmtDate } from "./dom.js";
import { loadCompetitions, competitionBreaks, table } from "./api.js";
import { buildBracket } from "./bracket.js";
import { cupResults } from "./context.js";
import { sidebar, panel, newsMini, topBreakPanel, dataTable, playerLink, leagueTablePanel, urls, outcomeTag } from "./components.js";

const breakList = (title, breaks) => (breaks.length > 1 ? panel(title, html`<div class="no-head">${dataTable([
  { label: "Player", cell: (x) => playerLink(x.player) },
  { label: "Break", cell: (x) => x.value, cls: "num strong" },
], breaks.slice(1, 7))}</div>`) : "");
const newsBox = (title, list, more = "/news") => (list.length ? panel(title, html`<div>${list.slice(0, 4).map(newsMini)}</div>`, { color: "blue", foot: { href: more, label: "More news" } }) : "");

/** Returns the sidebar for this page, or null for the standard one. */
export async function contextSidebar(ctx, news, box, { page, group, about }) {
  about = about ?? {};
  // ── one competition (its own pages, a cup match, its draw) ──
  if (about.competition || group === "competitions") {
    const data = await loadCompetitions();
    const players = ctx.players;
    const c = about.competition ? data.competitions.find((x) => x.id === about.competition.id) : null;
    const comps = c ? [c] : data.competitions.filter((x) => !x.season_id || x.season_id === ctx.season?.id);
    const ids = new Set(comps.map((x) => x.id));
    const matches = data.matches.filter((m) => ids.has(m.competition_id));
    const breaks = (await competitionBreaks(matches.map((m) => m.id)).catch(() => []))
      .map((b) => ({ ...b, player: players.find((p) => p.id === b.player_id), when: matches.find((m) => m.id === b.match_id)?.starts_at }))
      .filter((b) => b.player).sort((x, y) => y.value - x.value);
    const results = (await cupResults().catch(() => [])).filter((r) => (c ? r.title === c.name : true)).slice(0, 5);
    const dates = (await table("key_dates", "starts_on").catch(() => []))
      .filter((d) => d.is_active !== false && (d.ends_on || d.starts_on) >= new Date().toISOString().slice(0, 10) && (c ? d.competition_id === c.id : d.competition_id && ids.has(d.competition_id))).slice(0, 4);
    const name = c ? c.name : "Competitions";
    const champion = (x) => { const b = buildBracket(data.entries.filter((e) => e.competition_id === x.id), data.matches.filter((m) => m.competition_id === x.id)); return b.champion ? b.entryById.get(b.champion)?.name : null; };
    return html`<aside class="sidebar">
      ${topBreakPanel(`${name} Highest Break`, breaks[0])}
      ${breakList(`${name} Breaks`, breaks)}
      ${results.length ? panel(c ? "Latest results" : "Latest competition results", html`<div class="res-list">${results.map((r) => html`<a class="res-mini" href="${r.href}">
        <small>${r.when ? fmtDate(r.when) : ""}${c ? "" : ` · ${r.title}`}</small><span class="${r.won === "h" ? "won" : r.won ? "lost" : ""}">${r.home}</span><b>${r.score}</b><span class="${r.won === "a" ? "won" : r.won ? "lost" : ""}">${r.away}</span></a>`)}</div>`, { color: "blue" }) : ""}
      ${dates.length ? panel("Key dates", html`<div class="list-links">${dates.map((d) => html`<a href="${d.url || "/calendar"}"><b>${fmtDate(d.starts_on)}</b> ${d.title}</a>`)}</div>`, { color: "yellow" }) : ""}
      ${newsBox(c ? "Related news" : "Competition news", news.filter((a) => (c ? a.competition_id === c.id : a.competition_id && ids.has(a.competition_id))))}
      ${panel(c ? "Other competitions" : "This season's competitions", html`<div class="list-links">${data.competitions.filter((x) => x.id !== c?.id && (!x.season_id || x.season_id === ctx.season?.id))
        .map((x) => { const w = champion(x); return html`<a href="${urls.competition(x)}">${x.name}${w ? html` ${outcomeTag("won", `Winner: ${w}`)}` : ""}</a>`; })}</div>`)}
    </aside>`;
  }
  // ── the news pages ──
  if (group === "news") {
    const cats = [...new Set(news.map((a) => a.category).filter(Boolean))];
    return html`<aside class="sidebar">
      ${newsBox("Latest news", news)}
      ${cats.length ? panel("Categories", html`<div class="list-links">${cats.map((n) => html`<a href="/news?category=${encodeURIComponent(n)}">${n} <small class="muted">${news.filter((a) => a.category === n).length}</small></a>`)}</div>`) : ""}
      ${sidebar(ctx, news, { leagues: [], box })}
    </aside>`;
  }
  // ── a team, a match, a player, a league table: that league only ──
  const team = about.team ?? (about.player ? ctx.team.get(about.player.team_id) : null);
  const league = about.league ?? (team ? ctx.league.get(team.league_id) : null);
  if (league) {
    const mine = team ? news.filter((a) => (a.player_ids ?? []).some((id) => ctx.player.get(id)?.team_id === team.id) || a.title.toLowerCase().includes(team.name.toLowerCase())) : [];
    return sidebar(ctx, news, { leagues: [league], box,
      top: html`${page === "standings" ? "" : leagueTablePanel(ctx, league, { limit: 6, highlightTeamId: team?.id })}${newsBox(team ? `${team.name} news` : "", mine)}` });
  }
  return null;
}
