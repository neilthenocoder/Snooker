# St Blazey & District Snooker League — website

A fast, plain HTML/CSS/JavaScript website (no build step) with:

- **Public site**: home page with a rotating news banner, live & upcoming match strip, league tables, shield holders, player/team of the week and CueViews; fixtures and results, a **calendar** (with phone-calendar download), team pages, **player pages with CueView**, match scorecards, venues with maps and galleries, news with weekly round-ups, **knockout competitions with a live bracket and live cup scorecards**, standings, handicaps and a **Live** page.
- **Live extras**: the LIVE button pulses orange ("LIVE SOON") an hour before matches and green while they're on; green pop-ups announce frame wins, breaks, news, new leaders, competition winners and new players. The **bell** opens a side panel where each visitor switches each kind on or off (section 3j).
- **Members' area** (My Team · Fixtures · Profile · User details · Competitions): captains and vice captains enter scorecards frame by frame on match night — a **step-by-step view made for phones**, or the classic full card. Each save updates the live page for everyone, straight away. Every player can have a login to edit **their own profile** (photo, bio, career history, pictures, CueView).
- **Players**: an **Our Players** page (pick a team, see its players past and present) and player pages with bio, career history, past teams, pictures and **player news**.
- **Seasons** (`/seasons`): a page for every season with tiles for its Breaks, Competitions, Fixtures & Results, Handicaps, League Tables and Rankings, and a page per league for the breaks, the player rankings and the table. A **search** button in the menu finds players, teams, competitions, venues, news and pages.
- **Roles & permissions**: the Master Admin decides, in a tick-box grid, what each officer role (League Admin, Competition Secretary, League Secretary, Committee Member, President, Vice Chairman, Chairman) can see and do. Each login only sees its own parts of the dashboard, and the database enforces it. Any officer can also be given captain rights for their team.
- **Master Admin tools**: an **activity log** (who added, changed or removed what), a **backup** download, and **maintenance mode**.
- **Home page extras**: an **announcements ticker** along the very top, and a **Latest Results** box in the side column with an all-results page (`/results`).
- **CSV import**: bring in teams, players, old fixtures and results, or full scorecards from a spreadsheet (Admin → Import from CSV).
- **Admin dashboard**: approve results, and manage fixtures, the fixture generator, leagues (and their weekly shield), teams, players (with CueView), venues, seasons, competitions (entrants, byes, draws — fixed bracket or redrawn every round — and results), logins, news and categories, an **image library**, info pages, sponsors, **site settings** (logo, favicon, banner, player/team of the week) and a **statistics** dashboard.
- **Competition entry form** (`/enter`): players pick their name and the competitions they want, are shown the league's bank details and a pay-by date, and the entry waits for the competition secretary to confirm the payment.
- **Live draws**: a competition's draw can be made live on the website, one tie at a time, with a named witness.
- **Branding**: logo, loading logo, the colour of each menu button and its section, fonts and page layout are all set in the dashboard.
- **Season archive & roll of honour** (`/archive`): every season's champions, top player and highest break, with its full tables and breaks a click away.
- **Finals night**: a **live scoreboard** scored ball by ball from a phone or tablet (Admin → Live scoreboard), watched live at `/scoreboard`.
- **End of season**: a **presentation night** page with every trophy, winner and runner-up (`/presentation`) and a **season review** worked out from the results (`/season-review`).
- **League information**: **key dates** on the home page and calendar, a **Rules** page with tabs, a contents list and proper tables and sub-bullets (`/rules`), **AGM and committee meetings** with minutes (`/meetings`), a page for each **sponsor**, and **Sadly no longer with us** (`/in-memoriam`).
- **My Snooker** (`/myteam`): everyone with a login makes the site their own — the teams and players they follow, the sections they want (next match, results, fixtures, competitions, news, handicaps, breaks, table, rankings, CueViews), shown on their own page, on the home page, or both (section 3h).
- **Menu bar and side panels**: the menu bar stays at the top as you scroll; on phones the menu opens over the whole screen; a person icon opens the login / My account panel; the site can be **added to a phone's home screen** (section 3j).
- **Merchandise** (`/merchandise`) and a **CueView form** (`/cueview`) that players fill in themselves and the league approves (section 3i).
- **Result emails**: the results secretary is emailed as soon as a captain submits a card (through Resend — see section 3f).
- **Short web addresses**: `/match/2627-14`, `/player/sam-bolitho`, `/cup-match/27`.
- **Automatic calculations**: league tables (P/W/L/F/A/Pts), player rankings (5 pts per frame won plus break points), highest breaks and all breaks.

It runs in **demo mode** out of the box, using sample data saved in your browser, so you can deploy it to Netlify and click around before setting up a database.

---

## 1. Try it now (demo mode, 2 minutes)

1. Go to <https://app.netlify.com/drop>.
2. Drag the **`public`** folder onto the page.
3. Open the link Netlify gives you and log in with one of these demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.test` | `admin123` |
| Captain (Bethel A) | `captain@demo.test` | `captain123` |
| Player (Bugle) | `player@demo.test` | `player123` |
| Competition Secretary, who is also Bugle's captain | `compsec@demo.test` | `compsec123` |
| Committee Member (website only) | `committee@demo.test` | `committee123` |
| Player linked to nobody (My Snooker from scratch) | `fan@demo.test` | `fan12345` |

Demo data lives only in your browser. **Admin → Reset sample data** starts it fresh.

> To test on your own computer instead, install Node.js, then run `npm start` in this folder and open <http://localhost:8080>.
> Don't open `index.html` by double-clicking it. The site needs a web server to work.

---

## 2. Go live with Supabase (about 20 minutes)

### a) Create the database

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor → New query**, paste in all of **`supabase/schema.sql`** and press **Run**. This creates the tables, the security rules and the `images` storage bucket for uploads.
3. *(Optional)* Run **`supabase/seed.sql`** the same way to load the sample league for testing. When you're done testing, run **`supabase/remove-sample-data.sql`** to delete it (do this before entering your real teams).
4. Go to **Authentication → Sign In / Providers** and turn **off "Allow new users to sign up"**. Only the admin should create accounts.

### b) Create your own admin login

1. Go to **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
2. In the **SQL Editor**, run this, using your own email:

   ```sql
   insert into profiles (id, email, full_name, role)
   select id, email, 'Master Admin', 'admin' from auth.users where email = 'you@example.com';
   ```

### c) Connect the website

Supabase gives you **one URL and two keys**. Here's where each one goes:

| Value | Public? | Put it in |
|---|---|---|
| Project URL (`https://xxxx.supabase.co`) | Yes, it's just an address | `config.js` **and** Netlify (the same value in both) |
| **anon / publishable** key | Yes, it's designed to be public | `config.js` only |
| **service_role / secret** key | **No, never share it** | Netlify only, never in any file |

1. In Supabase, go to **Project Settings → API**. Copy the **Project URL** and the **anon / publishable** key.
2. Paste them into **`public/js/config.js`**:

   ```js
   export const SUPABASE_URL = "https://xxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...";   // the anon/publishable key, NOT the secret one
   ```

   The anon key is designed to be public. The database security rules protect the data, not this key.

