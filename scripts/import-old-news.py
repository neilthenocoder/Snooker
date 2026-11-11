#!/usr/bin/env python3
"""
The old website's news (Rich, round 30: "I would like everything — but other than league/competition news, the CueViews
and older articles can sit in the system but not go live"). Reads the WordPress database (loaded into MySQL/MariaDB as
`wp`, as for scripts/extract-old-site.py) and writes:

  supabase/legacy/10-news.sql            every article, with its category, date, author, lead and quote
  real-data/legacy/news-pictures.csv     which picture each article had on the old site (Rich is sorting the pictures)

Goes live: league and competition news from 2019 on (Match Reports, Latest News, League Competitions, League Meetings,
Team Handicap, Team Pairs, GB Trophy, Shootout, Competition Reports).
Kept, not live (Admin → News, as drafts): Professional Snooker, CueViews, Snooker Memories, and every article from the
old site's archive — those all carry the date 1 January 2014 (their real dates were lost in an old import).
"""
import csv, html as H, os, re, collections
import pymysql
from bs4 import BeautifulSoup, NavigableString

ROOT = os.path.join(os.path.dirname(__file__), "..")
db = pymysql.connect(user="root", database="wp", charset="utf8mb4", unix_socket=os.environ.get("MYSQL_SOCKET", "/run/mysqld/mysqld.sock"))
cur = db.cursor()
def q(sql, *a): cur.execute(sql, a); return cur.fetchall()

# Old category → (category on the new site, counts as league/competition news?)
CATEGORY = {
    "Match Reports": ("Match Reports", True), "Match Reports - Archive": ("Match Reports", True),
    "Latest News": ("League News", True), "League Meetings": ("League Meetings", True),
    "League Competitions": ("Competitions", True), "Competition Reports": ("Competitions", True),
    "Team Handicap": ("Competitions", True), "Team Pairs": ("Competitions", True), "GB Trophy": ("Competitions", True), "Shootout": ("Competitions", True),
    "CueView": ("Cue View", False), "Professional Snooker": ("Professional Snooker", False), "Snooker Memories": ("Snooker Memories", False),
}
ORDER = list(CATEGORY)   # the first of an article's categories in this order is its main one
LOST_DATE = "2014-01-01"

def text_of(el):
    """An element's text, with spaces kept sensible."""
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()

BLOCK = {"p", "div", "section", "article", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "tr", "br", "hr", "figure", "header", "footer"}
SKIP = {"script", "style", "img", "figure", "iframe", "noscript", "svg", "video", "audio", "form", "button"}

def to_paragraphs(soup):
    """HTML → plain paragraphs: words inside a sentence (links, bold) stay together; blocks become paragraphs."""
    out, run = [], []
    def flush():
        t = re.sub(r"\s+", " ", " ".join(run)).strip()
        t = re.sub(r"\s+([,.;:!?])", r"\1", t)
        if t and t.lower() not in ("more", "read more"): out.append(t)
        run.clear()
    def walk(node):
        for ch in list(node.children):
            if isinstance(ch, NavigableString):
                if str(ch).strip() or run: run.append(str(ch))
                continue
            name = ch.name or ""
            if name in SKIP: continue
            if name not in BLOCK:
                if ch.find(list(BLOCK - {"br"})): walk(ch)          # an inline wrapper around blocks
                else: run.append(ch.get_text(" "))
                continue
            flush()
            if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
                t = text_of(ch)
                if t: out.append(t.upper() if len(t) < 60 else t)
            elif name in ("ul", "ol"):
                items = [text_of(li) for li in ch.find_all("li", recursive=False)]
                items = [x for x in items if x]
                if items: out.append("\n".join(f"{'•' if name == 'ul' else str(n) + '.'} {x}" for n, x in enumerate(items, 1)))
            elif name == "table":
                rows = [" – ".join(text_of(c) for c in tr.find_all(["td", "th"]) if text_of(c)) for tr in ch.find_all("tr")]
                rows = [r for r in rows if r]
                if rows: out.append("\n".join(rows))
            elif name in ("br", "hr"):
                pass
            else:
                walk(ch); flush()
    walk(soup); flush()
    res = []
    for p in out:
        if res and p == res[-1]: continue
        res.append(p)
    return res

