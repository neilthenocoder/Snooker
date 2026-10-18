// "Form guide" (Rich, round 25): every player and team with their form out of 10, like the fantasy football lists.
// Sort by any column, pick a league, switch between players and teams.
import { html, mount, $, $$ } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadForm, formBadge, formChips, FORM_TEXT, FORM } from "../core/form.js";
import { breadcrumb, avatar, badge, urls, handicapText, breakTag, seasonPicker } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function formGuide(view, { query }) {
  const ctx = await seasonContext(query.get("season"));
  const form = await loadForm(ctx);
  setTitle("Form guide");
  adminEdit("players");

  const state = { tab: query.get("view") === "teams" ? "teams" : "players", league: query.get("league") || "", sort: "form", dir: -1, q: "", shown: 25 };
  const teamOf = (p) => ctx.team.get(p.team_id);
  const leagueOfTeam = (t) => t && ctx.league.get(t.league_id);

  const playerRows = () => ctx.players.filter((p) => p.status !== "deceased").map((p) => ({ p, t: teamOf(p), f: form.player(p.id) }))
    .filter((r) => r.f.n > 0);
  const teamRows = () => ctx.teams.map((t) => ({ t, f: form.team(t.id) })).filter((r) => r.f.n > 0);

  const sorters = {
    name: (r) => (r.p ?? r.t).full_name ?? r.t.name,
    form: (r) => r.f.form ?? -1,
    won: (r) => r.f.won - r.f.lost,
    best: (r) => r.f.best,
    handicap: (r) => Number(r.p?.handicap) || 0,
  };

  function rows() {
    const list = (state.tab === "teams" ? teamRows() : playerRows())
      .filter((r) => !state.league || leagueOfTeam(r.t)?.slug === state.league)
      .filter((r) => !state.q || ((r.p?.full_name ?? "") + " " + (r.t?.name ?? "")).toLowerCase().includes(state.q));
    const key = sorters[state.sort];
    return list.sort((a, b) => {
      const x = key(a), y = key(b);
      const c = typeof x === "string" ? x.localeCompare(y) : x - y;
      return c * state.dir || (b.f.form ?? 0) - (a.f.form ?? 0) || b.f.n - a.f.n;
    });
  }

  const th = (key, label, cls = "") => html`<th class="${cls}"><button type="button" class="fg-sort ${state.sort === key ? "on" : ""}" data-sort="${key}" aria-label="Sort by ${label}">${label}<i aria-hidden="true">${state.sort === key ? (state.dir < 0 ? "▼" : "▲") : "⇅"}</i></button></th>`;

  function tableHtml() {
    const all = rows(), list = all.slice(0, state.shown);
    const more = all.length > list.length ? html`<button type="button" class="btn fg-more" data-more>Show all ${all.length} ${state.tab}</button>` : "";
    if (!list.length) return html`<div class="empty box">No ${state.tab} with results yet${state.league ? " in this league" : ""}.</div>`;
    const top = state.sort === "form" && state.dir < 0 ? list[0] : null;
    if (state.tab === "teams") {
      return html`<div class="table-scroll"><table class="data fg-table"><thead><tr>
        <th class="num">#</th>${th("name", "Team")}${th("form", "Form", "num")}<th>Last ${FORM.last}</th>${th("won", "Frames", "num hide-sm")}</tr></thead>
        <tbody>${list.map((r, i) => html`<tr class="${r === top ? "hl" : ""}">
          <td class="num" data-label="#">${i + 1}</td>
          <td data-label="Team"><a class="fg-who" href="${urls.team(r.t)}">${badge(r.t)}<span><strong>${r.t.name}</strong><small>${leagueOfTeam(r.t)?.name ?? ""}</small></span></a></td>
          <td class="num" data-label="Form">${formBadge(r.f, { trend: true })}</td>
          <td data-label="Last ${FORM.last}">${formChips(r.f)}</td>
          <td class="num hide-sm" data-label="Frames">${r.f.won}–${r.f.lost}</td></tr>`)}</tbody></table></div>${more}`;
    }
    return html`<div class="table-scroll"><table class="data fg-table"><thead><tr>
      <th class="num">#</th>${th("name", "Player")}${th("form", "Form", "num")}<th>Last ${FORM.last}</th>${th("won", "Frames", "num hide-sm")}${th("best", "Best break", "num hide-sm")}${th("handicap", "Handicap", "num hide-sm")}</tr></thead>
      <tbody>${list.map((r, i) => html`<tr class="${r === top ? "hl" : ""}">
        <td class="num" data-label="#">${i + 1}</td>
        <td data-label="Player"><a class="fg-who" href="${urls.player(r.p)}">${avatar(r.p, "fg-photo")}<span><strong>${r.p.full_name}</strong><small>${r.t?.name ?? ""}</small></span></a></td>
        <td class="num" data-label="Form">${formBadge(r.f, { trend: true })}</td>
        <td data-label="Last ${FORM.last}">${formChips(r.f)}</td>
        <td class="num hide-sm" data-label="Frames">${r.f.won}–${r.f.lost}</td>
        <td class="num hide-sm" data-label="Best break">${breakTag(r.f.best)}</td>
        <td class="num hide-sm" data-label="Handicap">${handicapText(r.p.handicap)}</td></tr>`)}</tbody></table></div>${more}`;
  }

  // The best of each: a slim card for the most in-form player and team.
  // (Someone with three or more matches first, so one lucky night doesn't top it.)
  const hottest = (list) => { const settled = list.filter((r) => r.f.n >= 3); return (settled.length ? settled : list).sort((a, b) => b.f.form - a.f.form || b.f.n - a.f.n)[0]; };
  const hotPlayer = hottest(playerRows()), hotTeam = hottest(teamRows());
  const settledNote = (r) => (r?.f.n >= 3 ? " · 3+ matches" : "");

  mount(view, html`<div class="wrap stack">
    <div>${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Form guide"]])}
    <h1>Form guide</h1>
    <p class="fg-intro">Who's hot and who's not: a mark out of 10 from each player's and team's last ${FORM.last} matches this season, league and competitions.</p></div>
    ${hotPlayer || hotTeam ? html`<div class="spotlights">
      ${hotPlayer ? html`<a class="spotlight" href="${urls.player(hotPlayer.p)}">${avatar(hotPlayer.p, "spot-photo")}
        <div><span class="spot-label">Most in-form player${settledNote(hotPlayer)}</span><strong>${hotPlayer.p.full_name}</strong><small>${hotPlayer.t?.name ?? ""}</small>${formChips(hotPlayer.f, { links: false })}</div>${formBadge(hotPlayer.f, { big: true })}</a>` : ""}
      ${hotTeam ? html`<a class="spotlight" href="${urls.team(hotTeam.t)}"><span class="spot-badge">${badge(hotTeam.t)}</span>
        <div><span class="spot-label">Most in-form team${settledNote(hotTeam)}</span><strong>${hotTeam.t.name}</strong><small>${leagueOfTeam(hotTeam.t)?.name ?? ""}</small>${formChips(hotTeam.f, { links: false })}</div>${formBadge(hotTeam.f, { big: true })}</a>` : ""}
    </div>` : ""}
    <div class="fg-bar">
      <div class="fg-tabs" role="tablist">
        <button type="button" role="tab" data-tab="players" aria-selected="${state.tab === "players"}">Players</button>
        <button type="button" role="tab" data-tab="teams" aria-selected="${state.tab === "teams"}">Teams</button>
      </div>
      <select data-league aria-label="League"><option value="">All leagues</option>${ctx.leagues.map((l) => html`<option value="${l.slug}" ${l.slug === state.league ? "selected" : ""}>${l.name}</option>`)}</select>
      <input type="search" data-q placeholder="Search by name" aria-label="Search by name">
      ${seasonPicker(ctx)}
    </div>
    <div data-fg-table>${tableHtml()}</div>
    <p class="muted">${FORM_TEXT} Tap a W, L or D to open that match. ▲ ▼ = better or worse than before the latest match.</p>
  </div>`);

  const redraw = () => {
    mount($("[data-fg-table]", view), tableHtml());
    $$("[data-tab]", view).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === state.tab)));
    const u = new URL(location.href);
    u.searchParams.set("view", state.tab);
    state.league ? u.searchParams.set("league", state.league) : u.searchParams.delete("league");
    history.replaceState(history.state, "", u);
  };
  $(".wrap", view).addEventListener("click", (e) => {
    if (e.target.closest("[data-more]")) { state.shown = Infinity; return redraw(); }
    const s = e.target.closest("[data-sort]");
    if (s) { const k = s.dataset.sort; state.dir = state.sort === k ? -state.dir : k === "name" ? 1 : -1; state.sort = k; return redraw(); }
    const t = e.target.closest("[data-tab]");
    if (t) { state.tab = t.dataset.tab; state.shown = 25; if (state.tab === "teams" && ["best", "handicap"].includes(state.sort)) state.sort = "form"; redraw(); }
  });
  $("[data-league]", view).addEventListener("change", (e) => { state.league = e.target.value; redraw(); });
  $("[data-q]", view).addEventListener("input", (e) => { state.q = e.target.value.trim().toLowerCase(); redraw(); });
}
