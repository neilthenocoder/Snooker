// ─────────────────────────────────────────────────────────────
//  Admin → Website → Link checker (Rich, round 22).
//  Looks through the news, info pages, announcements, notifications, pop-ups, sponsors,
//  merchandise, venues, meetings, key dates, the menu and the site settings for every link
//  and picture, and checks each one:
//    • a page of this website (/team/…, /news/…) — that the page exists (and, for news, is published);
//    • another website or a picture — Netlify asks it (netlify/functions/link-check.mjs).
//  Each problem says where the link is, with a button straight to the place to fix it.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast } from "../core/dom.js";
import { allRows, settings, checkLinks } from "../core/api.js";
import { panel, dataTable } from "../core/components.js";
import { ROUTES } from "../core/routes.js";
import { menuItems, menuMore } from "../core/menu.js";
import { DEMO_MODE } from "../config.js";

// [table, admin section, how to name a row]
const SOURCES = [
  ["articles", "articles", (r) => r.title], ["pages", "pages", (r) => r.title], ["announcements", "announcements", (r) => r.text], ["notices", "notices", (r) => r.title],
  ["popups", "popups", (r) => r.name], ["sponsors", "sponsors", (r) => r.name], ["merchandise", "merchandise", (r) => r.name], ["venues", "venues", (r) => r.name],
  ["meetings", "meetings", (r) => r.title || r.kind], ["key_dates", "key_dates", (r) => r.title || r.name], ["competitions", "competitions", (r) => r.name],
];
const TABLE_NAME = { articles: "News", pages: "Info page", announcements: "Announcement", notices: "Notification", popups: "Pop-up advert", sponsors: "Sponsor", merchandise: "Merchandise",
  venues: "Venue", meetings: "Meeting", key_dates: "Key date", competitions: "Competition", settings: "Site settings", menu: "Menu" };
