import { html, mount, $, toast } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { loadFixture, saveScorecard, setFixtureStatus } from "../core/api.js";
import { matchScore, frameWinner, breakPoints, RULES } from "../core/rules.js";
import { canEditFixture, isAdmin } from "../core/auth.js";
import { breadcrumb, panel, statusBadge, urls } from "../core/components.js";
import { setTitle, navigate } from "../core/router.js";
import notFound from "./not-found.js";

export function mustLogin(view) {
  mount(view, html`<div class="wrap"><h1>Please log in</h1>
    <p>This area is for team captains and the league secretary. <a class="btn" href="/login">Log in</a></p></div>`);
}

export default async function scorecard(view, { params, user }) {
  if (!user) return mustLogin(view);
  const bundle = await loadFixture(params.id);
  if (!bundle) return notFound(view);
  const fx = bundle.fixture;
  const admin = isAdmin(user);
  if (!canEditFixture(user, fx)) {
    return mount(view, html`<div class="wrap"><h1>Scorecard locked</h1>
      <div class="notice error">You can only edit scorecards for your own team's matches, and only until they are approved.</div>
      <a class="btn" href="${urls.match(fx)}">View the match</a></div>`);
  }

  const ctx = await seasonContext(fx.season_id);
  const home = ctx.team.get(fx.home_team_id), away = ctx.team.get(fx.away_team_id);
  const title = `${home?.name} vs ${away?.name}`;
  setTitle(`Scorecard: ${title}`);

  // Working copy of the scorecard. Nothing is saved until "Save" is pressed.
  const frames = bundle.frames.map(({ frame_no, home_player_id, away_player_id, home_points, away_points }) =>
    ({ frame_no, home_player_id, away_player_id, home_points, away_points }));
  while (frames.length < RULES.framesPerMatch) frames.push(blankFrame(frames.length + 1));
  const breaks = bundle.breaks.map(({ frame_no, player_id, value }) => ({ frame_no, player_id, value }));
  let dirty = false;

  const options = (teamId, selected) => html`<option value="">– select –</option>${ctx.playersOf(teamId).map((p) =>
    html`<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${p.full_name}</option>`)}`;
  const name = (id) => ctx.player.get(id)?.full_name ?? "?";

  function drawRunning() {
    const s = matchScore(frames);
    mount($("#running"), html`<div><small>${home?.name}</small>${s.home}</div><div>–</div><div><small>${away?.name}</small>${s.away}</div>`);
    frames.forEach((f, i) => { $(`#win-${i}`).textContent = { home: "◀ Home", away: "Away ▶" }[frameWinner(f)] ?? ""; });
  }

  function draw() {
    mount($("#frames"), html`<div class="table-scroll"><table class="data scorecard">
      <thead><tr><th>#</th><th>${home?.name} player</th><th class="num">Pts</th><th class="num">Pts</th><th>${away?.name} player</th><th>Won</th><th>Breaks</th><th></th></tr></thead>
      <tbody>${frames.map((f, i) => html`<tr>
        <td class="num strong">${f.frame_no}</td>
        <td><select data-i="${i}" data-k="home_player_id">${options(fx.home_team_id, f.home_player_id)}</select></td>
        <td class="num"><input type="number" min="0" max="200" inputmode="numeric" data-i="${i}" data-k="home_points" value="${f.home_points ?? ""}"></td>
        <td class="num"><input type="number" min="0" max="200" inputmode="numeric" data-i="${i}" data-k="away_points" value="${f.away_points ?? ""}"></td>
        <td><select data-i="${i}" data-k="away_player_id">${options(fx.away_team_id, f.away_player_id)}</select></td>
        <td id="win-${i}" class="strong" style="white-space:nowrap"></td>
        <td><div class="break-list">
          ${breaks.map((b, bi) => (b.frame_no === f.frame_no ? html`<span class="chip">${name(b.player_id)} ${b.value}<button type="button" data-remove-break="${bi}" aria-label="Remove break">×</button></span>` : ""))}
          <button type="button" class="btn small ghost" data-add-break="${i}">+ Break</button>
        </div></td>
        <td>${i === frames.length - 1 && frames.length > 1 ? html`<button type="button" class="btn small ghost" data-remove-frame>Remove</button>` : ""}</td>
      </tr>`)}</tbody></table></div>`);
    drawRunning();
  }

  mount(view, html`<div class="wrap stack" id="sc">
    <div>${breadcrumb([["Home", "/"], [admin ? "Admin" : "My team", admin ? "/admin/results" : "/captain"], ["Scorecard"]])}
      <h1>Scorecard: ${title}</h1>
      <p>Status: ${statusBadge(fx.status)} · Enter each frame as it finishes and press <b>Save</b> — the live page updates for everyone.
        When the match is over, press <b>Submit final result</b>.</p></div>
    <div class="running" id="running"></div>
    ${panel("Frames", html`<div id="frames"></div>
      <div class="btn-row" style="padding:14px"><button type="button" class="btn ghost" data-add-frame>+ Add frame</button></div>`)}
    <div id="sc-errors"></div>
    <div class="btn-row">
      <button class="btn" data-save="in_progress">Save</button>
      <button class="btn green" data-save="submitted">Submit final result</button>
      ${admin ? html`<button class="btn blue" data-save="approved">Save & approve</button>
        <button class="btn secondary" data-save="postponed">Mark postponed</button>` : ""}
      <a class="btn ghost" href="${urls.match(fx)}">View public page</a>
    </div>
    <p class="muted" style="font-size:13px">Break points: ${RULES.breakMinimum}–39 = 3, 40–49 = 4 … 140+ = ${RULES.maxBreakPoints}.
      Only breaks you record here count towards rankings.</p>
  </div>`);
  draw();

  // ── events (attached to this page's own element, so they vanish with it) ──
  const root = $("#sc");
  root.addEventListener("input", (e) => {
    const { i, k } = e.target.dataset;
    if (i === undefined) return;
    frames[i][k] = e.target.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || null;
    dirty = true;
    if (e.target.tagName === "SELECT") draw(); else drawRunning();
  });

  root.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.matches("[data-add-frame]")) { frames.push(blankFrame(frames.length + 1)); dirty = true; draw(); }
    if (t.matches("[data-remove-frame]")) {
      const last = frames.pop();
      for (let j = breaks.length - 1; j >= 0; j--) if (breaks[j].frame_no === last.frame_no) breaks.splice(j, 1);
      dirty = true; draw();
    }
    if (t.matches("[data-remove-break]")) { breaks.splice(Number(t.dataset.removeBreak), 1); dirty = true; draw(); }
    if (t.matches("[data-add-break]")) addBreak(frames[Number(t.dataset.addBreak)]);
    if (t.matches("[data-save]")) await saveAll(t.dataset.save, t);
  });

  function addBreak(frame) {
    const players = [frame.home_player_id, frame.away_player_id].filter(Boolean);
    if (!players.length) return toast("Choose the players for this frame first", "error");
    const who = players.length === 1 ? players[0]
      : (prompt(`Who made the break?\n1 = ${name(players[0])}\n2 = ${name(players[1])}`, "1") === "2" ? players[1] : players[0]);
    const value = Number(prompt(`Break by ${name(who)} (1–147):`, "30"));
    if (!Number.isInteger(value) || value < 1 || value > 147) return value && toast("A break must be a whole number from 1 to 147", "error");
    breaks.push({ frame_no: frame.frame_no, player_id: who, value });
    dirty = true; draw();
    if (breakPoints(value)) toast(`${name(who)} earns ${breakPoints(value)} break points`);
  }

  function validate(finalising) {
    const errors = [];
    frames.forEach((f) => {
      const any = f.home_player_id || f.away_player_id || f.home_points != null || f.away_points != null;
      if (!any && !finalising) return;
      if (!f.home_player_id || !f.away_player_id) errors.push(`Frame ${f.frame_no}: choose both players.`);
      if (f.home_points == null || f.away_points == null) errors.push(`Frame ${f.frame_no}: enter both scores.`);
      else if (f.home_points === f.away_points) errors.push(`Frame ${f.frame_no}: a frame can't be tied.`);
      [f.home_points, f.away_points].forEach((p) => { if (p != null && (p < 0 || p > 200 || !Number.isInteger(p))) errors.push(`Frame ${f.frame_no}: scores must be whole numbers 0–200.`); });
    });
    breaks.forEach((b) => {
      const f = frames.find((x) => x.frame_no === b.frame_no);
      const side = f?.home_player_id === b.player_id ? "home" : f?.away_player_id === b.player_id ? "away" : null;
      if (!side) errors.push(`Frame ${b.frame_no}: the break by ${name(b.player_id)} doesn't match a player in that frame.`);
      else if (f[`${side}_points`] != null && b.value > f[`${side}_points`]) errors.push(`Frame ${b.frame_no}: break of ${b.value} is more than ${name(b.player_id)}'s score.`);
    });
    return errors;
  }

  async function saveAll(status, btn) {
    const finalising = ["submitted", "approved"].includes(status);
    const errors = status === "postponed" ? [] : validate(finalising);
    mount($("#sc-errors"), errors.length ? html`<div class="notice error">${errors.map((x) => html`<div>${x}</div>`)}</div>` : "");
    if (errors.length) return;
    if (finalising && !confirm(status === "approved" ? "Approve this result? Captains won't be able to edit it afterwards." : "Submit the final result?")) return;
    btn.disabled = true;
    try {
      // Only frames with something entered are saved; empty trailing rows are dropped.
      const kept = frames.filter((f) => f.home_player_id || f.away_player_id || f.home_points != null || f.away_points != null);
      const renumber = new Map(kept.map((f, idx) => [f.frame_no, idx + 1]));
      await saveScorecard(fx.id,
        kept.map((f) => ({ ...f, frame_no: renumber.get(f.frame_no) })),
        breaks.filter((b) => renumber.has(b.frame_no)).map((b) => ({ ...b, frame_no: renumber.get(b.frame_no) })));
      // "Save" starts a scheduled match but never un-submits or un-approves one.
      const target = status === "in_progress" && fx.status !== "scheduled" ? fx.status : status;
      if (target !== fx.status) await setFixtureStatus(fx.id, target);
      dirty = false;
      toast(finalising ? "Result submitted" : "Scorecard saved");
      navigate(finalising && !admin ? "/captain" : location.pathname, { replace: true });
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
    }
  }

  const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}

const blankFrame = (frame_no) => ({ frame_no, home_player_id: null, away_player_id: null, home_points: null, away_points: null });
