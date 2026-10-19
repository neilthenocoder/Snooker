# The real 2026-27 season, collected from the old website

Read from stblazeydistrictsnooker.co.uk on 7 and 8 October 2026, and checked against Rich's own list of
fixtures and results (Real_Data.docx, 8 October). Nothing was made up: where the old site had no
information (birthdays, most venue addresses, phone numbers) it is left empty.

| File | What is in it |
|---|---|
| `teams.csv` | 19 teams: 10 Victory League, 9 Rees Memorial League, each with its home venue |
| `players.csv` | The 153 players registered with a team this season: team, position (captain / vice captain), handicap |
| `players-without-a-team.csv` | 155 more people the old website lists with a handicap but no team this season |
| `cueviews.json` | The CueView answers of the 17 players who have any on the old site |
| `fixtures.csv` | All 162 league fixtures, 22 Sep 2026 – 16 Mar 2027; the 26 already played have their score |
| `byes.csv` | The Rees Memorial League's 18 bye weeks (nine teams, so one sits out each night) |
| `frames.csv` | The 26 played matches frame by frame (130 frames, 10 breaks) |
| `venues.csv` | 13 venue names, and the one address the old site had |
| `competitions.md` | The 11 cup competitions and what their pages said |
| `profiles.md` | What a player's page holds on the old site |
| `NOTES-from-the-old-site.md` | Everything odd that was found, and each choice that was made — **section 9 is what to check with Rich** |

## Putting it on the website: one SQL file

`supabase/real-league.sql` is built from these files (`npm run real-league`). In Supabase → SQL Editor:

1. Run all of `supabase/schema.sql` (database version 20; safe to re-run).
2. Run all of `supabase/real-league.sql`. It ends with a line like
   *Done: 153 players in teams, 162 fixtures, 130 frames, 10 breaks, 18 bye weeks.*

What it does:

- **Takes out** everything that was there for testing: every player not on the league's list (and the photos, bios,
  CueViews and other details of those who are), every fixture, scorecard and break, every news article, every season
  except 2026-2027, any league, team, venue or competition that isn't the real league's, competition draws and
  entries, test matches on the live scoreboard, the handicap log, award winners and the player/team of the week and month.
- **Keeps** logins (still linked to their player), the leagues', teams' and venues' emblems and pictures, pages,
  sponsors, the image library, settings and branding.
- **Adds** the players (the list from the league, round 27 — `players.csv`), fixtures, bye weeks, the scorecards and
  breaks on record, and the season's 11 competitions (without draws).
- **Not updated yet:** what isn't on record stays empty, and the website says "Not updated yet" — four handicaps,
  most CueViews and bios, and the matches played since 6 October (and Bethel D v Mevagissey C on 6 October).
  The league adds them in the dashboard.

`players-without-a-team.csv` is no longer used: only the players on the league's list are loaded.

It is one transaction: if any check fails, nothing is changed. **Run it once.** Run again later, it would put the
league back to this starting point and lose every result entered on the website since.

## The same files, by hand

Admin → Import from CSV still takes `teams.csv`, `players.csv`, `fixtures.csv` and `frames.csv`, in that order,
into an empty season. It does not bring in the CueViews, the players without a team or the bye weeks.

## What to know

- **Extra (Ext) frames.** The old site wrote the extra player as "Ben Rothwell (Ext)" or just "Extra Player".
  The first is Ben Rothwell's second frame of the night, the second a frame with no named player. There are four.
  As on the old site, an extra frame counts for the team but not for the player's own ranking.
- **Players with no handicap** on the old site come in as 0 — four in teams (Andre Koranteng, Peter Harford,
  Edward Barkhuysen, Simon Yeo) and 16 of those without a team. Three shown as "(0)" are scratch players.
- **Richard Pearson** is "Richard Pearson (Admin)" on the old site (Tregonissey A, handicap 7); the label is removed.
- **One name looks wrong on the old site** (Martin Richards shown playing for Tregonissey C on 6 October,
  the same night he played for St Blazey A): it is imported as the old site has it. See the notes.
- **Bethel D v Mevagissey C (6 October)** has no result on the old site and is a fixture still waiting for its card.
- League tables, every player's ranking points and all ten breaks worked out from these files match the old site.