def clean(raw):
    raw = raw or ""
    raw = re.sub(r"\[/?(one_third|two_third|one_half|one_fourth|three_fourth|column[^\]]*|row[^\]]*)\]", "\n", raw)   # layout shortcodes
    raw = re.sub(r"\[(gallery|event_blocks|caption|embed|video|audio|sp_[a-z_]+)[^\]]*\](.*?\[/\1\])?", "", raw, flags=re.S)
    raw = re.sub(r"\[/?[a-z_]+[^\]]*\]", "", raw)
    soup = BeautifulSoup(raw.replace("\\n", "\n"), "html.parser")
    lead = soup.select_one(".news-lead")
    lead_t = text_of(lead) if lead else ""
    if lead: lead.decompose()
    quote = soup.find("blockquote")
    quote_t = text_of(quote) if quote else ""
    if quote: quote.decompose()
    for tag in soup.select(".match-report"): tag.decompose()   # the little "Match Report" label
    imgs = [i.get("src") for i in soup.find_all("img") if i.get("src")]
    paras = to_paragraphs(soup)
    return lead_t, quote_t, paras, imgs

posts = q("""select p.ID, p.post_title, p.post_name, p.post_date, p.post_excerpt, p.post_content, coalesce(u.display_name, '') from devstb_posts p
             left join devstb_users u on u.ID = p.post_author where p.post_type='post' and p.post_status='publish' order by p.post_date, p.ID""")
cats = collections.defaultdict(list)
for pid, name in q("""select r.object_id, t.name from devstb_term_relationships r join devstb_term_taxonomy tt on tt.term_taxonomy_id=r.term_taxonomy_id
                      and tt.taxonomy='category' join devstb_terms t on t.term_id=tt.term_id"""):
    cats[pid].append(name)
thumb = {pid: url for pid, url in q("""select m.post_id, a.guid from devstb_postmeta m join devstb_posts a on a.ID = m.meta_value
                                        where m.meta_key='_thumbnail_id'""")}

def unescape(t): return H.unescape(t or "").replace(" ", " ").strip()
rows, pics, slugs = [], [], set()
for pid, title, name, when, excerpt, content, author in posts:
    mine = sorted([c for c in cats[pid] if c in CATEGORY], key=ORDER.index) or ["Latest News"]
    main, league_news = CATEGORY[mine[0]]
    more = sorted({CATEGORY[c][0] for c in mine[1:]} - {main})
    day = when.strftime("%Y-%m-%d")
    live = league_news and day != LOST_DATE and when.year >= 2019
    lead, quote, paras, imgs = clean(content)
    title = unescape(title)
    body = "\n\n".join(unescape(p) for p in paras)
    ex = unescape(excerpt) or unescape(lead) or (body.split("\n\n")[0] if body else "")
    if len(ex) > 220: ex = ex[:217].rsplit(" ", 1)[0] + "…"
    slug = re.sub(r"[^a-z0-9]+", "-", (H.unescape(name) or title).lower()).strip("-")[:80] or f"article-{pid}"
    base, n = slug, 2
    while slug in slugs: slug = f"{base}-{n}"; n += 1
    slugs.add(slug)
    rows.append((title, slug, main, more, ex, unescape(lead), unescape(quote), body, day, live, unescape(author)))
    for u in ([thumb[pid]] if pid in thumb else []) + imgs:
        pics.append({"Article": title, "Date": day, "Live": "yes" if live else "no", "New address": f"/news/{slug}", "Old picture": u})

def sq(v):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, list): return "'" + str(v).replace("'", '"').replace("\\\\", "") .replace("'", "''") + "'::jsonb" if v else "'[]'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"
import json
def jl(v): return "'" + json.dumps(v).replace("'", "''") + "'::jsonb"
def vals(rs):
    return ",\n".join("  (" + ", ".join([sq(t), sq(s_), sq(c), jl(m), sq(e or None), sq(l or None), sq(qq or None), sq(b or None), sq(d), sq(live), sq(a or None)]) + ")"
                       for t, s_, c, m, e, l, qq, b, d, live, a in rs)
