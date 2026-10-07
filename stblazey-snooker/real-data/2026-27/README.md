# The real 2026-27 season, collected from the old website

Read from stblazeydistrictsnooker.co.uk on 7 October 2026. Nothing was made up: where the old
site had no information (birthdays, most venue addresses, phone numbers) the column is empty.

| File | What is in it | How it is used |
|---|---|---|
| `teams.csv` | 19 teams: 10 Victory League, 9 Rees Memorial League, each with its home venue | Admin → Import from CSV → Teams |
| `players.csv` | 153 players with team, position (captain / vice captain) and handicap | … → Players |
| `fixtures.csv` | All 162 league fixtures, 22 Sep 2026 – 16 Mar 2027; the 26 already played have their score | … → Fixtures & results |
| `frames.csv` | The 26 played matches frame by frame (130 frames, 10 breaks) | … → Full scorecards |
| `venues.csv` | 13 venue names, and the one address the old site had | For reference: type addresses in under Admin → Venues |
| `competitions.md` | The 11 cup competitions and what their pages said | For reference: create them under Admin → Competitions |
| `profiles.md` | What a player's page holds on the old site (questions and answers) | For reference |
| `NOTES-from-the-old-site.md` | Everything odd that was found, and each choice that was made | **Read section 1 before importing** |

## Importing it

Do this on a copy of the site first if you can (or in the demo), then on the live one.

1. **Clear the sample league** — only if the sample teams and players are still there. In Supabase → SQL Editor run
   `supabase/remove-sample-data.sql`. This deletes the sample teams, players, fixtures, competitions, news and pages
   **and anything attached to them** (photos and emblems you added to sample players or teams lose their link).
   It is a one-off for going live — never part of a normal update.
2. In the dashboard add the two leagues exactly as named here — **Victory League** and **Rees Memorial League**
   (Admin → Leagues) — and the season **2026-2027**, ticked as the current season (Admin → Seasons).
3. Admin → Import from CSV, in this order: `teams.csv`, `players.csv`, `fixtures.csv`, `frames.csv`.
   Each one shows what it will do before anything is saved. Expected: 19 teams (and 10 venues), 153 players,
   162 fixtures, 130 frames — no lines with problems.
4. Check a league table against the old site, then look through `NOTES-from-the-old-site.md` section 1 and put
   right anything you disagree with (Admin → Players / Fixtures, or the scorecard itself).

## What to know before you press Import

- **Extra (Ext) frames.** The old site wrote the extra player as “Ben Rothwell (Ext)” or just “Extra Player”.
  The importer understands both: the first becomes Ben Rothwell playing as the extra player, the second a frame
  with no named player. There are four such frames.
- **Four players have no handicap** on the old site (Andre Koranteng, Peter Harford, Edward Barkhuysen,
  Simon Yeo): they come in as 0. Three shown as “(0)” are 0.
- **Richard Pearson** is “Richard Pearson (Admin)” on the old site; the label has been removed here.
- **One result looks wrong on the old site** (Martin Richards shown playing for Tregonissey C on 6 October,
  the same night he played for St Blazey A): it is imported as the old site has it. See the notes.
- **Bethel D v Mevagissey C (6 October)** has no result on the old site and is imported as a fixture still to play.
- The Rees league's “Bye” weeks are not fixtures and are left out.
- Tables rebuilt from these files match the old site's tables for all 19 teams.