### d) Deploy to Netlify, with the logins function

The admin "Logins" page uses a small server function, because creating accounts needs a **secret** key that must never be in the browser. Netlify Drop doesn't run functions, so deploy the whole folder instead.

**Option 1: GitHub (recommended).**
1. Push this whole folder to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project** and pick the repository. The settings come from `netlify.toml` automatically.

**Option 2: Netlify CLI.** Run `npm install`, then `npx netlify deploy --prod` in this folder.

Then, in Netlify, go to **Site configuration → Environment variables** and add these two. The logins function runs on Netlify's server and can't read `config.js`, so it needs its own copy of the URL.

| Key | Value | "Contains secret values"? |
|---|---|---|
| `SUPABASE_URL` | your Project URL (same as in `config.js`) | **No.** Leave it unticked, or Netlify may block the deploy because the URL is in `config.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role / secret** key | **Yes.** Tick it |

Redeploy once after adding the variables. Now log in at `/login` and create captain logins under **Admin → Logins**.

Result emails need one more variable (and a second once the league's domain is verified) — see **section 3f**:

| Key | Value | "Contains secret values"? |
|---|---|---|
| `RESEND_API_KEY` | your Resend API key (starts `re_`) | **Yes.** Tick it |
| `RESULTS_EMAIL_FROM` | e.g. `St Blazey Snooker League <results@mail.your-domain.co.uk>` — only after the domain is verified in Resend | No |
| `SITE_URL` | optional: the website's address, used for the links in the email (otherwise the address the captain is on is used) | No |

---

## 3. Match night: how it works

1. **Captain** logs in on their phone, which opens **My Team**. They press **Open scorecard** on tonight's match.
2. On a phone the scorecard opens **step by step**, with three steps across the top:
   - **1 Players** — pick who plays each of the five frames. A player can only be picked once, plus once more as "(Ext)" when they play a second frame as the team's extra player (allowed once per player per season). **+ Add a new player** registers someone new for their own team on the spot; the admin is told so they can set the handicap.
   - **2 Frames** — one frame at a time: home player on top, away player below. Type each **frame score**, add any **breaks** one by one, then press **Save frame**. It moves to the next frame; the numbers jump to any frame and **Skip** leaves one for later. The live strip, the **Live** page and the match page update for everyone within a second or two.
   - **3 Finish** — a summary of all the frames, the **photo of the paper scorecard** (opens the phone camera) and **Submit results**. **A result cannot be submitted without the photo** — the database refuses it, not just the page. Before it's sent, a box asks them to be certain the scores are correct and in the right columns.
   - **Classic card** (the switch above the steps) shows the whole card in one table instead — breaks are typed as `34, 41` next to the player. The site remembers which view each person prefers.
3. **Admin** opens **Results to approve**, checks the scorecard and its photo, and presses **Approve**. Approved results are locked for captains, but the admin can still edit them.

Tables and rankings count **submitted** and **approved** results. To make tables move live during the evening instead, add `"in_progress"` to `countedStatuses` in `public/js/core/rules.js`.

**Checks on the card:** a break is 1–155 (147, or up to 155 with a free ball); a player's breaks in a frame can't add up to more than their frame score; a frame can't be tied.

**Postponed matches:** a captain or vice captain presses **Postpone** next to the match under My Team → Fixtures (before it starts), or the admin opens its scorecard and presses **Mark postponed**. Players and visitors can't. It shows as "P - P" on the site and is left out of the tables. Both captains then see a reminder on their My Team page that it must be re-arranged **within 3 weeks**, with the date (`POSTPONE_WEEKS` in `rules.js`). The admin gives it a new date under **Admin → Results to approve → Postponed** and presses **Rearrange**; anything past the 3 weeks is flagged on the admin Overview.

**New players added by captains** show up on the admin Overview and with a red count next to **Players** in the menu. In the Players list they sit at the top, marked **NEW**. The mark (and the count) goes as soon as you **save** that player, or press **Mark as checked** — one at a time, or all at once. Players the admin adds are never marked.

**The Players list** in the dashboard shows 50 players at a time, with ‹ › arrows to move on (`pageSize` on the players section in `admin/resources.js`). Search and the team filter look through every page.

**The weekly shield:** set each league's shield name and the holder at the start of the season under Admin → Leagues. From then on it's automatic: the holder's match each week is the shield match (shown on the scorecard and match page), and if they lose, the winners take it. The home page shows who holds it. Each shield has its own **history page** (`/shield/victory-league`, linked from the home page box, the league table and the League page): the current holders, who has won it most, and every shield match of the season in order.

**Handicap competitions** (tick "Handicap competition" under Admin → Competitions): the scorecard shows each player's handicap and works out the start for every frame. Scores are entered **as they finish on the scoreboard, start included**; the site refuses a score lower than the start.

- **Singles and team matches:** the player with the higher handicap starts on the difference. 16 against −14 is a 30 start.
- **Doubles:** each pair's two handicaps are added together, and that total is what the pair starts on. +20 and −14 start on 6, so if they then score 85 their frame score is 91. A pair whose total is below zero starts below zero (and can finish a frame below zero).
- **Running total:** handicap scorecards show each side's total points so far (starts included), on the scorecard and on the public match page. If a match finishes **level on frames**, the side with the higher total goes through — the match page and the bracket say "on points". If the totals are level too, the site asks for a winner. (`handicapStarts()` in `rules.js`, `winnerSide()` in `bracket.js`.)

**Plate competitions:** on a competition's Draws page press **Create … Plate**. Everyone who lost their first match (a first-round loser, or a second-round loser after a bye) is entered; press **Add those knocked out** again as more matches finish, then make the plate's draw like any other.

**Cup matches** work the same way: open Admin → Draws & results → **Scorecard** (or a captain of a team in the match can use the match page's **Start scoring** button). Press **Finish match** at the end and the winner moves into the next round.

**Match night photos:** the **home** team's captain or vice captain (and the admins) can add up to 12 photos to a match: My Team → Fixtures → **Photos**, or the match page → **Add match night photos**. They show on the match page and, automatically, under that week's news report (a News article with a league and "week ending" date; untick "Show match night photos" on the article to leave them out). Photos are shrunk before upload and aren't added to the image library.

Either team's captain can enter the scorecard for their match. A captain can only ever touch their own team's matches, and this is enforced by the database itself, not just hidden in the page.

---

## 3a. Competition entries, live draws, handicaps

**Entry form.** Under Admin → Competitions → Edit, tick **Open for entries on the website**, type the **entry fee** as you want it shown (e.g. `£5 per player`) and, if you like, the day entries close. The competition then appears on the entry form at `/enter` (there are buttons to it on the Competitions page and on the competition's own page). The form is step by step and needs no login:

1. **Who you are** — choose your team, then your name from the list of players (plus an optional phone number or email that only the competition secretary sees).
2. **Competitions** — tick one or more. A doubles competition asks for your partner; a team competition enters your team; a competition limited to one league only lets that league's players in.
3. **Check** — the entries and the total to pay.
4. **Pay** — the league's bank details (BACS) and the **pay-by date**.

The bank details, the introduction and the number of days allowed to pay are under **Admin → Site settings → Competition entry form**.

Each entry then waits under **Admin → Entries to approve** (a red number in the menu shows how many). When the competition secretary has seen the payment in the bank they press **Paid — approve** and the entrant is added to that competition's draw list. **Remove** deletes an entry; **Undo** takes an approved one back out. An entry that isn't approved by its pay-by date **lapses by itself** — it moves to "Lapsed" (where it can still be approved if the money turns up) and the player is free to enter again. Nobody can enter the same competition twice, and the database refuses entries for a competition that isn't open. Payment itself is never taken on the website: confirming it is always a person's decision.

**Live draw.** On Admin → Draws & results, each competition has a **Live draw** box. Set the date and time (it's shown on the competition page and in the home page strip beforehand) and press **Save the date**. On the night, the person making the draw logs in, types the name of the **witness** and presses **Start the live draw now**; each press of **Draw the next tie** then pulls the next tie out at random. Everyone watching sees it as it happens: on the public draw page (`/draw/<competition>`, which updates by itself), as a card in the home page's "Live & upcoming" strip ("Player A has drawn Player B"), as a green pop-up, and on the LIVE button. When the last tie is out the bracket is complete and the draw page keeps a record of when it was made, by whom and who witnessed it. Starting a draw closes that competition's entry form. The live draw makes the first-round draw (byes included); for "redraw every round" competitions the later rounds are still drawn from the same screen as before.

**Handicaps.** **Admin → Handicaps** lists every player with a box for their new handicap — type it and press Save. It's open to the **League Secretary and the Competition Secretary** (and the admins), and it changes only the handicap, not the rest of the player's profile. Every change is recorded with who made it, when, and an optional reason. For the **yearly review**, press **Start a new yearly review** first: today's figures are remembered as "last year", and from then on the public Handicaps page and player pages show a green ▲ or red ▼ with the difference beside anyone who has moved.

## 3b. Who can do what — roles & permissions

The dashboard is split into eight parts. **Master Admin → Roles & permissions** is a grid of tick boxes: each officer role across, each part down. A tick lets that role see that part in their menu and change what's in it. The Master Admin always has everything and is the only one who can open the grid.

| Part | What it covers |
|---|---|
| **Match nights** | Approve results, edit any scorecard, rearrange postponed matches, score a match on the live scoreboard |
| **Fixtures** | Add and edit fixtures, the fixture generator |
| **League** | Leagues, teams, players, venues, seasons |
| **Handicaps** | Change handicaps, run the yearly review |
| **Competitions** | Competitions, entries to approve, draws, cup scorecards, live scoreboard, presentation awards, key dates |
| **News & website** | News, categories, announcements, key dates, meetings, info pages and rules, sponsors, presentation awards, image library |
| **Settings & branding** | Site settings, home page, branding, result emails, statistics |
| **Logins** | Create, change and remove logins |

What each role starts with (press **Put back the standard permissions** to return to this):

| Role | Standard permissions |
|---|---|
| **Master Admin** | Everything, always — plus Roles & permissions, the Activity log and Backup |
| **League Admin** | All eight parts |
| **Competition Secretary** | Competitions, Handicaps |
| **League Secretary** | League, Handicaps |
| **Committee Member**, **President**, **Vice Chairman**, **Chairman** | News & website, Settings & branding |
| **Captain**, **Vice Captain** | Not in the grid: scorecards, postponing and match night photos for their own team; their own profile |
| **Player** | Not in the grid, and no tools: **My Snooker**, their own page for the teams and players they follow (section 3h — every other login has My Snooker as well). Linked to a player profile, they can also edit that profile |

Things worth knowing:

- **It is enforced by the database**, not just hidden in the menu (`can_manage()` and the `role_permissions` table in `schema.sql`). A section that isn't ticked can't be changed by typing its address either.
- **Logins:** someone with "Logins" ticked can only create or change logins for roles that are allowed no more than they are themselves, and never a Master Admin's. Only a Master Admin can make another Master Admin.
- **Import from CSV** needs Fixtures, League and Match nights together, because an import writes to all three.
- Some sections belong to two parts, and either one is enough: the **live scoreboard** (Competitions or Match nights), **presentation awards** and **key dates** (Competitions or News & website).
- A change takes effect the next time that person opens the website or logs in.
- Any officer who also plays can be given **Team rights** (Captain or Vice Captain) on their login, and then has **My Team** as well as the **Admin dashboard** in the panel behind the person icon.

When an officer is logged in, public pages show an **Edit this page** button (bottom left) that opens the right part of the dashboard — only if their role includes it. The menu shows, in small print under **My Team** (or **Admin**), who is logged in and their club.

### Master Admin tools

- **Activity log** — every add, change and removal in the dashboard, with who did it and when: "Rich Pearson changed fixture Bethel A v Bugle — status: submitted → approved". A whole import or generated fixture list is one line. Scorecard frames aren't listed one by one; a match shows as its status changing. The database writes the log itself, so it can't be edited; entries are kept for a year. "System" means it was done outside the website (the Supabase SQL editor).
- **Backup** — **Download full backup** saves one file with everything in the database (players, fixtures, scorecards, competitions, news, settings, logins' names and roles). Any single list can be downloaded as a spreadsheet (CSV) too. Passwords are never included, and the pictures themselves stay in Supabase Storage (the backup keeps their links). It's a copy for you to keep; it changes nothing on the site.
- **Maintenance mode** (Website → Site settings) — visitors see a holding page with your message; anyone logged in still sees the whole site, and captains can still log in to enter results.

## 3c. Importing from a spreadsheet (CSV)

**Admin → Import from CSV** brings in old seasons. For each kind of file the page lists the column headings, has a **template** to download, checks the file and shows exactly what will happen before anything is saved. Do them in this order:

1. **Teams** — `Team, League, Venue, Playing`
2. **Players** — `Name, Team, Position, Handicap, Birthday`
3. **Fixtures & results** — `Season, League, Date, Time, Home, Away, Venue, Score` (or `Home score` / `Away score`), `Status`. One row per match with the final score. A season that doesn't exist yet is created; a team that no longer exists is created as a *past team* (kept for the history, left out of this season's lists).
4. **Full scorecards** — `Season, League, Date, Home, Away, Frame, Home player, Home points, Away player, Away points, Home breaks, Away breaks`. One row per frame: this is what gives players their history, rankings and breaks for old seasons.

Dates are day-first (`24/09/2019`). Column order doesn't matter and extra columns are ignored. Importing the same file twice is safe. Old competitions aren't imported — create those under Admin → Competitions and type the results into the draw.

In a scorecard file, a player written as `Ben Rothwell (Ext)` is Ben Rothwell playing as the extra player, and `Extra Player` is a frame with no named player — that is how the old website wrote them.

**The real 2026-27 season** is in `real-data/2026-27/`, collected from the old website: 19 teams, 153 players in teams (plus 155 the old site lists without a team), the players' CueView answers, all 162 fixtures, the 18 bye weeks and the 26 matches played so far frame by frame. **`supabase/real-season-2026-27.sql` puts all of it in, in one go** — it takes the sample players, fixtures and results out, keeps the teams, venues and leagues (with their emblems), and loads the real season. Run `supabase/schema.sql` first, then that file, once. The folder's own `README.md` has the detail and `NOTES-from-the-old-site.md` lists everything odd that was found. (The same files can still be brought in by hand through Admin → Import from CSV.)

## 3d. Finals night: the live scoreboard

For a final (or any match worth watching), one person scores it ball by ball and everyone else watches the score move.

1. **Admin → Live scoreboard → Set up a match.** Choose the competition (optional), a round or title ("Final"), the two players — start typing and pick **any player from any team**, or type a name that isn't in the list — and the number of frames: best of 1, 3, 5, 7 or **9 (first to 5)**. A date and time shows it as "coming up" on the website.
2. Press **Score it**, then the name of whoever breaks off. The match is now **Live**: the menu's Live button turns green and it appears in the home page strip.
3. Press a **ball** each time one is potted. The pad adds the points to the player at the table, keeps the break, counts the reds and shows the points left ("needs snookers" when it comes to it). **End of break** passes the table to the other player. **Foul: 4 / 5 / 6 / 7 away** gives the points to the opponent. **Free ball potted** scores the ball "on" without taking a ball off the table.
4. **Undo** takes back the last press — as many times as needed, even ending a frame by mistake. **Put something right** has ±1 for either player and for the reds (a red potted on a foul stays down: −1). Tapping a player's name puts them at the table.
5. **End the frame** when it's over (or **Frame conceded: to …**). The players take turns to break. The match ends by itself when someone has enough frames.

Visitors open **`/scoreboard`** (also linked from the League page, the Live page and the home page strip). It needs no refreshing. On a laptop: keys **1–7** pot a ball, **Space** ends the break, **Backspace** undoes.

**The result goes into the draw by itself.** When you set the match up, choose the competition and then **Match in the draw**: the list shows every match of that competition's draw whose two players are known (singles and doubles; a team competition keeps its own scorecard). Choosing one fills in the players, the round and the number of frames. From then on:

- the draw shows the match as in progress, and the frame score is written in each time a frame ends;
- when the match is won, the result, every frame score and each player's breaks of 30 or more are in the draw, and the winner goes through to the next round — nobody types the scorecard in afterwards;
- **Undo** after the last frame takes the result back out of the draw again (unless the next round has already started: then change it under Draws & results);
- a frame that was **conceded** counts for the player it was given to, with the points as they stood.

A match scored without a link (a friendly, an exhibition) changes nothing in any draw. Forgot to link it? **All matches → Details → Match in the draw**: the draw is brought up to date as soon as you save. Who can use the scoreboard: anyone with **Competitions** or **Match nights** in Roles & permissions.

## 3e. Presentation night, key dates, meetings, rules and sponsors

**Presentation awards** (Admin → Presentation awards). One list per season. **Add the standard list** creates the league's 22 awards in order (the two leagues, Bill Toms, Doubles, Singles, Rees Singles, Handicap Doubles, Seniors, Team Handicap, Team Pairs, Willie Thomas, Gordon Boynton Trophy, Shootout, the highest breaks, the Melville Mills Award, players of the year, rankings winners and Rest of the League) and carries each trophy picture over from the season before. **Fill in from the results** works out every winner and runner-up the results can give — league titles, highest breaks, rankings winners and knockout competitions that have been played to a finish — and never touches an award that already has a winner. The rest are yours: pick a player or a team, or type a pair's names. Each award has a trophy picture, and a picture for the winner and the runner-up (otherwise the player's photo or the team's emblem is used). The list is in `STANDARD_AWARDS` in `public/js/core/awards.js`.

- **`/presentation`** shows the trophies and winners; **`/season-review`** is the season at a glance — the honours board, the numbers, each league's top three, top players and breaks, and the competition winners — and needs nothing typed in.

**Trophies.** A league (Admin → Leagues), a competition (Admin → Competitions) and an award can each have a trophy picture: a cut-out works best — a **transparent PNG or an SVG**. It shows beside the league's table, on the competition's page and card, in key dates, on the scoreboard and on presentation night. Until one is uploaded a gold placeholder cup stands in (`public/assets/trophy.svg`).

**Key dates** (Admin → Key dates): "20 October — round 1 of the Team Handicap starts". The next few show in the **Key dates** box on the home page and every one is on the calendar (and in the phone-calendar download). A date drops off by itself the day after it has passed. How many show — or whether the box shows at all — is in Site settings.

**Meetings** (Admin → Meetings → `/meetings`): add the AGM or a committee meeting before it happens (date, time, place, agenda) and it shows as the next meeting; afterwards add the minutes, typed in or as a **PDF** (5 MB at most). Untick "Show on the website" to keep a draft.

**Rules** (`/rules`): every info page ticked **Show on the Rules page** becomes a tab — for example "League Rules" and "Rules of the Game" — with a contents list made from its headings and a Print button.

**Formatted text.** Rules, info pages, minutes and sponsor pages are typed as plain text with a few marks (the form shows them, and has a **Preview** button):

```
# Heading                 ## Sub-heading
- bullet                  (two spaces first)  - sub-bullet
1. numbered               (two spaces first)  a. lettered sub-item
| Column | Column |       a table: one row per line, the first row is the headings
**bold**  *italic*  [link text](https://…)
```

**Sponsors.** Each banner at the bottom of the site opens that sponsor's own page (`/sponsor/…`), written under Admin → Sponsors: about them, a photo, address, phone, email and a button to their website.

**Player status** (Admin → Players → Status): *Playing*, *No team at the moment* (still in entry forms and the handicap list, in no team's list), *Not playing* and *Sadly no longer with us*. The last two leave team lists, scorecards and entry forms; results, breaks and the player's page stay. Players marked *Sadly no longer with us* are remembered on **`/in-memoriam`**, with the years and a few words of tribute if you add them.

**Celebrations.** Everyone on the site at that moment sees a few seconds of confetti in the ball colours and a card saying who did it when: a break comes in that is the new **highest of the season** in its league or competition; a **different team goes top** of a league table; there is a **new leader of the player rankings**; or a **competition is won** (its final is finished). Site settings → Celebrations has a switch for each of the four (and the highest break can be "of the week" as well). It is the change that is celebrated, as the result that causes it is entered — so it is seen by the people on the site at that moment, not by someone who opens it an hour later. Each visitor can switch celebrations off for themselves under the bell. Visitors who ask their device for reduced motion get the card without the confetti.

**Announcements in the feature box.** The coloured strip on the home page shows its own text and, when "Also show the announcements" is ticked, the announcements as well — scrolling like the ticker, or one at a time. The ticker's **speed** is a slider from 1 to 10.

**Text sizes** (Admin → Branding → Text sizes): the size in pixels of page titles, headings, box headings, tables, the menu, buttons and normal text. An empty box keeps the standard size.

## 3f. Result emails (Resend)

When a captain presses **Submit results**, the website can email the results secretary: the score, every frame, the breaks, who submitted it, a link to the photo and a button to **Results to approve**. One email per submitted card. Emails are sent through [Resend](https://resend.com) by a small server function (`netlify/functions/result-email.mjs`); the free plan (100 emails a day, 3,000 a month) is far more than a league needs.

**First, a test — about ten minutes, no domain needed**

1. Create a free account at <https://resend.com>, signing up with **the email address you want the test to arrive at**.
2. In Resend → **API Keys → Create API Key** ("Sending access" is enough). Copy it — it starts `re_` and is shown once.
3. In Netlify → **Site configuration → Environment variables**, add `RESEND_API_KEY` with that key and tick **Contains secret values**. Then **Deploys → Trigger deploy**.
4. On the website: **Admin → Result emails**. In **Send to** type the email address of your Resend account, press **Save**, then **Send a test email**. It arrives from `onboarding@resend.dev` within a minute (look in spam the first time).
5. For the real thing: tick **Send an email when a scorecard is submitted**, Save, then log in as a captain and submit a card. The email arrives; pressing Submit twice doesn't send two.

Until a domain is verified, Resend only delivers to the address of the Resend account itself. Any other address gets the message "Resend is still in test mode…" under the test button — that's the signal to do the next part.

**Then, the real domain — so it can email Rich and anyone else**

1. In Resend → **Domains → Add Domain**. Resend recommends a subdomain, for example `mail.stblazeydistrictsnooker.co.uk`, so the emails' reputation is kept apart from the main domain.
2. Resend shows a short list of **DNS records** (they prove the league owns the domain: SPF and DKIM). Add each one exactly as shown, wherever the domain's DNS is managed — the company the domain was bought from, or Netlify if the domain uses Netlify DNS. Don't change or remove any record that is already there.
3. Back in Resend press **Verify**. It usually takes a few minutes, sometimes a few hours.
4. In Netlify add `RESULTS_EMAIL_FROM`, for example `St Blazey Snooker League <results@mail.stblazeydistrictsnooker.co.uk>` — the part after the `@` must be the domain you verified. Optionally add `SITE_URL` (the website's address). Trigger a deploy.
5. In **Admin → Result emails** put the results secretary's address in **Send to** (one per line, up to 10), Save, and **Send a test email** again. Under the button it now says who it went to and which address it came from.

Handing over: the Resend account should end up belonging to the league. Either create it with a league email address from the start, or add Rich to the Resend team later and make a fresh API key (then replace `RESEND_API_KEY` in Netlify and delete the old key in Resend).

Good to know: the addresses are kept in a private table that visitors and captains can't read. An email problem never stops a result being submitted. If a card is sent back to the captain and submitted again, the email is sent again.

## 3g. Short web addresses

- A match is `/match/2627-14`: the season (2026-27) and a running number, given when the fixture is created. Existing fixtures were numbered in date order.
- A player is `/player/sam-bolitho`; two players with the same name become `sam-bolitho` and `sam-bolitho-2`. The address can be changed under Admin → Players → Web address.
- A cup match is `/cup-match/27`, a scoreboard match `/scoreboard/4`, a sponsor `/sponsor/their-name`.
- A season is `/seasons/2026-2027`; its lists are `/seasons/2026-2027/rankings/victory-league`, `…/breaks/…` and `…/league-tables/…`.
- **Old links keep working**: the long addresses open the same page and the address bar changes to the short one.

---

## 3h. My Snooker: your own version of the site

Modelled on "My Sport" on the BBC website. **Everyone with a login has it** — players, captains and officers. It adds a page; it takes nothing away: a captain still has My Team, an officer still has the dashboard, exactly as before.

- **Following.** A person follows as many **teams** and **players** as they like. The quick way is the **☆ Follow** button on any team or player page (pressed again, it unfollows). Someone who is not logged in is shown the login panel.
- **What they see.** Thirteen sections, each one ticked or unticked: Next match, Team summary, Results, Fixtures, Competitions, Team news, Latest news (all of it, or only the news categories they pick), Team & handicaps, Players I follow, Breaks, League table, Rankings and CueViews. A section with nothing to show leaves no gap. With more than one team followed, buttons along the top switch between them.
- **Where it shows.** Their choice of three: **on my own page** (`/myteam`), **on the home page** (their block sits above the normal home page), or **both**.
- **Where it is set up:** My area → **My Snooker** (`/my/snooker`; the person icon in the menu bar → *My Snooker settings*). One form: on/off, where it shows, teams, players, sections, news categories, **Save my choices** and **Reset**.
- **Starting point.** A login linked to a team or a player starts off following them. One linked to nobody is asked to pick a team the first time (`/myteam`).
- **After logging in:** officers land on the dashboard and captains on My Team, as before. A plain **Player** login lands on their page (or on the home page, if that is where they chose to see it).
- **Coming back later** still logged in, the site opens on their page once per visit when they chose "my own page"; after that Home is the normal home page. On the home page a dark bar, **My Snooker: back to my page**, takes them back.
- **A Player login needs no link** to a player or a team (Admin → People → Logins → Add new, role **Player**). Link it to a player profile only if that person should also edit their own photo, bio and CueView.

The choices are saved with the login, so they follow the person from phone to computer. Where it is in the code: `core/my-snooker.js` (the sections and the Follow button — add a section there), `pages/myteam.js`, the My Snooker tab in `pages/my.js`, `myPrefs()` and `homeFor()` in `core/auth.js`, and `set_my_prefs()` in `schema.sql` (the only thing a login may change about itself; saved in `profiles.my_prefs`).

## 3i. Merchandise, and the CueView form

**Merchandise** (`/merchandise`, a tile on the League page). Admin → Website → **Merchandise**: each item has a name, a price as you want it shown ("£18", "from £12"), a picture, a description, options with commas between them ("S, M, L, XL") and an optional link to order it. Untick "Show on the website" to hide one for now. Nothing is paid for on the website: write who to speak to and how to pay under Site settings → **Merchandise page** → "How to order".

**CueViews** can reach a player's page in three ways:

1. **The form on the website** (`/cueview`, linked from the League page and from every player page that has no CueView yet). The player picks their name, answers as many questions as they like and sends it. It does **not** appear straight away.
2. **Admin → League → CueViews to approve** (a red number in the menu shows how many are waiting). Read it, check **whose profile** it belongs to — it is already chosen if the name matches a player — and press **Approve**: the answers go onto that player's page. Answers they left empty do not wipe what is already there. **Remove** throws it away.
3. As before: a player with a login linked to their profile edits it themselves (My area → Profile), and an officer can type it in under Admin → Players.

Visitors cannot upload pictures on the form (only people with a login can), and nothing a visitor sends is public until it is approved.

## 3j. The menu bar, side panels, news and the other site-wide pieces

**The menu bar** stays at the top of the screen as the page scrolls (it gets a little slimmer once you have scrolled down a little, and goes back to full size near the top; the page underneath never moves when it changes size — `measureHeader()` in `main.js` explains how). On the right, in this order: the **person**, the **bell**, the **search** glass — and on phones the menu button, which opens the menu over the **whole screen**.

- **The person** opens a panel from the right. Logged out it is the login form (there is no separate Login button; `/login` still works). Logged in it shows the person's initials and their links: My Snooker, My Team, Admin dashboard, My Snooker settings, My profile, Password & details and a red **Log out**.
- **The bell** opens the notifications panel: a master switch, then a slider for each kind of pop-up — Results, Breaks, News, Tables & rankings, Competitions, New players — and one for Celebrations (the confetti). The choices are remembered on that phone or computer (no login needed). The kinds are the `NOTIFY_KINDS` list in `core/notify.js`.
- **Add to your home screen** is in the person's panel. On Android and in Chrome it offers the install prompt; on an iPhone it shows the three steps (Share → Add to Home Screen). The name, colours and icons come from `public/manifest.webmanifest` and `public/assets/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `apple-touch-icon.png` (180 × 180). **These four were made from the placeholder logo — replace them with the league's real badge**, keeping the same names and sizes (the "maskable" one needs the badge inside the middle 80%, as phones crop it to a circle).

**Getting about.** Public pages have a **← back** link in place of the breadcrumb trail (it goes to the page above: a team → its league, an article → News). The dashboard and the My area keep the trail. On phones a white round **↓** button scrolls a screen down, and a white round **↑** takes you back to the top (on every screen size once you have scrolled).

**News.**

- **Featured news** — the big boxes at the top of the News page (one large, three beside it). Tick **Featured news** on an article (Admin → News → Edit). Fewer than four ticked: the newest articles fill the rest.
- **Categories** — an article has a main category and, under **More categories**, as many others as you like; it is listed under each of those tabs.
- **By and date** — every article shows "By: … · Date: …". **Written by** on the article, or the standard name under Site settings → News → *Articles are by*.
- **Video** — paste a YouTube or Vimeo link, or the link to an .mp4 file, into **Video**. It plays under the opening paragraph; type `[video]` on its own line in the text to put it somewhere else.
- **Share** — every article has share buttons (the phone's own share sheet, copy link, WhatsApp, Facebook, X, email).
- **Related news** is a strip of cards you slide along, at the bottom of articles and competition pages.

**Sidebars that know where they are.** A page with a sidebar (Admin → Branding → Page layout) fills it with what belongs to that page: a competition shows that competition's highest break, breaks, latest results, key dates and news; a team, player, match or league page shows that league only — its table with the team picked out, the team's news, and the standard boxes for that league; News shows the latest articles and the categories. Anything else gets the standard boxes. It is all in `core/side.js`; a page says what it is about with `sideContext({ competition })` (or `team`, `player`, `league`).

**Won and lost.** Everywhere — league results, competition draws, round cards, match pages, the frame-by-frame bars — a win is green and a loss is red (no more gold for cup winners). A team's fixtures have a **Won / Lost** column and the score of a finished match has a coloured background. Handicaps: plus is green, minus is red, scratch (0) is plain. The two colours are `--win` and `--loss` at the top of the v11 block in `style.css`.

**The calendar** (`/calendar`) is one long page: a strip of months that follows you as you scroll, every day with a date tile, and each match, key date or meeting with its buttons (Match preview, Result & scorecard, Venue). The team filter and the phone-calendar download are still there.

**The dashboard.** Every list has a pager, "1–50 of 116 ‹ ›", so you can page through everything as well as search. The boxes on the overview (Teams, Players, Fixtures, Approved, Awaiting approval, Live now) open the matching list. The menu is as long as its items: nothing in it is hidden and nothing inside it scrolls. On a long page it follows you down — at the top of the screen when it fits, otherwise it moves with the page until its last item is in view.

## 4. Scoring rules (all in `public/js/core/rules.js`)

| Rule | Current setting |
|---|---|
| Team league points | 1 point per frame won (a 3–2 win = 3 pts, a 2–3 loss = 2 pts, matching the current site) |
| Player ranking points | 5 per frame won, plus break points |
| Extra (Ext) frames | The team gets its 1 point for the frame win. The player gets nothing for it: no ranking points, no break points, and it is not in their frames played (`extCountsForRanking`). As on the old website, and confirmed by Rich (October 2026) |
| Break points | 30–39 = 3, 40–49 = 4, … 140 and over = 14 (below 30 = 0) |
| Highest break allowed | 155 (`MAX_BREAK`) |
| Table order | Points, then wins, then frame difference; teams level on all three share a position |
| Bye weeks | A league with an odd number of teams: one team has no match each night. Shown in that team's fixtures and on the calendar; never counted. Admin → Bye weeks (the fixture generator adds them) |

If Rich confirms a different team rule (for example 3 points for a win), change the one line inside `teamMatchPoints()`. The whole site follows automatically.

---

## 5. How the code is organised

```
public/                     ← everything Netlify serves
  index.html                ← the only HTML page (the app shell)
  css/style.css             ← all styling; colours are variables at the top
  manifest.webmanifest      ← name, colours and icons for "Add to home screen"
  assets/                   ← logo.svg, avatar.svg, trophy.svg (placeholder cup), hero.jpg (home page photo), icon-*.png + apple-touch-icon.png (home-screen icons)
  js/
    config.js               ← Supabase keys + site name  ← EDIT THIS
    main.js                 ← header, footer, and which page to show for each URL
    core/
      rules.js              ← ALL scoring maths
      api.js                ← ALL database reads/writes
      context.js            ← turns raw data into tables/rankings for pages
      components.js         ← ALL reusable tables, panels, cards, sidebar
      auth.js               ← login + "who can edit what" (UI side)
      branding.js           ← turns Admin → Branding (colours, fonts, text sizes, page layouts, loading screen) into CSS variables
      markup.js             ← formatted text: headings, bullets, sub-bullets and tables typed as plain text (rules, minutes, info pages)
      live-score.js         ← the rules for scoring a match ball by ball (no HTML, no database)
      awards.js             ← the presentation awards: the standard list and what the results say the winners are
      celebrate.js          ← confetti and card: a new highest break, new leaders, a competition winner
      terms.js              ← lists of words used in more than one place (meeting types, player statuses)
      list-field.js         ← the "add as many as you like" field (past teams)
      dom.js                ← safe HTML helper, dates in UK time, toasts
      schedule.js           ← round-robin fixture generator + date helpers
      bracket.js            ← knockout draw + who-plays-whom logic (no HTML)
      bracket-view.js       ← draws the bracket roadmap, round cards, standings
      upload.js             ← shrinks and uploads images (and adds them to the library)
      scorecard-editor.js   ← the one scorecard editor used for league AND cup matches (step-by-step + classic views)
      search.js             ← the search pop-up
      csv.js                ← CSV import: reads the file and works out what to add (no database)
      cueview.js            ← the CueView questions (add/reword one here)
      notify.js             ← live pop-up notifications: the kinds (NOTIFY_KINDS), each visitor's choices, when to celebrate
      my-snooker.js         ← My Snooker: the sections, the Follow button, and the block drawn on /myteam and the home page
      drawers.js            ← the side panels: login / My account, notifications, add to home screen
      side.js               ← the sidebar that follows the page (a competition's, a league's, the news)
      db.js                 ← picks real Supabase or the demo database
      demo-client.js        ← the in-browser demo database
      router.js             ← navigate() / setTitle() for pages; sideContext() tells the sidebar what the page is about
    pages/                  ← one small file per page (home, team, match, seasons, players, myteam, merchandise, cueview, …)
    admin/
      resources.js          ← describes each admin section (add a field = add a line)
      crud.js               ← one list/search/form engine used by every section
      draws.js              ← entrants, byes, draws and results for a competition
      picker.js             ← the image library and "choose from library" pop-up
      stats.js              ← the statistics dashboard
      import.js             ← the Import from CSV screen
      handicaps.js          ← the Handicaps screen (quick changes, yearly review, change log)
      entries.js            ← Entries to approve (competition entry form)
      roles.js              ← Roles & permissions grid (Master Admin)
      activity.js           ← Activity log (Master Admin)
      backup.js             ← Backup downloads (Master Admin)
      awards.js             ← Presentation awards (the season list and its two tools)
      scoreboard.js         ← Live scoreboard: setting a match up, the ball-by-ball control pad, and writing the result into the draw
      cueviews.js           ← CueViews to approve (sent in on the /cueview form)
      emails.js             ← Result emails: who gets them, and the test button
    demo/seed-data.js       ← sample league (imaginary players)
supabase/
  schema.sql                ← tables + security rules + image storage (safe to re-run)
  seed.sql                  ← optional sample data (generated: npm run seed)
  real-season-2026-27.sql   ← the real 2026-27 season: sample league out, real one in (generated: npm run real-season)
  remove-sample-data.sql    ← deletes the sample data again
  add-richard-pearson.sql   ← adds Rich as a player (run once)
netlify/functions/
  admin-users.mjs           ← creates/updates/deletes logins (server-side)
  result-email.mjs          ← emails the results secretary when a card is submitted (through Resend)
netlify/lib/
  result-email-template.mjs ← what that email says
real-data/2026-27/          ← the real season collected from the old website (see its README)
scripts/
  build-seed.mjs            ← writes supabase/seed.sql from the sample data
  build-real-season.mjs     ← writes supabase/real-season-2026-27.sql from real-data/2026-27/
netlify.toml                ← Netlify settings (publish folder, URL routing, headers)
```

**Don't repeat yourself.** Each thing has exactly one home:

- Scoring → `rules.js`.
- Queries → `api.js`.
- Visual building blocks → `components.js`.
- Admin sections → config in `resources.js`, not separate pages.

For example, to add a "phone" field to venues, add one line to `RESOURCES.venues.fields`, then add the column with `alter table venues add column phone text;`.

## 6. Common changes

| I want to… | Edit |
|---|---|
| Use the real logo / favicon / loading logo | Admin → Branding → Logos |
| Change a menu button's colour (and its section's headers) | Admin → Branding → Menu and section colours. Tick "Use my own colour" and pick; untick to go back to the standard one |
| Stop sections using their menu colour for headers | Admin → Branding → untick "Colour-code each section" (headers go back to the main colour) |
| Change the background colour of the whole site | Admin → Branding → Other colours → **Page background** (the main colour is there too) |
| Change the fonts | Admin → Branding → Fonts |
| Change which league teams go up to or down to (the green top row, the pink bottom row and the arrows in the league tables) | Admin → Leagues → **Display order**: 1 is the highest league. The bottom team of every league but the lowest is shown in the relegation place, the top team of every league but the highest in the promotion place. The colours are `--lt-top`, `--lt-down` and `--lt-mine` in the v12 block at the end of `public/css/style.css`; the rules are `leagueMarks()` in `public/js/core/components.js` |
| Give a part of the site a right sidebar, or make it full width | Admin → Branding → Page layout. One choice each for Home, Competitions, Fixtures, League and News: **Standard** (as designed), **Right sidebar on every page** (pages without side boxes get the standard ones), or **Full width on every page** (a page's own side boxes move underneath) |
| Put sidebars on the left | Admin → Branding → Page layout → Which side a sidebar goes on |
| Use a Google font that isn't in the lists | Admin → Branding → Fonts → paste the font's embed link from fonts.google.com ("Get font" → "Get embed code"). Its fonts join both lists straight away; choose them and Save |
| Turn the loading screen off, or keep it up longer | Admin → Branding → Loading screen (on/off, and the minimum seconds it shows when the site is first opened) |
| Put an article in the big boxes at the top of the News page | Admin → News → Edit → tick **Featured news** |
| List an article under more than one News tab | Admin → News → Edit → More categories |
| Add a video to an article | Admin → News → Edit → Video (YouTube, Vimeo or .mp4 link); `[video]` on its own line places it |
| Change who articles are "By" | Admin → News → Edit → Written by; the standard name is in Site settings → News |
| Change the order of the tabs on the News page | Admin → News categories → Edit → "Position" (1 = first). The cards themselves are in `public/js/pages/news.js` (12 at a time: `PAGE`) |
| Add, change or hide something on the Merchandise page | Admin → Website → Merchandise; the words at the top and "How to order" are under Site settings → Merchandise page |
| Change the CueView questions | `public/js/core/cueview.js` — the public form, the profile form and the player page all follow |
| Give a player a login | Admin → People → Logins → Add new → Role: Player (no player or team needed) |
| Follow a team or a player | The ☆ Follow button on its page, or My area → My Snooker |
| Add, change or stop an announcement in the ticker | Admin → Announcements. The ticker's on/off switch and speed (1–10) are in Site settings → Announcements ticker |
| Show (or stop showing) announcements in the home page's feature box | Admin → Site settings → Home page: feature box → "Also show the announcements" and "When there is more than one message". One announcement can be left out under Announcements → Edit |
| Add a key date | Admin → Key dates |
| Upload a trophy picture | Admin → Leagues / Competitions / Presentation awards → Edit → Trophy (transparent PNG or SVG) |
| Set up presentation night | Admin → Presentation awards → choose the season → Add the standard list → Fill in from the results → fill in the rest |
| Score a final ball by ball | Admin → Live scoreboard |
| Add the minutes of a meeting | Admin → Meetings → Edit → Minutes (typed) or the PDF |
| Add or change the rules | Admin → Info pages & rules → tick "Show on the Rules page" on each set of rules |
| Write a sponsor's page | Admin → Sponsors → Edit → The sponsor's page |
| Mark a player as not playing, without a team, or no longer with us | Admin → Players → Edit → Status |
| Change the size of headings, tables or the menu | Admin → Branding → Text sizes |
| Switch a celebration off (highest break, new league leaders, new rankings leader, competition winner) | Admin → Site settings → Celebrations — one switch each |
| Add a kind of notification to the bell's panel | `NOTIFY_KINDS` in `public/js/core/notify.js` |
| Add or reword a My Snooker section | `SECTIONS` in `public/js/core/my-snooker.js` |
| Change what a page's sidebar shows | `public/js/core/side.js` |
| Use the real badge as the phone home-screen icon | Replace `public/assets/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `apple-touch-icon.png` (same names and sizes) |
| Change the green and red used for won and lost | `--win` and `--loss` in `public/css/style.css` (v11 block) |
| Show 25 or 100 rows per page in a dashboard list | `PAGE_SIZE` in `public/js/admin/crud.js` (or `pageSize` on one section in `resources.js`) |
| Choose who is emailed when a card is submitted | Admin → Result emails |
| Change the News menu button's colour | Admin → Branding → Menu and section colours → News (standard: blue) |
| Choose what the side column's top box shows | Admin → Site settings → Side column: top box (latest league results, competition results, both, latest news, or nothing; heading; how many; one league) |
| Decide what a role can see and do | Admin → Roles & permissions (Master Admin) |
| See who changed something | Admin → Activity log (Master Admin) |
| Download a backup | Admin → Backup (Master Admin) |
| Take the public site down for a while | Admin → Site settings → Maintenance mode |
| Add a player's past teams | Admin → Players → Edit → Past teams (**+ Add another past team**), or the player under My Team → Profile |
| Open a competition for entries, set its fee | Admin → Competitions → Edit → Entry form |
| Bank details and days allowed to pay | Admin → Site settings → Competition entry form |
| Confirm someone has paid | Admin → Entries to approve → Paid — approve |
| Make a draw live | Admin → Draws & results → Live draw |
| Change a handicap / start the yearly review | Admin → Handicaps |
| See past seasons | League → Seasons (`/seasons`) for each season's own pages; League → Season archive (`/archive`) for the roll of honour |
| Add or move a bye week | Admin → Fixtures → Bye weeks |
| Let extra (Ext) frames count for the player's ranking | `extCountsForRanking` in `public/js/core/rules.js` |
| Change the home page banner photo | Admin → Site settings & home page → Home page banner background |
| Choose which news rotates in the banner | Admin → News → tick "Show in the home page banner" (newest 4 are shown; change the number in Site settings) |
| Player / team of the week, CueViews on the home page | Admin → Site settings & home page; pick CueViews under Players → "Show this CueView on the home page" |
| Add a CueView question | One line in `public/js/core/cueview.js` |
| Put the quote somewhere else in an article | Type `[quote]` on its own line in the article text |
| Footer: partner logos | Admin → Sponsors (they appear under "Principal Partners") |
| Footer: Facebook / X / Instagram / YouTube links | Admin → Site settings & home page → Social links (an icon only shows when its link is filled in) |
| Footer: which links are in the bottom menu (Privacy Policy, Contact Us…), and their order | Admin → Site settings → **Footer** → "Links in the bottom menu": pick the website's pages as you type, or type `What it says \| where it goes` (a web address or an email address works too). Left empty, every info page ticked "Show as a link in the footer" is shown |
| Footer: the text of Privacy Policy, Terms, Accessibility, About, Contact Us | Admin → Info pages — edit the text; "Show on the League page" puts a tile on the League page |
| Footer: the copyright line and the credit after it | Admin → Site settings → **Footer** → "Copyright line", "The credit" and where it links to (untick "Show a credit" to leave it out). The © and the year are added for you |
| Give a player a login for their own profile | Admin → Logins → Add new → role **Player**, and pick their player profile |
| Let a captain edit their own profile too | Admin → Logins → Edit → pick their player under "Player profile" |
| Tag a news article to players ("Player news") | Admin → News → Edit → "Players this article is about" |
| Bio, career history, past teams, pictures | The player does it under My Team → Profile, or Admin → Players → Edit |
| The "NEW" strip on the home page | Admin → Site settings → Home page: feature box (label, text, link, colour) |
| What the home page's Latest News box shows | Admin → Site settings → Home page: Latest News box |
| A CueView with someone who isn't a league player | Admin → News → Edit → CueView interview (tick "Show on the home page" to feature it) |
| Which leagues a competition is open to | Admin → Competitions → Edit → Open to |
| A "play by" date for each round | Admin → Draws & results → 3. Round deadlines |
| A plate competition | Admin → Draws & results → Create … Plate |
| Emblems for teams, leagues and venues | Admin → Teams / Leagues / Venues → Edit |
| File library pictures into categories | Admin → Image library (list under each picture) |
| Add sponsors, news, rules pages | Admin dashboard (no code) |
| Create next season's fixtures | Admin → Seasons (add, tick "current"), then Admin → Fixture generator |
| Add a new league | Admin → Leagues → Add new, then add its teams and generate its fixtures. It appears on the home page, fixtures page and League page automatically |
| Run a cup / singles / doubles competition | Admin → Competitions → Add new (choose "bracket" or "redraw every round"), then Admin → Draws & results: add entrants, press **Random draw**, score matches live with **Scorecard** or just type the result. Any slot can be changed by hand, including byes |
| Add a player photo | Admin → Players → Edit → Upload image or Choose from library (shown as a circle) |
| Add a picture gallery to a page or venue | Admin → Info pages / Venues → Edit → Add from library / Upload pictures |
| See how many people visit | Admin → Statistics |

## 7. Updating the site later

When you get new code files:

1. **Keep your own `public/js/config.js`.** The new copy has empty keys, so don't overwrite yours.
2. Replace the other files in your repo, then commit and push. Netlify redeploys on its own.
3. If `supabase/schema.sql` changed, run it again in the SQL Editor. It only adds what's missing and never deletes your data.
   Each new function also needs its environment variables in Netlify (result emails: `RESEND_API_KEY` — section 3f).
4. **Don't run `seed.sql`, `remove-sample-data.sql` or `real-season-2026-27.sql` again.** An update never needs them. `real-season-2026-27.sql` puts the season back as it was on 8 October 2026, so a second run would wipe every result entered on the website since. `remove-sample-data.sql` deletes the sample players, teams, venues and articles — together with any photos, emblems or details you attached to them — and `seed.sql` puts back blank ones. Only use them if you deliberately want to reset the sample league.
5. Netlify redeploys the logins function on its own when you push — nothing to do there. If you upload by drag and drop instead, upload the **whole project folder** (not only `public`), or the functions are not updated.

## 8. Security checklist before launch

- [ ] Public sign-ups turned **off** in Supabase (step 2a.4).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are only in Netlify environment variables, never in any file.
- [ ] Test it: Admin → Result emails → Send a test email arrives; then submit a card as a captain and check the email.
- [ ] Test it: log in as one captain, then try to open another team's scorecard URL. It should say "Scorecard locked".
- [ ] Test it: as a captain, try **Submit results** without a photo. It should be refused.
- [ ] Test it: log in as an officer (e.g. a Committee Member) and open `/admin/fixtures`. It should say the login doesn't include that part.
- [ ] Open **Roles & permissions** as the Master Admin and check each role only has what you want. Keep the number of Master Admins small.
- [ ] Download a **backup** once the real data is in.
- [ ] Test it: as the away captain, open a match page. There should be no "Add match night photos" button.
- [ ] Test it: enter a competition on `/enter` without logging in, then check it appears under Admin → Entries to approve and nowhere on the public site except as a name "waiting for payment".
- [ ] Give each captain their own login, and ask them to change their password under **My Team → User details**.

Players' names, scores and breaks are public, as they are on the current site. Login emails are only visible to the admin. The contact details typed into the entry form are only visible to the competition secretary and the admins.

The entry form is open to anyone (no login), like a paper form on a club noticeboard: someone could enter another player's name. Nothing happens until the competition secretary approves it, so a bogus entry is simply removed, or lapses on its own.

**The loading screen.** While a page is loading, the screen is black with the logo pulsing in the middle (the loading logo from Admin → Branding, or the main logo). It can be switched off, or made to stay up for a set number of seconds when the site is first opened (Admin → Branding → Loading screen). The colours and logo are remembered in each visitor's browser, so their second visit shows the right ones from the first instant.
