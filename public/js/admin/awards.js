// Admin → Presentation awards: the trophies, winners and runners-up shown on the
// presentation night page (/presentation). One list per season. Two tools save the typing:
// "Add the standard list" creates the league's usual awards (keeping last season's trophy
// pictures), and "Fill in from the results" works out every winner the results can tell us.
import { html, mount, $, toast } from "../core/dom.js";
import { table, insertMany, save, loadCompetitions } from "../core/api.js";
import { seasonContext } from "../core/context.js";
import { STANDARD_AWARDS, linkAward, awardFromResults, awardKind } from "../core/awards.js";
import { RESOURCES } from "./resources.js";
import { crud, friendly } from "./crud.js";

export async function awardsPage(el, { onChange = () => {} } = {}) {
  const seasons = await table("seasons", "name");
  const current = seasons.find((s) => s.is_current) ?? seasons.at(-1);
  let seasonId = sessionStorage.getItem("sbdsl-awards-season") || current?.id;
  if (!seasons.some((s) => s.id === seasonId)) seasonId = current?.id;

  async function draw() {
    const [all, leagues, data] = await Promise.all([table("awards", "sort"), table("leagues", "sort"), loadCompetitions()]);
    const mine = all.filter((a) => a.season_id === seasonId);
    const season = seasons.find((s) => s.id === seasonId);
    const open = mine.filter((a) => !a.winner_name && !a.winner_player_id && !a.winner_team_id);
    // How many of the undecided ones the results can already answer.
    const ctx = open.some((a) => awardKind(a, leagues) !== "manual") ? await seasonContext(seasonId) : null;
    const canFill = ctx ? open.filter((a) => awardFromResults(a, ctx, data)).length : 0;
    mount(el, html`
      <div class="notice">These are shown on the <a href="/presentation?season=${seasonId}" style="font-weight:700;color:var(--red)">Presentation night</a> page: each award with its trophy, the winner and the runner-up, and their pictures.
        A trophy with no picture yet shows a placeholder cup. The <a href="/season-review?season=${seasonId}" style="font-weight:700;color:var(--red)">Season review</a> page needs nothing from you — it is worked out from the results.</div>
      <div class="box award-tools">
        <label>Season <select data-award-season>${[...seasons].reverse().map((s) => html`<option value="${s.id}" ${s.id === seasonId ? "selected" : ""}>${s.name}${s.id === current?.id ? " (this season)" : ""}</option>`)}</select></label>
        <button type="button" class="btn blue" data-award-standard>Add the standard list</button>
        <button type="button" class="btn secondary" data-award-fill ${canFill ? "" : "disabled"}>Fill in from the results${canFill ? ` (${canFill})` : ""}</button>
        <p class="muted">${mine.length ? `${mine.length} award${mine.length === 1 ? "" : "s"} for ${season?.name}: ${mine.length - open.length} decided, ${open.length} still to be decided.` : `No awards for ${season?.name} yet — “Add the standard list” creates the league's ${STANDARD_AWARDS.length} usual ones in one go.`}
          “Fill in from the results” only touches awards that have no winner yet: league titles, highest breaks, rankings winners and knockout competitions that have been played to a finish. Awards the committee decides (player of the year, the Melville Mills Award…) are always yours to fill in.</p>
      </div>
      <div data-award-list></div>`);
    await crud($("[data-award-list]", el), RESOURCES.awards, { preset: { season_id: seasonId }, onChange: () => { onChange(); } });
  }

  el.onchange = (e) => {
    if (!e.target.matches("[data-award-season]")) return;
    seasonId = e.target.value;
    sessionStorage.setItem("sbdsl-awards-season", seasonId);
    draw();
  };
  el.onclick = async (e) => {
    const std = e.target.closest("[data-award-standard]"), fill = e.target.closest("[data-award-fill]");
    if (!std && !fill) return;
    (std ?? fill).disabled = true;
    try {
      const [all, leagues, data] = await Promise.all([table("awards", "sort"), table("leagues", "sort"), loadCompetitions()]);
      const mine = all.filter((a) => a.season_id === seasonId);
      const comps = data.competitions.filter((c) => (c.season_id ?? current?.id) === seasonId);
      if (std) {
        // The usual awards, plus any others the league gave out before — each with the trophy picture it had last time.
        const earlier = all.filter((a) => a.season_id !== seasonId);
        const names = [...new Set([...STANDARD_AWARDS, ...earlier.map((a) => a.name)])];
        const have = new Set(mine.map((a) => a.name.trim().toLowerCase()));
        const start = Math.max(0, ...mine.map((a) => a.sort || 0));
        const rows = names.filter((n) => !have.has(n.trim().toLowerCase())).map((name, i) => ({
          season_id: seasonId, name, sort: start + i + 1, ...linkAward(name, leagues, comps),
          trophy_url: earlier.filter((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase() && a.trophy_url).at(-1)?.trophy_url ?? null,
        }));
        if (!rows.length) toast("Every standard award is already in this season's list");
        else { await insertMany("awards", rows); toast(`${rows.length} award${rows.length === 1 ? "" : "s"} added — now fill in the winners`); }
      } else {
        const ctx = await seasonContext(seasonId);
        let n = 0;
        for (const a of mine.filter((x) => !x.winner_name && !x.winner_player_id && !x.winner_team_id)) {
          const found = awardFromResults(a, ctx, data);
          if (!found) continue;
          await save("awards", { id: a.id, ...found, note: a.note || found.note || null });
          n++;
        }
        toast(n ? `${n} award${n === 1 ? "" : "s"} filled in from the results — check them over` : "Nothing more could be worked out from the results yet");
      }
      onChange();
      await draw();
    } catch (err) { toast(friendly(err), "error"); (std ?? fill).disabled = false; }
  };
  await draw();
}
