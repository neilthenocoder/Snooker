# Issues, uncertainties and notes - data collected from stblazeydistrictsnooker.co.uk on 07/10/2026

Everything in the CSV files was read from the site with WebFetch. Nothing was filled in. Where the site was ambiguous the choice made is listed here so it can be reversed.

## 1. What needs a human decision before import

1. **"Extra frame" rows in frames.csv use names that are not in players.csv (4 rows).** When a team is a player short, the site records the fifth frame against a stand-in record instead of a real player. They are written in frames.csv exactly as the site shows them:
   - 22/09/2026 Bugle v Mevagissey B, frame 5, away player `Ben Rothwell (Ext)` (62 points; he also played frame 1 as `Ben Rothwell`). On the site this row has Wins 0 / Loss 0, i.e. the frame counts for the team (match is 1-4) but not for the player's own record.
   - 29/09/2026 Mevagissey C v Luxulyan B, frame 5, home player `Oliver Watson (Ext)` (58 points, position "Extra Player"; he also played frame 1 as `Oliver Watson`). On this one the site gives the row Wins 1.
   - 22/09/2026 Gorran Haven v Lerryn, frame 5, away player `Extra Player` (27 points) - a generic placeholder, the real person is not named.
   - 22/09/2026 Luxulyan B v Tregonissey B, frame 5, away player `Extra Player` (22 points) - same placeholder.
   The site has a shadow record "<Name> (Ext)" (position "Extra Player") for nearly every registered player, plus generic "Extra Player" and "Extra Player 2" records. Suggested handling: map "X (Ext)" to X and mark the frame as an extra frame; keep "Extra Player" as an unnamed stand-in. Not done here because it changes what the site says.
2. **A player recorded for the wrong team in a scorecard.** 06/10/2026 Luxulyan B v Tregonissey C, frame 2: the site shows `Martin Richards` (link /player/martin-richards/) playing for Tregonissey C. Martin Richards is registered with St Blazey A (handicap 40) and played for St Blazey A on 29/09 and again on 06/10 (St Blazey A v Mevagissey B, frame 5) - the same night, at a different venue. Tregonissey C has a `Mark Richards` (handicap 30) who played for them on 29/09. This looks like the wrong name picked when the result was entered, but frames.csv keeps what the site shows (the page was fetched twice, same both times).
3. **One match is past its date with no result.** Rees Memorial League, 06/10/2026, Bethel D v Mevagissey C (event 32124): the fixtures list still shows the time, the match page has five players a side all on 0 points, and the league table counts only 2 matches played for each of those teams. It is not marked postponed. In fixtures.csv it is `Scheduled` with no score.
4. **One result is shown incompletely.** Rees Memorial League, 06/10/2026, Luxulyan B v Tregonissey C (event 32128): the fixtures list shows the result as just "5" (no away figure). The scorecard has Luxulyan B winning all five frames and the league table (Luxulyan B F12 A3, Tregonissey C F1 A9) only adds up with 5-0, so fixtures.csv has `5-0`.
5. **A frame recorded as 1-0.** 22/09/2026 Bethel B v Mevagissey C, frame 5: Roy Bayliss 1 point (Win) v Andrew Kitt 0 points (Loss). Almost certainly a conceded/walk-over frame entered as 1-0 rather than a real score. Kept as shown.
6. **Names with site labels in them.** The site names him `Richard Pearson (Admin)` (Tregonissey A, handicap 7); **in players.csv here the “(Admin)” label has been taken off, so he is `Richard Pearson`.** The site ALSO has a separate, team-less record `Richard Pearson` (handicap 10). They are evidently the same person; the "(Admin)" one is the one registered for 2026-27. Rename on import if wanted.
7. **Handicap shown as "(0)" or "-".** Three players have the handicap printed as `(0)` - Ryan Bilson, Pete Chambers, Andrew Best - written as `0` in players.csv. Four have `-` (no handicap set) - Andre Koranteng, Peter Harford, Edward Barkhuysen, Simon Yeo - left empty in players.csv. Simon Yeo has played two league frames without a handicap on record.
8. **Vice-captain of St Neot: two sources disagree.** The St Neot handicaps page shows Chris Perring as Vice Captain and Darran Lock as Player (read twice). The live player records (REST API), the all-players handicap list and all three St Neot match pages show Darran Lock as Vice Captain and Chris Perring as Player. players.csv follows the live records (Darran Lock = Vice Captain). The club handicap pages appear to be slightly stale copies.
9. **Captain labels on match pages do not always match the player list.** Match pages carry their own Position per player. Bethel C: match pages show Howard Brett as "Vice Captain" and James Smithson as "Player"; the handicap page and live records say Howard Brett = Team Captain, James Smithson = Vice Captain (used in players.csv). Billy Vigus (St Blazey A captain) and Ross McMenemy (Bethel D vice captain) have not appeared in a scorecard yet.
10. **Duplicate player record: Les Shakespeare (Lerryn).** Two records with the same name: /player/les-shakespeare-2/ (Vice Captain, current team Lerryn, handicap 30 - the one on the Lerryn handicap page) and /player/les-shakespeare/ (Player, handicap 30, current team "Unassigned Team" in the live record although the all-players list prints Lerryn). The 22/09 scorecard links to the second; the 06/10 scorecard shows him as Vice Captain, so appears to use the first. One row in players.csv; both scorecards are spelled the same so nothing breaks, but his old-site statistics are split across two records.

