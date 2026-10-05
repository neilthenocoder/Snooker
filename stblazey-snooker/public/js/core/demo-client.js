// ─────────────────────────────────────────────────────────────
//  DEMO DATABASE — a tiny stand-in for the Supabase client that
//  stores everything in this browser's localStorage. It implements
//  only the parts of the Supabase API that js/core/api.js uses, so
//  the rest of the site doesn't know (or care) which one it talks to.
//  NOT secure — for testing only.
// ─────────────────────────────────────────────────────────────
import { buildSeed } from "../demo/seed-data.js";

const KEY = "sbdsl-demo-db-v6";
const SESSION_KEY = "sbdsl-demo-session";
const store = typeof localStorage !== "undefined" ? localStorage : (() => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
})();

let state = load();
function load() {
  try { const s = JSON.parse(store.getItem(KEY)); if (s?.tables) return s; } catch {}
  const seed = buildSeed();
  const fresh = { tables: seed.tables, users: seed.demoUsers };
  store.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}
const persist = () => store.setItem(KEY, JSON.stringify(state));
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
      data = [].concat(this.payload).map((r) => ({ id: newId(), ...r }));
      rows.push(...data);
    } else if (this.action === "update") {
      data = rows.filter((r) => this.matches(r));
      // Mirrors the players_log_handicap trigger in supabase/schema.sql.
      if (this.table === "players" && "handicap" in this.payload)
        for (const r of data) if (r.handicap !== this.payload.handicap) logHandicap(r, this.payload.handicap, "");
      data.forEach((r) => Object.assign(r, this.payload));
    } else if (this.action === "upsert") {
      data = [].concat(this.payload).map((r) => {
        const hit = rows.find((x) => this.conflict.every((c) => x[c] === r[c]));
        if (hit) return Object.assign(hit, r);
        const row = { id: newId(), ...r }; rows.push(row); return row;
      });
    } else if (this.action === "delete") {
      data = rows.filter((r) => this.matches(r));
      state.tables[this.table] = rows.filter((r) => !this.matches(r));
      cascade(this.table, data);
    }
    // Mirrors the stamp_postponed trigger in supabase/schema.sql.
    if (this.table === "fixtures" && ["insert", "update", "upsert"].includes(this.action))
      for (const f of data) f.postponed_at = f.status === "postponed" ? (f.postponed_at ?? new Date().toISOString()) : null;
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
function logHandicap(player, value, note) {
  (state.tables.handicap_changes ??= []).push({ id: newId(), player_id: player.id, old_handicap: player.handicap, new_handicap: value,
    note: note || null, changed_by: me()?.full_name ?? null, created_at: new Date().toISOString() });
}

// Mirrors "on delete cascade" in supabase/schema.sql.
const CASCADES = {
  fixtures: [["frames", "fixture_id"], ["breaks", "fixture_id"]],
  competitions: [["competition_entries", "competition_id"], ["competition_matches", "competition_id"], ["competition_signups", "competition_id"]],
  players: [["handicap_changes", "player_id"]],
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
};

// Mirrors the Netlify function netlify/functions/admin-users.mjs
const teamFor = (body) => body.team_id || state.tables.players.find((p) => p.id === body.player_id)?.team_id || null;
export function demoAdminUsers(body) {
  if (body.action === "create") {
    if (state.users.some((u) => u.email === body.email)) throw new Error("A user with this email already exists");
    const id = newId();
    state.users.push({ id, email: body.email, password: body.password });
    state.tables.profiles.push({ id, email: body.email, full_name: body.full_name, role: body.role, team_role: body.team_role || null, team_id: teamFor(body), player_id: body.player_id || null });
  } else if (body.action === "update") {
    const p = state.tables.profiles.find((x) => x.id === body.id);
    Object.assign(p, { full_name: body.full_name, role: body.role, team_role: body.team_role || null, team_id: teamFor(body), player_id: body.player_id || null });
    if (body.password) state.users.find((u) => u.id === body.id).password = body.password;
  } else if (body.action === "delete") {
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
    if (name === "set_fixture_status") {
      const fx = state.tables.fixtures.find((f) => f.id === args.fid);
      if (args.new_status === "submitted" && !fx.scorecard_url) return { data: null, error: { message: "Upload a photo of the paper scorecard before submitting the result" } };
      fx.status = args.new_status;
      fx.postponed_at = fx.status === "postponed" ? (fx.postponed_at ?? new Date().toISOString()) : null;
      persist(); emit("fixtures", [fx]);
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
      if (row.handicap !== args.value) { logHandicap(row, args.value, args.note); row.handicap = args.value; }
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
          : live.some((s) => [s.player_id, s.partner_id].some((id) => id && [pl.id, partner?.id].includes(id))) || t.competition_entries.some((e) => e.competition_id === cid && [pl.id, partner?.id].includes(e.player_id));
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
          const entry = { id: newId(), competition_id: su.competition_id, name: su.name, team_id: su.team_id, player_id: su.team_id ? null : su.player_id, seed };
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
      const row = { id: newId(), full_name: args.p_name, team_id: args.p_team, position: "Player", handicap: 0, avatar_url: "", birth_date: null, cueview: {}, cueview_featured: false, bio: "", career_history: "", past_teams: "", gallery: [], needs_review: !staff };
      state.tables.players.push(row); persist(); emit("players", [row], "INSERT");
      return { data: row.id, error: null };
    }
    if (name === "sync_comp_match") {
      // Mirrors sync_comp_match() in supabase/schema.sql
      const frames = (state.tables.competition_frames ?? []).filter((f) => f.match_id === args.mid);
      const wa = frames.filter((f) => f.a_points > f.b_points).length, wb = frames.filter((f) => f.b_points > f.a_points).length;
      if (args.finished && wa === wb) return { data: null, error: { message: "A knockout match needs a winner — the frames are level" } };
      const m = state.tables.competition_matches.find((x) => x.id === args.mid);
      Object.assign(m, { score_a: wa + wb ? wa : null, score_b: wa + wb ? wb : null, status: args.finished ? "completed" : wa + wb ? "in_progress" : m.status });
      const changed = [m];
      // advance_winner(): bracket draws move the winner into the next round.
      const comp = state.tables.competitions.find((c) => c.id === m.competition_id);
      const w = args.finished && (wa > wb ? m.entry_a : m.entry_b);
      if (w && comp?.draw_mode !== "redraw") {
        const next = state.tables.competition_matches.find((x) => x.competition_id === m.competition_id && x.round === m.round + 1 && x.slot === Math.floor(m.slot / 2));
        if (next) { next[m.slot % 2 ? "entry_b" : "entry_a"] = w; changed.push(next); }
      }
      persist(); emit("competition_matches", changed);
      return { data: null, error: null };
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
