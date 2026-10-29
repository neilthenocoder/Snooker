// ─────────────────────────────────────────────────────────────
//  DEMO DATABASE — a tiny stand-in for the Supabase client that
//  stores everything in this browser's localStorage. It implements
//  only the parts of the Supabase API that js/core/api.js uses, so
//  the rest of the site doesn't know (or care) which one it talks to.
//  NOT secure — for testing only.
// ─────────────────────────────────────────────────────────────
import { buildSeed } from "../demo/seed-data.js";
import { SCHEMA_VERSION } from "./version.js";
import { DEFAULT_SUPPORT_CATEGORIES } from "./support.js";

const KEY = "sbdsl-demo-db-v15";
const SESSION_KEY = "sbdsl-demo-session";
const store = typeof localStorage !== "undefined" ? localStorage : (() => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
})();

let state = load();
function load() {
  try { const s = JSON.parse(store.getItem(KEY)); if (s?.tables) return upgrade(s); } catch {}
  const seed = buildSeed();
  const fresh = upgrade({ tables: seed.tables, users: seed.demoUsers });
  store.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}
const persist = () => store.setItem(KEY, JSON.stringify(state));
// Sample data saved before a round added new tables: add them (round 55: support categories).
function upgrade(s) {
  if (!s.tables.support_categories) {
    s.tables.support_categories = demoSupportCategories();
    s.tables.support_tickets ??= []; s.tables.support_messages ??= [];
    // Two sample requests, so the Support inbox has something in it.
    const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString(), cap = s.tables.profiles?.find((p) => p.email === "captain@demo.test");
    const lee = s.tables.profiles?.find((p) => p.role === "admin");
    s.tables.support_tickets.push(
      { id: "sup-1", no: 1001, token: "sample-request-1001", category_id: "supcat-1", category: "Scorecards & results", subject: "Frame 4 score is the wrong way round", name: "Sample Visitor", email: "visitor@example.com",
        user_id: null, status: "new", assigned_to: null, last_from: "sender", page_url: "/results", created_at: ago(3), updated_at: ago(3) },
      ...(cap ? [{ id: "sup-2", no: 1002, token: "sample-request-1002", category_id: "supcat-4", category: "Competitions & entries", subject: "Can I still enter the Singles?", name: cap.full_name, email: cap.email,
        user_id: cap.id, status: "waiting", assigned_to: lee?.id ?? null, last_from: "league", page_url: "/competitions", created_at: ago(30), updated_at: ago(26) }] : []));
    s.tables.support_messages.push(
      { id: "supm-1", ticket_id: "sup-1", author_id: null, author_name: "Sample Visitor", from_league: false, internal: false, body: "On last Tuesday's match the frame 4 score is shown as 40–72 but it was 72–40 to the home player. Could someone change it please?", image_url: null, created_at: ago(3) },
      ...(cap ? [
        { id: "supm-2", ticket_id: "sup-2", author_id: cap.id, author_name: cap.full_name, from_league: false, internal: false, body: "Entries have closed on the website — is there any way I can still enter the Singles?", image_url: null, created_at: ago(30) },
        { id: "supm-3", ticket_id: "sup-2", author_id: lee?.id ?? null, author_name: lee?.full_name ?? "The league", from_league: true, internal: true, body: "The draw isn't made until Friday — fine to add him.", image_url: null, created_at: ago(27) },
        { id: "supm-4", ticket_id: "sup-2", author_id: lee?.id ?? null, author_name: lee?.full_name ?? "The league", from_league: true, internal: false, body: "Yes — the draw is on Friday, so I can still add you. Pay the entry fee to your captain by Thursday and you're in.", image_url: null, created_at: ago(26) },
      ] : []));
  }
  return s;
}
export function demoSupportCategories() { return DEFAULT_SUPPORT_CATEGORIES.map(([name, description, roles], i) => ({
  id: `supcat-${i + 1}`, name, description, roles, sort: i + 1, is_active: true, created_at: new Date().toISOString() })); }
export function resetDemo() { store.removeItem(KEY); state = load(); emit("*"); }

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── realtime emulation ────────────────────────────────────────
const listeners = new Set();
// Like Supabase realtime: listeners get one payload per changed row.
function emit(table, rows = [], eventType = "UPDATE") {
  for (const l of listeners) {
    if (!(l.table === table || l.table === "*" || table === "*")) continue;
    if (!rows.length) l.cb({ table, eventType, new: {} });
    for (const row of rows) l.cb({ table, eventType, new: clone(row) });
  }
}
// Another tab changed the demo data: tell listeners which rows changed.
function emitDiff(before, after) {
  for (const [table, rows] of Object.entries(after.tables)) {
    const old = new Map((before.tables[table] ?? []).map((r) => [r.id, JSON.stringify(r)]));
    const added = rows.filter((r) => !old.has(r.id));
    const changed = rows.filter((r) => old.has(r.id) && old.get(r.id) !== JSON.stringify(r));
    if (added.length) emit(table, added, "INSERT");
    if (changed.length) emit(table, changed, "UPDATE");
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { const before = state; state = load(); emitDiff(before, state); } });
}

// ── query builder ─────────────────────────────────────────────
const OPS = {
  eq: (a, b) => a === b, neq: (a, b) => a !== b, gt: (a, b) => a > b, gte: (a, b) => a >= b,
  lt: (a, b) => a < b, lte: (a, b) => a <= b, in: (a, b) => b.includes(a),
};