## 2. Spellings and naming choices

- `Darren OShea` (St Neot) - the site's record has no apostrophe (slug darren-oshea, REST title "Darren OShea"). The page-reading model sometimes "corrected" it to O'Shea; the site's own spelling is used everywhere.
- `Kenanne Burt` - the site's record has two spaces between the names; written with one.
- `Tregonissey A` is the team's displayed name; its URL slug is just `tregonissey`.
- `Mike Haley` has slug `m-haley`, `Nathan Taylor` has slug `nate-taylor`, `James Prynn` is `james-prynn-2`, `Darren Roberts` is `darren-roberts-2` - only relevant if old player URLs are redirected.
- Venue naming: the venue is "Tregonissey Social Club" everywhere in fixtures; the Venues (Clubs) page heading calls it "Tregonissey War Memorial Social Club". The venue list also has "Lostwithiel" and "Lostwithiel social club" as two separate entries, and a typo duplicate "Gorran Haven Snoooker Club" (1 use) - the duplicate is left out of venues.csv.
- The "Team" column printed in the site's player lists is unreliable where a player has more than one team on record: the Bugle handicap page lists Ian Ball with Team "Luxulyan A"; the all-players list shows every St Blazey A player as "St Blazey B" and vice versa, Roy Bayliss as "Bugle", Kyle Bennetts as "Mevagissey A", Darren Roberts as "Rees Bye". players.csv uses the team whose handicap list the player sits in, which agrees with the scorecards and with the live record's current team wherever it was checked (Ian Ball -> Bugle, Billy Vigus -> St Blazey A, Roy Bayliss -> Bethel B, etc.).

## 3. Fixtures: what the real pattern is

