// ─────────────────────────────────────────────────────────────
//  /robots.txt and /sitemap.xml (Rich, round 22 — Admin → Website → SEO).
//  robots.txt tells search engines where the sitemap is, and keeps them out of the
//  dashboard and the members' pages. sitemap.xml lists every public page of the site —
//  the standard pages, news, teams, players, venues, competitions, info pages and
//  marketplace adverts — except those ticked "keep out of search engines".
//  It reads the same public data the website shows (the anon key, as social.js does).
// ─────────────────────────────────────────────────────────────
const WAIT_MS = 2500;
const TTL_MS = 10 * 60_000;           // the sitemap is made again at most every ten minutes
const STATIC = ["/", "/news", "/fixtures", "/results", "/league", "/competitions", "/live", "/calendar", "/players", "/seasons", "/archive", "/handicaps",
  "/venues", "/rules", "/meetings", "/presentation", "/in-memoriam", "/merchandise", "/marketplace", "/enter", "/cueview", "/newsletter", "/hall-of-fame", "/sponsorship"];
const env = (k) => { try { return globalThis.Netlify?.env?.get?.(k) ?? Deno.env.get(k) ?? ""; } catch { return ""; } };
const xml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
let cache = null, cacheAt = 0, conf = null;

async function connection(request) {
  if (conf) return conf;
  let url = env("SUPABASE_URL"), key = env("SUPABASE_ANON_KEY");
  if (!url || !key) {
    try {
      const text = await (await fetch(new URL("/js/config.js", request.url), { signal: AbortSignal.timeout(WAIT_MS) })).text();
      url ||= text.match(/SUPABASE_URL\s*=\s*"([^"]*)"/)?.[1] ?? "";
      key ||= text.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]*)"/)?.[1] ?? "";
    } catch { /* no database: the standard pages only */ }
  }
  conf = { url: url.replace(/\/+$/, ""), key };
  return conf;
}
async function rows(c, query) {
  if (!c.url || !c.key) return [];
  const res = await fetch(`${c.url}/rest/v1/${query}`, { headers: { apikey: c.key, Authorization: `Bearer ${c.key}` }, signal: AbortSignal.timeout(WAIT_MS) }).catch(() => null);
  const data = res?.ok ? await res.json().catch(() => []) : [];
  return Array.isArray(data) ? data : [];
}

async function sitemap(request, origin) {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  const c = await connection(request);
  const [seo, news, teams, players, venues, comps, pages, ads] = await Promise.all([
    rows(c, "seo_pages?select=path,noindex"),
    rows(c, "articles?select=slug,published_at&is_published=eq.true"),
    rows(c, "teams?select=slug"), rows(c, "players?select=slug,id"), rows(c, "venues?select=slug"),
    rows(c, "competitions?select=slug"), rows(c, "pages?select=slug"),
    rows(c, "market_ads?select=no,updated_at&status=eq.approved"),
  ]);
  const hidden = new Set(seo.filter((r) => r.noindex).map((r) => (String(r.path).replace(/\/+$/, "") || "/").toLowerCase()));
  const list = [
    ...STATIC.map((p) => ({ loc: p, pri: p === "/" ? "1.0" : "0.8" })),
    ...news.filter((a) => a.slug).map((a) => ({ loc: `/news/${a.slug}`, mod: a.published_at, pri: "0.7" })),
    ...teams.filter((t) => t.slug).map((t) => ({ loc: `/team/${t.slug}`, pri: "0.6" })),
    ...players.map((p) => ({ loc: `/player/${p.slug || p.id}`, pri: "0.5" })),
    ...venues.filter((v) => v.slug).map((v) => ({ loc: `/venue/${v.slug}`, pri: "0.4" })),
    ...comps.filter((x) => x.slug).map((x) => ({ loc: `/competition/${x.slug}`, pri: "0.6" })),
    ...pages.filter((p) => p.slug).map((p) => ({ loc: `/page/${p.slug}`, pri: "0.5" })),
    ...ads.filter((a) => a.no != null).map((a) => ({ loc: `/marketplace/${a.no}`, mod: a.updated_at, pri: "0.3" })),
  ].filter((x) => !hidden.has(x.loc.toLowerCase()));
  cache = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${list.map((x) => `  <url><loc>${xml(origin + encodeURI(x.loc))}</loc>${x.mod ? `<lastmod>${xml(String(x.mod).slice(0, 10))}</lastmod>` : ""}<priority>${x.pri}</priority></url>`).join("\n")}
</urlset>`;
  cacheAt = Date.now();
  return cache;
}

export default async (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/robots.txt") {
    return new Response(`User-agent: *\nDisallow: /admin\nDisallow: /my\nDisallow: /scorecard/\nDisallow: /cup-scorecard/\nDisallow: /login\nDisallow: /unsubscribe\n\nSitemap: ${url.origin}/sitemap.xml\n`,
      { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
  }
  try {
    return new Response(await sitemap(request, url.origin), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=600" } });
  } catch {
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${xml(url.origin)}/</loc></url></urlset>`, { headers: { "content-type": "application/xml; charset=utf-8" } });
  }
};

export const config = { path: ["/robots.txt", "/sitemap.xml"], onError: "bypass" };
