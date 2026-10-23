// ─────────────────────────────────────────────────────────────
//  The dashboard Overview's working boxes (round 40, Neil's suggestions):
//   • Tonight      — every league and cup match of the night (or the next match night), its state, and the
//                    buttons for it: scorecard, approve, postpone, walkover.
//   • Needs you    — everything waiting for someone in the league office, in one list, oldest first.
//   • Your recent changes (Master Admin) — the last things you changed, with Undo.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, fmtDate, fmtTime, ukDay, todayUK, confirmBox } from "../core/dom.js";
import { setFixtureStatus, save, invalidate, currentCompetitions, auditLog, table, subscribe } from "../core/api.js";
import { db, run } from "../core/db.js";
import { buildBracket, isEntry, roundName, compScoreText } from "../core/bracket.js";
import { canOpenSection, isMaster } from "../core/auth.js";
import { rearrangeBy } from "../core/rules.js";
import { panel, urls, statusBadge } from "../core/components.js";

const LATE_HOURS = 3;      // a match that started this long ago with nothing entered is flagged
const ago = (iso) => {
  const h = Math.round((Date.now() - Date.parse(iso)) / 3600e3);
  if (h < 1) return "just now";
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
};

// ── Tonight ─────────────────────────────────────────────────
/** The matches of one evening: tonight if there are any, otherwise the next match night. */
function matchNight(ctx, comps) {
  const today = todayUK();
  const league = ctx.fixtures.filter((f) => f.starts_at).map((f) => ({ kind: "league", f, day: ukDay(f.starts_at) }));
  const cups = [];
  for (const c of comps.competitions) {
    const b = buildBracket(comps.entries.filter((e) => e.competition_id === c.id), comps.matches.filter((m) => m.competition_id === c.id));
    for (const m of b.rounds.flat()) if (m.row?.starts_at && !m.isBye && isEntry(m.a) && isEntry(m.b)) cups.push({ kind: "cup", c, b, m, day: ukDay(m.row.starts_at) });
  }
  const all = [...league, ...cups];
  const tonight = all.filter((x) => x.day === today);
  if (tonight.length) return { day: today, isToday: true, list: tonight };
  const next = all.filter((x) => x.day > today).map((x) => x.day).sort()[0];
  return next ? { day: next, isToday: false, list: all.filter((x) => x.day === next) } : { day: null, list: [] };
}

/** Where a match is up to, in words and a colour. */
function stateOf(x, ctx) {
  if (x.kind === "league") {
    const f = x.f, frames = ctx.framesOf(f.id).length;
    if (f.status === "postponed") return ["postponed", "Postponed"];
    if (f.status === "approved") return ["approved", "Approved"];
    if (f.status === "submitted") return ["submitted", "Waiting for approval"];
    if (f.status === "in_progress") return ["live", frames ? `Live · ${frames} frame${frames > 1 ? "s" : ""}` : "Started"];
    if (Date.parse(f.starts_at) < Date.now() - LATE_HOURS * 3600e3) return ["late", "Nothing entered yet"];
    return ["waiting", Date.parse(f.starts_at) <= Date.now() ? "Should have started" : `Starts ${fmtTime(f.starts_at)}`];
  }
  const r = x.m.row;
  if (r.status === "postponed") return ["postponed", "Postponed"];
  if (r.walkover) return ["approved", "Walkover"];
  if (r.status === "completed") return ["approved", "Finished"];
  if (r.status === "in_progress") return ["live", "Live"];
  if (Date.parse(r.starts_at) < Date.now() - LATE_HOURS * 3600e3) return ["late", "Nothing entered yet"];
  return ["waiting", Date.parse(r.starts_at) <= Date.now() ? "Should have started" : `Starts ${fmtTime(r.starts_at)}`];
}

