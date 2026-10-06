// Live frame-by-frame scorecard for a cup match (singles, doubles or teams).
import { html, mount, $ } from "../core/dom.js";
import { loadCompMatch, loadCompetitions, saveCompScorecard, table } from "../core/api.js";
import { buildBracket, roundName } from "../core/bracket.js";
import { canEditCompMatch, canManage } from "../core/auth.js";
import { scorecardEditor, breaksText } from "../core/scorecard-editor.js";
import { breadcrumb, cupMatchInfo, urls } from "../core/components.js";
import { handicapMode } from "../core/rules.js";
import { setTitle, navigate } from "../core/router.js";
import { mustLogin } from "./scorecard.js";
import notFound from "./not-found.js";

export default async function cupScorecard(view, { params, user }) {
  if (!user) return mustLogin(view);
  const [bundle, compData, players, teams, venues] = await Promise.all([
    loadCompMatch(params.id), loadCompetitions(), table("players", "full_name"), table("teams", "name"), table("venues", "name"),
  ]);
  if (!bundle) return notFound(view);
  const { match } = bundle;
  const info = cupMatchInfo(compData, match, buildBracket);
  if (!info.a || !info.b) return mount(view, html`<div class="wrap"><h1>Not ready yet</h1><div class="notice">Both players or teams need to be known before this match can be scored.</div></div>`);
  if (!canEditCompMatch(user, match, [info.a, info.b], players)) {
    return mount(view, html`<div class="wrap"><h1>Scorecard locked</h1>
      <div class="notice error">Only the league admin, the competition secretary, or a captain of a team in this match can score it — and captains only until it's finished.</div>
      <a class="btn" href="/cup-match/${match.id}">View the match</a></div>`);
  }
  const { c } = info;
  setTitle(`Scorecard: ${info.a.name} vs ${info.b.name}`);
  const doubles = c.kind === "Doubles";
  const slots = doubles ? 2 : 1;
  const team = (id) => teams.find((t) => t.id === id);
  const playerTeam = (e) => team(e.team_id) ?? team(players.find((p) => p.id === e.player_id)?.team_id);

  // Who can be picked: a team's players for team cups; for singles/doubles the
  // entrant's own team first, then everyone else.
  const options = (e) => {
    const home = playerTeam(e);
    const mine = players.filter((p) => p.team_id === home?.id).map((p) => ({ id: p.id, name: p.full_name, group: home?.name }));
    if (c.kind === "Team") return mine;
    const rest = players.filter((p) => p.team_id !== home?.id).map((p) => ({ id: p.id, name: p.full_name, group: team(p.team_id)?.name ?? "Other" }));
    return [...mine, ...rest];
  };
  // Singles: the entrant plays every frame, so fill them in.
  // (Doubles: the linked player is filled in; pick their partner.)
  const preset = ["Singles", "Doubles"].includes(c.kind) ? { a: [info.a.player_id], b: [info.b.player_id] } : {};

  const toEditor = (f) => ({
    frame_no: f.frame_no, a_points: f.a_points, b_points: f.b_points,
    a: [f.a_player_id, f.a_player2_id].slice(0, slots).map((id) => ({ player_id: id, ext: false, breaks: breaksText(bundle.breaks, f.frame_no, id) })),
    b: [f.b_player_id, f.b_player2_id].slice(0, slots).map((id) => ({ player_id: id, ext: false, breaks: breaksText(bundle.breaks, f.frame_no, id) })),
  });
  const fromEditor = (f) => ({
    frame_no: f.frame_no, a_points: f.a_points, b_points: f.b_points,
    a_player_id: f.a[0].player_id, a_player2_id: f.a[1]?.player_id ?? null,
    b_player_id: f.b[0].player_id, b_player2_id: f.b[1]?.player_id ?? null,
  });

  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], [c.name, urls.competition(c)], ["Scorecard"]])}
    <p class="sc-intro">Each frame you save shows on the competition page straight away. Press <b>Finish match</b> at the end and the winner goes through.</p>
    <div data-editor></div>
  </div>`);

  return scorecardEditor({
    person: (id) => { const p = players.find((x) => x.id === id); return { name: p?.full_name ?? "A player", avatar_url: p?.avatar_url, club: team(p?.team_id)?.name }; },
    el: $("[data-editor]", view),
    subtitle: `${c.name} · ${roundName(match.round, info.bracket.totalRounds)}`, when: match.starts_at, venue: venues.find((v) => v.id === match.venue_id)?.name,
    sides: { a: { name: info.a.name, team: playerTeam(info.a), options: options(info.a) }, b: { name: info.b.name, team: playerTeam(info.b), options: options(info.b) } },
    slots, preset, minFrames: Math.max(1, Math.ceil((c.best_of || 5) / 2)),
    // Team cups: each player plays one frame. Singles and doubles: the same players all match.
    unique: c.kind === "Team" ? "match" : "frame",
    // Handicap competitions: show each player's handicap and work out the start.
    handicap: c.handicap ? (id) => players.find((p) => p.id === id)?.handicap ?? 0 : null,
    // Doubles: each pair starts on its two handicaps added together. A running total decides a match level on frames.
    handicapMode: handicapMode(c), runningTotal: !!c.handicap,
    playerName: (id) => players.find((p) => p.id === id)?.full_name ?? "A player",
    frames: bundle.frames.map(toEditor),
    actions: [
      { key: "progress", label: "Save progress", done: "Progress saved", saves: true },
      { key: "finish", label: "Finish match", cls: "green", final: true, done: "Match finished",
        confirmTitle: "Finish this match?", confirm: "Please be certain the scores are correct and in the right columns.\n\nThe winner goes through to the next round." },
      { key: "view", label: "View match page", cls: "ghost", skipChecks: true, quiet: true },
    ],
    async onSave(frames, breaks, action) {
      if (action === "view") return navigate(`/cup-match/${match.id}`);
      await saveCompScorecard(match.id, frames.map(fromEditor), breaks, action === "finish");
      if (action === "finish") navigate(canManage(user, "competitions") ? `/admin/draws?c=${c.id}` : urls.competition(c));
    },
  }).destroy;
}
