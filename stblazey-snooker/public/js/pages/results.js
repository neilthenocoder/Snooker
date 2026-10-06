// /results — every result of the season, newest first: league matches and competition
// matches together, grouped by the day they were played. The side column's
// "Latest Results" box links here.
import { html, mount, fmtDate, ukDay } from "../core/dom.js";
import { seasonContext, cupResults } from "../core/context.js";
import { breadcrumb, panel, seasonPicker, urls, shortName } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

const PER_PAGE = 12;   // match days shown before "Show earlier results"

export default async function results(view, { query }) {
  const [ctx, cups] = await Promise.all([seasonContext(query.get("season")), cupResults().catch(() => [])]);
  setTitle(`Results ${ctx.season?.name ?? ""}`);
  adminEdit("results", null, { label: "Results to approve" });
  const current = ctx.seasons.find((s) => s.is_current) ?? ctx.seasons.at(-1);
  const which = query.get("show") ?? "";            // "" = everything, a league id, or "cups"
  let shown = PER_PAGE;

  const league = ctx.fixtures.filter((f) => ctx.hasResult(f) && f.status !== "in_progress").map((f) => {
    const s = ctx.scoreOf(f);
    return { when: f.starts_at, group: f.league_id, title: shortName(ctx.league.get(f.league_id) ?? { name: "League" }),
      home: ctx.team.get(f.home_team_id)?.name, away: ctx.team.get(f.away_team_id)?.name, score: `${s.home} – ${s.away}`,
      href: urls.match(f), won: s.home > s.away ? "h" : s.away > s.home ? "a" : "" };
  });
  const comp = cups.filter((c) => (c.season_id ?? current?.id) === ctx.season?.id).map((c) => ({ ...c, group: "cups" }));
  const all = [...league, ...comp].filter((r) => !which || r.group === which)
    .sort((a, b) => String(b.when ?? "").localeCompare(String(a.when ?? "")));
  // One block per match day.
  const days = new Map();
  for (const r of all) { const d = r.when ? ukDay(r.when) : "undated"; (days.get(d) ?? days.set(d, []).get(d)).push(r); }
  const link = (v) => `/results?${new URLSearchParams({ ...(query.get("season") ? { season: query.get("season") } : {}), ...(v ? { show: v } : {}) })}`;

  const draw = () => mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Fixtures", "/fixtures"], ["Results"]])}
      <h1>Results ${ctx.season?.name ?? ""}</h1>${seasonPicker(ctx)}
      <div class="chips">
        <a class="tag-link ${which ? "" : "on"}" href="${link("")}">All results</a>
        ${ctx.leagues.map((l) => html`<a class="tag-link ${which === l.id ? "on" : ""}" href="${link(l.id)}">${l.name}</a>`)}
        ${comp.length || which === "cups" ? html`<a class="tag-link ${which === "cups" ? "on" : ""}" href="${link("cups")}">Competitions</a>` : ""}
      </div></div>
    ${days.size ? [...days].slice(0, shown).map(([day, rows]) => panel(day === "undated" ? "Date not set" : fmtDate(day), html`<div class="res-list wide">
      ${rows.map((r) => html`<a class="res-mini" href="${r.href}"><small>${r.title}</small>
        <span class="${r.won === "h" ? "won" : ""}">${r.home}</span><b>${r.score}</b><span class="${r.won === "a" ? "won" : ""}">${r.away}</span></a>`)}</div>`))
      : html`<div class="empty box">No results yet${which ? " for this choice" : ""}.</div>`}
    ${days.size > shown ? html`<button type="button" class="btn ghost" data-more style="align-self:center">Show earlier results (${days.size - shown} more match day${days.size - shown > 1 ? "s" : ""})</button>` : ""}
    <div class="btn-row"><a class="btn secondary" href="/fixtures${query.get("season") ? `?season=${query.get("season")}` : ""}">Fixtures by team</a><a class="btn ghost" href="/calendar">Calendar</a></div>
  </div>`);
  draw();

  const more = (e) => { if (e.target.matches("[data-more]")) { shown += PER_PAGE; draw(); } };
  view.addEventListener("click", more);
  return () => view.removeEventListener("click", more);
}
