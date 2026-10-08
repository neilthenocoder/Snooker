// /cueview — "Send in your CueView": anyone can answer the player interview questions on this form.
// Nothing goes on the website straight away: the answers wait under Admin → League → CueViews to approve,
// where the league secretary checks them, picks whose profile they belong to and approves them.
// (A player with their own login can also edit their CueView themselves: My area → Profile.)
import { html, mount, $, readForm } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { submitCueview } from "../core/api.js";
import { CUEVIEW } from "../core/cueview.js";
import { breadcrumb, isActivePlayer } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function cueview(view, { user, query }) {
  setTitle("Send in your CueView");
  adminEdit("cueviews", null, { label: "CueViews to approve" });
  const ctx = await seasonContext();
  const players = ctx.players.filter(isActivePlayer).sort((a, b) => a.full_name.localeCompare(b.full_name));
  // Coming from a player's page (/cueview?player=12), or logged in with a linked player: start with their name.
  const preset = players.find((p) => query.get("player") && [p.slug, p.id].includes(query.get("player"))) ?? ctx.player.get(user?.profile?.player_id);
  const crumbs = breadcrumb([["Home", "/"], ["Our League", "/league"], ["Our Players", "/players"], ["Send in your CueView"]]);

  mount(view, html`<div class="wrap cv-form-wrap">
    ${crumbs}
    <h1>Send in your CueView</h1>
    <p class="cv-lead">A CueView is a short interview on your player page: when you started, your highest break, your favourite player and the rest.
      Answer as many questions as you like and leave the others empty. The league secretary reads it and adds it to your profile, so it appears a little later, not straight away.</p>
    <form class="form cv-form" data-cv novalidate>
      <div id="cv-error"></div>
      <h4 class="form-heading">About you</h4>
      <div class="grid-2">
        <label>Your name <span class="muted" style="font-weight:400">(start typing and choose it from the list)</span>
          <input name="name" list="cv-players" value="${preset?.full_name ?? ""}" required autocomplete="off" maxlength="80"></label>
        <label>Your team
          <select name="team"><option value="">– choose –</option>${ctx.leagues.map((l) => html`<optgroup label="${l.name}">${ctx.teamsIn(l.id).map((t) => html`<option ${t.id === preset?.team_id ? "selected" : ""}>${t.name}</option>`)}</optgroup>`)}
            <option value="No team this season">No team this season</option></select></label>
        <label style="grid-column:1/-1">Email or phone <span class="muted" style="font-weight:400">(optional and never shown on the website: only so the secretary can check something with you)</span>
          <input name="contact" maxlength="200" autocomplete="email"></label>
      </div>
      <datalist id="cv-players">${players.map((p) => html`<option value="${p.full_name}">${ctx.team.get(p.team_id)?.name ?? ""}</option>`)}</datalist>
      <label class="cv-hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>

      <h4 class="form-heading">Your CueView<small>Answer as many as you like</small></h4>
      ${CUEVIEW.map((q, i) => html`<label class="cv-q"><span><i>${i + 1}</i>${q.label}</span>
        ${q.options ? html`<select name="cv_${q.key}">${q.options.map((o) => html`<option value="${o}">${o || "–"}</option>`)}</select>`
          : html`<textarea name="cv_${q.key}" rows="2" maxlength="800"></textarea>`}</label>`)}
      <label class="cv-q"><span><i>+</i>A few words about you for your player page <span class="muted" style="font-weight:400">(optional)</span></span>
        <textarea name="bio" rows="4" maxlength="3000" placeholder="How long you have played in the league, teams you have played for, anything you would like people to know."></textarea></label>
      <div class="btn-row form-actions"><button class="btn green">Send my CueView</button><a class="btn ghost" href="/players">Cancel</a></div>
    </form>
  </div>`);

  // Choosing a name from the list fills in the team.
  const form = $("[data-cv]", view);
  const find = (name) => players.find((p) => p.full_name.toLowerCase() === String(name).trim().toLowerCase());
  form.elements.name.addEventListener("change", () => {
    const p = find(form.elements.name.value), team = p && ctx.team.get(p.team_id)?.name;
    if (p) form.elements.team.value = team ?? "No team this season";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = readForm(form);
    const answers = Object.fromEntries(CUEVIEW.map((q) => [q.key, String(v[`cv_${q.key}`] ?? "").trim()]).filter(([, a]) => a));
    const fail = (text) => { mount($("#cv-error", view), html`<div class="notice error">${text}</div>`); $("#cv-error", view).scrollIntoView({ behavior: "smooth", block: "center" }); };
    if (!String(v.name ?? "").trim()) return fail("Please tell us your name.");
    if (!Object.keys(answers).length && !String(v.bio ?? "").trim()) return fail("Please answer at least one question.");
    const btn = form.querySelector("button.btn");
    btn.disabled = true;
    try {
      // A filled-in hidden box means a spam robot: say thank you and send nothing.
      if (!v.website) await submitCueview({ player_id: find(v.name)?.id ?? null, name: v.name, team: v.team, answers, bio: v.bio, contact: v.contact });
      mount(view, html`<div class="wrap cv-form-wrap">${crumbs}
        <div class="box cv-thanks"><h1>Thank you, ${String(v.name).trim().split(/\s+/)[0]}</h1>
          <p>Your CueView has been sent to the league secretary. Once it has been checked it will appear on your player page.</p>
          <div class="btn-row" style="justify-content:center"><a class="btn" href="/players">Our Players</a><a class="btn ghost" href="/">Home</a></div></div></div>`);
      window.scrollTo(0, 0);
    } catch (err) { fail(err.message); btn.disabled = false; }
  });
}
