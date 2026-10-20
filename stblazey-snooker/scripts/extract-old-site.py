#!/usr/bin/env python3
"""
Reads the old WordPress / SportsPress database (Rich's phpMyAdmin export, loaded into a local MySQL/MariaDB
database called `wp`) and writes, for every past season, the same files as real-data/2026-27/:

  real-data/legacy/<season>/fixtures.csv   one row per league match (final score, status)
  real-data/legacy/<season>/frames.csv     one row per frame (players, points, breaks)
  real-data/legacy/<season>/byes.csv       bye weeks
  real-data/legacy/<season>/competitions.json   the cup brackets (round by round, with scores)
  real-data/legacy/players.json            every player the old site has, with his position history
  real-data/legacy/NOTES.md                everything odd that was found

Then scripts/build-legacy.py turns them into supabase/legacy/*.sql (one file per season).

    mysql -uroot -e "create database wp"; mysql -uroot wp < richa172_stblaz.sql
    python3 scripts/extract-old-site.py
"""
import csv, json, os, re, sys, collections
import pymysql

OUT = os.path.join(os.path.dirname(__file__), "..", "real-data", "legacy")
P = "devstb_"
db = pymysql.connect(user="root", database="wp", charset="utf8mb4", unix_socket=os.environ.get("MYSQL_SOCKET", "/run/mysqld/mysqld.sock"))
cur = db.cursor()
def q(sql, *a):
    cur.execute(sql, a); return cur.fetchall()

# ── PHP unserialize (enough for SportsPress meta) ───────────────
def unphp(s):
    if s is None: return None
    b = s.encode("utf-8") if isinstance(s, str) else s
    pos = 0
    def read():
        nonlocal pos
        t = chr(b[pos])
        if t == "N": pos += 2; return None
        if t in "ibd":
            end = b.index(b";", pos); v = b[pos+2:end].decode(); pos = end + 1
            return int(v) if t == "i" else (v == "1" if t == "b" else float(v))
        if t == "s":
            colon = b.index(b":", pos + 2); n = int(b[pos+2:colon]); start = colon + 2
            v = b[start:start+n].decode("utf-8", "replace"); pos = start + n + 2; return v
        if t == "a":
            colon = b.index(b":", pos + 2); n = int(b[pos+2:colon]); pos = colon + 2
            out = {}
            for _ in range(n):
                k = read(); v = read(); out[k] = v
            pos += 1; return out
        raise ValueError(f"unknown type {t} at {pos}")
    try: return read()
    except Exception: return None

notes = collections.defaultdict(list)
def note(season, text): notes[season].append(text)

# ── lookups ─────────────────────────────────────────────────────
titles = {i: t for i, t in q(f"select ID, post_title from {P}posts where post_type in ('sp_team','sp_player')")}
ptype = {i: t for i, t in q(f"select ID, post_type from {P}posts where post_type in ('sp_team','sp_player')")}
PSEUDO_TEAMS = {"Bye", "Rees Bye", "Victory Bye", "No Team", "Unassigned Team"}
POS = {"54": "Player", "44": "Team Captain", "51": "Vice Captain", "419": "Extra Player"}

def terms(obj, tax):
    return [n for (n,) in q(f"""select t.name from {P}term_relationships r join {P}term_taxonomy tt on tt.term_taxonomy_id=r.term_taxonomy_id
        join {P}terms t on t.term_id=tt.term_id where r.object_id=%s and tt.taxonomy=%s""", obj, tax)]

def meta(obj):
    m = collections.defaultdict(list)
    for k, v in q(f"select meta_key, meta_value from {P}postmeta where post_id=%s order by meta_id", obj): m[k].append(v)
    return m

def clean_player(name):
    """'Ben Rothwell (Ext)' → ('Ben Rothwell', True); 'Extra Player 2' → (None, True); '(Admin)' label dropped."""
    n = re.sub(r"\s+", " ", (name or "").replace("&#8217;", "'").replace("’", "'")).strip()
    n = re.sub(r"\s*\(admin\)$", "", n, flags=re.I)
    m = re.match(r"^(.*?)\s*\(ext\)$", n, re.I)
    if m: return m.group(1).strip(), True
    if re.match(r"^extra player(\s*\d+)?$", n, re.I) or not n: return None, True
    return n, False

