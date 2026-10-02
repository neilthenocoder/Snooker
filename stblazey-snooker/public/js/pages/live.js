import { html, mount, fmtTime, todayUK, ukDay } from "../core/dom.js";
import { seasonContext } from "../core/context.js";
import { subscribe } from "../core/api.js";
import { breadcrumb, panel, dataTable, statusBadge, urls } from "../core/components.js";
import { frameWinner } from "../core/rules.js";
import { setTitle, adminEdit } from "../core/router.js";

export default async function live(view) {
  setTitle("Live scores");
  adminEdit("results");
  const draw = async () => {
    const ctx = await seasonContext();
    const today = todayUK();
    const games = ctx.fixtures.filter((f) => f.status === "in_progress" || ukDay(f.starts_at) === today);
    const name = (id) => ctx.player.get(id)?.full_name ?? "–";
    // A player's name with any breaks they made in that frame: "Gary Lobb · 125 break".
    const who = (fx, f, side) => {
      const made = ctx.breaksOf(fx.id).filter((b) => b.frame_no === f.frame_no && b.player_id === f[`${side}_player_id`]).map((b) => b.value).sort((a, b) => b - a);
      return html`<span class="${frameWinner(f) === side ? "strong" : ""}">${name(f[`${side}_player_id`])}</span>${made.length ? html`<span class="break-tag" title="Break${made.length > 1 ? "s" : ""} in this frame">${made.join(", ")} break${made.length > 1 ? "s" : ""}</span>` : ""}`;
    };
    mount(view, html`<div class="wrap">
      ${breadcrumb([["Home", "/"], ["Live"]])}
      <h1>Live scores</h1>
      <p class="muted">Scores update automatically as captains save each frame — no need to refresh.</p>
      ${games.length ? html`<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">${games.map((fx) => {
        const s = ctx.scoreOf(fx);
        const home = ctx.team.get(fx.home_team_id), away = ctx.team.get(fx.away_team_id);
        return panel(ctx.league.get(fx.league_id)?.name ?? "", html`
          <a class="running" href="${urls.match(fx)}">
            <div><small>${home?.name}</small>${s.home}</div><div class="dash">–</div><div><small>${away?.name}</small>${s.away}</div>
          </a>
          <div style="text-align:center;padding-bottom:10px">${fx.status === "in_progress" ? html`<span class="live-dot">Live</span>` : statusBadge(fx.status)} <span class="muted">${fmtTime(fx.starts_at)}</span></div>
          ${dataTable([
            { label: "#", cell: (f) => f.frame_no, cls: "num" },
            { label: "Home", cell: (f) => who(fx, f, "home"), cls: "right live-name" },
            { label: "", cell: (f) => `${f.home_points ?? ""}-${f.away_points ?? ""}`, cls: "num" },
            { label: "Away", cell: (f) => who(fx, f, "away"), cls: "live-name" },
          ], ctx.framesOf(fx.id).filter((f) => !f.legacy), { empty: "Waiting for the first frame…" })}`);
      })}</div>` : html`<div class="empty">No matches being played right now. Match nights are usually Tuesdays from 19:30.</div>`}
    </div>`);
  };
  await draw();
  return subscribe(["frames", "breaks", "fixtures"], draw);
}
