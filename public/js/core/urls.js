// The address of each kind of page. A file of its own with no imports (round 116), so that pieces which must not
// depend on the database — the demo's sample data, for one — can use it without pulling the whole site in.
export const urls = {
  team: (t) => `/team/${t.slug}`,
  venue: (v) => `/venue/${v.slug}`,
  match: (fx) => `/match/${fx.code || fx.id}`,
  scorecard: (fx) => `/scorecard/${fx.code || fx.id}`,
  cupMatch: (m) => `/cup-match/${m.no ?? m.id}`,
  cupScorecard: (m) => `/cup-scorecard/${m.no ?? m.id}`,
  scoreboard: (m) => `/scoreboard/${m.no ?? m.id}`,
  sponsor: (s) => `/sponsor/${s.slug || s.id}`,
  article: (a) => `/news/${a.slug}`,
  standings: (l) => `/standings/${l.slug}`,
  // A season's own pages: /seasons/2026-2027, /seasons/2026-2027/rankings/victory-league …
  season: (s, section = "", league = null) => `/seasons/${encodeURIComponent(s?.name ?? "")}${section ? `/${section}` : ""}${league ? `/${league.slug}` : ""}`,
  page: (p) => `/page/${p.slug}`,
  player: (p) => `/player/${p.slug || p.id}`,
  competition: (c) => `/competition/${c.slug}`,
  shield: (l) => `/shield/${l.slug}`,
};