export async function tonightPanel(el, user) {
  const draw = async () => {
    invalidate();
    const { seasonContext } = await import("../core/context.js");
    const [ctx, comps] = await Promise.all([seasonContext(), currentCompetitions().catch(() => ({ competitions: [], entries: [], matches: [] }))]);
    const night = matchNight(ctx, comps);
    const canResults = canOpenSection(user, "results"), canDraws = canOpenSection(user, "draws");
    const row = (x) => {
      const [cls, words] = stateOf(x, ctx);
      if (x.kind === "league") {
        const f = x.f, s = ctx.scoreOf(f), home = ctx.team.get(f.home_team_id)?.name, away = ctx.team.get(f.away_team_id)?.name;
        return html`<div class="tn-row tn-${cls}">
          <span class="tn-time">${fmtTime(f.starts_at)}</span>
          <span class="tn-what"><small>${ctx.league.get(f.league_id)?.name ?? "League"}</small><a href="${urls.match(f)}">${home} v ${away}</a></span>
          <span class="tn-score">${ctx.hasResult(f) ? `${s.home} – ${s.away}` : f.status === "postponed" ? "P – P" : "–"}</span>
          <span class="tn-state">${words}</span>
          <span class="tn-acts">
            ${f.status === "submitted" && canResults ? html`<button type="button" class="btn small green" data-approve="${f.id}">Approve</button>` : ""}
            ${f.status !== "postponed" ? html`<a class="btn small secondary" href="${urls.scorecard(f)}">${["submitted", "approved"].includes(f.status) ? "Check card" : "Scorecard"}</a>` : ""}
            ${["scheduled"].includes(f.status) && canResults ? html`<button type="button" class="btn small ghost" data-postpone="${f.id}">Postpone</button>` : ""}
          </span></div>`;
      }
      const { c, b, m } = x, r = m.row, name = (id) => b.entryById.get(id)?.name ?? "?";
      return html`<div class="tn-row tn-${cls} tn-cup">
        <span class="tn-time">${fmtTime(r.starts_at)}</span>
        <span class="tn-what"><small>🏆 ${c.name} · ${roundName(m.round, b.totalRounds, b)}</small><a href="/cup-match/${r.no ?? r.id}">${name(m.a)} v ${name(m.b)}</a></span>
        <span class="tn-score">${compScoreText(r, " – ") || (r.status === "postponed" ? "P – P" : "–")}</span>
        <span class="tn-state">${words}</span>
        <span class="tn-acts">
          ${r.status !== "postponed" && r.status !== "completed" ? html`<a class="btn small secondary" href="/cup-scorecard/${r.no ?? r.id}">Scorecard</a>` : ""}
          ${(r.status ?? "scheduled") === "scheduled" && canDraws ? html`<button type="button" class="btn small ghost" data-cup-postpone="${r.id}">Postpone</button>
            <a class="btn small ghost" href="/cup-scorecard/${r.no ?? r.id}" title="Give a walkover from the scorecard">Walkover</a>` : ""}
        </span></div>`;
    };
    const order = (x) => (x.kind === "league" ? x.f.starts_at : x.m.row.starts_at) + (x.kind === "league" ? (ctx.league.get(x.f.league_id)?.name ?? "") : x.c.name);
    const list = [...night.list].sort((a, b) => order(a).localeCompare(order(b)));
    const counts = list.reduce((n, x) => { const k = stateOf(x, ctx)[0]; n[k] = (n[k] ?? 0) + 1; return n; }, {});
    const title = !night.day ? "Match night" : night.isToday ? "Tonight" : `Next match night · ${fmtDate(`${night.day}T12:00:00Z`)}`;
    mount(el, panel(title, list.length ? html`
      <div class="tn-sum">${[["live", "live"], ["submitted", "waiting for approval"], ["late", "nothing entered"], ["approved", "done"], ["postponed", "postponed"], ["waiting", "to come"]]
        .filter(([k]) => counts[k]).map(([k, w]) => html`<span class="tn-chip tn-${k}"><b>${counts[k]}</b> ${w}</span>`)}</div>
      <div class="tn-list">${list.map(row)}</div>` : html`<p class="muted" style="padding:14px">No matches coming up this season.</p>`, { color: "green" }));
  };
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    try {
      if (t.dataset.approve) { t.disabled = true; await setFixtureStatus(t.dataset.approve, "approved"); toast("Result approved"); }
      else if (t.dataset.postpone) { if (!(await confirmBox("Postpone this match? It shows as P - P and waits under Results to approve for a new date."))) return; t.disabled = true; await setFixtureStatus(t.dataset.postpone, "postponed"); toast("Match postponed"); }
      else if (t.dataset.cupPostpone) { if (!(await confirmBox("Postpone this cup match?"))) return; t.disabled = true; await save("competition_matches", { id: t.dataset.cupPostpone, status: "postponed" }); toast("Cup match postponed"); }
      else return;
      await draw();
    } catch (err) { t.disabled = false; toast(err.message, "error"); }
  });
  await draw();
  // Keeps itself up to date while captains score.
  return subscribe(["fixtures", "frames", "competition_matches"], () => draw().catch(() => {}));
}

// ── Needs you ───────────────────────────────────────────────
/**
 * Everything waiting for the league office, oldest first. `waiting` holds what the dashboard already loads for
 * its red menu numbers: { players, entries, cueviews, news, ads } (each a list, empty when this login can't see it).
 */