class Query {
  constructor(table) { Object.assign(this, { table, filters: [], orders: [], action: "select", payload: null, one: null, from: 0, to: Infinity }); }
  select() { return this; }
  order(col, { ascending = true } = {}) { this.orders.push([col, ascending]); return this; }
  range(from, to) { this.from = from; this.to = to; return this; }
  limit(n) { this.to = this.from + n - 1; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  insert(rows) { this.action = "insert"; this.payload = rows; return this; }
  update(patch) { this.action = "update"; this.payload = patch; return this; }
  upsert(rows, { onConflict = "id" } = {}) { this.action = "upsert"; this.payload = rows; this.conflict = onConflict.split(","); return this; }
  delete() { this.action = "delete"; return this; }
  then(resolve, reject) { try { resolve(this.run()); } catch (e) { reject(e); } }

  matches(row) { return this.filters.every(([op, col, val]) => OPS[op](row[col], val)); }
  run() {
    const rows = (state.tables[this.table] ??= []);
    let data;
    if (this.action === "select") {
      data = rows.filter((r) => this.matches(r));
      for (const [col, asc] of [...this.orders].reverse())
        data.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      data = data.slice(this.from, this.to + 1);
    } else if (this.action === "insert") {
      data = [].concat(this.payload).map((r) => guardInsert(this.table, { id: newId(), ...(ROUND22_TABLES.has(this.table) ? { created_at: new Date().toISOString() } : {}), ...r }));
      for (const r of data) { rows.push(r); shortAddress(this.table, r); }
      audit("added", this.table, data);
    } else if (this.action === "update") {
      data = rows.filter((r) => this.matches(r));
      for (const r of data) audit("changed", this.table, [r], this.payload);
      // Mirrors the players_log_handicap trigger in supabase/schema.sql.
      if (this.table === "players" && "handicap" in this.payload)
        for (const r of data) if (r.handicap !== this.payload.handicap) logHandicap(r, this.payload.handicap, "");
      // Mirrors the stamp_comp_result trigger: when a cup result went in (round 35).
      const stamp = this.table === "competition_matches" ? data.map((r) => ["score_a", "score_b", "status", "walkover"].some((k) => k in this.payload && this.payload[k] !== r[k])) : [];
      data.forEach((r) => { Object.assign(r, guardUpdate(this.table, r, this.payload)); shortAddress(this.table, r); });
      data.forEach((r, i) => { if (stamp[i] && (r.score_a != null || r.walkover || ["in_progress", "completed"].includes(r.status))) r.result_at = new Date().toISOString(); else if (stamp[i] && r.status === "scheduled" && r.score_a == null) r.result_at = null; });
    } else if (this.action === "upsert") {
      data = [].concat(this.payload).map((r) => {
        const hit = rows.find((x) => this.conflict.every((c) => x[c] === r[c]));
        if (hit) { audit("changed", this.table, [hit], r); return Object.assign(hit, r); }
        const row = { id: newId(), ...r }; rows.push(row); shortAddress(this.table, row); audit("added", this.table, [row]); return row;
      });
    } else if (this.action === "delete") {
      data = rows.filter((r) => this.matches(r));
      for (const r of data) audit("removed", this.table, [r]);
      state.tables[this.table] = rows.filter((r) => !this.matches(r));
      cascade(this.table, data);
    }
    // Mirrors the stamp_postponed trigger in supabase/schema.sql.
    if (this.table === "fixtures" && ["insert", "update", "upsert"].includes(this.action))
      for (const f of data) f.postponed_at = f.status === "postponed" ? (f.postponed_at ?? new Date().toISOString()) : null;
    if (this.table === "live_matches" && this.action !== "select" && this.action !== "delete") for (const m of data) m.updated_at = new Date().toISOString();
    if (this.table === "competition_matches" && this.action !== "select") settleFrom();
    if (this.action !== "select") { persist(); emit(this.table, data, { insert: "INSERT", delete: "DELETE" }[this.action] ?? "UPDATE"); }
    data = clone(data);
    if (this.one) {
      if (!data.length && this.one === "single") return { data: null, error: { message: "Row not found" } };
      return { data: data[0] ?? null, error: null };
    }
    return { data, error: null };
  }
}
for (const op of Object.keys(OPS)) Query.prototype[op] = function (col, val) { this.filters.push([op, col, val]); return this; };

const me = () => state.tables.profiles.find((p) => p.id === currentSession()?.user.id);

// Round 22: mirrors guard_market_ad() and guard_comment() in supabase/schema.sql.
const ROUND22_TABLES = new Set(["market_ads", "match_comments", "newsletter_campaigns", "newsletter_subscribers", "popups", "seo_pages", "site_versions", "login_attempts"]);
const officer = () => {
  const p = me();
  if (!p) return false;
  if (p.role === "admin") return true;
  const perm = (state.tables.role_permissions ?? []).find((r) => r.role === p.role);
  const areas = perm?.areas ?? (["league_admin", "committee_member", "president", "vice_chairman", "chairman"].includes(p.role) ? ["website"] : []);
  return areas.includes("website");
};
function guardInsert(table, row) {
  const who = me();
  if (table === "market_ads") {
    Object.assign(row, { owner_id: row.owner_id ?? who?.id ?? null, owner_name: row.owner_name ?? (who?.full_name || who?.email || null), updated_at: new Date().toISOString() });
    if (!officer()) Object.assign(row, { status: "pending", approved_at: null, approved_by: null, reject_reason: null });
    else if (row.status === "approved") Object.assign(row, { approved_at: new Date().toISOString(), approved_by: who?.full_name ?? "The league" });
    row.status ??= "pending";
  }
  if (table === "match_comments") {
    if (!who) throw new Error("Please log in to comment");
    if ((state.tables.settings?.[0]?.comments_on) === false) throw new Error("Comments are switched off");
    const off = (row.fixture_id && state.tables.fixtures.find((f) => f.id === row.fixture_id)?.chat_off) || (row.comp_match_id && state.tables.competition_matches.find((m) => m.id === row.comp_match_id)?.chat_off);
    if (off) throw new Error("The league has closed the chat for this match");
    const recent = (state.tables.match_comments ?? []).some((c) => c.author_id === who.id && Date.now() - Date.parse(c.created_at) < 10e3);
    if (recent) throw new Error("Please wait a few seconds before commenting again");
    Object.assign(row, { author_id: who.id, author_name: who.full_name || who.email.split("@")[0], hidden: false });
  }
  return row;
}
function guardUpdate(table, old, patch) {
  if (table === "market_ads") {
    const next = { ...old, ...patch, updated_at: new Date().toISOString() };
    if (officer()) { if (next.status === "approved" && old.status !== "approved") Object.assign(next, { approved_at: next.updated_at, approved_by: me()?.full_name ?? "The league" }); return next; }
    const same = ["title", "description", "image_url", "price", "contact", "category_id"].every((k) => (next[k] ?? null) === (old[k] ?? null));
    if (!(same && ["sold", "approved"].includes(next.status) && ["approved", "sold"].includes(old.status))) Object.assign(next, { status: "pending", reject_reason: null });
    return { ...next, owner_id: old.owner_id, owner_name: old.owner_name, approved_at: old.approved_at, approved_by: old.approved_by };
  }
  return patch;
}

// Mirrors the short-address triggers in supabase/schema.sql: a fixture's code (2627-14), a player's or
// sponsor's slug (sam-bolitho, made unique with -2, -3…), and the running numbers of cup and scoreboard matches.
const slugOf = (text) => String(text ?? "").toLowerCase().replace(/['’`]/g, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
function shortAddress(table, row) {
  const rows = state.tables[table] ?? [];
  if (table === "fixtures" && !row.code) {
    const name = state.tables.seasons.find((s) => s.id === row.season_id)?.name ?? "";
    const years = name.match(/\d{4}/g) ?? [];
    const prefix = years.length >= 2 ? years[0].slice(2) + years[1].slice(2) : years.length ? years[0].slice(2) : "s";
    const n = Math.max(0, ...rows.filter((f) => f.code?.startsWith(`${prefix}-`)).map((f) => Number(f.code.split("-").pop()) || 0)) + 1;
    row.code = `${prefix}-${String(n).padStart(2, "0")}`;
  }
  if (["players", "sponsors"].includes(table) && !row.slug) {
    const base = slugOf(row.full_name ?? row.name) || "item";
    let slug = base;
    for (let n = 2; rows.some((r) => r !== row && r.slug === slug); n++) slug = `${base}-${n}`;
    row.slug = slug;
  }
  if (["competition_matches", "live_matches", "market_ads", "hall_of_fame"].includes(table) && row.no == null) row.no = Math.max(0, ...rows.map((r) => Number(r.no) || 0)) + 1;
}

// Mirrors the activity-log triggers in supabase/schema.sql (audit_row / audit_added).
const AUDITED = new Set(["seasons", "leagues", "venues", "teams", "players", "fixtures", "competitions", "competition_entries", "articles", "pages", "sponsors", "categories", "announcements", "settings", "role_permissions", "key_dates", "awards", "meetings", "notices"]);
function auditLabel(table, r) {
  const team = (id) => state.tables.teams.find((t) => t.id === id)?.name ?? "?";
  if (table === "fixtures") return `${team(r.home_team_id)} v ${team(r.away_team_id)}${r.starts_at ? ` (${r.starts_at.slice(8, 10)}/${r.starts_at.slice(5, 7)}/${r.starts_at.slice(0, 4)})` : ""}`;
  if (table === "settings") return "Site settings";
  if (table === "role_permissions") return r.role;
  if (table === "meetings") return r.title || r.kind || "Meeting";
  return r.name || r.full_name || r.title || r.text || r.id;
}
function audit(action, table, rows, patch = null, force = false) {
  if ((!AUDITED.has(table) && !force) || !rows.length) return;
  const who = me();
  let changes = null, label = rows.slice(0, 3).map((r) => auditLabel(table, r)).join(", ") + (rows.length > 3 ? ` and ${rows.length - 3} more` : "");
  if (action === "added" && rows.length > 1) changes = { count: rows.length };
  if (action === "changed") {
    changes = {};
    const short = (v) => v == null || JSON.stringify(v).length <= 140;
    for (const [k, v] of Object.entries(patch ?? {})) {
      if (JSON.stringify(rows[0][k] ?? null) === JSON.stringify(v ?? null) || ["updated_at", "postponed_at", "code", "slug", "submitted_email_at", "reminder_sent_at", "result_at"].includes(k)) continue;
      changes[k] = short(v) && short(rows[0][k]) ? [rows[0][k] ?? null, v ?? null] : null;
    }
    if (!Object.keys(changes).length) return;
  }
  (state.tables.audit_log ??= []).push({ id: (state.tables.audit_log.length || 0) + 1, at: new Date().toISOString(), actor_id: who?.id ?? null, actor: who?.full_name || who?.email || "System",
    action, table_name: table, row_id: rows.length === 1 ? rows[0].id : null, label, changes });
}
// Mirrors comp_from_resolve / comp_from_winner in supabase/schema.sql (round 41): byes are empty, and a
// "Winner of …" place holds the winner of that match while the match it is in hasn't started.
function compWinner(m) {
  if (m.walkover === "a") return m.entry_a ?? null;
  if (m.walkover === "b") return m.entry_b ?? null;
  if (m.bye_b && m.entry_a && !m.entry_b) return m.entry_a;
  if (m.bye_a && m.entry_b && !m.entry_a) return m.entry_b;
  if (m.status !== "completed" || m.score_a == null || m.score_b == null) return null;
  if (m.score_a !== m.score_b) return m.score_a > m.score_b ? m.entry_a : m.entry_b;
  if ((m.points_a ?? 0) !== (m.points_b ?? 0)) return (m.points_a ?? 0) > (m.points_b ?? 0) ? m.entry_a : m.entry_b;
  return null;
}
function settleFrom() {
  const rows = state.tables.competition_matches ?? [];
  const byId = new Map(rows.map((m) => [m.id, m]));
  for (let pass = 0, moved = true; moved && pass < 12; pass++) {
    moved = false;
    for (const m of rows) for (const sd of ["a", "b"]) {
      if (m[`bye_${sd}`]) { if (m[`entry_${sd}`] != null || m[`from_${sd}`] != null) { m[`entry_${sd}`] = null; m[`from_${sd}`] = null; moved = true; } continue; }
      const from = m[`from_${sd}`];
      if (!from || m[`score_${sd}`] != null || m.walkover || !["scheduled", "postponed", undefined, null].includes(m.status)) continue;
      const src = byId.get(from), w = src ? compWinner(src) : null;
      if ((m[`entry_${sd}`] ?? null) !== w) { m[`entry_${sd}`] = w; moved = true; }
    }
  }
}
function logHandicap(player, value, note) {
  (state.tables.handicap_changes ??= []).push({ id: newId(), player_id: player.id, old_handicap: player.handicap, new_handicap: value,
    note: note || null, changed_by: me()?.full_name ?? null, created_at: new Date().toISOString() });
}

// Mirrors "on delete cascade" in supabase/schema.sql.
const CASCADES = {
  fixtures: [["frames", "fixture_id"], ["breaks", "fixture_id"], ["live_matches", "fixture_id"], ["lineups", "fixture_id"]],
  competitions: [["competition_entries", "competition_id"], ["competition_matches", "competition_id"], ["competition_signups", "competition_id"]],
  players: [["handicap_changes", "player_id"]],
  seasons: [["awards", "season_id"]],
  competition_matches: [["competition_frames", "match_id"], ["competition_breaks", "match_id"]],
};
function cascade(table, deleted) {
  const ids = new Set(deleted.map((d) => d.id));
  for (const [t, col] of CASCADES[table] ?? []) {
    const gone = (state.tables[t] ?? []).filter((r) => ids.has(r[col]));
    state.tables[t] = (state.tables[t] ?? []).filter((r) => !ids.has(r[col]));
    cascade(t, gone);
  }
}

// ── auth emulation ────────────────────────────────────────────
const authListeners = new Set();
const currentSession = () => { try { return JSON.parse(store.getItem(SESSION_KEY)); } catch { return null; } };
const setSession = (s) => {
  s ? store.setItem(SESSION_KEY, JSON.stringify(s)) : store.removeItem(SESSION_KEY);
  authListeners.forEach((cb) => cb(s ? "SIGNED_IN" : "SIGNED_OUT", s));
};

const auth = {
  async getSession() { return { data: { session: currentSession() }, error: null }; },
  async signInWithPassword({ email, password }) {
    const u = state.users.find((x) => x.email.toLowerCase() === String(email).toLowerCase() && x.password === password);
    if (!u) return { data: null, error: { message: "Invalid login credentials" } };
    const session = { access_token: "demo", user: { id: u.id, email: u.email } };
    setSession(session);
    return { data: { session }, error: null };
  },
  async signOut() { setSession(null); return { error: null }; },
  async updateUser({ password }) {
    const s = currentSession(); const u = s && state.users.find((x) => x.id === s.user.id);
    if (!u) return { error: { message: "Not signed in" } };
    u.password = password; persist(); return { data: {}, error: null };
  },
  onAuthStateChange(cb) { authListeners.add(cb); return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } }; },
  // Two-step login, pretended: the "phone app" code is always 123456 (the live site uses Supabase's real one).
  mfa: {
    async listFactors() {
      const u = state.users.find((x) => x.id === currentSession()?.user.id), list = u?.factors ?? [];
      return { data: { all: list, totp: list.filter((f) => f.status === "verified") }, error: null };
    },
    async enroll({ friendlyName }) {
      const u = state.users.find((x) => x.id === currentSession()?.user.id);
      if (!u) return { data: null, error: { message: "Not signed in" } };
      const f = { id: newId(), friendly_name: friendlyName, factor_type: "totp", status: "unverified" };
      (u.factors ??= []).push(f); persist();
      const qr = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="#fff"/><path d="M1 1h7v7H1zM13 1h7v7h-7zM1 13h7v7H1zM10 10h2v2h-2zM14 14h2v2h-2zM17 11h2v2h-2zM11 16h2v3h-2z" fill="#000"/><text x="10.5" y="11" font-size="2" text-anchor="middle">DEMO</text></svg>');
      return { data: { id: f.id, type: "totp", totp: { qr_code: qr, secret: "DEMO DEMO DEMO DEMO", uri: "" } }, error: null };
    },
    async unenroll({ factorId }) { const u = state.users.find((x) => x.id === currentSession()?.user.id); if (u) u.factors = (u.factors ?? []).filter((f) => f.id !== factorId); persist(); return { data: {}, error: null }; },
    async challengeAndVerify({ factorId, code }) {
      if (code !== "123456") return { data: null, error: { message: "Invalid TOTP code entered" } };
      const u = state.users.find((x) => x.id === currentSession()?.user.id), f = u?.factors?.find((x) => x.id === factorId);
      if (f) f.status = "verified";
      const s = currentSession(); setSession({ ...s, aal: "aal2" }); persist();
      return { data: {}, error: null };
    },
    async getAuthenticatorAssuranceLevel() { const s = currentSession(); return { data: { currentLevel: s?.aal ?? "aal1", nextLevel: "aal2" }, error: null }; },
  },
};

// Mirrors the Netlify function netlify/functions/admin-users.mjs
const teamFor = (body) => body.team_id || state.tables.players.find((p) => p.id === body.player_id)?.team_id || null;
export function demoAdminUsers(body) {
  const sec = state.tables.security_settings?.[0];
  if (body.action === "reset_mfa") {
    const u = state.users.find((x) => x.id === body.id); const n = (u?.factors ?? []).length;
    if (u) u.factors = []; persist(); return { ok: true, removed: n };
  }
  if (body.action === "create") {
    if (state.users.some((u) => u.email === body.email)) throw new Error("A user with this email already exists");
    const local = String(body.email ?? "").split("@")[0].toLowerCase();
    if (sec?.block_common_names !== false && String(sec?.common_names ?? "admin\nadministrator\nroot\ntest").split(/[\s,]+/).includes(local))
      throw new Error(`“${local}@…” is one of the common login names people guess first, so it can't be used. Use the person's own email address.`);
    const id = newId();
    state.users.push({ id, email: body.email, password: body.password });
    state.tables.profiles.push({ id, email: body.email, full_name: body.full_name, role: body.role, team_role: body.team_role || null, team_id: teamFor(body), player_id: body.player_id || null });
    audit("added", "profiles", [{ id, name: `${body.full_name || body.email} (${body.role})` }], null, true);
  } else if (body.action === "update") {
    const p = state.tables.profiles.find((x) => x.id === body.id);
    audit("changed", "profiles", [{ ...p, name: body.full_name || p.email }], { role: body.role, ...(body.password ? { password: "(new)" } : {}) }, true);
    Object.assign(p, { full_name: body.full_name, role: body.role, team_role: body.team_role || null, team_id: teamFor(body), player_id: body.player_id || null });
    if (body.password) state.users.find((u) => u.id === body.id).password = body.password;
  } else if (body.action === "delete") {
    audit("removed", "profiles", [{ ...state.tables.profiles.find((x) => x.id === body.id), name: state.tables.profiles.find((x) => x.id === body.id)?.full_name }], null, true);
    state.users = state.users.filter((u) => u.id !== body.id);
    state.tables.profiles = state.tables.profiles.filter((p) => p.id !== body.id);
  }
  persist(); emit("profiles", state.tables.profiles);
  return { ok: true };
}

export const demoClient = {
  from: (table) => new Query(table),
  auth,
  async rpc(name, args) {
    // The sample database is always the version the website expects (see SCHEMA_VERSION in db.js).
    if (name === "schema_version") return { data: SCHEMA_VERSION, error: null };
    // Round 57: sending anything to the league needs a login (as the database: see the end of schema.sql).
    if (["enter_competitions", "submit_memory", "submit_cueview", "support_staff", "set_chat_off"].includes(name) && !me()) return { data: null, error: { message: "Please log in first" } };
    if (name === "set_fixture_status") {
      const fx = state.tables.fixtures.find((f) => f.id === args.fid);
      if (args.new_status === "submitted" && !fx.scorecard_url) return { data: null, error: { message: "Upload a photo of the paper scorecard before submitting the result" } };
      audit("changed", "fixtures", [fx], { status: args.new_status });
      fx.status = args.new_status;
      fx.postponed_at = fx.status === "postponed" ? (fx.postponed_at ?? new Date().toISOString()) : null;
      // Mirrors set_fixture_status(): once the card is in, no frame of it is still "on the table".
      if (["submitted", "approved", "postponed"].includes(fx.status)) {
        const t = state.tables, mine = (m) => m.fixture_id === fx.id;
        t.live_matches = (t.live_matches ?? []).filter((m) => !(mine(m) && m.status === "setup"));
        const ended = t.live_matches.filter((m) => mine(m) && m.status === "live");
        for (const m of ended) Object.assign(m, { status: "finished", finished_at: new Date().toISOString() });
        if (ended.length) emit("live_matches", ended);
      }
      persist(); emit("fixtures", [fx]);
      return { data: null, error: null };
    }
    if (name === "set_comp_scorecard_photo") {
      const m = state.tables.competition_matches.find((x) => x.id === args.mid);
      if (m) { m.scorecard_url = args.url || null; persist(); emit("competition_matches", [m]); }
      return { data: null, error: null };
    }
    if (name === "set_scorecard_photo") {
      const fx = state.tables.fixtures.find((f) => f.id === args.fid);
      fx.scorecard_url = args.url; persist(); emit("fixtures", [fx]);
      return { data: null, error: null };
    }
    if (name === "update_my_player") {
      // Mirrors update_my_player() in supabase/schema.sql: only these fields, only your own profile.
      const me = state.tables.profiles.find((p) => p.id === currentSession()?.user.id);
      const row = state.tables.players.find((p) => p.id === me?.player_id);
      if (!row) return { data: null, error: { message: "Your login is not linked to a player profile yet" } };
      for (const k of ["avatar_url", "birth_date", "bio", "career_history", "past_teams", "gallery", "cueview"]) if (k in args.patch) row[k] = args.patch[k] === "" && k === "birth_date" ? null : args.patch[k];
      persist(); emit("players", [row]);
      return { data: null, error: null };
    }
    if (name === "set_handicap") {
      const row = state.tables.players.find((p) => p.id === args.pid);
      if (row.handicap !== args.value) { logHandicap(row, args.value, args.note); audit("changed", "players", [row], { handicap: args.value }); row.handicap = args.value; }
      persist(); emit("players", [row]);
      return { data: null, error: null };
    }
    if (name === "start_handicap_review") {
      const changed = state.tables.players.filter((p) => p.last_handicap !== p.handicap);
      changed.forEach((p) => { p.last_handicap = p.handicap; });
      persist();
      return { data: changed.length, error: null };
    }
    if (name === "set_match_photos") {
      const fx = state.tables.fixtures.find((f) => f.id === args.fid);
      fx.gallery = args.urls; persist(); emit("fixtures", [fx]);
      return { data: null, error: null };
    }
    // Entry forms — mirrors enter_competitions(), signup_names(), expire_signups() and decide_signup().
    if (name === "enter_competitions") {
      const t = state.tables, list = (t.competition_signups ??= []);
      const pl = t.players.find((p) => p.id === args.p_player), team = t.teams.find((x) => x.id === pl?.team_id);
      if (!pl) return { data: null, error: { message: "Please choose your name from the list" } };
      const days = t.settings[0]?.entry_pay_days || 7, made = [];
      for (const cid of args.p_competitions) {
        const c = t.competitions.find((x) => x.id === cid);
        if (!c?.entries_open) return { data: null, error: { message: `Entries for ${c?.name ?? "that competition"} are closed` } };
        const partner = c.kind === "Doubles" ? t.players.find((p) => p.id === args.p_partners?.[cid]) : null;
        if (c.kind === "Doubles" && (!partner || partner.id === pl.id)) return { data: null, error: { message: `Choose your partner for ${c.name}` } };
        const live = list.filter((s) => s.competition_id === cid && ["pending", "approved"].includes(s.status));
        const taken = c.kind === "Team" ? live.some((s) => s.team_id === team?.id) || t.competition_entries.some((e) => e.competition_id === cid && e.team_id === team?.id)
          : live.some((s) => [s.player_id, s.partner_id].some((id) => id && [pl.id, partner?.id].includes(id))) || t.competition_entries.some((e) => e.competition_id === cid && [e.player_id, e.partner_id].some((id) => id && [pl.id, partner?.id].includes(id)));
        if (taken) return { data: null, error: { message: `${c.kind === "Team" ? `${team?.name} are` : `${pl.full_name} is`} already entered in ${c.name}` } };
        const row = { id: newId(), competition_id: cid, player_id: pl.id, partner_id: partner?.id ?? null, team_id: c.kind === "Team" ? team?.id ?? null : null,
          name: c.kind === "Team" ? team?.name : partner ? `${pl.full_name} & ${partner.full_name}` : pl.full_name, contact: args.p_contact || null,
          status: "pending", pay_by: new Date(Date.now() + days * 864e5).toISOString(), created_at: new Date().toISOString(), decided_at: null, entry_id: null };
        list.push(row); made.push({ id: row.id, competition_id: cid, name: row.name, fee: c.entry_fee, pay_by: row.pay_by });
      }
      persist(); emit("competition_signups", made);
      return { data: made, error: null };
    }
    if (name === "expire_signups") {
      for (const s of state.tables.competition_signups ?? []) if (s.status === "pending" && s.pay_by < new Date().toISOString()) s.status = "expired";
      persist();
      return { data: null, error: null };
    }
    if (name === "signup_names") {
      const now = new Date().toISOString();
      return { data: (state.tables.competition_signups ?? []).filter((s) => s.competition_id === args.p_competition && ["pending", "approved"].includes(s.status))
        .map((s) => ({ name: s.name, status: s.status === "pending" && s.pay_by < now ? "expired" : s.status, pay_by: s.pay_by })), error: null };
    }
    if (name === "decide_signup") {
      const t = state.tables, su = t.competition_signups.find((s) => s.id === args.sid);
      if (args.approve) {
        if (!su.entry_id) {
          const seed = Math.max(0, ...t.competition_entries.filter((e) => e.competition_id === su.competition_id).map((e) => e.seed)) + 1;
          const entry = { id: newId(), competition_id: su.competition_id, name: su.name, team_id: su.team_id, player_id: su.team_id ? null : su.player_id, partner_id: su.team_id ? null : su.partner_id ?? null, seed };
          t.competition_entries.push(entry); su.entry_id = entry.id;
        }
        su.status = "approved";
      } else {
        t.competition_entries = t.competition_entries.filter((e) => e.id !== su.entry_id);
        Object.assign(su, { status: "rejected", entry_id: null });
      }
      su.decided_at = new Date().toISOString();
      persist(); emit("competition_entries", []);
      return { data: null, error: null };
    }
    if (name === "add_player") {
      // Players added by a captain are flagged for the admin to check.
      const who = state.tables.profiles.find((p) => p.id === currentSession()?.user.id);
      const staff = ["admin", "league_admin", "league_secretary"].includes(who?.role);
      const row = { id: newId(), full_name: args.p_name, team_id: args.p_team, position: "Player", handicap: 0, avatar_url: "", birth_date: null, cueview: {}, cueview_featured: false, bio: "", career_history: "", past_teams: "", gallery: [], needs_review: !staff,
        status: "playing", died_on: null, memorial: "", review_from: null };
      state.tables.players.push(row); shortAddress("players", row); persist(); emit("players", [row], "INSERT");
      return { data: row.id, error: null };
    }
    if (name === "claim_player") {
      // Mirrors claim_player(): only a player with no team, onto the caller's own team; flagged for the league to accept.
      const who = state.tables.profiles.find((p) => p.id === currentSession()?.user.id);
      const row = state.tables.players.find((p) => p.id === args.p_player);
      const captain = who && who.team_id === args.p_team && (["captain", "vice_captain"].includes(who.role) || ["captain", "vice_captain"].includes(who.team_role));
      if (!captain) return { data: null, error: { message: "You can only add players to your own team" } };
      if (!row || row.team_id || row.status === "deceased") return { data: null, error: { message: "That player already belongs to a team — ask the league secretary to move them" } };
      Object.assign(row, { team_id: args.p_team, status: "playing", needs_review: true, review_from: "no_team" });
      persist(); emit("players", [row]);
      return { data: null, error: null };
    }
    if (name === "set_lineup") {
      // Mirrors set_lineup(): your own team's sheet for a match that has not been submitted.
      const t = state.tables, who = t.profiles.find((p) => p.id === currentSession()?.user.id);
      const fx = t.fixtures.find((f) => f.id === args.fid);
      const captain = who && [fx?.home_team_id, fx?.away_team_id].includes(who.team_id) && (["captain", "vice_captain"].includes(who.role) || ["captain", "vice_captain"].includes(who.team_role));
      if (!fx || !captain) return { data: null, error: { message: "You can only pick the team for your own matches" } };
      if (!["scheduled", "in_progress"].includes(fx.status)) return { data: null, error: { message: "This match has already been played" } };
      const picks = (Array.isArray(args.p_picks) ? args.p_picks : []).slice(0, 10).map((x) => ({ player_id: x?.player_id || null, ext: !!x?.ext }));
      if (picks.some((x) => x.player_id && t.players.find((p) => p.id === x.player_id)?.team_id !== who.team_id)) return { data: null, error: { message: "You can only pick players from your own team" } };
      const list = (t.lineups ??= []), hit = list.find((l) => l.fixture_id === fx.id && l.team_id === who.team_id);
      if (!picks.some((x) => x.player_id)) t.lineups = list.filter((l) => l !== hit);
      else if (hit) Object.assign(hit, { picks, updated_by: who.full_name, updated_at: new Date().toISOString() });
      else list.push({ id: newId(), fixture_id: fx.id, team_id: who.team_id, picks, updated_by: who.full_name, updated_at: new Date().toISOString() });
      persist(); emit("lineups", []);
      return { data: null, error: null };
    }
    if (name === "sync_comp_match") {
      // Mirrors sync_comp_match() in supabase/schema.sql
      const frames = (state.tables.competition_frames ?? []).filter((f) => f.match_id === args.mid);
      const wa = frames.filter((f) => f.a_points > f.b_points).length, wb = frames.filter((f) => f.b_points > f.a_points).length;
      const pa = frames.reduce((n, f) => n + (f.a_points ?? 0), 0), pb = frames.reduce((n, f) => n + (f.b_points ?? 0), 0);
      const m = state.tables.competition_matches.find((x) => x.id === args.mid);
      const comp = state.tables.competitions.find((c) => c.id === m.competition_id);
      // Level on frames: a handicap competition is decided on total points; otherwise there must be a winner.
      if (args.finished && wa === wb && !(comp?.handicap && pa !== pb))
        return { data: null, error: { message: comp?.handicap ? "A knockout match needs a winner — the frames and the total points are both level" : "A knockout match needs a winner — the frames are level" } };
      Object.assign(m, { score_a: wa + wb ? wa : null, score_b: wa + wb ? wb : null, points_a: wa + wb ? pa : null, points_b: wa + wb ? pb : null,
        status: args.finished ? "completed" : wa + wb ? "in_progress" : m.status, ...(wa + wb ? { walkover: null } : {}) });
      const changed = [m];
      // advance_winner(): bracket draws move the winner into the next round.
      const w = args.finished && ((wa > wb || (wa === wb && pa > pb)) ? m.entry_a : m.entry_b);
      if (w && comp?.draw_mode !== "redraw") {
        const next = state.tables.competition_matches.find((x) => x.competition_id === m.competition_id && x.round === m.round + 1 && x.slot === Math.floor(m.slot / 2));
        if (next) { next[m.slot % 2 ? "entry_b" : "entry_a"] = w; changed.push(next); }
      }
      settleFrom(); persist(); emit("competition_matches", changed);
      return { data: null, error: null };
    }
    if (name === "set_walkover") {
      // Mirrors set_walkover() in supabase/schema.sql (round 37).
      const m = state.tables.competition_matches.find((x) => x.id === args.mid);
      if (!m) return { data: null, error: { message: "That match no longer exists" } };
      if (args.side && (!m.entry_a || !m.entry_b)) return { data: null, error: { message: "Both sides need to be known before a walkover can be given (an empty side is a bye)" } };
      if (!args.side && !m.walkover) return { data: null, error: null };
      const comp = state.tables.competitions.find((c) => c.id === m.competition_id);
      const side = (s) => (s === "a" ? m.entry_a : s === "b" ? m.entry_b : null);
      const next = comp?.draw_mode !== "redraw" && state.tables.competition_matches.find((x) => x.competition_id === m.competition_id && x.round === m.round + 1 && x.slot === Math.floor(m.slot / 2));
      const key = m.slot % 2 ? "entry_b" : "entry_a";
      const was = m.status === "completed" ? (m.walkover ? side(m.walkover) : m.score_a > m.score_b ? m.entry_a : m.score_b > m.score_a ? m.entry_b : (m.points_a ?? 0) > (m.points_b ?? 0) ? m.entry_a : m.entry_b) : null;
      if (next && was && was !== side(args.side)) {
        if (next.score_a != null || next.walkover || (next.status ?? "scheduled") !== "scheduled") return { data: null, error: { message: "The next round has already been played, so this result can't be changed any more" } };
        if (next[key] === was) next[key] = null;
      }
      if (!args.side) Object.assign(m, { walkover: null, status: "scheduled", result_at: null });
      else {
        state.tables.competition_frames = (state.tables.competition_frames ?? []).filter((f) => f.match_id !== m.id);
        state.tables.competition_breaks = (state.tables.competition_breaks ?? []).filter((f) => f.match_id !== m.id);
        Object.assign(m, { walkover: args.side, score_a: null, score_b: null, points_a: null, points_b: null, status: "completed", result_at: new Date().toISOString() });
        if (next) next[key] = side(args.side);
      }
      settleFrom(); persist(); emit("competition_matches", [m, ...(next ? [next] : [])]);
      return { data: null, error: null };
    }
    if (name === "set_my_prefs") {
      // Mirrors set_my_prefs(): only your own login's My Snooker choices, tidied up.
      const me = state.tables.profiles.find((p) => p.id === currentSession()?.user.id);
      if (!me) return { data: null, error: { message: "Please log in first" } };
      const p = args.p_prefs ?? {}, t = state.tables;
      const known = (list, rows, max) => [...new Set(Array.isArray(list) ? list : [])].filter((id) => rows.some((r) => r.id === id)).slice(0, max);
      const out = { place: ["page", "home", "both"].includes(p.place) ? p.place : "page", teams: known(p.teams, t.teams, 12), players: known(p.players, t.players, 40),
        cats: (Array.isArray(p.cats) ? p.cats : []).map((c) => String(c).slice(0, 80)).slice(0, 20) };
      if (Array.isArray(p.sections)) out.sections = p.sections.filter((x) => /^[a-z_]{1,24}$/.test(x)).slice(0, 30);
      Object.assign(me, { my_snooker: args.p_on ?? true, my_prefs: out, my_team_id: out.teams[0] ?? null });
      persist();
      return { data: null, error: null };
    }
    if (name === "set_my_snooker") {
      // Mirrors set_my_snooker(): only your own login's two My Snooker choices.
      const me = state.tables.profiles.find((p) => p.id === currentSession()?.user.id);
      if (!me) return { data: null, error: { message: "Please log in first" } };
      Object.assign(me, { my_team_id: args.p_team || null, my_snooker: args.p_on ?? true });
      persist();
      return { data: null, error: null };
    }
    if (name === "submit_cueview") {
      // Mirrors submit_cueview(): anyone can send one in; it waits for an officer.
      const t = state.tables, list = (t.cueview_submissions ??= []);
      const who = (t.players.find((p) => p.id === args.p_player)?.full_name ?? args.p_name ?? "").trim();
      if (!who) return { data: null, error: { message: "Please choose or type your name" } };
      if (!Object.values(args.p_answers ?? {}).some((v) => String(v ?? "").trim()) && !String(args.p_bio ?? "").trim())
        return { data: null, error: { message: "Please answer at least one question" } };
      const row = { id: newId(), player_id: args.p_player || null, name: who, team: (args.p_team ?? "").trim() || null, answers: args.p_answers ?? {},
        bio: (args.p_bio ?? "").trim() || null, contact: (args.p_contact ?? "").trim() || null, status: "pending", created_at: new Date().toISOString(), decided_at: null };
      list.push(row); persist(); emit("cueview_submissions", [row], "INSERT");
      return { data: row.id, error: null };
    }
    if (name === "scoreboard_to_draw") {
      // Mirrors scoreboard_to_draw() in supabase/schema.sql.
      const t = state.tables, l = (t.live_matches ?? []).find((x) => x.id === args.lid);
      const m = l?.comp_match_id && t.competition_matches.find((x) => x.id === l.comp_match_id);
      if (!m) return { data: "none", error: null };
      const comp = t.competitions.find((c) => c.id === m.competition_id);
      const next = () => t.competition_matches.find((x) => x.competition_id === m.competition_id && x.round === m.round + 1 && x.slot === Math.floor(m.slot / 2));
      const changed = [m];
      if (m.status === "completed" && l.status !== "finished" && comp?.draw_mode !== "redraw") {
        const w = m.score_a > m.score_b ? m.entry_a : m.score_b > m.score_a ? m.entry_b : null, n = next();
        if (n && w) {
          if (n.score_a != null || (n.status ?? "scheduled") !== "scheduled")
            return { data: null, error: { message: "The next round of the draw has already started, so this result cannot be taken back from the scoreboard. Change it under Draws & results." } };
          const key = m.slot % 2 ? "entry_b" : "entry_a";
          if (n[key] === w) { n[key] = null; changed.push(n); }
        }
      }
      const frames = Array.isArray(l.state?.frames) ? l.state.frames : [];
      t.competition_frames = (t.competition_frames ?? []).filter((f) => f.match_id !== m.id)
        .concat(frames.map((f) => ({ id: newId(), match_id: m.id, frame_no: f.no, a_player_id: l.player_a_id, a_player2_id: null, b_player_id: l.player_b_id, b_player2_id: null, a_points: f.a ?? 0, b_points: f.b ?? 0 })));
      t.competition_breaks = (t.competition_breaks ?? []).filter((b) => b.match_id !== m.id)
        .concat(frames.flatMap((f) => [["a", l.player_a_id], ["b", l.player_b_id]].filter(([s, pid]) => pid && (f[`high_${s}`] ?? 0) >= 30)
          .map(([s, pid]) => ({ id: newId(), match_id: m.id, frame_no: f.no, player_id: pid, value: f[`high_${s}`] }))));
      const played = (l.frames_a ?? 0) + (l.frames_b ?? 0) > 0;
      Object.assign(m, { score_a: played ? l.frames_a : null, score_b: played ? l.frames_b : null,
        points_a: played ? frames.reduce((n, f) => n + (f.a ?? 0), 0) : null, points_b: played ? frames.reduce((n, f) => n + (f.b ?? 0), 0) : null,
        status: l.status === "finished" ? "completed" : l.status === "live" ? "in_progress" : "scheduled" });
      if (l.status === "finished" && comp?.draw_mode !== "redraw") {
        const w = m.score_a > m.score_b ? m.entry_a : m.score_b > m.score_a ? m.entry_b : null, n = next();
        if (n && w) { n[m.slot % 2 ? "entry_b" : "entry_a"] = w; changed.push(n); }
      }
      settleFrom(); persist(); emit("competition_matches", changed);
      return { data: l.status === "finished" ? "finished" : "updated", error: null };
    }
    // ── Round 22 ──
    if (name === "newsletter_subscribe") {
      const e = String(args.p_email ?? "").trim().toLowerCase(), list = (state.tables.newsletter_subscribers ??= []);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { data: null, error: { message: "Please type a whole email address, like name@example.com" } };
      const hit = list.find((x) => x.email === e);
      if (hit) Object.assign(hit, { status: "subscribed", unsubscribed_at: null, name: args.p_name || hit.name });
      else list.push({ id: newId(), email: e, name: args.p_name || null, status: "subscribed", token: newId(), source: "website", created_at: new Date().toISOString(), unsubscribed_at: null });
      persist(); return { data: "ok", error: null };
    }
    if (name === "newsletter_unsubscribe") {
      const hit = (state.tables.newsletter_subscribers ?? []).find((x) => x.token === args.p_token);
      if (!hit) return { data: "unknown", error: null };
      Object.assign(hit, { status: "unsubscribed", unsubscribed_at: hit.unsubscribed_at ?? new Date().toISOString() }); persist();
      return { data: hit.email.replace(/^(.).*(@.*)$/, "$1…$2"), error: null };
    }
    if (name === "login_gate") {
      const s = state.tables.security_settings?.[0] ?? {}, slug = s.login_slug || "", path = String(args.p_path ?? "");
      return { data: { login: slug ? path.replace(/^\/+|\/+$/g, "").toLowerCase() === slug : path.replace(/\/+$/, "") === "/login", custom: !!slug,
        hide_button: !!slug && !!s.hide_login_button, access: s.login_access || "all", mfa_roles: s.mfa_roles ?? [] }, error: null };
    }
    if (name === "login_wait") {
      const s = state.tables.security_settings?.[0] ?? { max_attempts: 5, lockout_minutes: 15 }, e = String(args.p_email ?? "").trim().toLowerCase();
      if (!(s.max_attempts > 0)) return { data: 0, error: null };
      const mine = (state.tables.login_attempts ?? []).filter((a) => a.email === e), lastOk = Math.max(0, ...mine.filter((a) => a.ok).map((a) => Date.parse(a.at)));
      const fails = mine.filter((a) => !a.ok && Date.parse(a.at) > lastOk && Date.now() - Date.parse(a.at) < s.lockout_minutes * 60e3);
      const last = Math.max(0, ...fails.map((a) => Date.parse(a.at)));
      return { data: fails.length >= s.max_attempts ? Math.max(1, Math.ceil((last + s.lockout_minutes * 60e3 - Date.now()) / 1000)) : 0, error: null };
    }
    if (name === "set_chat_off") {
      const row = args.p_fixture ? state.tables.fixtures.find((f) => f.id === args.p_fixture) : state.tables.competition_matches.find((m) => m.id === args.p_comp_match);
      if (row) row.chat_off = !!args.p_off; persist(); return { data: null, error: null };
    }
    if (name === "submit_memory") {
      const p = args.p ?? {};
      if (String(p.title ?? "").trim().length < 3) return { data: null, error: { message: "Please give it a title" } };
      if (String(p.submitted_by ?? "").trim().length < 2) return { data: null, error: { message: "Please type your name" } };
      const row = { id: newId(), category: p.category || "Memory", title: p.title.trim(), subject: p.subject || null, year: p.year || null, achievements: p.achievements || null, body: p.body || null,
        images: Array.isArray(p.images) ? p.images.slice(0, 12) : [], quote: p.quote || null, quote_by: p.quote_by || null, status: "pending", featured: false, submitted_by: p.submitted_by.trim(), sort: 1, created_at: new Date().toISOString() };
      (state.tables.hall_of_fame ??= []).push(row); shortAddress("hall_of_fame", row);
      if (p.contact) (state.tables.hall_of_fame_contacts ??= []).push({ id: newId(), entry_id: row.id, contact: p.contact });
      persist(); return { data: row.id, error: null };
    }
    if (name === "submit_support") {
      // Mirrors submit_support() in supabase/schema.sql.
      const p = args.p ?? {}, t = state.tables, who = me();
      if (!who) return { data: null, error: { message: "Please log in to contact the league" } };
      const em = String(who.email || p.email || "").trim().toLowerCase();
      p.name = who.full_name || p.name;
      if (String(p.website ?? "").trim()) return { data: { no: 0 }, error: null };
      const cat = (t.support_categories ?? []).find((c) => c.id === p.category_id && c.is_active);
      const fail = (message) => ({ data: null, error: { message } });
      if (!cat) return fail("Please choose what your request is about");
      if (String(p.subject ?? "").trim().length < 3) return fail("Please say in a few words what it is about");
      if (String(p.message ?? "").trim().length < 5) return fail("Please tell us a little more");
      if (String(p.name ?? "").trim().length < 2) return fail("Please type your name");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return fail("Please type your email address, so the league can answer you");
      const tickets = (t.support_tickets ??= []), msgs = (t.support_messages ??= []), now = new Date().toISOString();
      if (tickets.filter((x) => Date.now() - Date.parse(x.created_at) < 3600e3 && (x.email === em || (who && x.user_id === who.id))).length >= 5)
        return fail("You have sent several requests in the last hour — please wait for the league to answer");
      const row = { id: newId(), no: Math.max(1000, ...tickets.map((x) => x.no)) + 1, token: newId(), category_id: cat.id, category: cat.name, subject: String(p.subject).trim().slice(0, 160),
        name: String(p.name).trim().slice(0, 120), email: em, user_id: who?.id ?? null, status: "new", assigned_to: null, last_from: "sender", page_url: p.page_url || null, created_at: now, updated_at: now };
      const msg = { id: newId(), ticket_id: row.id, author_id: who?.id ?? null, author_name: row.name, from_league: false, internal: false, body: String(p.message).trim().slice(0, 5000), image_url: p.image_url || null, created_at: now };
      tickets.push(row); msgs.push(msg);
      persist(); emit("support_tickets", [row], "INSERT"); emit("support_messages", [msg], "INSERT");
      return { data: { id: row.id, no: row.no, token: row.token, message_id: msg.id }, error: null };
    }
    if (name === "support_staff") {
      const cats = (state.tables.support_categories ?? []).filter((c) => c.is_active), roles = new Set(["admin", ...cats.flatMap((c) => c.roles)]);
      return { data: state.tables.profiles.filter((p) => roles.has(p.role)).map((p) => ({ id: p.id, full_name: p.full_name || p.email, role: p.role })), error: null };
    }
    if (name === "support_thread") {
      const who = me(), t = (state.tables.support_tickets ?? []).find((x) => x.token === args.p_token);
      const cat = (state.tables.support_categories ?? []).find((c) => c.id === t?.category_id);
      if (!t || !who || !(t.user_id === who.id || who.role === "admin" || (cat?.roles ?? []).includes(who.role))) return { data: null, error: null };
      const messages = (state.tables.support_messages ?? []).filter((m) => m.ticket_id === t.id && !m.internal).sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((m) => ({ ...m, author_name: m.from_league ? String(m.author_name || "The league").split(" ")[0] : m.author_name }));
      const { id, no, subject, category, status, name: sender, created_at, updated_at } = t;
      return { data: { ticket: { id, no, subject, category, status, name: sender, created_at, updated_at }, messages: clone(messages) }, error: null };
    }
    if (name === "support_reply") {
      // Mirrors support_reply(): an officer who looks after the category answers (or adds a private note); the sender answers back.
      const t = (state.tables.support_tickets ?? []).find((x) => (args.p_ticket && x.id === args.p_ticket) || (args.p_token && x.token === args.p_token));
      if (!t) return { data: null, error: { message: "Request not found" } };
      const body = String(args.p_body ?? "").trim();
      if (!body) return { data: null, error: { message: "Please type your message" } };
      const who = me(), cat = (state.tables.support_categories ?? []).find((c) => c.id === t.category_id);
      if (!who) return { data: null, error: { message: "Please log in to reply" } };
      const staff = !!who && (who.role === "admin" || (cat?.roles ?? []).includes(who.role));
      const now = new Date().toISOString(), internal = staff && !!args.p_internal;
      const msg = { id: newId(), ticket_id: t.id, author_id: who?.id ?? null, created_at: now, body: body.slice(0, 5000), image_url: args.p_image || null, internal };
      if (staff) {
        Object.assign(msg, { author_name: who.full_name || "The league", from_league: true });
        t.status = ["new", "in_progress", "waiting", "resolved"].includes(args.p_status) ? args.p_status : internal ? (t.status === "new" ? "in_progress" : t.status) : "waiting";
        if (!internal) t.last_from = "league";
        t.assigned_to ??= who.id;
      } else if (t.user_id === who.id) {
        Object.assign(msg, { author_name: t.name, from_league: false });
        t.status = t.status === "new" ? "new" : "in_progress"; t.last_from = "sender";
      } else return { data: null, error: { message: "This isn't your request" } };
      t.updated_at = now;
      (state.tables.support_messages ??= []).push(msg);
      persist(); emit("support_messages", [msg], "INSERT"); emit("support_tickets", [t], "UPDATE");
      return { data: msg.id, error: null };
    }
    if (name === "login_record") {
      (state.tables.login_attempts ??= []).push({ id: Date.now(), email: String(args.p_email ?? "").trim().toLowerCase(), ip: "this browser", ok: !!args.p_ok, at: new Date().toISOString() });
      persist(); return { data: null, error: null };
    }
    return { data: null, error: { message: `Unknown function ${name}` } };
  },
  channel() {
    const subs = [];
    const ch = {
      on(_type, { table }, cb) { subs.push({ table, cb }); return ch; },
      subscribe() { subs.forEach((s) => listeners.add(s)); return ch; },
      _subs: subs,
    };
    return ch;
  },
  removeChannel(ch) { ch._subs.forEach((s) => listeners.delete(s)); },
};
