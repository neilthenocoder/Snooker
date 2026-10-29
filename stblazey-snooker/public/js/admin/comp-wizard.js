// ─────────────────────────────────────────────────────────────
//  Admin → Competitions → Set up step by step (round 59 — Rich: "a step by step (like the news) for each comp?
//  1. Choose your comp 2. choose your deadlines 3. choose your players 4. and so on").
//  One question at a time, for the competition secretary:
//    1 The competition (pick one, or start a new one)   2 The details (type, handicap, frames, who can enter)
//    3 Entries (the entry form, fee, closing date)      4 Entrants (players, pairs or teams)
//    5 The draw (random, seeded or live)                6 Round deadlines (play by / contact by)
//    7 Dates & venues of the matches                    8 All done — a checklist of what is set and what isn't
//  Steps 4–7 are the same screens as Draws & results (admin/draws.js), shown one part at a time.
//  The address keeps the place: /admin/comp_wizard?c=<competition>&step=<1–8>.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$, toast, fmtDate } from "../core/dom.js";
import { save, table, loadCompetitions, signups, invalidate } from "../core/api.js";
import { buildBracket, roundName } from "../core/bracket.js";
import { slugify } from "../core/schedule.js";
import { urls, shortName } from "../core/components.js";
import { navigate } from "../core/router.js";
import { draws } from "./draws.js";
import { friendly } from "./crud.js";

const STEPS = [
  ["The competition", "Choose one, or start a new one"],
  ["The details", "Type, handicap, frames, who can enter"],
  ["Entries", "The entry form on the website"],
  ["Entrants", "Who is in it"],
  ["The draw", "Random, seeded or live"],
  ["Deadlines", "When each round must be played"],
  ["Dates & venues", "Each match's date and venue"],
  ["All done", "What's set, and what's left"],
];
const KINDS = [["Singles", "One player against another"], ["Doubles", "Pairs of players"], ["Team", "One team against another"], ["Other", "Anything else"]];
const go = (c, step) => navigate(`/admin/comp_wizard?${c ? `c=${c}&` : ""}step=${step}`);

