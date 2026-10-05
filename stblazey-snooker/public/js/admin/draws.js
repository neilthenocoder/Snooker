// Admin: entrants, the draw and results for one knockout competition.
import { html, mount, $, toast, readForm, toLocalInput, fromLocalInput, fmtDate, fmtTime, confirmBox } from "../core/dom.js";
import { table, save, remove, insertMany, loadCompetitions, replaceDraw } from "../core/api.js";
import { buildBracket, makeDraw, shuffle, roundName, isEntry, redrawNextRound, winnerAdvance, firstMatchLosers, drawPlan, drawNextTie, PENDING } from "../core/bracket.js";
import { slugify } from "../core/schedule.js";
import { panel, dataTable, urls, shortName } from "../core/components.js";
import { navigate } from "../core/router.js";
import { friendly } from "./crud.js";

export async function draws(el, { user } = {}) {
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
  // A draw being made live, one tie at a time (see drawNextTie in core/bracket.js).
  const live = c.draw_live?.status === "live" ? c.draw_live : null;
  const liveDone = c.draw_live?.status === "done" ? c.draw_live : null;
  const entryName = (id) => entries.find((e) => e.id === id)?.name ?? "–";
  const inHat = live ? entries.filter((e) => !live.log.some((t) => [t.a, t.b].includes(e.id))) : [];
  const redraw = () => navigate(`/admin/draws?c=${c.id}`, { replace: true });
  // Only the leagues this competition is open to (all of them when none are chosen).
  const open = c.league_ids?.length ? leagues.filter((l) => c.league_ids.includes(l.id)) : leagues;
  const openIds = new Set(open.map((l) => l.id));
  const okTeams = teams.filter((t) => openIds.has(t.league_id) && t.active !== false);
  const okTeamIds = new Set(okTeams.map((t) => t.id));
  const okPlayers = players.filter((p) => okTeamIds.has(p.team_id));
  const linkOptions = c.kind === "Team"
    ? html`<option value="">– no team link –</option>${okTeams.map((t) => html`<option value="team:${t.id}">${t.name}</option>`)}`
    : html`<option value="">– no player link –</option>${okPlayers.map((p) => html`<option value="player:${p.id}">${p.full_name} (${teams.find((t) => t.id === p.team_id)?.name ?? "no team"})</option>`)}`;
  // Plate competitions: for everyone who lost their first match in the main competition.
  const parent = data.competitions.find((x) => x.id === c.parent_id);
  const plate = data.competitions.find((x) => x.parent_id === c.id);
  const bracketOf = (comp) => buildBracket(data.entries.filter((e) => e.competition_id === comp.id), data.matches.filter((m) => m.competition_id === comp.id));
  const sameEntrant = (x, y) => (x.team_id && x.team_id === y.team_id) || (x.player_id && x.player_id === y.player_id) || x.name === y.name;
  const plateEntrants = (main, already = []) => firstMatchLosers(bracketOf(main)).filter((e) => !already.some((x) => sameEntrant(x, e)));

  mount(el, html`<div class="stack" id="draws-root">
    <div class="toolbar">
      <label style="font-weight:700">Competition
        <select data-pick>${data.competitions.map((x) => html`<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${x.name}</option>`)}</select></label>
      <a class="btn ghost" href="${urls.competition(c)}">View public page</a>
      <a class="btn ghost" href="/admin/competitions?edit=${c.id}">Edit competition details</a>
    </div>
    <p class="muted" style="margin:0">Open to: <b>${c.league_ids?.length ? open.map((l) => shortName(l)).join(" and ") : "all leagues"}</b>${c.handicap ? html` · <b>Handicap competition</b>` : ""} — change under Edit competition details.</p>

    ${parent ? html`<div class="notice">This is the <b>plate competition</b> of <a href="/admin/draws?c=${parent.id}" style="font-weight:700;color:var(--red)">${parent.name}</a>: for everyone who lost their first match there.
        ${plateEntrants(parent, entries).length ? html`<b>${plateEntrants(parent, entries).length}</b> more ${plateEntrants(parent, entries).length === 1 ? "has" : "have"} gone out since.` : "Everyone knocked out so far is already in."}
        <div class="btn-row" style="margin-top:8px"><button class="btn small secondary" data-plate-fill ${plateEntrants(parent, entries).length ? "" : "disabled"}>Add those knocked out of ${parent.name}</button></div></div>`
      : plate ? html`<div class="notice">Plate competition: <a href="/admin/draws?c=${plate.id}" style="font-weight:700;color:var(--red)">${plate.name}</a> — entrants who lose their first match here can be added to it from its own page.</div>`
      : rows.length ? html`<div class="notice">Does this competition have a <b>plate</b> for those knocked out in their first match?
          <div class="btn-row" style="margin-top:8px"><button class="btn small secondary" data-plate-create>Create ${c.name} Plate</button></div></div>` : ""}

    ${panel(`1. Entrants (${entries.length})`, html`
      <form class="form" data-add-entry>
        <div class="grid-2">
          <label>Link to a ${c.kind === "Team" ? "team" : "player"} (fills in the name)<select name="link">${linkOptions}</select></label>
          <label>Name shown in the draw<input name="name" placeholder="e.g. Bethel A, or J. Smith & P. Jones"></label>
        </div>
        <div class="btn-row"><button class="btn green">Add entrant</button>
          ${c.kind === "Team" ? html`<span class="muted">or</span>
            <select name="league" style="width:auto;margin:0">${open.map((l) => html`<option value="${l.id}">${l.name}</option>`)}</select>
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
        You can move anyone (or a bye) by hand in step 4.</p>
      <p><b>This competition's draw:</b> ${c.draw_mode === "redraw"
        ? "a fresh random draw every round (use “Draw next round” below when a round is finished)."
        : "winners follow the bracket."} Change this under Competitions → Edit.</p>
      ${hasResults ? html`<div class="notice error">Results have already been entered. Making a new draw will delete them.</div>` : ""}
      ${live ? "" : html`<div class="btn-row">
        <button class="btn blue" data-draw="random" ${entries.length < 2 ? "disabled" : ""}>Random draw</button>
        <button class="btn secondary" data-draw="seeded" ${entries.length < 2 ? "disabled" : ""}>Seeded draw (keep order)</button>
      </div>`}

      <h4 class="form-heading">Live draw<small>Make the draw in front of everyone: each press draws the next tie at random, and it appears on the public draw page, in the home page strip and as a pop-up as it happens. Starting the draw closes the entry form for this competition.</small></h4>
      ${live ? html`<div class="live-ctl">
          <p><span class="live-dot">Live</span> <b>The draw is live.</b> Drawn by ${live.by} · witnessed by ${live.witness}. <b>${live.log.length}</b> of ${drawPlan(entries.length).length} ties drawn.</p>
          ${live.log.length ? html`<p class="live-last">Last drawn: <b>${entryName(live.log.at(-1).a ?? live.log.at(-1).b)}</b> ${live.log.at(-1).a && live.log.at(-1).b ? html`v <b>${entryName(live.log.at(-1).b)}</b>` : "— a bye"}</p>` : ""}
          <p class="muted">Still in the hat (${inHat.length}): ${inHat.map((e) => e.name).join(", ") || "nobody"}</p>
          <div class="btn-row"><button type="button" class="btn green live-next" data-live-next>Draw the next tie</button>
            <a class="btn ghost" href="/draw/${c.slug}" target="_blank" rel="noopener">Open the public draw page</a>
            <button type="button" class="btn small" data-live-cancel>Cancel the live draw</button></div></div>`
        : html`<div class="live-setup" data-live-setup>
          ${liveDone ? html`<p>✓ Drawn live on <b>${fmtDate(liveDone.finished_at)} at ${fmtTime(liveDone.finished_at)}</b> by ${liveDone.by}, witnessed by ${liveDone.witness}. <a href="/draw/${c.slug}" style="color:var(--red);font-weight:700">See the draw page</a></p>` : ""}
          <div class="grid-2">
            <label>When the draw will be made <span class="muted" style="font-weight:400">(shown on the website)</span><input type="datetime-local" name="draw_at" value="${toLocalInput(c.draw_at)}"></label>
            <label>Witnessed by <span class="muted" style="font-weight:400">(a second person must watch the draw)</span><input type="text" name="witness" maxlength="80" placeholder="Their name"></label>
          </div>
          <div class="btn-row"><button type="button" class="btn secondary" data-save-draw-at>Save the date</button>
            <button type="button" class="btn green" data-live-start ${entries.length < 2 ? "disabled" : ""}>Start the live draw now</button>
            <a class="btn ghost" href="/draw/${c.slug}">Public draw page</a></div></div>`}
      </div>`)}

    ${c.draw_mode === "redraw" && b.totalRounds > 1 ? html`<div class="btn-row">${b.rounds.slice(0, -1).map((list, i) => {
      const done = list.every((m) => m.winner !== PENDING);
      const nextSet = b.rounds[i + 1].some((m) => m.row.entry_a || m.row.entry_b);
      return html`<button class="btn ${done && !nextSet ? "blue" : "ghost"}" data-redraw="${i + 1}" ${done ? "" : "disabled"}>
        Draw ${roundName(i + 2, b.totalRounds).toLowerCase()}${nextSet ? " again" : ""}</button>`;
    })}</div>` : ""}

    ${b.totalRounds ? panel("3. Round deadlines", html`<form class="form" data-deadlines>
      <p style="margin-top:0">The date each round must be played by. It's shown on the competition page next to the round.</p>
      <div class="deadline-grid">${b.rounds.map((_, i) => html`<label>${roundName(i + 1, b.totalRounds)}
        <input type="date" name="round_${i + 1}" value="${c.round_deadlines?.[i + 1] ?? ""}"></label>`)}</div>
      <div class="btn-row"><button class="btn green">Save deadlines</button></div></form>`) : ""}

    ${b.totalRounds ? panel("4. Pairings, dates & results", html`<div class="table-scroll"><table class="data results-edit">
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

  // Round deadlines are kept on the competition as { "1": "2026-10-04", … }.
  $("[data-deadlines]", root)?.addEventListener("submit", (e) => guard(async () => {
    e.preventDefault();
    const v = readForm(e.target);
    const round_deadlines = Object.fromEntries(b.rounds.map((_, i) => [i + 1, v[`round_${i + 1}`]]).filter(([, d]) => d));
    await save("competitions", { id: c.id, round_deadlines });
    toast("Deadlines saved"); redraw();
  }));

  const asEntries = (list, competitionId, from = 0) => list.map((e, i) => ({ competition_id: competitionId, name: e.name, team_id: e.team_id ?? null, player_id: e.player_id ?? null, seed: from + i + 1 }));

  root.addEventListener("click", (e) => guard(async () => {
    const t = e.target;
    // ── live draw ──
    if (t.matches("[data-save-draw-at]")) {
      await save("competitions", { id: c.id, draw_at: fromLocalInput($("[name=draw_at]", root).value) });
      toast("Draw date saved"); return redraw();
    }
    if (t.matches("[data-live-start]")) {
      const witness = $("[name=witness]", root).value.trim();
      if (!witness) return toast("Type the name of the person witnessing the draw", "error");
      const ok = await confirmBox(`${entries.length} entrants go into the hat. Each press of “Draw the next tie” draws at random and shows it to everyone straight away — it can't be re-drawn quietly.${rows.length ? "\n\nThe draw that's there now, and any results, will be replaced." : ""}`,
        { title: `Start the ${c.name} draw?`, ok: "Start the live draw" });
      if (!ok) return;
      await replaceDraw(c.id, makeDraw(entries.map(() => null)));
      await save("competitions", { id: c.id, entries_open: false, draw_live: { status: "live", round: 1, by: user?.profile?.full_name || user?.email || "League official", witness, started_at: new Date().toISOString(), log: [] } });
      toast("The draw is live"); return redraw();
    }
    if (t.matches("[data-live-next]")) {
      t.disabled = true;
      const next = drawNextTie(entries.map((x) => x.id), live);
      if (!next) return redraw();
      const { tie, done } = next;
      const row = rows.find((r) => r.round === 1 && r.slot === tie.slot);
      await save("competition_matches", { id: row.id, entry_a: tie.a, entry_b: tie.b });
      // A bye goes straight through to the next round.
      const through = tie.a && !tie.b ? tie.a : !tie.a && tie.b ? tie.b : null;
      const onward = through && rows.find((r) => r.round === 2 && r.slot === Math.floor(tie.slot / 2));
      if (onward) await save("competition_matches", { id: onward.id, [tie.slot % 2 ? "entry_b" : "entry_a"]: through });
      await save("competitions", { id: c.id, draw_live: { ...live, log: [...live.log, tie], ...(done ? { status: "done", finished_at: new Date().toISOString() } : {}) } });
      toast(done ? "That's the draw complete" : tie.a && tie.b ? `${entryName(tie.a)} v ${entryName(tie.b)}` : `${entryName(through)} gets a bye`);
      return redraw();
    }
    if (t.matches("[data-live-cancel]")) {
      if (!(await confirmBox("The ties drawn so far are thrown away and the competition goes back to having no draw.", { title: "Cancel the live draw?", ok: "Cancel the draw", cancel: "Keep going" }))) return;
      await replaceDraw(c.id, []);
      await save("competitions", { id: c.id, draw_live: null });
      toast("Live draw cancelled"); return redraw();
    }
    if (t.matches("[data-plate-create]")) {
      const losers = plateEntrants(c);
      if (!confirm(`Create “${c.name} Plate”${losers.length ? ` with the ${losers.length} knocked out so far` : ""}? You can add more as first matches finish, then make its draw.`)) return;
      const made = await save("competitions", {
        name: `${c.name} Plate`, slug: slugify(`${c.name} Plate ${data.competitions.some((x) => x.slug === slugify(`${c.name} Plate`)) ? Date.now().toString(36) : ""}`),
        season_id: c.season_id, kind: c.kind, draw_mode: "bracket", best_of: c.best_of, sort: (c.sort ?? 1) + 1, image_url: c.image_url ?? null,
        info: `Plate competition for those knocked out in their first match of the ${c.name}.`, league_ids: c.league_ids ?? [], handicap: !!c.handicap, round_deadlines: {}, parent_id: c.id,
      });
      await insertMany("competition_entries", asEntries(losers, made.id));
      toast("Plate competition created"); return navigate(`/admin/draws?c=${made.id}`);
    }
    if (t.matches("[data-plate-fill]")) {
      const add = plateEntrants(parent, entries);
      await insertMany("competition_entries", asEntries(add, c.id, entries.length));
      toast(`${add.length} added`); return redraw();
    }
    if (t.matches("[data-add-league]")) {
      const leagueId = root.querySelector("[name=league]").value;
      const have = new Set(entries.map((x) => x.team_id));
      const add = okTeams.filter((x) => x.league_id === leagueId && !have.has(x.id))
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
      // This draw wasn't made live; and once there is a draw, the entry form closes for this competition.
      if (c.draw_live || c.entries_open) await save("competitions", { id: c.id, draw_live: null, entries_open: false });
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
