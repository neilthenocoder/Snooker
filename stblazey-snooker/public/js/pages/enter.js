// Competition entry form — no login needed. Step by step:
//   1 Who you are → 2 Which competitions → 3 Check and send → 4 How to pay
// Each entry then waits for the competition secretary to confirm the fee has
// been paid (Admin → Entries to approve). Unpaid entries lapse on their pay-by date.
import { html, mount, toast, fmtDate, paragraphs } from "../core/dom.js";
import { table, loadCompetitions, settings, enterCompetitions } from "../core/api.js";
import { breadcrumb, shortName } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

/** Competitions that can be entered today. */
export const openForEntry = (competitions, today = new Date().toISOString().slice(0, 10)) =>
  competitions.filter((c) => c.entries_open && (!c.entry_closes || c.entry_closes >= today));

/** "£5" + "£3.50" → 8.5 (0 when a fee has no number in it). */
const pounds = (fee) => Number(String(fee ?? "").match(/\d+(?:\.\d+)?/)?.[0] ?? 0);

export default async function enter(view, { query }) {
  setTitle("Enter a competition");
  adminEdit("entries", null, { href: "/admin/entries", label: "Entries to approve" });
  const [data, players, teams, leagues, site] = await Promise.all([
    loadCompetitions(), table("players", "full_name"), table("teams", "name"), table("leagues", "sort"), settings(),
  ]);
  const open = openForEntry(data.competitions);
  const state = { step: 1, teamId: "", playerId: "", contact: "", picked: new Set(), partners: {}, made: null };
  const wanted = open.find((c) => c.slug === query.get("c"));
  if (wanted) state.picked.add(wanted.id);

  const me = () => players.find((p) => p.id === state.playerId);
  const myTeam = () => teams.find((t) => t.id === me()?.team_id);
  const chosen = () => open.filter((c) => state.picked.has(c.id));
  /** Why this player can't enter this competition ("" when they can). */
  const blocked = (c) => {
    const p = me(), team = myTeam();
    if (!p) return "";
    if ((c.league_ids ?? []).length && !c.league_ids.includes(team?.league_id)) return `Open to ${leagues.filter((l) => c.league_ids.includes(l.id)).map(shortName).join(" and ")} players only`;
    if (c.kind === "Team" && !team) return "You need to be in a team";
    const entries = data.entries.filter((e) => e.competition_id === c.id);
    if (c.kind === "Team" ? entries.some((e) => e.team_id === team.id) : entries.some((e) => e.player_id === p.id)) return `${c.kind === "Team" ? team.name : "You"} are already entered`;
    return "";
  };
  const entrantName = (c) => (c.kind === "Team" ? myTeam()?.name : c.kind === "Doubles"
    ? `${me()?.full_name} & ${players.find((p) => p.id === state.partners[c.id])?.full_name ?? "partner"}` : me()?.full_name);

  const steps = () => html`<ol class="entry-steps">${["Who you are", "Competitions", "Check", "Pay"].map((label, i) =>
    html`<li class="${state.step === i + 1 ? "on" : state.step > i + 1 ? "done" : ""}"><b>${i + 1}</b>${label}</li>`)}</ol>`;

  function body() {
    if (state.step === 1) return html`<h3 class="g-h"><span>1</span> Who are you?</h3>
      <div class="form">
        <label>Your team<select data-team><option value="">All teams</option>${teams.filter((t) => t.active !== false).map((t) => html`<option value="${t.id}" ${t.id === state.teamId ? "selected" : ""}>${t.name}</option>`)}</select></label>
        <label>Your name<select data-player required><option value="">– choose your name –</option>${players.filter((p) => !state.teamId || p.team_id === state.teamId)
          .map((p) => html`<option value="${p.id}" ${p.id === state.playerId ? "selected" : ""}>${p.full_name}${state.teamId ? "" : ` (${teams.find((t) => t.id === p.team_id)?.name ?? "no team"})`}</option>`)}</select></label>
        <label>Your phone number or email <span class="muted" style="font-weight:400">(optional — only the competition secretary sees it)</span>
          <input type="text" maxlength="200" value="${state.contact}" data-contact autocomplete="email"></label>
        <p class="muted" style="margin:0">Not in the list? Ask your captain to add you to the team first.</p>
      </div>
      <div class="entry-nav"><span></span><button type="button" class="btn green" data-next>Next: choose competitions →</button></div>`;

    if (state.step === 2) return html`<h3 class="g-h"><span>2</span> Which competitions?</h3>
      <p class="muted">Entering as <b>${me().full_name}</b>${myTeam() ? ` (${myTeam().name})` : ""}. Tick every competition you want to enter.</p>
      <div class="entry-comps">${open.map((c) => { const why = blocked(c), on = state.picked.has(c.id) && !why;
        return html`<div class="entry-comp ${on ? "on" : ""} ${why ? "off" : ""}">
          <label class="entry-pick"><input type="checkbox" data-comp="${c.id}" ${on ? "checked" : ""} ${why ? "disabled" : ""}>
            <span><strong>${c.name}</strong><small>${[c.handicap ? "Handicap" : "", c.kind, c.entry_closes ? `entries close ${fmtDate(c.entry_closes)}` : ""].filter(Boolean).join(" · ")}</small>
              ${why ? html`<em>${why}</em>` : c.kind === "Team" ? html`<small>Enters your team: <b>${myTeam()?.name}</b></small>` : ""}</span>
            <b class="entry-fee">${c.entry_fee || "Free"}</b></label>
          ${on && c.kind === "Doubles" ? html`<label class="entry-partner">Your partner<select data-partner="${c.id}"><option value="">– choose your partner –</option>
            ${players.filter((p) => p.id !== state.playerId).map((p) => html`<option value="${p.id}" ${state.partners[c.id] === p.id ? "selected" : ""}>${p.full_name} (${teams.find((t) => t.id === p.team_id)?.name ?? "no team"})</option>`)}</select></label>` : ""}
        </div>`; })}</div>
      <div class="entry-nav"><button type="button" class="btn ghost" data-back>‹ Back</button><button type="button" class="btn green" data-next>Next: check your entry →</button></div>`;

    if (state.step === 3) { const total = chosen().reduce((n, c) => n + pounds(c.entry_fee), 0);
      return html`<h3 class="g-h"><span>3</span> Check and send</h3>
      <table class="data entry-check"><tbody>${chosen().map((c) => html`<tr><td><strong>${c.name}</strong><br><small class="muted">Entered as ${entrantName(c)}</small></td><td class="num strong">${c.entry_fee || "Free"}</td></tr>`)}
        ${total ? html`<tr class="hl"><td>Total to pay</td><td class="num">£${total.toFixed(2).replace(/\.00$/, "")}</td></tr>` : ""}</tbody></table>
      <p class="muted">When you press Send, your ${chosen().length > 1 ? "entries are" : "entry is"} held for <b>${site.entry_pay_days || 7} days</b>. ${total ? "You'll see how to pay on the next screen; once the competition secretary has confirmed your payment you are in the draw." : "The competition secretary will confirm it."}</p>
      <div class="entry-nav"><button type="button" class="btn ghost" data-back>‹ Back</button><button type="button" class="btn green" data-send>Send my ${chosen().length > 1 ? "entries" : "entry"}</button></div>`; }

    // Step 4: sent — how and when to pay.
    const total = state.made.reduce((n, m) => n + pounds(m.fee), 0);
    const payBy = state.made.map((m) => m.pay_by).sort()[0];
    return html`<h3 class="g-h"><span>4</span> Entry received — now pay</h3>
      <div class="entry-done">
        <p class="entry-ok">✓ Thanks, ${me().full_name}. ${state.made.length > 1 ? "Your entries are" : "Your entry is"} in, waiting for payment.</p>
        <ul>${state.made.map((m) => html`<li><b>${data.competitions.find((c) => c.id === m.competition_id)?.name}</b> — ${m.name}${m.fee ? ` · ${m.fee}` : ""}</li>`)}</ul>
        ${total ? html`<div class="entry-pay"><h4>Pay £${total.toFixed(2).replace(/\.00$/, "")} by bank transfer (BACS)</h4>
          ${site.bacs_details ? paragraphs(site.bacs_details) : html`<p>The league's bank details will be sent to you by the competition secretary.</p>`}
          <p>Reference: <b>${me().full_name}</b></p></div>` : ""}
        <p class="entry-deadline">${total ? "Pay" : "This will be confirmed"} by <b>${fmtDate(payBy)}</b>. ${total ? "If your payment hasn't been confirmed by then, the entry is removed and you'd need to enter again." : ""}</p>
        <div class="btn-row"><a class="btn" href="/competitions">Back to competitions</a><button type="button" class="btn ghost" data-again>Enter someone else</button></div>
      </div>`;
  }

  function draw() {
    mount(view, html`<div class="wrap" style="max-width:760px">
      ${breadcrumb([["Home", "/"], ["Competitions", "/competitions"], ["Enter a competition"]])}
      <h1>Enter a competition</h1>
      ${site.entry_intro && state.step === 1 ? html`<div class="prose" style="margin-bottom:18px">${paragraphs(site.entry_intro)}</div>` : ""}
      ${open.length ? html`${steps()}<div class="entry-box" data-entry>${body()}</div>`
        : html`<div class="notice">No competitions are open for entries at the moment. <a href="/competitions" style="font-weight:700;color:var(--red)">See all competitions</a></div>`}
    </div>`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const onInput = (e) => {
    const t = e.target;
    if (t.matches("[data-team]")) { state.teamId = t.value; if (me()?.team_id !== state.teamId && state.teamId) state.playerId = ""; return draw(); }
    if (t.matches("[data-player]")) state.playerId = t.value;
    if (t.matches("[data-contact]")) state.contact = t.value;
    if (t.matches("[data-comp]")) { t.checked ? state.picked.add(t.dataset.comp) : state.picked.delete(t.dataset.comp); return draw(); }
    if (t.matches("[data-partner]")) state.partners[t.dataset.partner] = t.value;
  };
  const onClick = async (e) => {
    const t = e.target.closest("button");
    if (!t || !view.contains(t)) return;
    if (t.matches("[data-back]")) { state.step--; return draw(); }
    if (t.matches("[data-again]")) { Object.assign(state, { step: 1, playerId: "", picked: new Set(), partners: {}, made: null }); return draw(); }
    if (t.matches("[data-next]")) {
      if (state.step === 1 && !me()) return toast("Choose your name first", "error");
      if (state.step === 2) {
        for (const c of open) if (blocked(c)) state.picked.delete(c.id);
        if (!chosen().length) return toast("Tick at least one competition", "error");
        const missing = chosen().find((c) => c.kind === "Doubles" && !state.partners[c.id]);
        if (missing) return toast(`Choose your partner for ${missing.name}`, "error");
      }
      state.step++; return draw();
    }
    if (t.matches("[data-send]")) {
      t.disabled = true;
      try {
        state.made = await enterCompetitions(state.playerId, chosen().map((c) => c.id), state.contact.trim(), state.partners);
        state.step = 4; draw();
      } catch (err) { toast(err.message, "error"); t.disabled = false; }
    }
  };
  view.addEventListener("input", onInput);
  view.addEventListener("click", onClick);
  draw();
  return () => { view.removeEventListener("input", onInput); view.removeEventListener("click", onClick); };
}
