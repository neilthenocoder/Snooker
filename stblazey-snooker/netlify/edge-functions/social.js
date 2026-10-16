// ─────────────────────────────────────────────────────────────
//  SOCIAL PREVIEWS AND APP ICONS — runs on Netlify in front of every page.
//
//  When a link to the website is shared (Facebook, WhatsApp, X, iMessage, Slack…), the service
//  reads the page's <head> without running any JavaScript. This puts the right title, text and
//  picture there before the page goes out:
//    • a news article (/news/<slug>): its own Social preview (Admin → News → the article), or
//      its headline, intro and picture;
//    • a page with its own settings under Admin → Website → SEO (Rich, round 22): its title,
//      description and picture, and "noindex" when it is kept out of search engines;
//    • every other page: Admin → Website → SEO → Site settings (the same as Site settings → Sharing).
//  The page's language (<html lang="…">) comes from there too.
//  It also fills in the icons a phone uses for "Add to Home Screen" and an installed app
//  (Admin → Branding → App icon), and the favicon — in the page and in /manifest.webmanifest.
//
//  Where the database is: SUPABASE_URL / SUPABASE_ANON_KEY in Netlify's environment variables if
//  they are set, otherwise read from public/js/config.js (the same public values the browser uses).
//  What it reads is public anyway: the site settings and published articles.
//  If anything goes wrong — the database is slow or unreachable, a column is missing — the page
//  goes out exactly as it is in index.html. It never stops a page from loading.
// ─────────────────────────────────────────────────────────────
const TTL_MS = 60_000;        // the site settings are asked for at most once a minute
const WAIT_MS = 1500;         // never hold a page up longer than this
const DEFAULT_TEXT = "Fixtures, results, league tables, breaks and rankings for the St Blazey and District Snooker League, established 1941.";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const env = (k) => { try { return globalThis.Netlify?.env?.get?.(k) ?? Deno.env.get(k) ?? ""; } catch { return ""; } };
const web = (u) => (/^https?:\/\//i.test(String(u ?? "").trim()) ? String(u).trim() : "");
const short = (text, n = 200) => { const t = String(text ?? "").replace(/\[[a-z]+\]/gi, " ").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t; };

let conf = null, confAt = 0, site = null, siteAt = 0, seo = null, seoAt = 0;

async function connection(request) {
  if (conf && Date.now() - confAt < TTL_MS * 10) return conf;
  let url = env("SUPABASE_URL"), key = env("SUPABASE_ANON_KEY"), name = "";
  try {
    const text = await (await fetch(new URL("/js/config.js", request.url), { signal: AbortSignal.timeout(WAIT_MS) })).text();
    url ||= text.match(/SUPABASE_URL\s*=\s*"([^"]*)"/)?.[1] ?? "";
    key ||= text.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]*)"/)?.[1] ?? "";
    name = text.match(/name:\s*"([^"]+)"/)?.[1] ?? "";
  } catch { /* use what the environment gave */ }
  conf = { url: url.replace(/\/+$/, ""), key, name: name || "St Blazey and District Snooker League" };
  confAt = Date.now();
  return conf;
}

async function rows(c, query) {
  if (!c.url || !c.key) return [];
  const res = await fetch(`${c.url}/rest/v1/${query}`, { headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, Accept: "application/json" }, signal: AbortSignal.timeout(WAIT_MS) });
  return res.ok ? res.json() : [];
}

async function settings(c) {
  if (site && Date.now() - siteAt < TTL_MS) return site;
  site = (await rows(c, "settings?select=*&limit=1").catch(() => []))[0] ?? {};
  siteAt = Date.now();
  return site;
}

/** Every page's own SEO settings (Admin → Website → SEO), asked for at most once a minute. */
async function seoRows(c) {
  if (seo && Date.now() - seoAt < TTL_MS) return seo;
  seo = await rows(c, "seo_pages?select=*").catch(() => []);
  if (!Array.isArray(seo)) seo = [];
  seoAt = Date.now();
  return seo;
}
const norm = (path) => (String(path || "/").replace(/\/+$/, "") || "/").toLowerCase();

