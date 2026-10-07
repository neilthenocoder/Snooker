// /presentation  — presentation night: every award with its trophy, winner and runner-up
//                  (and their photos), as set under Admin → Presentation awards.
// /season-review — the season at a glance: the honours board, the numbers, each league's
//                  top three, and the competition winners. Worked out from the results.
import { html, mount, fmtDate } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { table, loadCompetitions } from "../core/api.js";
import { awardSide, awardTrophy, competitionFinal } from "../core/awards.js";
import { isCounted, matchScore, shieldHolder, shieldTable } from "../core/rules.js";
import { breadcrumb, trophy, urls, teamLink, playerLink, panel, dataTable, shortName, badge, seasonPicker } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function presentation(view, { query }) {
  const review = location.pathname.startsWith("/season-review");
  const [allAwards, seasons, data] = await Promise.all([table("awards", "sort").catch(() => []), table("seasons", "name"), loadCompetitions()]);
  // No season chosen: presentation night opens on the latest season that has awards.
  const withAwards = [...seasons].reverse().find((s) => allAwards.some((a) => a.season_id === s.id));
  const ctx = await seasonContext(query.get("season") || (review ? null : withAwards?.id));
  const season = ctx.season;
  const awards = allAwards.filter((a) => a.season_id === season?.id);
  const look = { players: ctx.player, teams: ctx.team };
  const comps = data.competitions.filter((c) => (c.season_id ?? seasons.find((s) => s.is_current)?.id) === season?.id);
  const q = query.get("season") ? `?season=${season.id}` : "";
  setTitle(`${review ? "Season review" : "Presentation night"} ${season?.name ?? ""}`);
  adminEdit("awards", null, { label: "Edit the awards" });
  view.classList.add("flush");

  const head = html`<section class="pres-hero"><div class="wrap">
      ${breadcrumb([["Home", "/"], ["Our League", "/league"], [review ? "Season review" : "Presentation night"]])}
      <div class="pres-hero-row"><div>
        <h1>${review ? "Season review" : "Presentation night"} <span>${season?.name ?? ""}</span></h1>
        <p>${review ? "The season at a glance: who won what, each league's top three and the numbers behind it."
          : "The league's trophies and the people who won them this season."}</p></div>
        ${seasons.length > 1 ? seasonPicker(ctx) : ""}</div>
      <nav class="pres-tabs"><a class="${review ? "" : "on"}" href="/presentation${q}">Trophies &amp; winners</a><a class="${review ? "on" : ""}" href="/season-review${q}">Season review</a></nav>
    </div></section>`;

  mount(view, html`${head}<div class="wrap stack pres-body">${review ? reviewBody(ctx, awards, comps, data, look) : awardsBody(ctx, awards, comps, look)}</div>`);
}

// ── presentation night ─────────────────────────────────────────
function face(who) {
  if (!who) return html`<span class="award-face blank" aria-hidden="true"></span>`;
  if (who.own) return html`<button type="button" class="award-face" data-lightbox="${who.own}" aria-label="Open the photo of ${who.name}"><img src="${who.own}" alt="" loading="lazy"></button>`;
  if (who.team) return html`<span class="award-face emblem">${badge(who.team)}</span>`;
  return html`<span class="award-face"><img src="${who.image || "/assets/avatar.svg"}" alt="" loading="lazy"></span>`;
}
const person = (who, label, cls) => html`<div class="award-who ${cls} ${who ? "" : "open"}">${face(who)}
  <div><small>${label}</small>${who ? (who.href ? html`<a href="${who.href}">${who.name}</a>` : html`<strong>${who.name}</strong>`) : html`<em>To be decided</em>`}
    ${who?.sub ? html`<span>${who.sub}</span>` : ""}</div></div>`;

function awardsBody(ctx, awards, comps, look) {
  if (!awards.length) {
    return html`<div class="empty box">The awards for ${ctx.season?.name ?? "this season"} haven't been announced yet.
      ${ctx.season?.is_current ? " They are presented at the end of the season." : ""} <a href="/season-review${ctx.season ? `?season=${ctx.season.id}` : ""}">See how the season is going</a></div>`;
  }
  return html`<div class="awards">${awards.map((a) => {
    const first = awardSide(a, "winner", look), second = awardSide(a, "runner_up", look);
    const comp = comps.find((c) => c.id === a.competition_id), league = ctx.league.get(a.league_id);
    const more = comp ? urls.competition(comp) : league ? `${urls.standings(league)}?season=${ctx.season.id}` : "";
    return html`<article class="award">
      <div class="award-cup">${trophy({ trophy_url: awardTrophy(a, ctx.leagues, comps), name: a.name })}</div>
      <div class="award-main">
        <h2>${more ? html`<a href="${more}">${a.name}</a>` : a.name}</h2>
        ${a.note ? html`<p class="award-note">${a.note}</p>` : ""}
        ${person(first, "Winner", "first")}
        ${second || !first ? person(second, "Runner-up", "second") : ""}
      </div></article>`;
  })}</div>`;
}

