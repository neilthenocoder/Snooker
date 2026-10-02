// Admin → Statistics: a small, privacy-friendly "Google Analytics".
// Page views are recorded anonymously by trackPageView() in core/api.js.
import { html, mount, $, ukDay } from "../core/dom.js";
import { pageViews } from "../core/api.js";
import { addDays } from "../core/schedule.js";
import { panel, dataTable } from "../core/components.js";

const RANGES = [[7, "Last 7 days"], [30, "Last 30 days"], [90, "Last 90 days"]];
const fmtDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Daily views as an SVG bar chart (one series, so no legend — the title names it). */
function barChart(days) {
  const W = 760, H = 220, pad = { l: 36, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...days.map((d) => d.views));
  const nice = Math.ceil(max / 5) * 5 || 5;
  const step = (W - pad.l - pad.r) / days.length;
  const bw = Math.max(2, step - 2);               // 2px gap between bars
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const labelEvery = Math.ceil(days.length / 8);
  return html`<div class="chart" data-chart>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Page views per day">
      ${ticks.map((t) => html`<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.l - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${t}</text>`)}
      ${days.map((d, i) => {
        const x = pad.l + i * step + 1, top = y(d.views), h = Math.max(0, y(0) - top);
        return html`<g class="bar-g" data-tip="${fmtDay(d.day)}: ${d.views} views, ${d.visits} visits">
          <rect x="${x - 1}" y="${pad.t}" width="${step}" height="${H - pad.t - pad.b}" class="hit"/>
          <path d="${h > 4 ? `M${x},${y(0)} V${top + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y(0)} Z` : `M${x},${y(0)} v${-h} h${bw} v${h} Z`}" class="bar"/>
          ${i % labelEvery === 0 ? html`<text x="${x + bw / 2}" y="${H - 8}" class="tick" text-anchor="middle">${fmtDay(d.day)}</text>` : ""}
        </g>`;
      })}
    </svg>
    <div class="chart-tip" hidden></div>
  </div>`;
}

/** Horizontal share bars with direct labels (device types, sources). */
const shareBars = (rows, total) => html`<div class="share">${rows.map(([label, n]) => html`<div class="share-row">
  <span>${label}</span><div class="share-track"><i style="width:${total ? (n / total) * 100 : 0}%"></i></div><b>${n} <small>(${total ? Math.round((n / total) * 100) : 0}%)</small></b></div>`)}</div>`;

export async function statsPage(el) {
  let range = 30;
  const draw = async () => {
    const today = ukDay(new Date().toISOString());
    const start = addDays(today, -(range - 1));
    const views = await pageViews(`${start}T00:00:00Z`);
    const byDay = new Map(Array.from({ length: range }, (_, i) => [addDays(start, i), { views: 0, visits: 0 }]));
    for (const v of views) { const d = byDay.get(ukDay(v.created_at)); if (d) { d.views++; if (v.new_session) d.visits++; } }
    const days = [...byDay].map(([day, d]) => ({ day, ...d }));
    const count = (key) => { const m = new Map(); for (const v of views) { const k = v[key] || "Direct / unknown"; m.set(k, (m.get(k) ?? 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
    const visits = views.filter((v) => v.new_session).length;
    const busiest = days.reduce((a, b) => (b.views > a.views ? b : a), days[0]);

    mount($("[data-stats]", el), html`
      <div class="stats">
        <div class="stat"><b>${views.length}</b>Page views</div>
        <div class="stat"><b>${visits}</b>Visits</div>
        <div class="stat"><b>${visits ? (views.length / visits).toFixed(1) : "–"}</b>Pages per visit</div>
        <div class="stat"><b>${busiest?.views ? fmtDay(busiest.day) : "–"}</b>Busiest day</div>
      </div>
      ${panel("Page views per day", html`<div style="padding:14px">${barChart(days)}</div>`)}
      <div class="grid-2" style="gap:24px;margin-top:24px;align-items:start">
        ${panel("Most viewed pages", dataTable([
          { label: "Page", cell: ([p]) => html`<a href="${p}" target="_blank">${p}</a>` },
          { label: "Views", cell: ([, n]) => n, cls: "num strong" },
        ], count("path").slice(0, 12), { empty: "No visits yet." }))}
        <div class="stack">
          ${panel("Devices", html`<div style="padding:14px">${shareBars(count("device"), views.length)}</div>`)}
          ${panel("Where visitors came from", html`<div style="padding:14px">${shareBars(count("referrer").slice(0, 6), views.length)}</div>`)}
        </div>
      </div>`);

    // Hover tooltip for the bars.
    const chart = $("[data-chart]", el), tip = $(".chart-tip", chart);
    chart.addEventListener("mousemove", (e) => {
      const g = e.target.closest(".bar-g");
      chart.querySelectorAll(".bar-g.on").forEach((x) => x.classList.remove("on"));
      if (!g) { tip.hidden = true; return; }
      g.classList.add("on");
      tip.hidden = false; tip.textContent = g.dataset.tip;
      const r = chart.getBoundingClientRect();
      tip.style.left = `${Math.min(e.clientX - r.left + 12, r.width - 190)}px`; tip.style.top = `${e.clientY - r.top - 34}px`;
    });
    chart.addEventListener("mouseleave", () => { tip.hidden = true; chart.querySelectorAll(".bar-g.on").forEach((x) => x.classList.remove("on")); });
  };

  mount(el, html`<div class="notice">Counts every public page opened on the website. No names, cookies or IP addresses are stored —
      a "visit" is one browser tab session. Admin and scorecard pages aren't counted.</div>
    <div class="toolbar">${RANGES.map(([n, l]) => html`<button class="btn small ${n === range ? "" : "ghost"}" data-range="${n}">${l}</button>`)}</div>
    <div data-stats></div>`);
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-range]");
    if (!b) return;
    range = Number(b.dataset.range);
    el.querySelectorAll("[data-range]").forEach((x) => x.classList.toggle("ghost", x !== b));
    draw();
  });
  await draw();
}
