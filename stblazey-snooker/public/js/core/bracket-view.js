// HTML for knockout competitions: the bracket "roadmap", round cards and
// standings. The logic (who plays whom, who won) lives in bracket.js.
import { html, fmtDate, fmtTime } from "./dom.js";
import { roundName, isEntry, EMPTY, competitionStandings } from "./bracket.js";
import { dataTable, urls } from "./components.js";

const MATCH_HEIGHT = 102; // px per first-round match; later rounds share the same height

/** Name for one side of a match: an entrant, "Bye", or "Winner of …". */
function sideLabel(b, match, side) {
  const id = match[side];
  if (isEntry(id)) return b.entryById.get(id).name;
  if (id === EMPTY) return "Bye";
  if (match.round === 1) return "TBC";
  const from = b.rounds[match.round - 2][match.slot * 2 + (side === "a" ? 0 : 1)];
  const short = { "Quarter-finals": "QF", "Semi-finals": "SF" }[roundName(from.round, b.totalRounds)] ?? `R${from.round}-`;
  return `Winner ${short}${from.slot + 1}`;
}

function entryHref(entry) {
  if (entry?.player_id) return `/player/${entry.player_id}`;
  return null;
}

function teamRow(b, m, side) {
  const id = m[side];
  const score = m.row[side === "a" ? "score_a" : "score_b"];
  const state = !isEntry(id) ? "tbc" : m.winner === id ? "won" : m.loser === id ? "lost" : "";
  const onPath = b.champion && id === b.champion ? "path" : "";
  return html`<div class="br-team ${state} ${onPath}" ${isEntry(id) ? html`data-entry="${id}"` : ""}>
    <span class="br-name">${sideLabel(b, m, side)}</span>
    <span class="br-score">${m.isBye ? "" : score ?? ""}</span>
  </div>`;
}

function matchBox(b, m) {
  const when = m.row.starts_at ? `${fmtDate(m.row.starts_at)}` : "";
  return html`<div class="br-match ${m.isBye ? "bye" : ""} ${m.played ? "played" : ""}">
    ${teamRow(b, m, "a")}${teamRow(b, m, "b")}
    ${when && !m.isBye ? html`<div class="br-meta">${when}</div>` : ""}
  </div>`;
}

/** The whole bracket, left to right, finishing with the champion. */
export function bracketView(b) {
  if (!b.totalRounds) return html`<div class="empty">The draw hasn't been made yet.</div>`;
  const firstRound = b.rounds[0].length;
  const champ = b.champion ? b.entryById.get(b.champion) : null;
  const cols = b.rounds.map((list, i) => {
    const isLast = i === b.rounds.length - 1;
    const slots = list.map((m) => html`<div class="br-slot">${matchBox(b, m)}</div>`);
    const body = isLast ? slots : list.filter((_, j) => j % 2 === 0).map((_, p) => html`<div class="br-pair">${slots[p * 2]}${slots[p * 2 + 1]}</div>`);
    return html`<div class="br-col" style="--i:${i}"><div class="br-title">${roundName(i + 1, b.totalRounds)}</div>
      <div class="br-matches" style="height:${firstRound * MATCH_HEIGHT}px">${body}</div></div>`;
  });
  return html`<div class="bracket-wrap" data-bracket><div class="bracket">
    ${cols}
    <div class="br-col br-champion" style="--i:${b.rounds.length}"><div class="br-title">Champion</div>
      <div class="br-matches" style="height:${firstRound * MATCH_HEIGHT}px"><div class="br-slot">
        <div class="br-trophy ${champ ? "won" : ""}" ${champ ? html`data-entry="${champ.id}"` : ""}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3Zm10 4v3a2 2 0 0 0 1-1.7V7ZM6 7v1.3A2 2 0 0 0 7 10V7Zm-1 14h14v1H5Z"/></svg>
          <span>${champ ? champ.name : "To be decided"}</span>
        </div>
      </div></div>
    </div>
  </div></div>`;
}

/** Hovering an entrant lights up their whole route through the bracket. */
export function wireBracket(root) {
  const light = (id) => root.querySelectorAll("[data-entry]").forEach((el) => el.classList.toggle("lit", !!id && el.dataset.entry === id));
  root.addEventListener("mouseover", (e) => light(e.target.closest("[data-entry]")?.dataset.entry));
  root.addEventListener("mouseleave", () => light(null));
  root.addEventListener("focusin", (e) => light(e.target.closest("[data-entry]")?.dataset.entry));
}

/** Round-by-round cards (like a fixture list), newest round first when finished. */
export function roundCards(b, venueById) {
  return b.rounds.map((list, i) => {
    const real = list.filter((m) => !m.isBye);
    if (!real.length) return "";
    return html`<h3>${roundName(i + 1, b.totalRounds)}</h3>
      <div class="fx-cards">${real.map((m) => {
        const v = venueById.get(m.row.venue_id);
        const cell = (side) => {
          const id = m[side], e = isEntry(id) ? b.entryById.get(id) : null, href = entryHref(e);
          const name = sideLabel(b, m, side);
          return html`<div class="fx-side ${m.winner === id && m.played ? "won" : ""}">
            ${href ? html`<a href="${href}">${name}</a>` : html`<span>${name}</span>`}
            <b>${m.row[side === "a" ? "score_a" : "score_b"] ?? "-"}</b></div>`;
        };
        return html`<div class="fx-card">${cell("a")}<div class="fx-v">v</div>${cell("b")}
          <div class="fx-meta">${m.row.starts_at ? `${fmtDate(m.row.starts_at)} ${fmtTime(m.row.starts_at)}` : "Date TBC"}${v ? html` · <a href="${urls.venue(v)}">${v.name}</a>` : ""}</div></div>`;
      })}</div>`;
  });
}

export function standingsTable(b) {
  return dataTable([
    { label: "", cell: (r, i) => i + 1, cls: "num" },
    { label: "Entrant", cell: (r) => { const href = entryHref(r.entry); return href ? html`<a class="strong" href="${href}">${r.entry.name}</a>` : html`<span class="strong">${r.entry.name}</span>`; } },
    { label: "Status", cell: (r) => html`<span class="status plain ${r.status === "Winner" ? "approved" : r.alive ? "submitted" : ""}">${r.status}</span>` },
    { label: "W", cell: (r) => r.w, cls: "num" },
    { label: "L", cell: (r) => r.l, cls: "num" },
    { label: "F", cell: (r) => r.f, cls: "num" },
    { label: "A", cell: (r) => r.a, cls: "num" },
  ], competitionStandings(b), { highlight: (r) => r.status === "Winner", empty: "No entrants yet." });
}