// ── season review ──────────────────────────────────────────────
function reviewBody(ctx, awards, comps, data, look) {
  const counted = ctx.fixtures.filter(isCounted);
  const scores = counted.map((f) => matchScore(ctx.framesByFixture.get(f.id)));
  const breaks = ctx.leagues.flatMap((l) => ctx.breaksIn(l.id));
  const best = [...breaks].sort((a, b) => b.value - a.value)[0];
  const played = new Set(counted.flatMap((f) => (ctx.framesByFixture.get(f.id) ?? []).flatMap((fr) => [fr.home_player_id, fr.away_player_id])).filter(Boolean));
  const numbers = [
    ["Matches played", counted.length], ["Frames played", scores.reduce((n, s) => n + s.framesPlayed, 0)],
    ...(played.size ? [["Players who took part", played.size]] : []), ["Breaks of 30 or more", breaks.filter((b) => b.value >= 30).length],
    ["Highest break", best ? best.value : "–"], ["Whitewashes", scores.filter((s) => s.framesPlayed >= 3 && (s.home === 0 || s.away === 0)).length],
  ];
  const decided = awards.map((a) => ({ a, who: awardSide(a, "winner", look) })).filter((x) => x.who);
  const cups = comps.map((c) => ({ c, final: competitionFinal(c, data) }));
  const live = ctx.season?.is_current;
  const q = `?season=${ctx.season?.id ?? ""}`;

  return html`
    ${decided.length ? html`<section class="honours" aria-label="Honours board">
      <h2>Honours ${ctx.season?.name ?? ""}</h2>
      <dl>${decided.map(({ a, who }) => html`<div><dt>${a.name}</dt><dd>${who.name}</dd></div>`)}</dl>
      <a href="/presentation${q}">See the trophies and photos</a></section>` : ""}

    <div class="stats">${numbers.map(([label, n]) => html`<div class="stat"><b>${n}</b>${label}</div>`)}</div>
    ${best ? html`<p class="pres-best">The highest break of the season${live ? " so far" : ""} is <b>${best.value}</b> by ${playerLink(best.player)}${best.fixture ? html`, made on <a href="${urls.match(best.fixture)}">${fmtDate(best.fixture.starts_at)}</a>` : ""}.</p>` : ""}

    ${ctx.leagues.map((league) => {
      const rows = ctx.standings(league.id).filter((r) => r.p > 0);
      if (!rows.length) return "";
      const shield = league.shield_team_id ? shieldTable(shieldHolder(league, ctx.fixtures, ctx.framesByFixture).history)[0] : null;
      const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
      // Old seasons brought in as final scores only have no frame-by-frame record, so no player rankings.
      const ranked = ctx.rankings(league.id).slice(0, 5);
      return html`<section class="review-league">
        <h2>${trophy(league, "inline", { always: false })}${league.name}</h2>
        <div class="podium">${podium.map((r) => html`<a class="podium-step p${r === rows[0] ? 1 : r === rows[1] ? 2 : 3}" href="${urls.team(r.team)}">
          ${badge(r.team)}<strong>${r.team.name}</strong><small>${r.pts} pts · won ${r.w} of ${r.p}</small>
          <b>${r === rows[0] ? (live ? "Leading" : "Champions") : r === rows[1] ? (live ? "Second" : "Runners-up") : "Third"}</b></a>`)}</div>
        <div class="${ranked.length ? "grid-2" : ""}" style="gap:30px;align-items:start">
          ${!ranked.length ? "" : panel(`${shortName(league)}: top players`, dataTable([
            { label: "", cell: (r) => r.pos, cls: "num" }, { label: "Player", cell: (r) => playerLink(r.player) },
            { label: "Won", cell: (r) => r.won, cls: "num" }, { label: "Pts", cell: (r) => r.pts, cls: "num strong" },
          ], ranked, { empty: "No frames played yet." }), { foot: { href: `${urls.standings(league)}${q}#players`, label: "Full rankings" } })}
          ${panel(`${shortName(league)}: highest breaks`, dataTable([
            { label: "Player", cell: (b) => playerLink(b.player) }, { label: "Date", cell: (b) => fmtDate(b.fixture?.starts_at), cls: "hide-sm" },
            { label: "Break", cell: (b) => b.value, cls: "num strong" },
          ], ctx.breaksIn(league.id).slice(0, 5), { empty: "No breaks recorded yet." }), { foot: { href: `${urls.standings(league)}${q}#breaks`, label: "All breaks" } })}
        </div>
        ${shield ? html`<p class="inline-row">${league.shield_name || "Shield"}: most wins ${teamLink(ctx.team.get(shield.teamId), true)} (${shield.wins}) <a href="${urls.shield(league)}${q}" style="text-decoration:underline">Shield history</a></p>` : ""}
        <div class="btn-row"><a class="btn small secondary" href="${urls.standings(league)}${q}">Full ${shortName(league)} table</a></div>
      </section>`;
    })}

    ${cups.length ? panel("Competitions", dataTable([
      { label: "Competition", cell: ({ c }) => html`<a class="team-cell" href="${urls.competition(c)}">${trophy(c, "tiny", { always: false })}${c.name}</a>` },
      { label: "Winner", cell: ({ final }) => (final ? html`<b>${final.winner.name}</b>` : html`<span class="muted">In progress</span>`) },
      { label: "Runner-up", cell: ({ final }) => final?.runnerUp?.name ?? "–", cls: "hide-sm" },
    ], cups), { color: "yellow", href: `/competitions${q}` }) : ""}

    <div class="btn-row"><a class="btn" href="/presentation${q}">Trophies &amp; winners</a>
      <a class="btn secondary" href="/fixtures${q}">Fixtures &amp; results ${ctx.season?.name ?? ""}</a><a class="btn ghost" href="/archive">Every season</a></div>`;
}