/** The lines between <!--social--> and <!--/social--> in index.html, filled in for this page. */
function head({ title, text, image, url, type, favicon, apple, noindex }) {
  return [
    noindex ? `<meta name="robots" content="noindex, nofollow">` : "",
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(text)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${esc(conf.name)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(text)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(text)}">`,
    image ? `<meta name="twitter:image" content="${esc(image)}">` : "",
    favicon ? `<link rel="icon" href="${esc(favicon)}">` : "",
    apple ? `<link rel="apple-touch-icon" href="${esc(apple)}">` : "",
  ].filter(Boolean).join("\n  ");
}

export default async (request, context) => {
  const url = new URL(request.url);
  if (request.method !== "GET") return context.next();
  const response = await context.next();

  // The app's name, colours and icons for "Add to Home Screen" / install.
  if (url.pathname === "/manifest.webmanifest") {
    try {
      const c = await connection(request), s = await settings(c), icons = s.app_icons ?? {};
      if (!web(icons.i192) || !web(icons.i512)) return response;
      const manifest = await response.json();
      manifest.icons = [
        { src: icons.i192, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: icons.i512, sizes: "512x512", type: "image/png", purpose: "any" },
        ...(web(icons.maskable) ? [{ src: icons.maskable, sizes: "512x512", type: "image/png", purpose: "maskable" }] : []),
      ];
      return new Response(JSON.stringify(manifest, null, 2), { status: 200, headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=300" } });
    } catch { return response; }
  }

  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  let page = null;
  const asItWas = () => new Response(page, { status: response.status, headers: response.headers });
  try {
    page = await response.text();
    if (!page.includes("<!--social-->")) return asItWas();
    const c = await connection(request);
    const s = await settings(c);
    const slug = url.pathname.match(/^\/news\/([^/]+)\/?$/)?.[1];
    const article = slug ? (await rows(c, `articles?select=*&slug=eq.${encodeURIComponent(decodeURIComponent(slug))}&is_published=eq.true&limit=1`).catch(() => []))[0] : null;
    const own = (await seoRows(c)).find((r) => norm(r.path) === norm(url.pathname));
    const siteTitle = String(s.social_title ?? "").trim() || conf.name;
    const siteText = String(s.social_description ?? "").trim() || DEFAULT_TEXT;
    const siteImage = web(s.social_image_url);
    const icons = s.app_icons ?? {};
    const meta = article ? {
      title: `${article.title} | ${siteTitle}`,
      text: short(article.social_description || article.excerpt || article.lead || article.body) || siteText,
      image: web(article.social_image_url) || web(article.image_url) || web(article.circle_image_url) || siteImage,
      type: "article",
    } : { title: siteTitle, text: siteText, image: siteImage, type: "website" };
    if (own) Object.assign(meta, { title: String(own.title ?? "").trim() || meta.title, text: String(own.description ?? "").trim() || meta.text, image: web(own.image_url) || meta.image, noindex: !!own.noindex });
    const filled = head({ ...meta, url: `${url.origin}${url.pathname}`,
      favicon: web(s.favicon_url) || web(icons.i192), apple: web(icons.apple) });     // only what was uploaded: no stand-in logo
    const lang = /^[a-z]{2,3}(-[A-Za-z]{2})?$/.test(String(s.site_language ?? "")) ? s.site_language : "en-GB";
    const out = page.replace(/<!--social-->[\s\S]*?<!--\/social-->/, `<!--social-->\n  ${filled}\n  <!--/social-->`).replace(/<html lang="[^"]*">/, `<html lang="${lang}">`);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(out, { status: response.status, headers });
  } catch {
    return page === null ? response : asItWas();
  }
};

export const config = {
  path: "/*",
  excludedPath: ["/js/*", "/css/*", "/assets/*", "/.netlify/*", "/robots.txt", "/sitemap.xml", "/_headers", "/_redirects"],
  onError: "bypass",
};
