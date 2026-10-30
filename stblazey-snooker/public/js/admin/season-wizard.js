// ─────────────────────────────────────────────────────────────
//  Admin → Fixtures → Set up a new season step by step (round 76 — Rich: "it's a right pain for me each season,
//  takes me hours to set it all up"). One step at a time, in the order the jobs have to be done:
//    1 The season (pick one, or start a new one)      2 The leagues
//    3 Promotion & relegation (from last season's final tables, using each league's Up / Down numbers)
//    4 Teams (playing or not, home venue, add a team) 5 Players (squads at a glance)
//    6 Fixtures (every league at once, round-robin)   7 Check (venue clashes, byes)
//    8 All done — a checklist, and "Make this the current season"
//  The address keeps the place: /admin/season_wizard?s=<season>&step=<1–8>.
//  Nothing is changed until a step's button is pressed; every step can be come back to.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$, toast, fmtDate, fmtTime, ukDay } from "../core/dom.js";
import { save, table, insertMany, invalidate } from "../core/api.js";
import { seasonContext } from "../core/context.js";
import { roundRobin, addDays, londonISO, slugify } from "../core/schedule.js";
import { navigate } from "../core/router.js";
import { friendly } from "./crud.js";

const STEPS = [
  ["The season", "Pick it, or start a new one"],
  ["Leagues", "Which leagues there are"],
  ["Up & down", "Promotion and relegation"],
  ["Teams", "Who is playing, and where"],
  ["Players", "The squads"],
  ["Fixtures", "Make every league's fixtures"],
  ["Check", "Venue clashes and byes"],
  ["All done", "Make it the current season"],
];
const go = (s, step) => navigate(`/admin/season_wizard?${s ? `s=${s}&` : ""}step=${step}`);
const nextTuesday = () => { const d = new Date(); d.setDate(d.getDate() + ((9 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10); };
/** "2026-2027" → "2027-2028" (or the year after anything else). */
const followingName = (name) => {
  const m = String(name ?? "").match(/(\d{4})\s*[-–\/]\s*(\d{2,4})/);
  if (m) { const a = Number(m[1]) + 1; return `${a}-${a + 1}`; }
  const y = new Date().getFullYear(); return `${y}-${y + 1}`;
};

export async function seasonWizardPage(el, { user } = {}) {
  const q = new URLSearchParams(location.search);
  const step = Math.min(8, Math.max(1, Number(q.get("step")) || 1));
  invalidate();
  const [seasons, leagues, teams, venues, players] = await Promise.all([table("seasons", "name"), table("leagues", "sort"), table("teams", "name"), table("venues", "name"), table("players", "full_name")]);
  const season = seasons.find((s) => s.id === q.get("s"));
  if (step > 1 && !season) return go(null, 1);
  const current = seasons.find((s) => s.is_current) ?? seasons.at(-1);
  const ctx = season ? await seasonContext(season.id) : null;
  const fixtures = ctx?.fixtures ?? [];
  const activeTeams = teams.filter((t) => t.active !== false);
  const teamsOf = (leagueId) => activeTeams.filter((t) => t.league_id === leagueId);
  const venueName = (id) => venues.find((v) => v.id === id)?.name ?? "";
  // Round 77 (Rich): a venue can hold as many matches on one night as it has tables (Admin → Venues → Snooker tables).
  const tablesAt = (id) => Math.max(1, Number(venues.find((v) => v.id === id)?.tables) || 1);

  // Venue clashes: two matches at the same venue on the same night.
  const clashes = (() => {
    const by = new Map();
    for (const f of fixtures) { if (!f.venue_id || f.status === "postponed") continue; const k = `${f.venue_id}|${ukDay(f.starts_at)}`; (by.get(k) ?? by.set(k, []).get(k)).push(f); }
    return [...by.values()].filter((list) => list.length > tablesAt(list[0].venue_id));
  })();
  const done = season ? {
    1: true,
    2: leagues.length > 0,
    3: true,
    4: leagues.every((l) => teamsOf(l.id).length >= 2),
    5: activeTeams.every((t) => players.some((p) => p.team_id === t.id)),
    6: leagues.length > 0 && leagues.every((l) => fixtures.some((f) => f.league_id === l.id)),
    7: fixtures.length > 0 && clashes.length === 0,
  } : {};

  const bar = html`<ol class="cw-steps">${STEPS.map(([name, sub], i) => {
    const n = i + 1, here = n === step, can = !!season || n === 1;
    const inner = html`<span class="cw-n">${done[n] && !here && n < 8 ? "✓" : n}</span><span class="cw-t"><b>${name}</b><small>${sub}</small></span>`;
    return html`<li class="${here ? "on" : ""} ${done[n] ? "ok" : ""}">${can && !here ? html`<a href="/admin/season_wizard?${season ? `s=${season.id}&` : ""}step=${n}">${inner}</a>` : html`<span>${inner}</span>`}</li>`;
  })}</ol>`;
  const head = (title, text) => html`${bar}<div class="cw-card">
    ${season ? html`<p class="cw-comp">Season ${season.name}${season.is_current ? " · the current season" : " · not the current season yet"}</p>` : ""}
    <h2 class="cw-q">${title}</h2>${text ? html`<p class="cw-help">${text}</p>` : ""}`;
  const nav = (label = "Next") => html`<div class="cw-nav">
    ${step > 1 ? html`<a class="btn ghost" href="/admin/season_wizard?s=${season.id}&step=${step - 1}">‹ Back</a>` : html`<span></span>`}
    ${step < 8 ? html`<a class="btn green" href="/admin/season_wizard?s=${season.id}&step=${step + 1}">${label} ›</a>` : ""}</div>`;
  const guard = (btn, fn) => async (e) => {
    e?.preventDefault?.();
    if (btn) btn.disabled = true;
    try { await fn(); } catch (err) { toast(friendly(err), "error"); if (btn) btn.disabled = false; }
  };

  // ── 1. The season ──────────────────────────────────────────────
  if (step === 1) {
    const count = (s) => (s.id === current?.id ? "current season" : "");
    mount(el, html`${head("Which season are you setting up?", "Start the new season here — normally near the end of the old one. The website keeps showing the current season until the last step, so you can set everything up in peace.")}
      <form class="form cw-new" data-sw-new style="margin-top:0;padding-top:0;border:0">
        <h3 class="cw-sub">Start a new season</h3>
        <div class="grid-2"><label>Name<input name="name" required maxlength="40" value="${followingName(current?.name)}"></label></div>
        <div class="btn-row"><button class="btn green">Create it and carry on ›</button></div>
      </form>
      <h3 class="cw-sub">Or carry on with a season</h3>
      <div class="cw-picks">${[...seasons].reverse().map((s) => html`<a class="cw-pick" href="/admin/season_wizard?s=${s.id}&step=2"><b>${s.name}</b><small>${count(s) || "—"}</small></a>`)}</div>
      </div>`);
    const f = $("[data-sw-new]", el);
    f.addEventListener("submit", (e) => guard(f.querySelector("button"), async () => {
      const name = f.elements.name.value.trim();
      if (!name) return;
      if (seasons.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a season called ${name}.`);
      const made = await save("seasons", { name, is_current: false });
      toast(`Season ${name} created`); go(made.id, 2);
    })(e));
    return;
  }

  // ── 2. Leagues ─────────────────────────────────────────────────
  if (step === 2) {
    mount(el, html`${head("The leagues", "Every league plays its own fixtures. Change a name, or add a new league. The Up / Down numbers say how many teams are promoted and relegated at the end of a season (next step).")}
      <form class="form" data-sw-leagues>
        <div class="sw-rows">${leagues.map((l) => html`<div class="sw-row" data-id="${l.id}">
          <label>League<input name="name" value="${l.name}" required></label>
          <label>Short name<input name="short_name" value="${l.short_name ?? ""}"></label>
          <label>Order<input type="number" name="sort" value="${l.sort ?? 1}" min="1"></label>
          <label>Up<input type="number" name="promote_count" value="${l.promote_count ?? 0}" min="0" max="10"></label>
          <label>Down<input type="number" name="relegate_count" value="${l.relegate_count ?? 0}" min="0" max="10"></label>
          <span class="sw-note">${teamsOf(l.id).length} teams</span></div>`)}</div>
        <div class="btn-row"><button class="btn secondary">Save the leagues</button></div>
      </form>
      <form class="form cw-new" data-sw-add>
        <h3 class="cw-sub">Add a league</h3>
        <div class="grid-3"><label>Name<input name="name" required placeholder="e.g. Premier League"></label><label>Short name<input name="short_name" placeholder="Premier"></label>
          <label>Order<input type="number" name="sort" value="${leagues.length + 1}" min="1"></label></div>
        <div class="btn-row"><button class="btn ghost">Add this league</button></div>
      </form>
      ${nav()}</div>`);
    const lf = $("[data-sw-leagues]", el);
    lf.addEventListener("submit", (e) => guard(lf.querySelector("button"), async () => {
      for (const row of $$(".sw-row", lf)) {
        const v = (n) => row.querySelector(`[name=${n}]`).value.trim();
        await save("leagues", { id: row.dataset.id, name: v("name"), short_name: v("short_name") || null, sort: Number(v("sort")) || 1,
          promote_count: Number(v("promote_count")) || 0, relegate_count: Number(v("relegate_count")) || 0 });
      }
      toast("Leagues saved"); go(season.id, 2);
    })(e));
    const af = $("[data-sw-add]", el);
    af.addEventListener("submit", (e) => guard(af.querySelector("button"), async () => {
      const name = af.elements.name.value.trim();
      await save("leagues", { name, short_name: af.elements.short_name.value.trim() || null, slug: slugify(name), sort: Number(af.elements.sort.value) || leagues.length + 1 });
      toast(`${name} added`); go(season.id, 2);
    })(e));
    return;
  }

  // ── 3. Promotion & relegation ──────────────────────────────────
  if (step === 3) {
    // Last season's final tables: the season before this one (or the current one when setting up the next).
    const older = seasons.filter((s) => s.id !== season.id && s.name < season.name).at(-1) ?? (current?.id !== season.id ? current : null);
    const last = older ? await seasonContext(older.id) : null;
    const ordered = [...leagues].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const pairs = ordered.slice(0, -1).map((upper, i) => ({ upper, lower: ordered[i + 1] }));
    const finalTable = (l) => (last ? last.standings(l.id) : []);
    const moves = pairs.map(({ upper, lower }) => {
      const down = finalTable(upper).slice(-(upper.relegate_count || 0)).filter(() => (upper.relegate_count || 0) > 0);
      const up = finalTable(lower).slice(0, lower.promote_count || 0);
      return { upper, lower, down, up };
    });
    const row = (r, to, kind) => {
      const t = teams.find((x) => x.id === r.team.id);
      const moved = t?.league_id === to.id;
      return html`<label class="sw-move ${moved ? "moved" : ""}"><input type="checkbox" name="move" value="${r.team.id}|${to.id}" ${moved ? "disabled checked" : "checked"}>
        <span class="sw-pos">${r.pos ?? ""}</span><b>${r.team.name}</b><small>${r.pts ?? 0} pts</small>
        <i class="${kind}">${moved ? `already in ${to.name}` : `${kind === "up" ? "↑ up to" : "↓ down to"} ${to.name}`}</i></label>`;
    };
    mount(el, html`${head("Promotion and relegation", last
      ? html`From the final ${older.name} tables, using each league's Up and Down numbers (step 2). Untick anyone who isn't moving (a team folding, a committee decision), then press the button. Teams keep all their results and history — only the league they play in this season changes.`
      : "There is no earlier season to work from, so nobody moves. Teams can still be moved by hand in the next step.")}
      ${last ? html`<form class="form" data-sw-moves>
        ${moves.map(({ upper, lower, down, up }) => html`<section class="sw-pair"><h3 class="cw-sub">${upper.name} ⇅ ${lower.name}</h3>
          ${!down.length && !up.length ? html`<p class="muted">No promotion or relegation set between these leagues (Up / Down in step 2).</p>` : ""}
          ${down.length ? html`<div class="sw-moves">${down.map((r) => row(r, lower, "down"))}</div>` : ""}
          ${up.length ? html`<div class="sw-moves">${up.map((r) => row(r, upper, "up"))}</div>` : ""}</section>`)}
        ${moves.some((m) => m.down.length || m.up.length) ? html`<div class="btn-row"><button class="btn secondary">Move the ticked teams</button></div>` : ""}
      </form>` : ""}
      ${nav()}</div>`);
    const mf = $("[data-sw-moves]", el);
    mf?.addEventListener("submit", (e) => guard(mf.querySelector("button"), async () => {
      const picked = $$("[name=move]:checked:not(:disabled)", mf).map((x) => x.value.split("|"));
      if (!picked.length) return toast("Nothing ticked to move");
      if (!confirm(`Move ${picked.length} team${picked.length === 1 ? "" : "s"} to their new league? (This season's lists change straight away; past seasons keep their own tables.)`)) { mf.querySelector("button").disabled = false; return; }
      for (const [teamId, leagueId] of picked) await save("teams", { id: teamId, league_id: leagueId });
      toast(`${picked.length} team${picked.length === 1 ? "" : "s"} moved`); go(season.id, 3);
    })(e));
    return;
  }

  // ── 4. Teams ───────────────────────────────────────────────────
  if (step === 4) {
    const all = [...teams].sort((a, b) => (a.active === false) - (b.active === false) || a.name.localeCompare(b.name));
    mount(el, html`${head("The teams", "Tick the teams playing this season, and check each one's league and home venue (the fixtures use it). A team that has folded: untick it — its history stays. A new team: add it at the bottom.")}
      <form class="form" data-sw-teams>
        ${leagues.map((l) => html`<h3 class="cw-sub">${l.name} <small class="muted">${teamsOf(l.id).length} playing</small></h3>
          <div class="sw-rows">${all.filter((t) => t.league_id === l.id).map((t) => html`<div class="sw-row team ${t.active === false ? "off" : ""}" data-id="${t.id}">
            <label class="check"><input type="checkbox" name="active" ${t.active !== false ? "checked" : ""}> <b>${t.name}</b></label>
            <label>League<select name="league_id">${leagues.map((x) => html`<option value="${x.id}" ${x.id === t.league_id ? "selected" : ""}>${x.name}</option>`)}</select></label>
            <label>Home venue<select name="venue_id"><option value="">–</option>${venues.map((v) => html`<option value="${v.id}" ${v.id === t.venue_id ? "selected" : ""}>${v.name}</option>`)}</select></label></div>`)}</div>`)}
        <div class="btn-row"><button class="btn secondary">Save the teams</button></div>
      </form>
      <form class="form cw-new" data-sw-add>
        <h3 class="cw-sub">Add a new team</h3>
        <div class="grid-3"><label>Team name<input name="name" required placeholder="e.g. Bugle B"></label>
          <label>League<select name="league_id">${leagues.map((x) => html`<option value="${x.id}">${x.name}</option>`)}</select></label>
          <label>Home venue<select name="venue_id"><option value="">–</option>${venues.map((v) => html`<option value="${v.id}">${v.name}</option>`)}</select></label></div>
        <div class="btn-row"><button class="btn ghost">Add this team</button></div>
      </form>
      ${nav()}</div>`);
    const tf = $("[data-sw-teams]", el);
    tf.addEventListener("submit", (e) => guard(tf.querySelector("button"), async () => {
      let n = 0;
      for (const row of $$(".sw-row.team", tf)) {
        const t = teams.find((x) => x.id === row.dataset.id);
        const next = { active: row.querySelector("[name=active]").checked, league_id: row.querySelector("[name=league_id]").value, venue_id: row.querySelector("[name=venue_id]").value || null };
        if ((t.active !== false) !== next.active || t.league_id !== next.league_id || (t.venue_id ?? null) !== next.venue_id) { await save("teams", { id: t.id, ...next }); n++; }
      }
      toast(n ? `${n} team${n === 1 ? "" : "s"} saved` : "Nothing had changed"); go(season.id, 4);
    })(e));
    const af = $("[data-sw-add]", el);
    af.addEventListener("submit", (e) => guard(af.querySelector("button"), async () => {
      const name = af.elements.name.value.trim();
      if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a team called ${name} — tick it above instead.`);
      await save("teams", { name, slug: slugify(name), league_id: af.elements.league_id.value, venue_id: af.elements.venue_id.value || null, active: true });
      toast(`${name} added`); go(season.id, 4);
    })(e));
    return;
  }

  // ── 5. Players ─────────────────────────────────────────────────
  if (step === 5) {
    const squad = (t) => players.filter((p) => p.team_id === t.id && !["not_playing", "deceased"].includes(p.status));
    const loose = players.filter((p) => !p.team_id && !["not_playing", "deceased"].includes(p.status)).length;
    mount(el, html`${head("The squads", "Players stay with their team from season to season, so usually there's little to do. Open a team to sign, move or retire players (and set handicaps). Captains can also add new players from their scorecard.")}
      ${leagues.map((l) => html`<h3 class="cw-sub">${l.name}</h3><div class="cw-picks">${teamsOf(l.id).map((t) => {
        const n = squad(t).length;
        return html`<a class="cw-pick ${n ? "" : "warn"}" href="/admin/players?team_id=${t.id}"><b>${t.name}</b><small>${n ? `${n} player${n === 1 ? "" : "s"}` : "No players yet"} — open →</small></a>`;
      })}</div>`)}
      ${loose ? html`<div class="notice" style="margin-top:16px"><b>${loose}</b> player${loose === 1 ? " has" : "s have"} no team. <a href="/admin/players" style="font-weight:700;color:var(--red)">Players</a> — filter by team to find them.</div>` : ""}
      ${nav()}</div>`);
    return;
  }

  // ── 6. Fixtures ────────────────────────────────────────────────
  if (step === 6) {
    const have = (l) => fixtures.filter((f) => f.league_id === l.id).length;
    mount(el, html`${head("Make the fixtures", "Every team plays every other team in its league — home and away, normally. Venues come from each home team (step 4). Pick the dates once; each league can start on its own night. A league with an odd number of teams gets a bye week for the team left out each night.")}
      <form class="form" data-sw-gen>
        <div class="grid-3">
          <label>Start time<input type="time" name="time" value="19:30" required></label>
          <label>Days between rounds<input type="number" name="gap" value="7" min="1" required></label>
          <label class="check" style="align-self:end"><input type="checkbox" name="double" checked> Home and away</label>
        </div>
        <label>Nights to skip (e.g. Christmas and New Year) — one per line, YYYY-MM-DD<textarea name="skip" rows="3" placeholder="2027-12-21&#10;2027-12-28"></textarea></label>
        <div class="sw-rows">${leagues.map((l) => html`<div class="sw-row gen" data-league="${l.id}">
          <label class="check"><input type="checkbox" name="on" ${have(l) ? "" : "checked"}> <b>${l.name}</b></label>
          <span class="sw-note">${teamsOf(l.id).length} teams${have(l) ? html` · <b class="warn-ink">${have(l)} fixtures already</b>` : ""}</span>
          <label>First match night<input type="date" name="start" value="${nextTuesday()}"></label></div>`)}</div>
        <div class="btn-row"><button type="button" class="btn ghost" data-preview>Preview</button><button class="btn green">Create the fixtures</button></div>
      </form>
      <div data-sw-preview></div>
      ${nav()}</div>`);
    const gf = $("[data-sw-gen]", el);
    const build = () => {
      const time = gf.elements.time.value || "19:30", gap = Number(gf.elements.gap.value) || 7, double = gf.elements.double.checked;
      const skip = new Set(gf.elements.skip.value.split(/\s+/).filter(Boolean));
      const rows = $$(".sw-row.gen", gf).filter((row) => row.querySelector("[name=on]").checked);
      if (!rows.length) throw new Error("Tick at least one league.");
      for (const row of rows) {
        const l = leagues.find((x) => x.id === row.dataset.league);
        if (teamsOf(l.id).length < 2) throw new Error(`${l.name} needs at least two teams playing (step 4).`);
        if (!row.querySelector("[name=start]").value) throw new Error(`Choose ${l.name}'s first match night.`);
      }
      const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
      // One complete set of fixtures, with each league's teams in the given order (the order decides who is at home when).
      const makeAll = (orderOf) => {
        const out = { fixtures: [], byes: [], leagues: [] };
        for (const row of rows) {
          const l = leagues.find((x) => x.id === row.dataset.league), ts = orderOf(teamsOf(l.id));
          let date = row.querySelector("[name=start]").value;
          while (skip.has(date)) date = addDays(date, gap);
          const rounds = roundRobin(ts.map((t) => t.id)), used = double ? rounds : rounds.slice(0, rounds.length / 2);
          let n = 0;
          used.forEach((pairs, i) => {
            if (i > 0) { date = addDays(date, gap); while (skip.has(date)) date = addDays(date, gap); }
            const playing = new Set(pairs.flat());
            for (const t of ts) if (!playing.has(t.id)) out.byes.push({ season_id: season.id, league_id: l.id, team_id: t.id, bye_on: date });
            for (const [home, away] of pairs) {
              out.fixtures.push({ season_id: season.id, league_id: l.id, home_team_id: home, away_team_id: away,
                venue_id: teams.find((t) => t.id === home)?.venue_id ?? null, starts_at: londonISO(date, time), status: "scheduled", notes: "" });
              n++;
            }
          });
          out.leagues.push({ l, n, last: date, existing: have(l) });
        }
        return out;
      };
      // Round 76: clubs with more than one team (Bethel A–D, Mevagissey A–C…) — the fixtures are drawn many times over with
      // the teams in a different order, and the one with the fewest nights where a venue has two matches is kept.
      const clashCount = (list) => { const m = new Map(); let n = 0; for (const f of list) { if (!f.venue_id) continue; const k = `${f.venue_id}|${f.starts_at.slice(0, 10)}`; const c = (m.get(k) ?? 0) + 1; m.set(k, c); if (c > tablesAt(f.venue_id)) n++; } return n; };
      let out = makeAll((ts) => ts), best = clashCount(out.fixtures);
      for (let i = 0; i < 400 && best > 0; i++) { const o = makeAll(shuffle); const c = clashCount(o.fixtures); if (c < best) { out = o; best = c; } }
      // Then fewer still: Where two matches would be at the same venue on the same night (two teams from
      // one club, in either league), the match is turned round — and so is its return match later in the season, so
      // every team still has the same number of home games — as long as that doesn't make a clash somewhere else.
      const day = (f) => f.starts_at.slice(0, 10);
      const venueOf = (teamId) => teams.find((t) => t.id === teamId)?.venue_id ?? null;
      const load = new Map();
      const key = (v, d) => `${v}|${d}`;
      const add = (f, n) => { if (f.venue_id) load.set(key(f.venue_id, day(f)), (load.get(key(f.venue_id, day(f))) ?? 0) + n); };
      out.fixtures.forEach((f) => add(f, 1));
      const flip = (f) => { add(f, -1); [f.home_team_id, f.away_team_id] = [f.away_team_id, f.home_team_id]; f.venue_id = venueOf(f.home_team_id); add(f, 1); };
      // A match and its return match are turned round together, so home games stay even. Keep turning pairs round
      // while it lowers the number of clashes (a few passes are plenty).
      const extra = (f) => (f.venue_id ? Math.max(0, (load.get(key(f.venue_id, day(f))) ?? 0) - tablesAt(f.venue_id)) : 0);
      const pairsOf = [];
      const seen = new Set();
      for (const f of out.fixtures) {
        if (seen.has(f)) continue;
        const back = out.fixtures.find((g) => !seen.has(g) && g !== f && g.league_id === f.league_id && g.home_team_id === f.away_team_id && g.away_team_id === f.home_team_id);
        seen.add(f); if (back) seen.add(back);
        pairsOf.push(back ? [f, back] : [f]);
      }
      const cost = (pair) => pair.reduce((n, f) => n + extra(f), 0);
      for (let pass = 0; pass < 6; pass++) {
        let better = false;
        for (const pair of pairsOf) {
          const before = cost(pair);
          if (!before) continue;
          pair.forEach(flip);
          if (cost(pair) < before) better = true; else pair.forEach(flip);
        }
        if (!better) break;
      }
      return out;
    };
    const preview = () => {
      const b = build();
      const tn = (id) => teams.find((t) => t.id === id)?.name ?? "?";
      mount($("[data-sw-preview]", el), html`<div class="sw-preview">
        ${b.leagues.map(({ l, n, last, existing }) => html`<p>${existing ? html`<span class="status postponed">already has ${existing}</span> ` : ""}<b>${l.name}</b>: ${n} fixtures, last night ${fmtDate(last)}.</p>`)}
        ${b.byes.length ? html`<p class="muted">${b.byes.length} bye weeks as well.</p>` : ""}
        <details><summary>See the first two nights</summary><ul class="plain-list">${b.fixtures.slice(0, 20).map((f) => html`<li>${fmtDate(f.starts_at)} ${fmtTime(f.starts_at)} — ${tn(f.home_team_id)} v ${tn(f.away_team_id)}${f.venue_id ? ` · ${venueName(f.venue_id)}` : ""}</li>`)}</ul></details></div>`);
      return b;
    };
    el.addEventListener("click", (e) => { if (e.target.matches("[data-preview]")) { try { preview(); } catch (err) { toast(err.message, "error"); } } });
    gf.addEventListener("submit", (e) => guard(gf.querySelector("button.green"), async () => {
      const b = preview();
      const dup = b.leagues.filter((x) => x.existing);
      if (!confirm(`Create ${b.fixtures.length} fixtures${b.byes.length ? ` and ${b.byes.length} bye weeks` : ""}?${dup.length ? `\n\n${dup.map((x) => x.l.name).join(" and ")} already ${dup.length === 1 ? "has" : "have"} fixtures this season — these would be added on top.` : ""}`)) { gf.querySelector("button.green").disabled = false; return; }
      await insertMany("fixtures", b.fixtures);
      if (b.byes.length) await insertMany("byes", b.byes);
      toast(`${b.fixtures.length} fixtures created`); go(season.id, 7);
    })(e));
    return;
  }

  // ── 7. Check ───────────────────────────────────────────────────
  if (step === 7) {
    const tn = (id) => teams.find((t) => t.id === id)?.name ?? "?";
    mount(el, html`${head("Check the fixtures", fixtures.length ? (clashes.length
      ? "More matches at a venue on one night than it has tables (Admin → Venues → Snooker tables) — usually teams from the same club. Swap one of them round (it is then played at the other team's venue), or change it under All fixtures. (The fixtures were already drawn to avoid this wherever they could be.)"
      : "No venue has more matches on a night than it has tables. All good.") : "No fixtures yet — make them in the step before.")}
      ${clashes.map((list) => html`<div class="sw-clash"><p><b>${venueName(list[0].venue_id)}</b> · ${fmtDate(list[0].starts_at)} · ${list.length} matches, ${tablesAt(list[0].venue_id)} table${tablesAt(list[0].venue_id) === 1 ? "" : "s"}</p>
        ${list.map((f) => html`<div class="sw-clash-row"><span>${tn(f.home_team_id)} v ${tn(f.away_team_id)} <small class="muted">${ctx.league.get(f.league_id)?.name ?? ""}</small></span>
          <button type="button" class="btn small ghost" data-swap="${f.id}">Swap home and away</button></div>`)}</div>`)}
      ${fixtures.length ? html`<p class="muted" style="margin-top:14px">${fixtures.length} fixtures and ${(ctx.byes ?? []).length} bye weeks this season · <a href="/admin/fixtures?season_id=${season.id}" style="color:var(--red);font-weight:700">See them all</a></p>` : ""}
      ${nav()}</div>`);
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-swap]");
      if (!b) return;
      const f = fixtures.find((x) => x.id === b.dataset.swap);
      guard(b, async () => {
        await save("fixtures", { id: f.id, home_team_id: f.away_team_id, away_team_id: f.home_team_id, venue_id: teams.find((t) => t.id === f.away_team_id)?.venue_id ?? null });
        toast("Swapped"); go(season.id, 7);
      })();
    });
    return;
  }

  // ── 8. All done ────────────────────────────────────────────────
  const item = (ok, text, fix, n) => html`<li class="${ok ? "ok" : "todo"}"><span class="cw-mark">${ok ? "✓" : "!"}</span><span>${text}</span>${ok || !n ? "" : html`<a href="/admin/season_wizard?s=${season.id}&step=${n}">${fix}</a>`}</li>`;
  const noVenue = activeTeams.filter((t) => !t.venue_id).length;
  mount(el, html`${head(`Season ${season.name}`, season.is_current ? "This is the current season — the website shows it." : "When everything is ready, make it the current season: the website's tables, fixtures and results switch over to it. The old season stays in Past seasons.")}
    <ul class="cw-check">
      ${item(leagues.length > 0, `${leagues.length} league${leagues.length === 1 ? "" : "s"}`, "Leagues", 2)}
      ${item(done[4], leagues.map((l) => `${l.name}: ${teamsOf(l.id).length} teams`).join(" · "), "Teams", 4)}
      ${item(!noVenue, noVenue ? `${noVenue} team${noVenue === 1 ? " has" : "s have"} no home venue` : "Every team has a home venue", "Teams", 4)}
      ${item(done[5], done[5] ? "Every team has players" : "Some teams have no players yet", "Players", 5)}
      ${item(done[6], done[6] ? `${fixtures.length} fixtures` : "Some leagues have no fixtures yet", "Make fixtures", 6)}
      ${item(!clashes.length, clashes.length ? `${clashes.length} venue clash${clashes.length === 1 ? "" : "es"}` : "No venue clashes", "Check", 7)}
    </ul>
    <div class="btn-row cw-end">
      ${season.is_current ? "" : html`<button type="button" class="btn green" data-make-current>Make ${season.name} the current season</button>`}
      <a class="btn ghost" href="/admin/fixtures?season_id=${season.id}">All fixtures</a>
      <a class="btn ghost" href="/admin/comp_wizard">Set up this season's competitions</a>
    </div></div>`);
  $("[data-make-current]", el)?.addEventListener("click", (e) => guard(e.target, async () => {
    if (!confirm(`Make ${season.name} the current season? The website switches over to it straight away${current ? ` — ${current.name} moves to Past seasons` : ""}.`)) { e.target.disabled = false; return; }
    await save("seasons", { id: season.id, is_current: true });
    toast(`${season.name} is now the current season`); go(season.id, 8);
  })());
}