const PICTURE = /image|logo|photo|avatar|icon|gallery|banner|trophy|shield|picture/i;
const SKIP = new Set(["id", "slug", "created_at", "updated_at", "published_at", "created_by", "owner_id"]);
const URLISH = /\[[^\]]*\]\(([^)\s]+)\)|(https?:\/\/[^\s"'<>)\]]+)/g;

/** Every link and picture in one value: markdown links, bare web addresses, and whole values that are a page of the site. */
function linksIn(value) {
  const out = [];
  const visit = (v) => {
    if (v == null) return;
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v === "object") return Object.values(v).forEach(visit);
    const s = String(v).trim();
    if (!s) return;
    if (/^\/(?!\/)[^\s]*$/.test(s) || /^https?:\/\/\S+$/.test(s)) { out.push(s); return; }
    for (const m of s.matchAll(URLISH)) out.push((m[1] ?? m[2]).replace(/[.,;:!?]+$/, ""));
    // "Label | /address" lines (footer links)
    for (const line of s.split("\n")) { const p = line.split("|")[1]?.trim(); if (p && /^(\/(?!\/)|https?:\/\/)/.test(p)) out.push(p); }
  };
  visit(value);
  return [...new Set(out)];
}

/** Is this a page of the website? (the address matches a page, and the team / news / player … it names exists) */
function internalCheck(path, data) {
  const clean = path.split(/[?#]/)[0].replace(/(.)\/+$/, "$1");
  if (/^\/(assets|css|js)\//.test(clean) || /\.(webmanifest|xml|txt)$/.test(clean)) return { ok: true };
  const parts = clean.split("/").filter(Boolean);
  for (const [pattern] of ROUTES) {
    const pp = pattern.split("/").filter(Boolean);
    if (pp.length !== parts.length || !pp.every((p, i) => p.startsWith(":") || p === parts[i])) continue;
    const key = decodeURIComponent(parts[pp.findIndex((p) => p.startsWith(":"))] ?? "");
    const has = (rows, ...cols) => rows.some((r) => cols.some((c) => String(r[c] ?? "") === key));
    switch (pp[0]) {
      case "news": if (pp[1]) { const a = data.articles.find((x) => x.slug === key); return a ? (a.is_published ? { ok: true } : { ok: false, note: "News article not published" }) : { ok: false, note: "No news article at this address" }; } break;
      case "page": return has(data.pages, "slug") ? { ok: true } : { ok: false, note: "No info page at this address" };
      case "team": return has(data.teams, "slug") ? { ok: true } : { ok: false, note: "No team at this address" };
      case "player": return has(data.players, "slug", "id") ? { ok: true } : { ok: false, note: "No player at this address" };
      case "venue": return has(data.venues, "slug") ? { ok: true } : { ok: false, note: "No venue at this address" };
      case "competition": return has(data.competitions, "slug") ? { ok: true } : { ok: false, note: "No competition at this address" };
      case "sponsor": return has(data.sponsors, "slug", "id") ? { ok: true } : { ok: false, note: "No sponsor at this address" };
      case "standings": case "shield": return has(data.leagues, "slug") ? { ok: true } : { ok: false, note: "No league at this address" };
      default: break;
    }
    return { ok: true };
  }
  return { ok: false, note: "No page of the website has this address" };
}

export async function linksPage(el) {
  mount(el, html`<div class="notice">Finds every link and picture in the news, info pages, announcements, notifications, pop-up adverts, sponsors, merchandise, venues, meetings, key dates,
    competitions, the menu and the site settings — and checks that each one still works. Links to pages of this website are checked against the website itself; links to other websites and pictures are checked by asking those websites.
    ${DEMO_MODE ? html`<b>Demo:</b> only links to pages of this website can be checked here.` : ""}</div>
    <div class="btn-row"><button type="button" class="btn green" data-lk-run>Check all links</button><label class="check" style="margin:0"><input type="checkbox" data-lk-problems checked> Show only the problems</label></div>
    <p class="muted" data-lk-progress></p><div data-lk-out></div>`);
  let results = [];
  const draw = () => {
    const onlyBad = $("[data-lk-problems]", el).checked;
    const bad = results.filter((r) => r.state !== "ok");
    const list = onlyBad ? bad : results;
    mount($("[data-lk-out]", el), results.length ? html`<div class="lk-sum"><span class="lk-pill ok">${results.filter((r) => r.state === "ok").length} working</span>
        <span class="lk-pill bad">${results.filter((r) => r.state === "bad").length} broken</span><span class="lk-pill warn">${results.filter((r) => r.state === "warn").length} to look at</span></div>
      ${panel(onlyBad ? "Problems" : "Every link", dataTable([
        { label: "", cell: (r) => html`<span class="lk-dot ${r.state}" title="${r.state}"></span>` },
        { label: "Link", cell: (r) => html`<div class="lk-cell"><a class="lk-url" href="${r.url}" target="_blank" rel="noopener">${r.url}</a>${r.kind === "picture" ? html` <small class="muted">picture</small>` : ""}<br><small class="${r.state === "ok" ? "muted" : "lk-why"}">${r.note}</small></div>` },
        { label: "Where", cell: (r) => html`<div class="lk-cell">${r.where.slice(0, 3).map((w) => html`<span class="lk-where">${TABLE_NAME[w.table] ?? w.table}: ${w.label}${w.edit ? html` <a class="btn small ghost" href="${w.edit}">Fix</a>` : ""}</span>`)}${r.where.length > 3 ? html`<small class="muted">and ${r.where.length - 3} more</small>` : ""}</div>` },
      ], list, { empty: "Nothing to fix — every link works." }))}` : "");
  };
  el.onchange = (e) => { if (e.target.matches("[data-lk-problems]")) draw(); };
  el.onclick = async (e) => {
    const btn = e.target.closest("[data-lk-run]");
    if (!btn) return;
    btn.disabled = true;
    const progress = (t) => mount($("[data-lk-progress]", el), t);
    try {
      progress("Collecting the links…");
      const names = [...new Set([...SOURCES.map(([t]) => t), "teams", "players", "leagues"])];
      const loaded = await Promise.all(names.map((t) => allRows(t).catch(() => [])));
      const data = Object.fromEntries(names.map((t, i) => [t, loaded[i]]));
      const site = await settings();
      const found = new Map();      // url → { kind, where: [] }
      const add = (url, where, field) => {
        const hit = found.get(url) ?? found.set(url, { url, kind: PICTURE.test(field) ? "picture" : "link", where: [] }).get(url);
        if (!hit.where.some((w) => w.table === where.table && w.label === where.label)) hit.where.push(where);
      };
      for (const [tbl, section, nameOf] of SOURCES) for (const row of data[tbl]) {
        for (const [field, value] of Object.entries(row)) {
          if (SKIP.has(field)) continue;
          for (const url of linksIn(value)) add(url, { table: tbl, label: nameOf(row) || "(no name)", edit: `/admin/${section}?edit=${row.id}` }, field);
        }
      }
      for (const [field, value] of Object.entries(site)) {
        if (SKIP.has(field) || ["menu_items", "menu_more"].includes(field)) continue;
        for (const url of linksIn(value)) add(url, { table: "settings", label: field.replace(/_/g, " "), edit: /^(logo|favicon|app_icon|font|color|loading)/.test(field) ? "/admin/branding" : "/admin/settings" }, field);
      }
      for (const item of [...menuItems(site, { all: true }), ...menuMore(site)]) add(item.href, { table: "menu", label: item.label, edit: "/admin/menu" }, "href");

      results = [];
      const outside = [];
      for (const f of found.values()) {
        if (f.url.startsWith("/")) { const r = internalCheck(f.url, data); results.push({ ...f, state: r.ok ? "ok" : "bad", note: r.ok ? "Page of this website — found" : r.note }); }
        else if (f.url.startsWith("data:")) results.push({ ...f, state: "ok", note: "Kept inside the website (demo)" });
        else outside.push(f);
      }
      for (let i = 0; i < outside.length; i += 25) {
        progress(`Checking other websites and pictures… ${Math.min(i + 25, outside.length)} of ${outside.length}`);
        const part = outside.slice(i, i + 25);
        const { results: answers = [] } = await checkLinks(part.map((x) => x.url));
        for (const f of part) {
          const a = answers.find((x) => x.url === f.url) ?? { status: 0, note: "No answer" };
          const state = a.status >= 200 && a.status < 400 ? (a.moved && !/^https?:\/\/[^/]*supabase/.test(f.url) ? "warn" : "ok") : a.status === 0 && /demo|Private/.test(a.note ?? "") ? "warn" : a.status === 401 || a.status === 403 || a.status === 429 ? "warn" : "bad";
          const note = a.status >= 200 && a.status < 400 ? (state === "warn" ? `Works, but now goes to ${a.moved}` : `Works (${a.status})`)
            : a.status === 404 || a.status === 410 ? `Page not found (${a.status})` : a.status === 401 || a.status === 403 ? `The website would not let the checker in (${a.status}) — open it to make sure` : a.status ? `The website answered ${a.status}` : a.note ?? "No answer";
          results.push({ ...f, state, note });
        }
      }
      const rank = { bad: 0, warn: 1, ok: 2 };
      results.sort((a, b) => rank[a.state] - rank[b.state] || a.url.localeCompare(b.url));
      progress(html`Checked <b>${results.length}</b> links and pictures.`);
      draw();
    } catch (err) { progress(""); toast(err.message, "error"); }
    btn.disabled = false;
  };
}
