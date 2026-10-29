// Admin: entrants, the draw and results for one knockout competition.
import { html, mount, $, $$, toast, readForm, toLocalInput, fromLocalInput, fmtDate, fmtTime, confirmBox } from "../core/dom.js";
import { table, save, remove, insertMany, loadCompetitions, replaceDraw, setWalkover } from "../core/api.js";
import { buildBracket, makeDraw, shuffle, roundName, isEntry, walkoverSide, placeLabel, EMPTY, redrawNextRound, winnerAdvance, firstMatchLosers, drawPlan, drawNextTie, PENDING, inEntry, autoPrelims, maxPrelims, drawShape } from "../core/bracket.js";
import { slugify } from "../core/schedule.js";
import { panel, dataTable, urls, shortName, isActivePlayer } from "../core/components.js";
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
  // Players who can be entered: playing, and in one of those teams (or without a team, when every league can enter).
  const okPlayers = players.filter((p) => isActivePlayer(p) && (okTeamIds.has(p.team_id) || (!p.team_id && !c.league_ids?.length)));
  const linkOptions = c.kind === "Team"
    ? html`<option value="">– no team link –</option>${okTeams.map((t) => html`<option value="team:${t.id}">${t.name}</option>`)}`
    : html`<option value="">– no player link –</option>${okPlayers.map((p) => html`<option value="player:${p.id}">${p.full_name} (${teams.find((t) => t.id === p.team_id)?.name ?? "no team"})</option>`)}`;
  // Round 54 (Rich): the entrant picker is a search box — teams first for team competitions (and anything called
  // "Team …", like Team Pairs), players first otherwise — and anyone already entered is greyed out, as on scorecards.
  const teamFirst = c.kind === "Team" || /\bteam/i.test(c.name);
  // Round 56 (Rich: "with the doubles competition, how do I pair up who is with who?"): a doubles entrant is a pair —
  // pick Player 1 and Player 2, and both get the pair's results and their own breaks. (Team Pairs enters teams.)
  const pairMode = c.kind === "Doubles" && !teamFirst;
  // Round 72 (Rich: "competitions, we don't have seeds — but other leagues might"): seeds only when the competition is ticked as seeded.
  const seeded = !!c.seeded;
  const clubOf = (e) => {
    const teamIds = e.team_id ? [e.team_id] : [e.player_id, e.partner_id].filter(Boolean).map((id) => players.find((p) => p.id === id)?.team_id).filter(Boolean);
    return [...new Set(teamIds)].map((id) => { const t = teams.find((x) => x.id === id); const v = venues.find((x) => x.id === t?.venue_id);
      return t ? `${t.name}${v ? ` (${v.name})` : ""}` : ""; }).filter(Boolean).join(" / ");
  };
  // Round 72: how many pre-qualifier matches — worked out from the number of entrants, and can be changed.
  const prelimsNow = autoPrelims(entries.length);
  const shapeHtml = (n, p) => {
    const shape = drawShape(n, p);
    if (!shape.length) return html`<p class="muted" style="margin:0">Add at least two entrants first.</p>`;
    return html`<ol class="draw-shape">${shape.map((r, i) => html`<li><b>${r.name}</b><span>${r.matches} match${r.matches === 1 ? "" : "es"}${i === 0 && r.byes ? html` · <em>${r.byes} straight through to ${shape[1]?.name ?? "the next round"}</em>` : r.byes ? html` · <em>${r.byes} bye${r.byes === 1 ? "" : "s"}</em>` : ""}</span></li>`)}</ol>`;
  };
  const pickable = [
    ...(c.kind === "Singles" || pairMode ? [] : okTeams.map((t) => ({ link: `team:${t.id}`, name: t.name, sub: leagues.find((l) => l.id === t.league_id)?.name ?? "Team", group: "Teams", taken: entries.some((e) => e.team_id === t.id) }))),
    ...(c.kind === "Team" ? [] : okPlayers.map((p) => ({ link: `player:${p.id}`, name: p.full_name, sub: teams.find((t) => t.id === p.team_id)?.name ?? "No team", group: "Players", taken: entries.some((e) => inEntry(e, p.id)) }))),
  ].sort((a, b) => (teamFirst ? (a.group === "Teams" ? 0 : 1) - (b.group === "Teams" ? 0 : 1) : (a.group === "Players" ? 0 : 1) - (b.group === "Players" ? 0 : 1)) || a.name.localeCompare(b.name));
  // Plate competitions: for everyone who lost their first match in the main competition.
  const parent = data.competitions.find((x) => x.id === c.parent_id);
  const plate = data.competitions.find((x) => x.parent_id === c.id);
  const bracketOf = (comp) => buildBracket(data.entries.filter((e) => e.competition_id === comp.id), data.matches.filter((m) => m.competition_id === comp.id));
  const sameEntrant = (x, y) => (x.team_id && x.team_id === y.team_id) || (x.player_id && x.player_id === y.player_id && (x.partner_id ?? null) === (y.partner_id ?? null)) || x.name === y.name;
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
        ${pairMode ? html`<p class="muted" style="margin:0">A doubles entrant is a <b>pair</b>: find each player. Both of them get the pair's results on their own page, and each player's breaks are entered against them on the scorecard.</p>
        <div class="grid-3 ent-pair">
          ${[["link", "Player 1"], ["link2", "Player 2"]].map(([field, label]) => html`<div class="field-label ent-pick" data-ent-pick="${field}"><span>${label}</span>
            <input type="search" data-ent-q placeholder="Start typing a name…" autocomplete="off" aria-label="Find ${label}">
            <input type="hidden" name="${field}" value="">
            <div class="ent-list" data-ent-list hidden></div></div>`)}
          <label>Name shown in the draw <span class="muted" style="font-weight:400">(filled in for you)</span><input name="name" placeholder="e.g. John Smith & Paul Jones"></label>
        </div>` : html`<div class="grid-2">
          <div class="field-label ent-pick" data-ent-pick="link"><span>Find a ${teamFirst ? "team or player" : "player or team"} <span class="muted" style="font-weight:400">(fills in the name)</span></span>
            <input type="search" data-ent-q placeholder="Start typing a name…" autocomplete="off" aria-label="Find a player or team to enter">
            <input type="hidden" name="link" value="">
            <div class="ent-list" data-ent-list hidden></div></div>
          <label>Name shown in the draw<input name="name" placeholder="e.g. Bethel A, or J. Smith & P. Jones"></label>
        </div>`}
        <div class="btn-row"><button class="btn green">${pairMode ? "Add this pair" : "Add entrant"}</button>
          ${c.kind === "Team" ? html`<span class="muted">or</span>
            <select name="league" style="width:auto;margin:0">${open.map((l) => html`<option value="${l.id}">${l.name}</option>`)}</select>
            <button type="button" class="btn secondary" data-add-league>Add every team in this league</button>` : ""}
        </div>
      </form>
      ${dataTable([
        // Round 73 (Rich): a number for every entrant (so it's clear how many have been added), and their club —
        // the team they play for and its venue, to see where the home player plays.
        { label: "#", cell: (e, i) => i + 1, cls: "num" },
        ...(seeded ? [{ label: "Seed", cell: (e) => e.seed || "–", cls: "num" }] : []),
        { label: "Name", cell: (e) => html`<b>${e.name}</b>` },
        { label: pairMode ? "Players" : "Linked to", cell: (e) => teams.find((t) => t.id === e.team_id)?.name ?? ([e.player_id, e.partner_id].filter(Boolean).map((id) => players.find((p) => p.id === id)?.full_name).filter(Boolean).join(" & ") || (pairMode ? html`<span class="muted">Not linked — remove and add again as a pair</span>` : "–")) },
        { label: "Club (venue)", cell: (e) => clubOf(e) || html`<span class="muted">–</span>` },
        { label: "", cls: "right", cell: (e) => html`<button class="btn small" data-remove-entry="${e.id}">Remove</button>` },
      ], entries, { empty: "No entrants yet." })}`)}

    ${panel("2. Make the draw", html`<div class="form">
      <div class="prelim-box">
        <label class="prelim-field">Pre-qualifier matches
          <input type="number" name="prelims" min="0" max="${maxPrelims(entries.length)}" value="${prelimsNow}" ${entries.length < 3 ? "disabled" : ""}>
          <small class="muted">Worked out from the ${entries.length} entrant${entries.length === 1 ? "" : "s"}${prelimsNow ? ` (${entries.length} − ${entries.length - prelimsNow} = ${prelimsNow})` : ""} — change it if you need to.</small></label>
        <div class="prelim-shape"><small class="muted">How the draw will look</small><div data-shape>${shapeHtml(entries.length, prelimsNow)}</div></div>
      </div>
      <p class="muted" style="margin:0">With pre-qualifiers, the players drawn last play them; everyone else goes straight into the next round (no long list of byes).
        ${seeded ? "Seeded draw: the entrants at the bottom of the list above play the pre-qualifiers and the top seeds are kept apart." : ""}
        You can still move anyone by hand in step 4.</p>
      <p style="margin:0"><b>This competition's draw:</b> ${c.draw_mode === "redraw"
        ? "a fresh random draw every round (use “Draw next round” below when a round is finished)."
        : "winners follow the bracket."} Change this under Competitions → Edit.</p>
      ${hasResults ? html`<div class="notice error">Results have already been entered. Making a new draw will delete them.</div>` : ""}
      ${live ? "" : html`<div class="btn-row">
        <button class="btn blue" data-draw="random" ${entries.length < 2 ? "disabled" : ""}>Make the draw (random)</button>
        ${seeded ? html`<button class="btn secondary" data-draw="seeded" ${entries.length < 2 ? "disabled" : ""}>Seeded draw (keep order)</button>` : ""}
      </div>`}

      <h4 class="form-heading">Live draw<small>Make the draw in front of everyone: each press draws the next tie at random, and it appears on the public draw page, in the home page strip and as a pop-up as it happens. Starting the draw closes the entry form for this competition.</small></h4>
      ${live ? html`<div class="live-ctl">
          <p><span class="live-dot">Live</span> <b>The draw is live.</b> Drawn by ${live.by} · witnessed by ${live.witness}. <b>${live.log.length}</b> of ${drawPlan(entries.length, live.prelims ?? null).length} ties drawn.</p>
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
        Draw ${roundName(i + 2, b.totalRounds, b).toLowerCase()}${nextSet ? " again" : ""}</button>`;
    })}</div>` : ""}

    ${b.totalRounds ? panel("3. Round deadlines", html`<form class="form" data-deadlines>
      <p style="margin-top:0">The date each round must be played by — shown on the competition page next to the round. Players (and captains, in a team competition) get a warning in their own area as it comes up.
        <b>Contact by</b> (optional) is the day the home player must have contacted their opponent: until then the away player is told to wait for the call; after it, they are told the rule for when nobody has been in touch (Site settings → Competitions).</p>
      <div class="deadline-grid">${b.rounds.map((_, i) => html`<fieldset class="deadline-round"><legend>${roundName(i + 1, b.totalRounds, b)}</legend>
        <label>Play by <input type="date" name="round_${i + 1}" value="${c.round_deadlines?.[i + 1] ?? ""}"></label>
        <label>Contact by <input type="date" name="contact_${i + 1}" value="${c.round_contact?.[i + 1] ?? ""}"></label></fieldset>`)}</div>
      <div class="btn-row form-actions"><button class="btn green">Save deadlines</button></div></form>`) : ""}

    ${b.totalRounds ? panel("4. Pairings, dates & results", html`
      <p class="muted dm-intro">Each round on its own. Type a score and <b>Save</b>, or press <b>Score live</b> to score a match frame by frame — everyone following on the website sees it as it happens. Entrants who go straight through (byes) are tucked away under each round.</p>
      ${b.rounds.map((list, ri) => {
        const matchRow = (m) => {
        // Who's in each slot: round 1 can be anyone or a bye; later rounds default to "the winner".
        // Each side: a team / player, a bye, or (round 41) "the winner of that match" — for draws made on paper
        // before the round before has finished ("St Neot or Mevagissey C").
        const sources = b.rounds.slice(0, m.round - 1).flat().filter((x) => x.row.id && !(x.a === EMPTY && x.b === EMPTY) && !(x.isBye && isEntry(x.winner) && !x.row.from_a && !x.row.from_b));
        const sideName = (x, sd) => (isEntry(x[sd]) ? b.entryById.get(x[sd]).name : x[sd] === EMPTY ? null : placeLabel(b, x, sd) ?? "TBC");
        const sourceLabel = (x) => (x.isBye ? `${[sideName(x, "a"), sideName(x, "b")].filter(Boolean).join("")} (through from ${roundName(x.round, b.totalRounds, b).toLowerCase()})`
          : `Winner of ${sideName(x, "a")} v ${sideName(x, "b")} (${roundName(x.round, b.totalRounds, b).toLowerCase()})`);
        const pickSide = (side) => {
          const key = side === "a" ? "entry_a" : "entry_b";
          const cur = m.row[`bye_${side}`] ? "bye" : m.row[`from_${side}`] ? `w:${m.row[`from_${side}`]}` : (m.row[key] ?? "");
          // Round 73 (Rich): an empty place reads as a plain line to choose from, not a name or "Bye".
          const auto = m.round === 1 ? "—— choose ——" : c.draw_mode === "redraw" ? "—— not drawn yet ——" : "—— winner goes here ——";
          return html`<select name="${key}" class="pair-pick ${cur ? "" : "is-empty"}"><option value="">${auto}</option>
            <option value="bye" ${cur === "bye" ? "selected" : ""}>Bye</option>
            ${sources.length ? html`<optgroup label="Winner of a match">${sources.map((x) => html`<option value="w:${x.row.id}" ${cur === `w:${x.row.id}` ? "selected" : ""}>${sourceLabel(x)}</option>`)}</optgroup>` : ""}
            <optgroup label="${m.round > 1 ? "Team / player" : "Entrants"}">${entries.map((e) => html`<option value="${e.id}" ${cur === e.id ? "selected" : ""}>${e.name}</option>`)}</optgroup></select>
            ${m.round > 1 && !m.row[key] && !m.row[`bye_${side}`] ? html`<small class="muted">${isEntry(m[side]) ? b.entryById.get(m[side]).name : placeLabel(b, m, side) ?? "to be decided"}</small>` : ""}`;
        };
        const ready = isEntry(m.a) && isEntry(m.b);
        const label = `${roundName(m.round, b.totalRounds, b)}: ${isEntry(m.a) ? b.entryById.get(m.a).name : "?"} v ${isEntry(m.b) ? b.entryById.get(m.b).name : m.isBye ? "bye" : "?"}`;
        return html`<tr data-row="${m.row.id ?? ""}" data-round="${m.round}" data-slot="${m.slot}" data-label="${label}" class="dm ${m.isBye ? "dm-bye" : ""}">
          <td class="dm-a">${m.row.status === "in_progress" ? html`<span class="live-dot">Live</span> ` : m.row.status === "postponed" ? html`<span class="status postponed">postponed</span> ` : ""}${pickSide("a")}</td>
          <td class="dm-score">${m.isBye ? html`<span class="muted">bye</span>` : html`
            <input type="number" min="0" max="99" name="score_a" value="${m.row.score_a ?? ""}" style="width:58px" ${ready && !walkoverSide(m.row) ? "" : "disabled"}> –
            <input type="number" min="0" max="99" name="score_b" value="${m.row.score_b ?? ""}" style="width:58px" ${ready && !walkoverSide(m.row) ? "" : "disabled"}>
            ${ready ? html`<select name="walkover" class="wo-pick" aria-label="Walkover" title="Not played: give the match to one side">
              <option value="">No walkover</option>
              <option value="a" ${walkoverSide(m.row) === "a" ? "selected" : ""}>Walkover to ${b.entryById.get(m.a)?.name}</option>
              <option value="b" ${walkoverSide(m.row) === "b" ? "selected" : ""}>Walkover to ${b.entryById.get(m.b)?.name}</option></select>` : ""}`}</td>
          <td class="dm-b">${pickSide("b")}${m.isBye ? "" : html`<label class="home-switch" title="The home player didn't contact their opponent in time: the second-named is now at home"><input type="checkbox" name="home_switched" ${m.row.home_switched ? "checked" : ""}> now at home</label>`}</td>
          <td class="dm-when">${m.isBye ? "" : html`<span class="dm-l">Date & time</span><input type="datetime-local" name="starts_at" value="${toLocalInput(m.row.starts_at)}">
            ${ready && !walkoverSide(m.row) && m.row.status !== "completed" ? html`<label class="home-switch" title="Not played on the day: shows as postponed until it is rearranged"><input type="checkbox" name="postponed" ${m.row.status === "postponed" ? "checked" : ""}> postponed</label>` : ""}`}</td>
          <td class="dm-venue">${m.isBye ? "" : html`<span class="dm-l">Venue</span><select name="venue_id"><option value="">–</option>${venues.map((v) => html`<option value="${v.id}" ${v.id === m.row.venue_id ? "selected" : ""}>${v.name}</option>`)}</select>`}</td>
          <td class="dm-act">${!m.row.id ? "" : html`<button class="btn small green" data-save-row>Save</button>
            ${ready ? html`<a class="btn small ${m.row.status === "completed" || walkoverSide(m.row) ? "ghost" : "blue"}" href="/cup-scorecard/${m.row.no ?? m.row.id}" title="Score it frame by frame — everyone on the website sees it live">${m.row.status === "completed" ? "Scorecard" : m.row.status === "in_progress" ? "Carry on scoring live" : "Score live"}</a>` : ""}`}</td>
        </tr>`;
        };
        const real = list.filter((m) => !m.isBye), byes = list.filter((m) => m.isBye);
        const through = byes.filter((m) => isEntry(m.winner));
        const name = roundName(ri + 1, b.totalRounds, b);
        const played = real.filter((m) => m.played).length;
        return html`<section class="dm-round" data-dm-round="${ri + 1}">
          <h4 class="dm-round-h">${name}<small>${real.length ? `${played} of ${real.length} played` : "no matches"}${c.round_deadlines?.[ri + 1] ? ` · play by ${fmtDate(c.round_deadlines[ri + 1])}` : ""}</small></h4>
          <table class="data results-edit dm-table">
            <tbody>${real.map(matchRow)}</tbody>
            ${byes.length ? html`<tbody class="dm-byes" hidden>${byes.map(matchRow)}</tbody>
            <tbody><tr class="dm-byes-toggle"><td><button type="button" class="btn small ghost" data-show-byes aria-expanded="false">${through.length
              ? `${through.length} straight through to ${roundName(ri + 2, b.totalRounds, b)} (bye${through.length === 1 ? "" : "s"}) — show / change`
              : `${byes.length} empty place${byes.length === 1 ? "" : "s"} — show / change`}</button>
              ${through.length && through.length <= 40 ? html`<small class="muted dm-through">${through.map((m) => b.entryById.get(m.winner)?.name).filter(Boolean).join(", ")}</small>` : ""}</td></tr></tbody>` : ""}
          </table></section>`;
      })}
      <div class="btn-row save-all-row"><button type="button" class="btn green" data-save-all>Save all changes</button><small class="muted" data-dirty-count>Change as many matches as you like, then save them all at once.</small></div>
      <p class="muted" style="padding:0 14px">Type a final score and press Save (or <b>Save all changes</b>), or use <b>Score live</b> to score it frame by frame live (with breaks) — on a phone or tablet at the table.
        Not played? Choose <b>Walkover to …</b> under the score, or tick <b>postponed</b> under the date — then save.
        <br><b>Drawing a round on paper before the one before it has finished?</b> Set each side to a team, <b>Bye</b>, or <b>Winner of …</b> a match
        (it shows as “St Neot or Mevagissey C” and the winner drops in by itself when that result goes in).
        Winners move into the next round automatically. Changing a pairing by hand overrides the bracket for that match.</p>`) : ""}
  </div>`);

  const root = $("#draws-root");
  $("[data-pick]", root).addEventListener("change", (e) => navigate(`/admin/draws?c=${e.target.value}`));
  // A walkover has no score: the score boxes switch off while one is chosen.
  // Rows with unsaved changes are marked (and counted beside Save all).
  const markDirty = (e) => {
    const tr = e.target.closest("tr[data-row]");
    if (!tr || !tr.dataset.row) return;
    tr.classList.add("dirty"); tr.classList.remove("row-error");
    const n = root.querySelectorAll("tr[data-row].dirty").length, note = $("[data-dirty-count]", root);
    if (note) note.textContent = `${n} match${n > 1 ? "es" : ""} changed — not saved yet`;
  };
  root.addEventListener("input", markDirty);
  root.addEventListener("change", markDirty);
  root.addEventListener("change", (e) => {
    if (!e.target.matches(".wo-pick")) return;
    for (const n of ["score_a", "score_b"]) { const box = e.target.closest("tr").querySelector(`[name=${n}]`); box.disabled = !!e.target.value; if (e.target.value) box.value = ""; }
  });
  const guard = async (fn) => { try { await fn(); } catch (err) { toast(friendly(err), "error"); } };
  // Round 72: the number of pre-qualifier matches chosen in step 2 (the shape underneath follows it as it's typed).
  const prelimsChosen = () => {
    const box = $("[name=prelims]", root);
    const n = Math.round(Number(box?.value));
    return box && box.value !== "" && Number.isFinite(n) ? Math.max(0, Math.min(maxPrelims(entries.length), n)) : prelimsNow;
  };
  $("[name=prelims]", root)?.addEventListener("input", () => { const shape = $("[data-shape]", root); if (shape) mount(shape, shapeHtml(entries.length, prelimsChosen())); });

  // Save one row of "Pairings, dates & results". Throws with a readable message when something isn't right;
  // returns what to say when it worked. Used by each row's Save button and by Save all.
  const saveRow = async (tr) => {
    const get = (n) => tr.querySelector(`[name=${n}]`);
    const num = (n) => (get(n).value === "" ? null : Number(get(n).value));
    const before = rows.find((r) => r.id === tr.dataset.row);
    const row = { id: tr.dataset.row };
    // A pairing is only written when it was changed here — so Save all never undoes a winner that the
    // database has just moved into this match from the round before.
    // "bye", "w:<match id>" (the winner of that match) or a team / player id. Round 41.
    const parse = (v) => (v === "bye" ? { entry: null, from: null, bye: true } : v.startsWith("w:") ? { entry: null, from: v.slice(2), bye: false } : { entry: v || null, from: null, bye: false });
    const A = parse(get("entry_a").value), B = parse(get("entry_b").value);
    const changed = (P, sd) => (P.from ?? null) !== (before?.[`from_${sd}`] ?? null) || P.bye !== !!before?.[`bye_${sd}`] || (!P.from && P.entry !== (before?.[`entry_${sd}`] ?? null));
    if (changed(A, "a")) Object.assign(row, { entry_a: A.entry, from_a: A.from, bye_a: A.bye });
    if (changed(B, "b")) Object.assign(row, { entry_b: B.entry, from_b: B.from, bye_b: B.bye });
    if (A.from && A.from === B.from) throw new Error("Both sides can't be the winner of the same match");
    if (A.bye && B.bye) throw new Error("Both sides can't be a bye");
    const pickA = A.entry, pickB = B.entry;
    if (get("score_a")) Object.assign(row, { score_a: num("score_a"), score_b: num("score_b") });
    if (get("starts_at")) Object.assign(row, { starts_at: fromLocalInput(get("starts_at").value), venue_id: get("venue_id").value || null });
    if (get("home_switched")) row.home_switched = get("home_switched").checked;
    if (pickA && pickA === pickB) throw new Error("Someone can't play themselves");
    // Round 37: a walkover — save the pairing, date and venue, then the database gives the match to that side.
    const wo = get("walkover")?.value || null;
    if (wo) {
      delete row.score_a; delete row.score_b;
      await save("competition_matches", row);
      await setWalkover(row.id, wo);
      return `Walkover saved — ${b.entryById.get(wo === "a" ? pickA ?? before?.entry_a : pickB ?? before?.entry_b)?.name ?? "the winner"} through to the next round`;
    }
    if (walkoverSide(before)) await setWalkover(row.id, null);
    if ((row.score_a == null) !== (row.score_b == null)) throw new Error("Enter both scores (or neither)");
    // Rich, round 38: a match can be postponed (no score yet). Untick it once it has been rearranged.
    const postponed = !!get("postponed")?.checked;
    if ("score_a" in row) row.status = row.score_a != null ? "completed" : postponed ? "postponed" : "scheduled";
    // Level on frames is only possible when the scorecard's total points decided it (handicap competitions).
    const onPoints = before?.status === "completed" && before.score_a === row.score_a && before.score_b === row.score_b && before.points_a != null && before.points_a !== before.points_b;
    if (row.score_a != null && row.score_a === row.score_b && !onPoints) throw new Error(c.handicap
      ? "Level on frames: enter the frames on the Scorecard instead, so the total points can decide the winner." : "A knockout match needs a winner — scores can't be level");
    await save("competition_matches", row);
    // Bracket draws: the winner moves straight into their next match.
    if (c.draw_mode !== "redraw" && row.score_a != null) {
      const fresh = await loadCompetitions();
      const nb = buildBracket(fresh.entries.filter((x) => x.competition_id === c.id), fresh.matches.filter((x) => x.competition_id === c.id));
      const adv = winnerAdvance(nb, Number(tr.dataset.round), Number(tr.dataset.slot));
      if (adv) await save("competition_matches", adv);
    }
    return row.status === "postponed" ? "Saved — marked as postponed" : "Saved";
  };

  // The search boxes: type to narrow the list; press a name (or Enter for the first one) to pick it.
  // (Doubles: two boxes, one for each player of the pair; the name in the draw is made from both.)
  const nameBox = $("[data-add-entry] [name=name]", root);
  let autoName = "";
  const pairName = () => {
    if (!pairMode) return;
    const names = ["link", "link2"].map((f) => players.find((p) => p.id === ($(`[data-add-entry] [name=${f}]`, root).value.split(":")[1] ?? ""))?.full_name).filter(Boolean);
    if (names.length === 2 && (!nameBox.value || nameBox.value === autoName)) { autoName = `${names[0]} & ${names[1]}`; nameBox.value = autoName; }
  };
  for (const pick of $$("[data-ent-pick]", root)) {
    const q = $("[data-ent-q]", pick), list = $("[data-ent-list]", pick), hidden = $("input[type=hidden]", pick);
    const other = () => $$("[data-ent-pick] input[type=hidden]", root).filter((x) => x !== hidden).map((x) => x.value).filter(Boolean);
    const draw = () => {
      const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), chosen = other();
      const hits = pickable.filter((x) => words.every((w) => `${x.name} ${x.sub}`.toLowerCase().includes(w))).slice(0, 40)
        .map((x) => (chosen.includes(x.link) ? { ...x, taken: true, why: "Already picked" } : x));
      const groups = [...new Set(hits.map((x) => x.group))];
      mount(list, hits.length ? html`${groups.map((g) => html`<small class="ent-h">${g}</small>${hits.filter((x) => x.group === g).map((x) => html`<button type="button" class="ent-item ${x.taken ? "taken" : ""}" data-link="${x.link}" data-name="${x.name}" ${x.taken ? "disabled" : ""}>
          <b>${x.name}</b><small>${x.taken ? x.why ?? "Already entered" : x.sub}</small></button>`)}`)}` : html`<p class="ent-none">Nobody matches “${q.value}”.${pairMode ? "" : " You can still type a name in the box on the right."}</p>`);
      list.hidden = false;
    };
    const choose = (b) => { hidden.value = b.dataset.link; q.value = b.dataset.name; if (!pairMode && !nameBox.value) nameBox.value = b.dataset.name; list.hidden = true; pairName(); };
    q.addEventListener("focus", draw);
    q.addEventListener("input", () => { hidden.value = ""; draw(); });
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const first = $(".ent-item:not([disabled])", list); if (first) choose(first); } if (e.key === "Escape") list.hidden = true; });
    list.addEventListener("click", (e) => { const b = e.target.closest(".ent-item:not([disabled])"); if (b) choose(b); });
    document.addEventListener("click", (e) => { if (!pick.contains(e.target)) list.hidden = true; });
  }
  // Add one entrant (the name defaults to the linked team/player's name; a pair's to both names).
  $("[data-add-entry]", root).addEventListener("submit", (e) => guard(async () => {
    e.preventDefault();
    const v = readForm(e.target);
    if (pairMode) {
      const [p1, p2] = [v.link, v.link2].map((x) => players.find((p) => p.id === String(x ?? "").split(":")[1]));
      if (!p1 || !p2) return toast("Find both players of the pair", "error");
      const name = v.name || `${p1.full_name} & ${p2.full_name}`;
      await save("competition_entries", { competition_id: c.id, name, team_id: null, player_id: p1.id, partner_id: p2.id, seed: entries.length + 1 });
      return (toast(`${name} added`), redraw());
    }
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
    const round_contact = Object.fromEntries(b.rounds.map((_, i) => [i + 1, v[`contact_${i + 1}`]]).filter(([, d]) => d));
    const late = b.rounds.map((_, i) => i + 1).find((r) => round_contact[r] && round_deadlines[r] && round_contact[r] > round_deadlines[r]);
    if (late) return toast(`${roundName(late, b.totalRounds, b)}: the contact date must be before the play-by date`, "error");
    await save("competitions", { id: c.id, round_deadlines, round_contact });
    toast("Deadlines saved"); redraw();
  }));

  const asEntries = (list, competitionId, from = 0) => list.map((e, i) => ({ competition_id: competitionId, name: e.name, team_id: e.team_id ?? null, player_id: e.player_id ?? null, partner_id: e.partner_id ?? null, seed: from + i + 1 }));

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
      await replaceDraw(c.id, makeDraw(entries.map(() => null), { prelims: prelimsChosen() }));
      await save("competitions", { id: c.id, entries_open: false, draw_live: { status: "live", round: 1, prelims: prelimsChosen(), by: user?.profile?.full_name || user?.email || "League official", witness, started_at: new Date().toISOString(), log: [] } });
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
      const order = t.dataset.draw === "random" || !seeded ? shuffle(entries) : entries;
      await replaceDraw(c.id, makeDraw(order.map((x) => x.id), { prelims: prelimsChosen() }));
      // This draw wasn't made live; and once there is a draw, the entry form closes for this competition.
      if (c.draw_live || c.entries_open) await save("competitions", { id: c.id, draw_live: null, entries_open: false });
      toast("Draw made"); redraw();
    }
    if (t.matches("[data-redraw]")) {
      const round = Number(t.dataset.redraw);
      const next = redrawNextRound(b, round);
      if (!confirm(`Make a random draw for the ${roundName(round + 1, b.totalRounds, b).toLowerCase()}?`)) return;
      for (const n of next) {
        const row = rows.find((r) => r.round === round + 1 && r.slot === n.slot);
        await save("competition_matches", { id: row.id, entry_a: n.entry_a, entry_b: n.entry_b, from_a: null, from_b: null, bye_a: false, bye_b: false, score_a: null, score_b: null, walkover: null, status: "scheduled" });
      }
      toast("Next round drawn"); redraw();
    }
    // Round 72: the byes under each round open and close.
    if (t.matches("[data-show-byes]")) {
      const body = t.closest("table").querySelector(".dm-byes"), open = body.hidden;
      body.hidden = !open; t.setAttribute("aria-expanded", String(open));
      return;
    }
    if (t.matches("[data-save-row]")) {
      t.disabled = true;
      try { const msg = await saveRow(t.closest("tr")); toast(msg); redraw(); }
      finally { t.disabled = false; }
    }
    // Rich, round 38: one button saves every row that has been changed, round by round (so winners move on first).
    if (t.matches("[data-save-all]")) {
      const changed = [...root.querySelectorAll("tr[data-row].dirty")].sort((x, y) => Number(x.dataset.round) - Number(y.dataset.round) || Number(x.dataset.slot) - Number(y.dataset.slot));
      if (!changed.length) return toast("Nothing has been changed yet");
      t.disabled = true;
      const problems = [];
      for (const tr of changed) {
        try { await saveRow(tr); tr.classList.remove("dirty"); }
        catch (err) { problems.push(`${tr.dataset.label ?? "A match"}: ${friendly(err)}`); tr.classList.add("row-error"); }
      }
      t.disabled = false;
      if (problems.length) return toast(`${changed.length - problems.length} saved. Not saved — ${problems.join(" · ")}`, "error");
      toast(`${changed.length} match${changed.length > 1 ? "es" : ""} saved`); redraw();
    }
  }));
}
