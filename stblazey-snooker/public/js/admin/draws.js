// Admin: entrants, the draw and results for one knockout competition.
import { html, mount, $, toast, readForm, toLocalInput, fromLocalInput } from "../core/dom.js";
import { table, save, remove, insertMany, loadCompetitions, replaceDraw } from "../core/api.js";
import { buildBracket, makeDraw, shuffle, roundName, isEntry, redrawNextRound, winnerAdvance, PENDING } from "../core/bracket.js";
import { panel, dataTable, urls } from "../core/components.js";
import { navigate } from "../core/router.js";
import { friendly } from "./crud.js";

export async function draws(el) {
  const [data, teams, players, leagues, venues] = await Promise.all([
    loadCompetitions(), table("teams", "name"), table("players", "full_name"), table("leagues", "sort"), table("venues", "name"),
  ]);
  const id = new URLSearchParams(location.search).get("c") ?? data.competitions[0]?.id;
  const c = data.competitions.find((x) => x.id === id);
  if (!c) {
    return mount(el, html`<div class="notice">No competitions yet. <a href="/admin/competitions" style="font-weight:700;color:var(--red)">Create one first</a>, then come back here to add entrants and make the draw.</div>`);
  }
  const entries = data.entries.filter((e) => e.competition_id === c.id).sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name));
  const rows = data.matches.filter((m) => m.competition_id === c.id);
  const b = buildBracket(entries, rows);
  const hasResults = rows.some((r) => r.score_a != null || r.score_b != null);
  const redraw = () => navigate(`/admin/draws?c=${c.id}`, { replace: true });
  const linkOptions = c.kind === "Team"
    ? html`<option value="">– no team link –</option>${teams.map((t) => html`<option value="team:${t.id}">${t.name}</option>`)}`
    : html`<option value="">– no player link –</option>${players.map((p) => html`<option value="player:${p.id}">${p.full_name} (${teams.find((t) => t.id === p.team_id)?.name ?? "no team"})</option>`)}`;

  mount(el, html`<div class="stack" id="draws-root">
    <div class="toolbar">
      <label style="font-weight:700">Competition
        <select data-pick>${data.competitions.map((x) => html`<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${x.name}</option>`)}</select></label>
      <a class="btn ghost" href="${urls.competition(c)}">View public page</a>
      <a class="btn ghost" href="/admin/competitions">Edit competition details</a>
    </div>

    ${panel(`1. Entrants (${entries.length})`, html`
      <form class="form" data-add-entry>
        <div class="grid-2">
          <label>Link to a ${c.kind === "Team" ? "team" : "player"} (fills in the name)<select name="link">${linkOptions}</select></label>
          <label>Name shown in the draw<input name="name" placeholder="e.g. Bethel A, or J. Smith & P. Jones"></label>
        </div>
        <div class="btn-row"><button class="btn green">Add entrant</button>
          ${c.kind === "Team" ? html`<span class="muted">or</span>
            <select name="league" style="width:auto;margin:0">${leagues.map((l) => html`<option value="${l.id}">${l.name}</option>`)}</select>
            <button type="button" class="btn secondary" data-add-league>Add every team in this league</button>` : ""}
        </div>
      </form>
      ${dataTable([
        { label: "Seed", cell: (e) => e.seed || "–", cls: "num" },
        { label: "Name", cell: (e) => html`<b>${e.name}</b>` },
        { label: "Linked to", cell: (e) => teams.find((t) => t.id === e.team_id)?.name ?? players.find((p) => p.id === e.player_id)?.full_name ?? "–" },
        { label: "", cls: "right", cell: (e) => html`<button class="btn small" data-remove-entry="${e.id}">Remove</button>` },
      ], entries, { empty: "No entrants yet." })}`)}

    ${panel("2. Make the draw", html`<div class="form">
      <p style="margin-top:0">Entrants are seeded in the order listed above (seed 1 first). When the number of entrants isn't 2, 4, 8, 16 or 32,
        the top seeds get byes — e.g. 10 entrants = 2 first-round matches and 6 byes, leaving 8 for the quarter-finals.
        You can move anyone (or a bye) by hand in step 3.</p>
      <p><b>This competition's draw:</b> ${c.draw_mode === "redraw"
        ? "a fresh random draw every round (use “Draw next round” below when a round is finished)."
        : "winners follow the bracket."} Change this under Competitions → Edit.</p>
      ${hasResults ? html`<div class="notice error">Results have already been entered. Making a new draw will delete them.</div>` : ""}
      <div class="btn-row">
        <button class="btn blue" data-draw="random" ${entries.length < 2 ? "disabled" : ""}>Random draw</button>
        <button class="btn secondary" data-draw="seeded" ${entries.length < 2 ? "disabled" : ""}>Seeded draw (keep order)</button>
      </div></div>`)}

    ${c.draw_mode === "redraw" && b.totalRounds > 1 ? html`<div class="btn-row">${b.rounds.slice(0, -1).map((list, i) => {
      const done = list.every((m) => m.winner !== PENDING);
      const nextSet = b.rounds[i + 1].some((m) => m.row.entry_a || m.row.entry_b);
      return html`<button class="btn ${done && !nextSet ? "blue" : "ghost"}" data-redraw="${i + 1}" ${done ? "" : "disabled"}>
        Draw ${roundName(i + 2, b.totalRounds).toLowerCase()}${nextSet ? " again" : ""}</button>`;
    })}</div>` : ""}

    ${b.totalRounds ? panel("3. Pairings, dates & results", html`<div class="table-scroll"><table class="data results-edit">
      <thead><tr><th>Round</th><th class="right">Home / first named</th><th class="num">Score</th><th>Away / second named</th><th>Date & time</th><th>Venue</th><th></th></tr></thead>
      <tbody>${b.rounds.flat().map((m) => {
        // Who's in each slot: round 1 can be anyone or a bye; later rounds default to "the winner".
        const pickSide = (side) => {
          const key = side === "a" ? "entry_a" : "entry_b";
          const auto = m.round === 1 ? "Bye" : "Winner (automatic)";
          return html`<select name="${key}" class="pair-pick"><option value="">${auto}</option>${entries.map((e) => html`<option value="${e.id}" ${m.row[key] === e.id ? "selected" : ""}>${e.name}</option>`)}</select>
            ${m.round > 1 && !m.row[key] ? html`<small class="muted">${isEntry(m[side]) ? b.entryById.get(m[side]).name : "to be decided"}</small>` : ""}`;
        };
        const ready = isEntry(m.a) && isEntry(m.b);
        return html`<tr data-row="${m.row.id ?? ""}" data-round="${m.round}" data-slot="${m.slot}">
          <td class="strong">${roundName(m.round, b.totalRounds)}${m.row.status === "in_progress" ? html` <span class="live-dot">Live</span>` : ""}</td>
          <td class="right">${pickSide("a")}</td>
          <td class="num" style="white-space:nowrap">${m.isBye ? html`<span class="muted">bye</span>` : html`
            <input type="number" min="0" max="99" name="score_a" value="${m.row.score_a ?? ""}" style="width:58px" ${ready ? "" : "disabled"}> –
            <input type="number" min="0" max="99" name="score_b" value="${m.row.score_b ?? ""}" style="width:58px" ${ready ? "" : "disabled"}>`}</td>
          <td>${pickSide("b")}</td>
          <td>${m.isBye ? "" : html`<input type="datetime-local" name="starts_at" value="${toLocalInput(m.row.starts_at)}">`}</td>
          <td>${m.isBye ? "" : html`<select name="venue_id"><option value="">–</option>${venues.map((v) => html`<option value="${v.id}" ${v.id === m.row.venue_id ? "selected" : ""}>${v.name}</option>`)}</select>`}</td>
          <td style="white-space:nowrap">${!m.row.id ? "" : html`<button class="btn small green" data-save-row>Save</button>
            ${ready ? html`<a class="btn small ghost" href="/cup-scorecard/${m.row.id}">Scorecard</a>` : ""}`}</td>
        </tr>`;
      })}</tbody></table></div>
      <p class="muted" style="padding:0 14px">Type a final score and press Save, or use <b>Scorecard</b> to score it frame by frame live (with breaks).
        Winners move into the next round automatically. Changing a pairing by hand overrides the bracket for that match.</p>`) : ""}
  </div>`);

  const root = $("#draws-root");
  $("[data-pick]", root).addEventListener("change", (e) => navigate(`/admin/draws?c=${e.target.value}`));
  const guard = async (fn) => { try { await fn(); } catch (err) { toast(friendly(err), "error"); } };

  // Add one entrant (the name defaults to the linked team/player's name).
  $("[data-add-entry]", root).addEventListener("submit", (e) => guard(async () => {
    e.preventDefault();
    const v = readForm(e.target);
    const [kind, linkId] = (v.link ?? "").split(":");
    const linked = kind === "team" ? teams.find((t) => t.id === linkId) : players.find((p) => p.id === linkId);
    const name = v.name || linked?.name || linked?.full_name;
    if (!name) return toast("Choose a team/player or type a name", "error");
    await save("competition_entries", { competition_id: c.id, name, team_id: kind === "team" ? linkId : null, player_id: kind === "player" ? linkId : null, seed: entries.length + 1 });
    toast(`${name} added`); redraw();
  }));

  root.addEventListener("click", (e) => guard(async () => {
    const t = e.target;
    if (t.matches("[data-add-league]")) {
      const leagueId = root.querySelector("[name=league]").value;
      const have = new Set(entries.map((x) => x.team_id));
      const add = teams.filter((x) => x.league_id === leagueId && !have.has(x.id))
        .map((x, i) => ({ competition_id: c.id, name: x.name, team_id: x.id, player_id: null, seed: entries.length + i + 1 }));
      if (!add.length) return toast("Those teams are already in", "error");
      await insertMany("competition_entries", add); toast(`${add.length} teams added`); redraw();
    }
    if (t.matches("[data-remove-entry]")) {
      if (!confirm("Remove this entrant? If the draw is made, their matches will show as a bye.")) return;
      await remove("competition_entries", t.dataset.removeEntry); redraw();
    }
    if (t.matches("[data-draw]")) {
      if (!confirm(hasResults ? "Make a new draw? All results for this competition will be deleted." : "Make the draw now?")) return;
      const order = t.dataset.draw === "random" ? shuffle(entries) : entries;
      await replaceDraw(c.id, makeDraw(order.map((x) => x.id)));
      toast("Draw made"); redraw();
    }
    if (t.matches("[data-redraw]")) {
      const round = Number(t.dataset.redraw);
      const next = redrawNextRound(b, round);
      if (!confirm(`Make a random draw for the ${roundName(round + 1, b.totalRounds).toLowerCase()}?`)) return;
      for (const n of next) {
        const row = rows.find((r) => r.round === round + 1 && r.slot === n.slot);
        await save("competition_matches", { id: row.id, entry_a: n.entry_a, entry_b: n.entry_b, score_a: null, score_b: null, status: "scheduled" });
      }
      toast("Next round drawn"); redraw();
    }
    if (t.matches("[data-save-row]")) {
      const tr = t.closest("tr");
      const get = (n) => tr.querySelector(`[name=${n}]`);
      const num = (n) => (get(n).value === "" ? null : Number(get(n).value));
      const row = { id: tr.dataset.row, entry_a: get("entry_a").value || null, entry_b: get("entry_b").value || null };
      if (get("score_a")) Object.assign(row, { score_a: num("score_a"), score_b: num("score_b") });
      if (get("starts_at")) Object.assign(row, { starts_at: fromLocalInput(get("starts_at").value), venue_id: get("venue_id").value || null });
      if (row.entry_a && row.entry_a === row.entry_b) return toast("Someone can't play themselves", "error");
      if ((row.score_a == null) !== (row.score_b == null)) return toast("Enter both scores (or neither)", "error");
      if ("score_a" in row) row.status = row.score_a != null ? "completed" : "scheduled";
      if (row.score_a != null && row.score_a === row.score_b) return toast("A knockout match needs a winner — scores can't be level", "error");
      t.disabled = true;
      await save("competition_matches", row);
      // Bracket draws: the winner moves straight into their next match.
      if (c.draw_mode !== "redraw" && row.score_a != null) {
        const fresh = await loadCompetitions();
        const nb = buildBracket(fresh.entries.filter((x) => x.competition_id === c.id), fresh.matches.filter((x) => x.competition_id === c.id));
        const adv = winnerAdvance(nb, Number(tr.dataset.round), Number(tr.dataset.slot));
        if (adv) await save("competition_matches", adv);
      }
      toast("Saved"); redraw();
    }
  }));
}