def breaks_of(text):
    return [int(x) for x in re.findall(r"\d+", str(text or "")) if 1 <= int(x) <= 155]

SEASONS = ["2018-2019", "2019-2020", "2020-2021", "2021-2022", "2022-2023", "2023-2024", "2024-2025", "2025-2026", "2026-2027"]
LEAGUES = {"Victory League", "Rees Memorial League"}

events = q(f"""select p.ID, p.post_title, p.post_date, p.post_status from {P}posts p where p.post_type='sp_event' and p.post_status in ('publish','future') order by p.post_date, p.ID""")
by_season = collections.defaultdict(list)
for eid, title, when, status in events:
    seasons, leagues = terms(eid, "sp_season"), terms(eid, "sp_league")
    if len(seasons) != 1: continue
    by_season[seasons[0]].append((eid, title, when, status, leagues))

players_seen = {}     # clean name → {"positions": {season: position}, "teams": {season: team}}
def saw(name, season, team, position):
    if not name: return
    p = players_seen.setdefault(name, {"seasons": {}})
    s = p["seasons"].setdefault(season, {"team": team, "position": position})
    if position in ("Team Captain", "Vice Captain"): s["position"] = position

def event_sides(eid, m):
    """[(team_id, [(player_id, row)…])…] home first, rows in their order on the card (player 0 = the team line)."""
    teams = [int(t) for t in m.get("sp_team", []) if t and int(t) > 0]
    players = unphp(m["sp_players"][0]) if m.get("sp_players") else {}
    results = unphp(m["sp_results"][0]) if m.get("sp_results") else {}
    sides = []
    for t in teams[:2]:
        rows = [(int(pid), row) for pid, row in (players or {}).get(t, {}).items() if int(pid) > 0 and isinstance(row, dict)]
        sides.append((t, rows))
    return teams, sides, results or {}

def score_of(results, team):
    r = results.get(team) if isinstance(results, dict) else None
    v = r.get("score") if isinstance(r, dict) else None
    try: return int(str(v).strip()) if str(v).strip() != "" else None
    except ValueError: return None

def num(v):
    try: return int(str(v).strip())
    except (ValueError, TypeError): return None

os.makedirs(OUT, exist_ok=True)
summary = []
event_cache = {}

