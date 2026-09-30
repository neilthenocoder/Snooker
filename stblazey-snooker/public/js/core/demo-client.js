// ─────────────────────────────────────────────────────────────
//  DEMO DATABASE — a tiny stand-in for the Supabase client that
//  stores everything in this browser's localStorage. It implements
//  only the parts of the Supabase API that js/core/api.js uses, so
//  the rest of the site doesn't know (or care) which one it talks to.
//  NOT secure — for testing only.
// ─────────────────────────────────────────────────────────────
import { buildSeed } from "../demo/seed-data.js";

const KEY = "sbdsl-demo-db-v2";
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
function emit(table) { for (const l of listeners) if (l.table === table || l.table === "*" || table === "*") l.cb({ table }); }
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { state = load(); emit("*"); } });
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
    if (this.action !== "select") { persist(); emit(this.table); }
    data = clone(data);
    if (this.one) {
      if (!data.length && this.one === "single") return { data: null, error: { message: "Row not found" } };
      return { data: data[0] ?? null, error: null };
    }
    return { data, error: null };
  }
}
for (const op of Object.keys(OPS)) Query.prototype[op] = function (col, val) { this.filters.push([op, col, val]); return this; };

// Mirrors "on delete cascade" in supabase/schema.sql.
const CASCADES = {
  fixtures: [["frames", "fixture_id"], ["breaks", "fixture_id"]],
  competitions: [["competition_entries", "competition_id"], ["competition_matches", "competition_id"]],
};
function cascade(table, deleted) {
  const ids = new Set(deleted.map((d) => d.id));
  for (const [t, col] of CASCADES[table] ?? []) state.tables[t] = (state.tables[t] ?? []).filter((r) => !ids.has(r[col]));
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
export function demoAdminUsers(body) {
  if (body.action === "create") {
    if (state.users.some((u) => u.email === body.email)) throw new Error("A user with this email already exists");
    const id = newId();
    state.users.push({ id, email: body.email, password: body.password });
    state.tables.profiles.push({ id, email: body.email, full_name: body.full_name, role: body.role, team_id: body.team_id || null });
  } else if (body.action === "update") {
    const p = state.tables.profiles.find((x) => x.id === body.id);
    Object.assign(p, { full_name: body.full_name, role: body.role, team_id: body.team_id || null });
    if (body.password) state.users.find((u) => u.id === body.id).password = body.password;
  } else if (body.action === "delete") {
    state.users = state.users.filter((u) => u.id !== body.id);
    state.tables.profiles = state.tables.profiles.filter((p) => p.id !== body.id);
  }
  persist(); emit("profiles");
  return { ok: true };
}

export const demoClient = {
  from: (table) => new Query(table),
  auth,
  async rpc(name, args) {
    if (name === "set_fixture_status") {
      const fx = state.tables.fixtures.find((f) => f.id === args.fid);
      fx.status = args.new_status; persist(); emit("fixtures");
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
