// The public page for a competition's live draw. Before: when it will happen
// and who is in the hat. During: each tie appears as it is drawn (the page
// updates itself). After: the full draw, who made it and who witnessed it.
import { html, mount, $, fmtDate, fmtTime } from "../core/dom.js";
import { loadCompetitions, subscribe, signupNames } from "../core/api.js";
import { drawPlan } from "../core/bracket.js";
import { breadcrumb, urls } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";
import notFound from "./not-found.js";

export default async function drawPage(view, { params }) {
  let shown = -1;   // ties already on screen, so only new ones get the reveal animation

  const draw = async () => {
    const data = await loadCompetitions();
    const c = data.competitions.find((x) => x.slug === params.slug);
    if (!c) return notFound(view);
    setTitle(`${c.name} draw`);
    adminEdit("draws", null, { href: `/admin/draws?c=${c.id}`, label: "Run the draw" });
    const entries = data.entries.filter((e) => e.competition_id === c.id);
    const name = (id) => entries.find((e) => e.id === id)?.name ?? "–";
    const live = c.draw_live;
    const log = live?.log ?? [];
    const rows = data.matches.filter((m) => m.competition_id === c.id);
    const status = live?.status === "live" ? "live" : live?.status === "done" ? "done" : rows.length ? "made" : "waiting";
    const inHat = entries.filter((e) => !log.some((t) => [t.a, t.b].includes(e.id)));
    const total = drawPlan(entries.length).length;
    const pending = status === "waiting" ? (await signupNames(c.id)).filter((s) => s.status === "pending") : [];
    const fresh = shown >= 0 ? log.length - shown : 0;   // how many ties arrived since the last look
    shown = log.length;
    view.classList.add("flush");

    mount(view, html`
      <section class="draw-hero ${status}">
        <div class="wrap">
          ${breadcrumb([["Home", "/"], ["Competitions", "/competitions"], [c.name, urls.competition(c)], ["The draw"]])}
          <p class="comp-kicker">${c.kind} competition · the draw</p>
          <h1>${c.name}</h1>
          ${status === "live" ? html`<p class="draw-state"><span class="live-dot">Live</span> The draw is being made now — ${log.length} of ${total} ties drawn</p>`
            : status === "done" ? html`<p class="draw-state done">✓ Drawn live on ${fmtDate(live.finished_at)} at ${fmtTime(live.finished_at)}</p>`
            : status === "made" ? html`<p class="draw-state done">The draw has been made</p>`
            : html`<p class="draw-state">${c.draw_at ? html`The draw will be made live on this page on <b>${fmtDate(c.draw_at)} at ${fmtTime(c.draw_at)}</b>` : "The date of the draw will be announced here"}</p>`}
          ${live ? html`<p class="draw-people">Drawn by <b>${live.by}</b> · Witnessed by <b>${live.witness}</b></p>` : ""}
        </div>
      </section>
      <div class="wrap draw-body">
        ${status === "made" ? html`<div class="notice">This draw wasn't made live on the website. <a href="${urls.competition(c)}" style="font-weight:700;color:var(--red)">See the full draw</a></div>` : ""}
        ${status === "waiting" ? html`
          <h3>In the hat (${entries.length})</h3>
          ${entries.length ? html`<div class="hat">${entries.map((e) => html`<span>${e.name}</span>`)}</div>` : html`<div class="empty box">No confirmed entrants yet.</div>`}
          ${pending.length ? html`<p class="muted">${pending.length} more ${pending.length === 1 ? "entry is" : "entries are"} waiting for payment to be confirmed: ${pending.map((p) => p.name).join(", ")}.</p>` : ""}
          ${c.entries_open ? html`<a class="btn green" href="/enter?c=${c.slug}">Enter this competition</a>` : ""}
          <p class="muted">Keep this page open — the ties appear here one by one as they are drawn. No need to refresh.</p>` : ""}
        ${status === "live" || status === "done" ? html`<div class="draw-grid">
          <div>
            <h3>${status === "done" ? "The draw" : "Drawn so far"}</h3>
            <ol class="ties">${log.map((t, i) => html`<li class="${i >= log.length - fresh ? "new" : ""}">
              <span class="tie-no">${i + 1}</span>
              ${t.a && t.b ? html`<b>${name(t.a)}</b><i>v</i><b>${name(t.b)}</b>` : html`<b>${name(t.a ?? t.b)}</b><i></i><em>Bye — straight into the next round</em>`}</li>`)}
              ${status === "live" && !log.length ? html`<li class="waiting">Waiting for the first tie…</li>` : ""}</ol>
            ${status === "done" ? html`<a class="btn" href="${urls.competition(c)}">See the full bracket</a>` : ""}
          </div>
          ${status === "live" ? html`<aside><h3>Still in the hat (${inHat.length})</h3><div class="hat">${inHat.map((e) => html`<span>${e.name}</span>`)}</div></aside>` : ""}
        </div>` : ""}
      </div>`);
    if (fresh > 0) $(".ties li.new", view)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  await draw();
  return subscribe(["competitions", "competition_matches", "competition_entries"], draw);
}
