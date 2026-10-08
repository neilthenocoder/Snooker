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

`supabase/real-season-2026-27.sql` is built from these files (`npm run real-season`). In Supabase → SQL Editor:

1. Run all of `supabase/schema.sql` (it adds the bye-weeks table; safe to re-run).
2. Run all of `supabase/real-season-2026-27.sql`. It ends with a line like
   *Done: 153 players in teams, 162 fixtures, 130 frames, 10 breaks, 18 bye weeks.*

What it does:

- **Takes out** every fixture, scorecard and break (all sample or test), every sample player, every season
  except 2026-2027, the sample competition draws, and test matches on the live scoreboard.
- **Keeps** the 19 teams, the venues and the two leagues — so the emblems stay — and brings their details up to date
  (two venues get their real names: Gorran Haven Snooker Club, Lerryn Community Centre; made-up addresses and
  descriptions are cleared). Players you added yourself, logins, news, pages, sponsors, the image library,
  settings and branding are not touched.
- **Adds** the players, fixtures, bye weeks, scorecards and breaks, and the season's 11 competitions (without draws).

It is one transaction: if any check fails, nothing is changed. **Run it once.** Run again later, it would put the
season back to 8 October 2026 and lose every result entered on the website since.

Afterwards, on the website:

- Check a league table against the old site (they match for all 19 teams on 8 October).
- Admin → Leagues: set who held each shield at the start of the season (the sample holders were cleared).
- Admin → Players: add the four photos listed in the notes, and set a handicap for the players who have none.
- Logins that were linked to a sample player have lost that link (their team is kept): Admin → Logins → pick the real player.

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