export async function compWizardPage(el, { user } = {}) {
  const q = new URLSearchParams(location.search);
  const step = Math.min(8, Math.max(1, Number(q.get("step")) || 1));
  const [data, seasons, leagues] = await Promise.all([loadCompetitions(), table("seasons", "name"), table("leagues", "sort")]);
  const c = data.competitions.find((x) => x.id === q.get("c"));
  if (step > 1 && !c) return go(null, 1);
  const current = seasons.find((s) => s.is_current) ?? seasons.at(-1);
  const entries = c ? data.entries.filter((e) => e.competition_id === c.id) : [];
  const matches = c ? data.matches.filter((m) => m.competition_id === c.id) : [];
  const b = c ? buildBracket(entries, matches) : null;

  // How far each step has got (for the ticks in the step bar and the checklist at the end).
  const r1 = b?.rounds?.[0]?.filter((m) => !m.isBye) ?? [];
  const done = c ? {
    1: true,
    2: true,
    3: true,
    4: entries.length >= 2,
    5: matches.length > 0,
    6: !!b?.totalRounds && b.rounds.every((_, i) => c.round_deadlines?.[i + 1]),
    7: r1.length > 0 && r1.every((m) => m.row.starts_at),
  } : {};

  const bar = html`<ol class="cw-steps">${STEPS.map(([name, sub], i) => {
    const n = i + 1, here = n === step, can = !!c || n === 1;
    const inner = html`<span class="cw-n">${done[n] && !here && n < 8 ? "✓" : n}</span><span class="cw-t"><b>${name}</b><small>${sub}</small></span>`;
    return html`<li class="${here ? "on" : ""} ${done[n] ? "ok" : ""}">${can && !here ? html`<a href="/admin/comp_wizard?${c ? `c=${c.id}&` : ""}step=${n}">${inner}</a>` : html`<span>${inner}</span>`}</li>`;
  })}</ol>`;
  const nav = (opts = {}) => html`<div class="cw-nav">
    ${step > 1 ? html`<a class="btn ghost" href="/admin/comp_wizard?c=${c.id}&step=${step - 1}">‹ Back</a>` : html`<span></span>`}
    ${opts.next === false ? "" : step < 8 && c ? html`<a class="btn green" href="/admin/comp_wizard?c=${c.id}&step=${step + 1}">${opts.nextLabel ?? "Next"} ›</a>` : ""}</div>`;
  const head = (title, text) => html`${bar}<div class="cw-card">
    ${c ? html`<p class="cw-comp">${c.name}${c.season_id ? html` · ${seasons.find((s) => s.id === c.season_id)?.name ?? ""}` : ""}</p>` : ""}
    <h2 class="cw-q">${title}</h2>${text ? html`<p class="cw-help">${text}</p>` : ""}`;

  // ── 1. The competition ─────────────────────────────────────────
  if (step === 1) {
    const ofSeason = (s) => data.competitions.filter((x) => x.season_id === s?.id && !x.parent_id);
    const status = (x) => {
      const n = data.entries.filter((e) => e.competition_id === x.id).length, drawn = data.matches.some((m) => m.competition_id === x.id);
      return drawn ? "Drawn" : n ? `${n} entrant${n === 1 ? "" : "s"}` : x.entries_open ? "Entries open" : "Not started";
    };
    const tile = (x) => html`<a class="cw-pick" href="/admin/comp_wizard?c=${x.id}&step=2"><b>${x.name}</b><small>${x.kind}${x.handicap ? " · handicap" : ""} · ${status(x)}</small></a>`;
    const others = data.competitions.filter((x) => x.season_id !== current?.id && !x.parent_id);
    mount(el, html`${head("Which competition are you setting up?", "Pick it from this season's list — or start a new one at the bottom. You can come back to any step at any time.")}
      ${ofSeason(current).length ? html`<h3 class="cw-sub">${current?.name ?? "This season"}</h3><div class="cw-picks">${ofSeason(current).map(tile)}</div>` : html`<p class="muted">No competitions for ${current?.name ?? "this season"} yet.</p>`}
      ${others.length ? html`<details class="cw-older"><summary>Other seasons (${others.length})</summary><div class="cw-picks">${others.map(tile)}</div></details>` : ""}
      <form class="form cw-new" data-cw-new>
        <h3 class="cw-sub">Start a new competition</h3>
        <div class="grid-2"><label>Name<input name="name" required maxlength="80" placeholder="e.g. Christmas Handicap Singles"></label>
          <label>Season<select name="season_id">${seasons.map((s) => html`<option value="${s.id}" ${s.id === current?.id ? "selected" : ""}>${s.name}</option>`)}</select></label></div>
        <div class="cw-kinds">${KINDS.map(([k, sub], i) => html`<label class="cw-kind"><input type="radio" name="kind" value="${k}" ${i === 0 ? "checked" : ""}><span><b>${k}</b><small>${sub}</small></span></label>`)}</div>
        <div class="btn-row"><button class="btn green">Create it and carry on ›</button></div>
      </form></div>`);
    $("[data-cw-new]", el).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, name = f.elements.name.value.trim();
      if (!name) return f.elements.name.focus();
      const taken = new Set(data.competitions.map((x) => x.slug));
      const season = seasons.find((s) => s.id === f.elements.season_id.value);
      let slug = slugify(name);
      if (taken.has(slug)) slug = `${slug}-${slugify(season?.name ?? "")}`;
      for (let n = 2; taken.has(slug); n++) slug = `${slugify(name)}-${n}`;
      f.querySelector("button").disabled = true;
      try {
        const made = await save("competitions", { name, slug, season_id: season?.id ?? null, kind: f.querySelector("[name=kind]:checked").value, best_of: 5, draw_mode: "bracket",
          sort: data.competitions.length + 1 });
        invalidate(); toast(`${name} created`); go(made.id, 2);
      } catch (err) { toast(friendly(err), "error"); f.querySelector("button").disabled = false; }
    });
    return;
  }

  // ── 2. The details ─────────────────────────────────────────────
  if (step === 2) {
    const open = new Set(c.league_ids ?? []);
    mount(el, html`${head("The details", "How the competition is played. Everything here can be changed later.")}
      <form class="form" data-cw-form>
        <label>Name<input name="name" required maxlength="80" value="${c.name}"></label>
        <div class="field-label">Type</div>
        <div class="cw-kinds">${KINDS.map(([k, sub]) => html`<label class="cw-kind"><input type="radio" name="kind" value="${k}" ${c.kind === k ? "checked" : ""}><span><b>${k}</b><small>${sub}</small></span></label>`)}</div>
        <div class="grid-2">
          <label>Frames per match (best of)<input type="number" name="best_of" min="1" max="35" value="${c.best_of ?? 5}"></label>
          <label>The draw<select name="draw_mode"><option value="bracket" ${c.draw_mode !== "redraw" ? "selected" : ""}>Winners follow the bracket (the usual)</option>
            <option value="redraw" ${c.draw_mode === "redraw" ? "selected" : ""}>A fresh random draw every round</option></select></label>
        </div>
        <label class="check"><input type="checkbox" name="handicap" ${c.handicap ? "checked" : ""}> Handicap competition — scorecards show each player's handicap and the head start</label>
        <div class="field-label">Who can enter <span class="muted" style="font-weight:400">(tick none for every league)</span></div>
        <div class="cw-leagues">${leagues.map((l) => html`<label class="check"><input type="checkbox" name="league" value="${l.id}" ${open.has(l.id) ? "checked" : ""}> ${l.name}</label>`)}</div>
        <label>Rules, format and dates for the competition page <span class="muted" style="font-weight:400">(optional)</span><textarea name="info" rows="5">${c.info ?? ""}</textarea></label>
        <div class="cw-nav"><a class="btn ghost" href="/admin/comp_wizard?c=${c.id}&step=1">‹ Back</a><button class="btn green">Save and carry on ›</button></div>
      </form></div>`);
    $("[data-cw-form]", el).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await save("competitions", { id: c.id, name: f.elements.name.value.trim() || c.name, kind: f.querySelector("[name=kind]:checked")?.value ?? c.kind,
          best_of: Number(f.elements.best_of.value) || 5, draw_mode: f.elements.draw_mode.value, handicap: f.elements.handicap.checked,
          league_ids: $$("[name=league]:checked", f).map((x) => x.value), info: f.elements.info.value.trim() || null });
        invalidate(); toast("Saved"); go(c.id, 3);
      } catch (err) { toast(friendly(err), "error"); }
    });
    return;
  }

  // ── 3. Entries ─────────────────────────────────────────────────
  if (step === 3) {
    const waiting = (await signups().catch(() => [])).filter((s) => s.competition_id === c.id && s.status === "pending").length;
    mount(el, html`${head("Can people enter on the website?", "Open the entry form and the competition appears on Enter a competition (/enter). Each entry waits under Entries to approve until the fee is paid, then joins the entrants by itself. Not taking entries online? Leave it closed and add the entrants yourself in the next step.")}
      <form class="form" data-cw-form>
        <label class="check cw-big-check"><input type="checkbox" name="entries_open" ${c.entries_open ? "checked" : ""}> Open for entries on the website</label>
        <div class="grid-2">
          <label>Entry fee <span class="muted" style="font-weight:400">(as you want it shown)</span><input name="entry_fee" maxlength="60" placeholder="£5 per player" value="${c.entry_fee ?? ""}"></label>
          <label>Entries close on <span class="muted" style="font-weight:400">(optional)</span><input type="date" name="entry_closes" value="${c.entry_closes ?? ""}"></label>
        </div>
        ${waiting ? html`<div class="notice"><b>${waiting}</b> ${waiting === 1 ? "entry is" : "entries are"} waiting for payment — <a href="/admin/entries">Entries to approve</a>.</div>` : ""}
        <div class="cw-nav"><a class="btn ghost" href="/admin/comp_wizard?c=${c.id}&step=2">‹ Back</a><button class="btn green">Save and carry on ›</button></div>
      </form></div>`);
    $("[data-cw-form]", el).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await save("competitions", { id: c.id, entries_open: f.elements.entries_open.checked, entry_fee: f.elements.entry_fee.value.trim() || null, entry_closes: f.elements.entry_closes.value || null });
        invalidate(); toast("Saved"); go(c.id, 4);
      } catch (err) { toast(friendly(err), "error"); }
    });
    return;
  }

  // ── 4–7: the Draws & results screens, one part at a time ──────
  if (step >= 4 && step <= 7) {
    const part = step - 3;
    const words = {
      4: ["Who is in it?", c.kind === "Doubles" && !/\bteam/i.test(c.name) ? "Add each pair: find Player 1 and Player 2 and the name in the draw fills itself in. Entries approved from the website appear here by themselves."
        : c.kind === "Team" ? "Add each team — or every team in a league at once. Entries approved from the website appear here by themselves." : "Find each player and add them. Entries approved from the website appear here by themselves. The order is the seeding (1 first)."],
      5: ["Make the draw", entries.length < 2 ? "Add at least two entrants first (step 4)." : "A random draw, a seeded draw (keeps the order of the entrants), or a live draw in front of everyone — it appears on the website tie by tie."],
      6: ["When must each round be played?", matches.length ? "The play-by date of each round, and (optional) the day the home player must have contacted their opponent. Players get a reminder in their own area as each date comes up." : "Make the draw first (step 5) — then each round appears here."],
      7: ["Dates and venues", matches.length ? "Give each match its date, time and venue (or leave them for the players to arrange). Results go in here later too — or from each match's scorecard." : "Make the draw first (step 5) — then the matches appear here."],
    }[step];
    mount(el, html`${head(words[0], words[1])}<div class="cw-embed" data-step="${part}"></div>${nav({ nextLabel: step === 7 ? "Finish" : "Next" })}</div>`);
    if (step === 4 || matches.length || step === 5) await draws($(".cw-embed", el), { user, step: part });
    if (step === 5 && entries.length < 2) mount($(".cw-embed", el), "");
    return;
  }

  // ── 8. All done ────────────────────────────────────────────────
  const rounds = b?.totalRounds ?? 0;
  const item = (ok, text, fix, n) => html`<li class="${ok ? "ok" : "todo"}"><span class="cw-mark">${ok ? "✓" : "!"}</span><span>${text}</span>${ok ? "" : html`<a href="/admin/comp_wizard?c=${c.id}&step=${n}">${fix}</a>`}</li>`;
  mount(el, html`${head(`${c.name} is set up`, "Here is what's in place. Anything marked ! can be done now, or whenever you're ready.")}
    <ul class="cw-check">
      ${item(true, html`${c.kind}${c.handicap ? ", handicap" : ""}, best of ${c.best_of ?? 5} — open to ${(c.league_ids ?? []).length ? leagues.filter((l) => c.league_ids.includes(l.id)).map(shortName).join(" and ") : "every league"}`, "", 2)}
      ${item(true, c.entries_open ? html`Entries open on the website${c.entry_fee ? ` (${c.entry_fee})` : ""}${c.entry_closes ? `, closing ${fmtDate(c.entry_closes)}` : ""}` : "Entries are added by hand (the online entry form is closed)", "", 3)}
      ${item(entries.length >= 2, `${entries.length} entrant${entries.length === 1 ? "" : "s"}`, "Add entrants", 4)}
      ${item(matches.length > 0, matches.length ? `Drawn — ${rounds} round${rounds === 1 ? "" : "s"}, ${roundName(1, rounds, b).toLowerCase()} first` : "Not drawn yet", "Make the draw", 5)}
      ${item(done[6], done[6] ? "Every round has a play-by date" : "Some rounds have no play-by date", "Set deadlines", 6)}
      ${item(done[7], done[7] ? "Every first-round match has a date" : `${r1.filter((m) => !m.row.starts_at).length} first-round match${r1.filter((m) => !m.row.starts_at).length === 1 ? " has" : "es have"} no date yet (fine if the players arrange them)`, "Add dates", 7)}
    </ul>
    <div class="btn-row cw-end">
      <a class="btn green" href="${urls.competition(c)}">See the competition page</a>
      <a class="btn ghost" href="/admin/draws?c=${c.id}">Draws & results (everything on one page)</a>
      <a class="btn ghost" href="/admin/competitions?edit=${c.id}">Pictures & trophy</a>
      <a class="btn ghost" href="/admin/comp_wizard?step=1">Set up another competition</a>
    </div></div>`);
}