export async function needsYouPanel(el, user, ctx, waiting) {
  // Each kind of job is one line ("9 matches with no scorecard yet") that opens to show them, oldest first.
  const groups = new Map();
  const add = (key, icon, title, href, label, when, text, itemHref = null) => {
    const g = groups.get(key) ?? groups.set(key, { icon, title, href, label, items: [] }).get(key);
    g.items.push({ when: when ?? "", text, href: itemHref });
  };
  const fx = (f) => html`<b>${ctx.team.get(f.home_team_id)?.name} v ${ctx.team.get(f.away_team_id)?.name}</b> <small class="muted">${fmtDate(f.starts_at)}</small>`;
  if (canOpenSection(user, "results")) {
    for (const f of ctx.fixtures.filter((x) => x.status === "submitted"))
      add("approve", "✅", (n) => `${n} result${n > 1 ? "s" : ""} to approve`, "/admin/results", "Approve", f.starts_at, fx(f), urls.match(f));
    for (const f of ctx.fixtures.filter((x) => x.status === "scheduled" && Date.parse(x.starts_at) < Date.now() - 864e5 && Date.parse(x.starts_at) > Date.now() - 42 * 864e5))
      add("cards", "📝", (n) => `${n} match${n > 1 ? "es" : ""} with no scorecard yet (last six weeks)`, "/admin/results", "Results", f.starts_at,
        html`${fx(f)}${f.reminder_sent_at ? html` <small class="muted">· captains reminded ${ago(f.reminder_sent_at)}</small>` : ""}`, urls.scorecard(f));
    for (const f of ctx.fixtures.filter((x) => x.status === "postponed")) {
      const late = Date.parse(rearrangeBy(f)) < Date.now();
      add(late ? "pp-late" : "pp", late ? "⛔" : "📅", (n) => late ? `${n} postponed match${n > 1 ? "es" : ""} past the rearrange-by date` : `${n} postponed match${n > 1 ? "es" : ""} to rearrange`,
        "/admin/results#postponed", "Find dates", rearrangeBy(f), html`${fx(f)} <small class="muted">— by ${fmtDate(rearrangeBy(f))}</small>`);
    }
  }
  for (const p of waiting.players ?? []) add("players", "👤", (n) => `${n} new player${n > 1 ? "s" : ""} to check`, "/admin/players", "Players", p.created_at,
    html`<b>${p.full_name}</b> <small class="muted">${ctx.team.get(p.team_id)?.name ?? ""}</small>`, `/admin/players?edit=${p.id}`);
  for (const r of waiting.entries ?? []) add("entries", "💷", (n) => `${n} competition entr${n > 1 ? "ies" : "y"} waiting for payment`, "/admin/entries", "Entries", r.created_at, html`<b>${r.name ?? "entry"}</b>`);
  for (const r of waiting.news ?? []) add("news", "📰", (n) => `${n} news article${n > 1 ? "s" : ""} to approve`, "/admin/approvals", "Read", r.created_at ?? r.published_at, html`<b>${r.title}</b>`);
  for (const r of waiting.cueviews ?? []) add("cueviews", "🎤", (n) => `${n} CueView${n > 1 ? "s" : ""} to check`, "/admin/cueviews", "Check", r.created_at, html`<b>${r.player_name ?? r.name ?? "answers"}</b>`);
  for (const r of waiting.ads ?? []) add("ads", "🏷", (n) => `${n} marketplace advert${n > 1 ? "s" : ""} to approve`, "/admin/market", "Check", r.created_at, html`<b>${r.title ?? "advert"}</b>`);
  // Cup matches past their round's play-by date with no result.
  if (canOpenSection(user, "draws")) {
    const comps = await currentCompetitions().catch(() => ({ competitions: [], entries: [], matches: [] }));
    for (const c of comps.competitions) {
      const b = buildBracket(comps.entries.filter((e) => e.competition_id === c.id), comps.matches.filter((m) => m.competition_id === c.id));
      for (const m of b.rounds.flat()) {
        const by = c.round_deadlines?.[m.round] ?? c.round_deadlines?.[String(m.round)];
        if (!by || m.isBye || m.played || !isEntry(m.a) || !isEntry(m.b) || by >= todayUK()) continue;
        add("cups", "🏆", (n) => `${n} cup match${n > 1 ? "es" : ""} past the round deadline`, "/admin/draws", "Draws", by,
          html`<b>${b.entryById.get(m.a)?.name} v ${b.entryById.get(m.b)?.name}</b> <small class="muted">${c.name} · play by ${fmtDate(`${by}T12:00:00Z`)}</small>`, `/admin/draws?c=${c.id}`);
      }
    }
  }
  const list = [...groups.values()].map((g) => ({ ...g, items: g.items.sort((a, b) => String(a.when).localeCompare(String(b.when))) }))
    .sort((a, b) => String(a.items[0].when).localeCompare(String(b.items[0].when)));
  const total = list.reduce((n, g) => n + g.items.length, 0);
  mount(el, panel(`Needs you${total ? ` (${total})` : ""}`, list.length
    ? html`<div class="ny-list">${list.map((g) => html`<details class="ny-group" ${list.length === 1 ? "open" : ""}>
        <summary><span class="ny-ico" aria-hidden="true">${g.icon}</span><span class="ny-text">${g.title(g.items.length)}</span><a class="btn small" href="${g.href}">${g.label}</a></summary>
        <ul>${g.items.slice(0, 25).map((i) => html`<li>${i.href ? html`<a href="${i.href}">${i.text}</a>` : i.text}</li>`)}${g.items.length > 25 ? html`<li class="muted">and ${g.items.length - 25} more</li>` : ""}</ul>
      </details>`)}</div>`
    : html`<p class="ny-done">Nothing waiting — all caught up. 🎉</p>`, { color: "red" }));
}