- Both leagues are a double round robin: every team plays every other team once at home and once away. Checked by script: every ordered (home, away) pair appears exactly once.
- Victory League: 10 teams, 90 fixtures, 18 each (9 home, 9 away). 15 played, 75 to play.
- Rees Memorial League: 9 teams, 72 fixtures, 16 each (8 home, 8 away). 11 played, 61 to play. The fixtures index page says "10 teams" for the Rees league but lists nine.
- Each Rees team also has 2 "Bye" weeks. The site stores each bye as a match against a team called "Bye" (18 of them). They are NOT in fixtures.csv and do not count in the league table. Bye weeks: 22/09/2026 Tregonissey C; 29/09/2026 Lerryn; 06/10/2026 Bethel C; 13/10/2026 Gorran Haven; 27/10/2026 Luxulyan B; 03/11/2026 Tregonissey B; 10/11/2026 Mevagissey C; 17/11/2026 Bethel B; 01/12/2026 Bethel D; 05/01/2027 Tregonissey C; 12/01/2027 Lerryn; 19/01/2027 Bethel C; 02/02/2027 Gorran Haven; 09/02/2027 Luxulyan B; 23/02/2027 Tregonissey B; 02/03/2027 Mevagissey C; 09/03/2027 Bethel B; 16/03/2027 Bethel D.
- All matches are on Tuesdays at 19:30, 18 match nights: 22/09, 29/09, 06/10, 13/10, 27/10, 03/11, 10/11, 17/11, 01/12/2026, 05/01, 12/01, 19/01, 02/02, 09/02, 23/02, 02/03, 09/03, 16/03/2027.
- No fixture is marked postponed on the site (the "Postponed" column is "-" on every row).
- Every match is five frames. League points = frames won (the table's points column equals frames for). The league tables rebuilt from fixtures.csv match the site's tables exactly (P, W, L, F, A for all 19 teams).
- Bethel D's fixture page also lists a cup tie ("Bye v Bethel D", Team Handicap, 20/10/2026 07:30). Excluded.
- Old-site match ids: Victory League 32001-32090, Rees Memorial League 32112-32204 (match page = /event/<id>/).

## 4. Scorecards (frames.csv)

- All 26 played matches have a scorecard; none had to be skipped. 130 frame rows.
- The site does not number frames. Each match page has one table per team with five player rows; row N of the home table is taken as frame N against row N of the away table. This pairing is consistent everywhere: in every one of the 130 frames exactly one side has the higher points, and the frames won by points equal the match score (26/26). The site's Wins/Loss flags agree with the points in all frames except the "(Ext)" row in item 1.1.
- Breaks: the site has one "Brks" cell per player per match (which is also per frame here, because a player plays one frame). 10 breaks recorded so far, all single values. In older seasons the same field holds several breaks separated by spaces (e.g. "0 30 0 38").
- Points written without leading zeros (the site shows "06" and "09" in two places).
- No match reports are attached to match pages (the "Article" link just says Recap/Preview). Match write-ups exist as separate news posts (e.g. "Moore Power as Bugle Edge Past St Neot in Five-Frame Thriller") and were not collected.

## 5. Checks carried out

- Every one of the 180 site events (162 matches + 18 byes) was read from both teams' fixture pages; the two readings were identical for all of them.
- Scores of all 26 played matches were read a second time from nine team pages (with the stored date-time, confirming 19:30 for all).
- Nine match pages were re-fetched with a different prompt and compared line by line with frames.csv: events 32001, 32009, 32011, 32014, 32113, 32116, 32120, 32127, 32128. No differences.
- All ten club handicap pages were read twice (153 players); the two readings were identical apart from the O'Shea apostrophe. 130 of the 153 were then matched against the site's all-players list (/list/player-handicaps-26-27/) and the other 23 (handicap 50 and over, which that page cut off) plus Richard Pearson (Admin) against the live player records via the REST API. Every handicap agreed.
- Every team in fixtures.csv, players.csv and frames.csv is in teams.csv with the same spelling.
- Players named in frames.csv but not in players.csv: only the four stand-in rows in item 1.1. One player appears for a team he is not registered with (item 1.2).
- Every team has exactly one Team Captain and one Vice Captain in players.csv.

## 6. Things that could not be found

- **Birthdays:** the site shows a "Birthday" for every player but it is the date the web record was created, not a date of birth (see profiles.md). Birthday is empty for all players.
- **Venue addresses and telephone numbers:** not on the venue pages or the Venues (Clubs) page. The only address anywhere is inside the Bugle venue description ("Bugle Working mens Club 4 Rosevear Rd Bugle St Austell PL26 8PH"). No telephone numbers at all. The Bugle description also gives opening times (Mon-Thurs 7pm-11pm, Fri 7pm-midnight, Sat midday-midnight, Sun midday-1030pm) and Bethel has a one-line description ("A Members Club With 2 Bars, 2 Full size Snooker Tables, a Pool Table, Dart Boards, and Entertainment Most Saturday Nights").
- The venue list also contains three non-venues ("Bye", "Rees Bye", "No Club"); left out of venues.csv. "Lostwithiel", "Lostwithiel social club" and "St Stephen Social Club" are venues from past seasons, not used in 2026-27.
- Team pages show only the home venue, the competitions and seasons the team is tagged with, and a fixture list; no club contact details.

## 7. Sources: what worked

- **HTML pages (worked, main source):** the per-team "Fixtures & Results 26-27" pages (19), match pages /event/<id>/, the per-club "Handicaps 26-27" pages (10), player pages, team pages, competition pages, /list/player-handicaps-26-27/.
- **REST API, worked:** `/tables/<id>` (full league table - the HTML table pages only yielded position and team name), `/tables`, `/leagues`, `/seasons`, `/venues`, `/positions`, `/calendars`, `/lists/<id>`, and `/players?search=<name>&per_page=10` (title, current team, position, handicap and profile answers).
- **REST API, did not work:** `/events` returns an empty list (with or without filters), `/events?status=future` returns HTTP 400; `/teams` returns only 5 records (Unassigned Team, Luxulyan B, Bugle, Luxulyan A, Bye) and page 2 is HTTP 400; `/players` and `/lists` time out whenever more than about 10 records are requested or a season/league/position filter is used.
- The all-players handicap list stopped at row 237 (handicap 50) when read, so it could not be used for the highest handicaps.

## 8. Earlier seasons on the site

- Season terms exist for 2018-2019, 2019-2020, 2020-2021, 2021-2022, 2022-2023, 2023-2024, 2024-2025, 2025-2026 and 2026-2027. Number of records tagged with each (matches plus every player and team tagged with that season, so only a rough guide): 2018-19: 609; 2019-20: 607; 2020-21: 383; 2021-22: 570; 2022-23: 570; 2023-24: 703; 2024-25: 851; 2025-26: 802; 2026-27: 497. 2020-21 looks like it has no matches (no league table exists for it either).
- League tables exist for both leagues for 2014-15, 2015-16, 2016-17, 2017-18, 2018-19, 2019-20, 2021-22, 2022-23, 2023-24, 2024-25, 2025-26 and 2026-27 (24 tables; a count of 25 was reported by the reader but only 24 were listed). The 2014-15 to 2017-18 tables seem to be tables only, with no match records behind them: the Seasons page lists 2014-2015 to 2017-2018 without working links.
- The Seasons page (/our-league/seasons/) links to a page per season from 2018-2019 to 2026-2027, each with Breaks, Competitions, Fixtures & Results, Handicaps, League Tables and Rankings sub-pages. The 2018-2019 season page's links point at the 2023-24 sub-pages (e.g. /fixtures-results-23-24/), so older season pages cannot be trusted to lead to their own data.
- Match-level data goes back to 18/09/2018. A sample 2018-19 match page (Bethel A v Bethel C, /event/5863/, 4-1) has the five players a side with their frame points, but the Wins/Loss columns are all 0 - the per-frame winner flags were only filled in from about 2021-22 (a player's season totals show Wins 0 for 2018-19 and 2019-20 and real numbers from 2021-22). Frame winners for old seasons would have to be worked out from the points.
- The 2025-26 Victory League table lists 9 teams (Bethel A, Tregonissey A, Luxulyan A, St Blazey B, St Neot, Mevagissey A, Mevagissey B, Pelynt, Bethel D), so team line-ups and divisions change between seasons (Bethel D is in the Rees league this season; Luxulyan B is described on the site as a Rees league newcomer).
- The numbers of matches per past season were not counted, because the REST events route is empty and each season would need its team pages reading one by one.
- Competition terms on the site (cups): Bill Toms, Doubles, Gordon Boynton Trophy, Handicap Doubles, Rees League Singles, Seniors, Singles, Snooker Shoot-Out, Team Handicap, Team Pairs, Willie Thomas.