live_n = sum(1 for r in rows if r[9])
cat_names = sorted({r[2] for r in rows} | {m for r in rows for m in r[3]})
# Small files (about 250 KB each) so each pastes easily into Supabase's SQL editor: the live ones first, then the drafts.
chunks, cur_, size = [], [], 0
for r in sorted(rows, key=lambda r: (not r[9], r[8], r[0])):
    n = len(r[7] or "") + 400
    if cur_ and (size + n > 250_000 or cur_[-1][9] != r[9]): chunks.append(cur_); cur_, size = [], 0
    cur_.append(r); size += n
if cur_: chunks.append(cur_)
folder = os.path.join(ROOT, "supabase", "legacy")
for f in os.listdir(folder):
    if re.match(r"1\d-news", f): os.remove(os.path.join(folder, f))
for k, ch in enumerate(chunks, 1):
    live_part = ch[0][9]
    sql = f"""-- ─────────────────────────────────────────────────────────────
--  THE OLD WEBSITE'S NEWS — part {k} of {len(chunks)}: {len(ch)} {'articles that go live' if live_part else 'articles kept as drafts (not live)'}
--  Generated by scripts/import-old-news.py from Rich's export of the old WordPress database.
--  Run the news files in order, after the other files in supabase/legacy/ (SQL Editor → paste → Run), each once.
--
--  All {len(rows)} old articles: {live_n} league and competition articles from 2019 on go live, with their real dates.
--  The other {len(rows) - live_n} wait in Admin → News as drafts (Rich, round 30): Professional Snooker, CueViews,
--  Snooker Memories, and the old archive — whose articles all carry the date 1 January 2014 on the old site
--  (their real dates were lost long ago). Tick "Published" on any of them to put it on the website.
--  The text keeps its paragraphs, the opening paragraph and the pull quote. Pictures are not brought across
--  (Rich is sorting them): real-data/legacy/news-pictures.csv says which article had which picture.
--  None is "featured", so the News page and the banner keep showing the newest articles.
--  Nothing already on the website is changed. All one transaction.
-- ─────────────────────────────────────────────────────────────
begin;

do $$ begin
  if exists (select 1 from articles where slug in ({", ".join(sq(r[1]) for r in ch[:5])})) then
    raise exception 'This part of the old news is already in: nothing to do.';
  end if;
end $$;

insert into categories (name, sort)
  select r.name, 100 + row_number() over (order by r.name) from (values
{",\n".join(f"  ({sq(c)})" for c in cat_names)}) r(name)
  where not exists (select 1 from categories c where lower(c.name) = lower(r.name));

create temp table _news (title text, slug text, category text, more_categories jsonb, excerpt text, lead text, quote_text text, body text, published_at date, is_published boolean, author text) on commit drop;
insert into _news values
{vals(ch)};
insert into articles (title, slug, category, more_categories, excerpt, lead, quote_text, body, published_at, is_published, author, featured, hub_featured, awaiting_approval)
  select r.title, case when exists (select 1 from articles a where a.slug = r.slug) then r.slug || '-old' else r.slug end,
    r.category, r.more_categories, r.excerpt, r.lead, r.quote_text, r.body, r.published_at, r.is_published, r.author, false, false, false
  from _news r;

do $$ begin
  raise notice 'Done: part {k} of {len(chunks)} — % articles added ({'live' if live_part else 'drafts'}).', (select count(*) from _news);
end $$;
commit;
"""
    open(os.path.join(folder, f"{9 + k:02d}-news-{k}{'-live' if live_part else '-drafts'}.sql"), "w").write(sql)
with open(os.path.join(ROOT, "real-data", "legacy", "news-pictures.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["Article", "Date", "Live", "New address", "Old picture"]); w.writeheader(); w.writerows(pics)
print(f"{len(rows)} articles, {live_n} live; {len(pics)} pictures listed; categories: {cat_names}")
by = collections.Counter((r[2], r[9]) for r in rows); print(sorted(by.items()))