// ── Your recent changes, with Undo (Master Admin) ───────────
// Only plain changes can be undone: the values before and after are both in the activity log, and the row
// still has the "after" values (nobody has changed it since). Additions and deletions are not undone here.
const NO_UNDO = new Set(["profiles", "role_permissions", "audit_log", "page_views"]);
const GENERATED = new Set(["word_count", "result_at", "reminder_sent_at"]);
const undoable = (r) => r.action === "changed" && r.row_id && !NO_UNDO.has(r.table_name) && r.changes
  && Object.entries(r.changes).filter(([k]) => !GENERATED.has(k)).length > 0
  && Object.entries(r.changes).filter(([k]) => !GENERATED.has(k)).every(([, v]) => Array.isArray(v));
const pretty = (k) => k.replace(/_/g, " ");
const show = (v) => (v === null || v === "" ? "empty" : v === true ? "yes" : v === false ? "no" : typeof v === "object" ? JSON.stringify(v) : String(v));

export async function recentChangesPanel(el, user) {
  if (!isMaster(user)) return;
  const draw = async () => {
    const rows = (await auditLog(200).catch(() => [])).filter((r) => r.actor_id === user.id && Date.now() - Date.parse(r.at) < 7 * 864e5).slice(0, 8);
    if (!rows.length) return mount(el, "");
    mount(el, panel("Your recent changes", html`<ul class="rc-list">${rows.map((r) => html`<li>
      <span class="rc-when">${ago(r.at)}</span>
      <span class="rc-what"><span class="status act-${r.action}">${r.action}</span> <b>${r.label ?? r.table_name}</b>
        ${r.changes && r.action === "changed" ? html`<small>${Object.entries(r.changes).filter(([k, v]) => !GENERATED.has(k) && !(Array.isArray(v) && show(v[0]) === show(v[1]))).slice(0, 4).map(([k, v]) => (Array.isArray(v) ? `${pretty(k)}: ${show(v[0])} → ${show(v[1])}` : `${pretty(k)} changed`)).join(" · ")}</small>` : ""}</span>
      ${undoable(r) ? html`<button type="button" class="btn small ghost" data-undo="${r.id}">Undo</button>` : html`<span></span>`}</li>`)}</ul>
      <p class="muted" style="padding:0 14px 10px;margin:0">Everything everyone has changed is under <a href="/admin/activity">Activity log</a>.</p>`));
    el.onclick = async (e) => {
      const btn = e.target.closest("[data-undo]");
      if (!btn) return;
      const r = rows.find((x) => String(x.id) === btn.dataset.undo);
      const changes = Object.entries(r.changes).filter(([k]) => !GENERATED.has(k));
      try {
        btn.disabled = true;
        const now = await run(db.from(r.table_name).select("*").eq("id", r.row_id).maybeSingle());
        if (!now) throw new Error("That has since been removed, so it can't be undone.");
        const moved = changes.filter(([k, v]) => JSON.stringify(now[k] ?? null) !== JSON.stringify(v[1] ?? null));
        if (moved.length) throw new Error(`It has been changed again since (${moved.map(([k]) => pretty(k)).join(", ")}), so it can't be undone from here. Edit it instead.`);
        if (!(await confirmBox(`Undo this change to ${r.label ?? r.table_name}?\n\n${changes.map(([k, v]) => `${pretty(k)} goes back to ${show(v[0])}`).join("\n")}`))) { btn.disabled = false; return; }
        await save(r.table_name, { id: r.row_id, ...Object.fromEntries(changes.map(([k, v]) => [k, v[0]])) });
        toast("Undone"); invalidate(); await draw();
      } catch (err) { btn.disabled = false; toast(err.message, "error"); }
    };
  };
  await draw();
}