for season in SEASONS:
    rows = by_season.get(season, [])
    fixtures, frames, byes = [], [], []
    league_rows = [r for r in rows if any(l in LEAGUES for l in r[4])]
    seen_matches = set()
    if not league_rows: note(season, "No league matches at all on the old website (the covid season)." if season == "2020-2021" else "No league matches on the old website.")
    for eid, title, when, status, leagues in league_rows:
        league = next(l for l in leagues if l in LEAGUES)
        m = meta(eid)
        teams, sides, results = event_sides(eid, m)
        names = [titles.get(t, "?") for t in teams]
        venue = (terms(eid, "sp_venue") or [""])[0]
        day = when.strftime("%Y-%m-%d"); time = when.strftime("%H:%M")
        if len(teams) < 2:
            note(season, f"{day} “{title}”: fewer than two teams on record — left out."); continue
        if any(n in PSEUDO_TEAMS for n in names):
            real = [n for n in names if n not in PSEUDO_TEAMS]
            if real: byes.append({"League": league, "Team": real[0], "Date": day})
            continue
        dup = (day, names[0].lower(), names[1].lower())
        if dup in seen_matches:
            note(season, f"{day} {league}: {names[0]} v {names[1]} is on the old website twice — the second copy is left out."); continue
        seen_matches.add(dup)
        hs, as_ = score_of(results, teams[0]), score_of(results, teams[1])
        if season == "2026-2027":
            pass
        # frames: row i of the home card against row i of the away card
        (ht, hrows), (at, arows) = sides
        fr = []
        for i in range(max(len(hrows), len(arows))):
            h = hrows[i] if i < len(hrows) else (0, {})
            a = arows[i] if i < len(arows) else (0, {})
            hp, ap = num(h[1].get("points")), num(a[1].get("points"))
            if hp is None and ap is None: continue
            hn, hext = clean_player(titles.get(h[0], "")) if h[0] else (None, True)
            an, aext = clean_player(titles.get(a[0], "")) if a[0] else (None, True)
            hpos = POS.get(str((h[1].get("position") or {0: ""}).get(0, "")) if isinstance(h[1].get("position"), dict) else "", "")
            apos = POS.get(str((a[1].get("position") or {0: ""}).get(0, "")) if isinstance(a[1].get("position"), dict) else "", "")
            hext = hext or hpos == "Extra Player"; aext = aext or apos == "Extra Player"
            saw(hn, season, names[0], hpos if hpos != "Extra Player" else "Player"); saw(an, season, names[1], apos if apos != "Extra Player" else "Player")
            fr.append({"Frame": len(fr) + 1, "Home player": hn or "", "Home ext": int(hext), "Home points": hp or 0,
                       "Away player": an or "", "Away ext": int(aext), "Away points": ap or 0,
                       "Home breaks": " ".join(map(str, breaks_of(h[1].get("breaks")))), "Away breaks": " ".join(map(str, breaks_of(a[1].get("breaks"))))})
        played = hs is not None and as_ is not None and (hs + as_) > 0
        # a card whose points don't give a winner in every frame can't stand as frames: keep the final score only
        if fr:
            won_h = sum(1 for f in fr if f["Home points"] > f["Away points"]); won_a = sum(1 for f in fr if f["Away points"] > f["Home points"])
            ties = sum(1 for f in fr if f["Home points"] == f["Away points"])
            silly = [f for f in fr if not (0 <= f["Home points"] <= 200 and 0 <= f["Away points"] <= 200)]
            if silly and played:
                note(season, f"{day} {league}: {names[0]} v {names[1]} — a frame score of {max(max(f['Home points'], f['Away points']) for f in silly)} (a typing slip on the old site): final score kept, frame details left out.")
                fr = []
            elif not played or ties or (won_h, won_a) != (hs, as_):
                if played: note(season, f"{day} {league}: {names[0]} v {names[1]} — the card ({won_h}-{won_a}{', a tied frame' if ties else ''}) doesn't add up to the result {hs}-{as_}: final score kept, frame details left out.")
                fr = []
        # A past season's match with no result never happened (the covid stop, a team that folded, a duplicate):
        # it isn't brought across. This season's are, so that their results can still be added.
        if not played and season != "2026-2027":
            note(season, f"{day} {league}: {names[0]} v {names[1]} — no result on the old website, so not brought across.")
            continue
        for f in fr:
            frames.append({"Date": day, "Home": names[0], "Away": names[1], **f})
        fixtures.append({"League": league, "Date": day, "Time": time, "Home": names[0], "Away": names[1], "Venue": venue,
                         "Score": f"{hs}-{as_}" if played else "", "Status": "Approved" if played else "Scheduled", "Old id": eid})
    # ── cup brackets of this season
    comps = []
    for tid, ttitle, tstatus in q(f"select ID, post_title, post_status from {P}posts where post_type='sp_tournament' and post_status='publish' order by ID"):
        if not ttitle.endswith(season) and not re.search(rf"\b{season[:4]}\b|\b{season[5:]}\b", ttitle): continue
        tm = meta(tid)
        tseasons = terms(tid, "sp_season")
        if tseasons and season not in tseasons: continue
        if not tseasons and not ttitle.endswith(season):
            # "Gordon Boynton Trophy 2025" / "Snooker Shoot Out 2024": the year the competition is played in this season
            yr = re.search(r"(\d{4})$", ttitle)
            if not yr or yr.group(1) not in (season[:4], season[5:]): continue
            if ("Shoot" in ttitle and yr.group(1) != season[:4]) or ("Boynton" in ttitle and yr.group(1) != season[5:]): continue
        rounds = num((tm.get("sp_rounds") or ["0"])[0]) or 0
        evs = unphp((tm.get("sp_events") or [""])[0]) or {}
        labels = unphp((tm.get("sp_labels") or [""])[0]) or {}
        mode = (tm.get("sp_mode") or ["player"])[0]
        matches = []
        idx = 0
        for r in range(1, rounds + 1):
            for slot in range(2 ** (rounds - r)):
                e = evs.get(idx) or {}; idx += 1
                ts = [num(x) or 0 for x in (e.get("teams") or {}).values()] + [0, 0]
                res = [str(x).strip() for x in (e.get("results") or {}).values()] + ["", ""]
                sa, sb = num(res[0]), num(res[1])
                pa = pb = None
                ev = num(e.get("id")) or 0
                if ev:
                    em = meta(ev); _, esides, eres = event_sides(ev, em)
                    if sa is None and ts[0]: sa = score_of(eres, ts[0])
                    if sb is None and ts[1]: sb = score_of(eres, ts[1])
                    tots = [sum(num(row.get("points")) or 0 for _, row in rows) for _, rows in esides]
                    if len(tots) == 2 and any(tots): pa, pb = tots
                    when = q(f"select post_date from {P}posts where ID=%s", ev)
                    date = when[0][0].strftime("%Y-%m-%d %H:%M") if when else None
                else:
                    date = f"{e.get('date')} {e.get('hh') or '19'}:{e.get('mm') or '30'}" if e.get("date") else None
                def who(i):
                    if not i: return None
                    n = titles.get(i)
                    if n is None: return None
                    if ptype.get(i) == "sp_player": n = clean_player(n)[0] or n
                    return {"name": n, "kind": "team" if ptype.get(i) == "sp_team" else "player", "old_id": i}
                matches.append({"round": r, "slot": slot, "a": who(ts[0]), "b": who(ts[1]), "score_a": sa, "score_b": sb,
                                "points_a": pa, "points_b": pb, "starts_at": date, "old_event": ev or None})
        played = [x for x in matches if x["score_a"] is not None and x["score_b"] is not None and (x["score_a"] or x["score_b"])]
        if not any(x["a"] or x["b"] for x in matches):
            note(season, f"Competition “{ttitle}”: the bracket is empty on the old website — left out."); continue
        comps.append({"title": ttitle, "old_id": tid, "mode": mode, "rounds": rounds, "labels": [labels.get(i) for i in range(rounds)], "matches": matches})
        note(season, f"Competition “{ttitle}”: {len(played)} of {len(matches)} matches have a result.") if len(played) < len([x for x in matches if x['a'] and x['b']]) else None

    d = os.path.join(OUT, season); os.makedirs(d, exist_ok=True)
    def write(name, rows, head):
        with open(os.path.join(d, name), "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=head); w.writeheader(); w.writerows(rows)
    write("fixtures.csv", fixtures, ["League", "Date", "Time", "Home", "Away", "Venue", "Score", "Status", "Old id"])
    write("frames.csv", frames, ["Date", "Home", "Away", "Frame", "Home player", "Home ext", "Home points", "Away player", "Away ext", "Away points", "Home breaks", "Away breaks"])
    write("byes.csv", byes, ["League", "Team", "Date"])
    json.dump(comps, open(os.path.join(d, "competitions.json"), "w"), indent=1, default=str)
    summary.append((season, len(fixtures), sum(1 for f in fixtures if f["Score"]), len({(f['Date'], f['Home']) for f in frames}), len(frames),
                    sum(len(f["Home breaks"].split()) + len(f["Away breaks"].split()) for f in frames), len(byes), len(comps)))

json.dump(players_seen, open(os.path.join(OUT, "players.json"), "w"), indent=1, sort_keys=True)
with open(os.path.join(OUT, "NOTES.md"), "w") as f:
    f.write("# Notes from the old website's database\n\nRead from Rich's export of the WordPress database (19 October 2026) by scripts/extract-old-site.py.\n\n")
    f.write("| Season | League matches | With a result | With full scorecards | Frames | Breaks | Bye weeks | Cup competitions |\n|---|---|---|---|---|---|---|---|\n")
    for s in summary: f.write("| " + " | ".join(map(str, s)) + " |\n")
    for season in SEASONS:
        if notes[season]:
            f.write(f"\n## {season}\n\n" + "".join(f"- {n}\n" for n in notes[season]))
for s in summary: print(s)
print("players seen:", len(players_seen))
