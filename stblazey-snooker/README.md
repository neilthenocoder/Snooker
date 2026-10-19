# St Blazey & District Snooker League — website

A fast, plain HTML/CSS/JavaScript website (no build step) with:

- **Public site**: home page with a rotating news banner, live & upcoming match strip, league tables, shield holders, player/team of the week and CueViews; fixtures and results, a **calendar** (with phone-calendar download), team pages, **player pages with CueView**, match scorecards, venues with maps and galleries, news with weekly round-ups, **knockout competitions with a live bracket and live cup scorecards**, standings, handicaps and a **Live** page.
- **Live extras**: the LIVE button pulses orange ("LIVE SOON") an hour before matches and green while they're on; green pop-ups announce frame wins, breaks, news, new leaders, competition winners and new players. The league can send its own **notifications** — breaking news, important updates, offers — which pop up and wait behind the bell with a red number. The **bell** opens a side panel where each visitor switches each kind on or off (section 3j).
- **Members' area** (My Team · Manage team · Fixtures · Profile · User details · Competitions): captains and vice captains enter scorecards frame by frame on match night — a **step-by-step view made for phones**, the classic full card, or **ball by ball** with everyone watching. Before the night they pick their players under **Manage team** (section 3k). Each save updates the live page for everyone, straight away. Every player can have a login to edit **their own profile** (photo, bio, career history, pictures, CueView).
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
- **Emails**: the results secretary (and the Master Admin, always) is emailed as soon as a captain submits a card, the captains and vice captains of both teams get a copy of their card, and the competition secretary is emailed each new competition entry (through Resend — see section 3f).
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
3. Run **`supabase/real-league.sql`** the same way: it loads the real league (leagues, teams, venues, players, the 2026-27 fixtures and the results on record) and clears out any test data. See section 3c.
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
   - **Ball by ball** (the third choice on the switch, league matches only — and **only for people given "Live scoring"** under Admin → Roles & permissions: officers who have it, and captains and vice captains only if it is ticked for them; it is off for them to start with) is the step-by-step card with a **scoring pad** in place of the score boxes: press who breaks off, then a ball each time one is potted, **End of break** on a miss, the foul buttons, and **End the frame**. The match shows as live from the first press. Visitors watch that frame on the Live scoreboard (the home page strip, the Live page and the match page all link to it), and when the frame ends its score and every break of 30 or more are put on the card for the captain. The three views can be mixed: score one frame on the pad and type the next. A frame that was started on the pad and left is no longer shown as live after three hours, or as soon as the card is submitted.
3. **Admin** opens **Results to approve**, checks the scorecard and its photo, and presses **Approve**. Approved results are locked for captains, but the admin can still edit them.

Tables and rankings count **submitted** and **approved** results. To make tables move live during the evening instead, add `"in_progress"` to `countedStatuses` in `public/js/core/rules.js`.

**Checks on the card:** a break is 1–155 (147, or up to 155 with a free ball); a player's breaks in a frame can't add up to more than their frame score; a frame can't be tied.

**Postponed matches:** a captain or vice captain presses **Postpone** next to the match under My Team → Fixtures (before it starts), or the admin opens its scorecard and presses **Mark postponed**. Players and visitors can't. It shows as "P - P" on the site and is left out of the tables. Both captains then see a reminder on their My Team page that it must be re-arranged **within 3 weeks**, with the date (`POSTPONE_WEEKS` in `rules.js`). The admin gives it a new date under **Admin → Results to approve → Postponed** and presses **Rearrange**; anything past the 3 weeks is flagged on the admin Overview.

**New players added by captains** (from Manage team or the scorecard) show up on the admin Overview and with a red count next to **Players** in the menu. In the Players list they sit at the top, marked **NEW**, each with **Accept** and **Reject**. The captain can pick them straight away; the league has the final say. **Accept** (or saving the player, e.g. after setting the handicap) clears the mark. **Reject** turns the request down: a brand-new player is removed (and comes off any card or team sheet), someone who was already on the website with no team goes back to having no team. Players the admin adds are never marked.

**The Players list** in the dashboard shows 50 players at a time, with ‹ › arrows to move on (`pageSize` on the players section in `admin/resources.js`). Search and the team filter look through every page.

**The weekly shield:** set each league's shield name, the holder at the start of the season and — if you have one — a **picture of the shield** under Admin → Leagues → Weekly shield (a cut-out picture with a clear background looks best; a gold shield is drawn until you add one). The picture is shown small beside the holders on the home page and on the shield's own page. From then on it's automatic: the holder's match each week is the shield match (shown on the scorecard and match page), and if they lose, the winners take it. The home page shows who holds it. Each shield has its own **history page** (`/shield/victory-league`, linked from the home page box, the league table and the League page): the current holders, who has won it most, and every shield match of the season in order.

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

**The real league** (round 27) is in `real-data/2026-27/`: the 2 leagues, 19 teams and venues, the league's players list (153 players in their teams — the list Rich sent, checked against the old website), all 162 fixtures, the 18 bye weeks and the 26 matches on record frame by frame, plus the CueViews of the 12 listed players who had one on the old website. **`supabase/real-league.sql` puts it in, in one go** (run `supabase/schema.sql` first). It clears out everything that was there for testing — every other player (and the photos, bios and CueViews of the listed ones), every fixture and scorecard, every news article, other seasons, leagues, teams, venues and competitions — and keeps logins, emblems, pages, sponsors, settings and branding. Whatever isn't on record yet is left empty and the website shows **“Not updated yet”**: the 4 handicaps not on record, the other CueViews, bios and stats, and every match whose night has gone by without a result (they wait for the league to add them). Rebuild the file after changing the CSVs with `npm run real-league`.

## 3d. Finals night: the live scoreboard

For a final (or any match worth watching), one person scores it ball by ball and everyone else watches the score move.

**Who can.** Anyone whose role has **Live scoring** ticked under Admin → Roles & permissions — to start with the League Admin and the Competition Secretary (and the Master Admin, always). It is the one permission that can also be ticked for captains and vice captains; ticked for them, it gives them the Ball by ball view on their own team's scorecards and nothing else (not this page, not the dashboard). The database keeps to the same rule.

1. **Admin → Live scoreboard → Set up a match.** Choose the competition (optional), a round or title ("Final"), the two players — start typing and pick **any player from any team**, or type a name that isn't in the list — and the number of frames: best of 1, 3, 5, 7 or **9 (first to 5)**. A date and time shows it as "coming up" on the website.
2. Press **Score it**, then the name of whoever breaks off. The match is now **Live**: the menu's Live button turns green and it appears in the home page strip.
3. Press a **ball** each time one is potted. The pad adds the points to the player at the table, keeps the break, counts the reds and shows the points left ("needs snookers" when it comes to it). **End of break** passes the table to the other player. **Foul: 4 / 5 / 6 / 7 away** gives the points to the opponent. **Free ball potted** scores the ball "on" without taking a ball off the table.
4. **Undo** takes back the last press — as many times as needed, even ending a frame by mistake. **Put something right** has ±1 for either player and for the reds (a red potted on a foul stays down: −1). Tapping a player's name puts them at the table.
5. **End the frame** when it's over (or **Frame conceded: to …**). The players take turns to break. The match ends by itself when someone has enough frames.

Visitors open **`/scoreboard`** (also linked from the League page, the Live page and the home page strip). It needs no refreshing. On a laptop: keys **1–7** pot a ball, **Space** ends the break, **Backspace** undoes.

**Live text.** On the pad — under the ball buttons while a frame is on, and there before the match starts too — is a blue-edged **Live text** box: type what is happening ("Great long red to get in") and press **Post**. The line appears under the public scoreboard (`/scoreboard/<number>`, the "see it" link in the box) for everyone watching, newest first, with the time and the frame. The × beside a line takes it back. Undo never removes live text. A match keeps its last 150 lines.

It is in two places: here (**Admin → Live scoreboard → Score it**), and on a **league scorecard's "Ball by ball" view when an admin is the one scoring** — captains score ball by ball without the text box, because live text is the league's voice. To let captains write it too, change `liveText: admin ? … : null` to always give the link in `pages/scorecard.js`. The box and its rules are in `core/live-text.js`.

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

## 3f. Emails: results and competition entries (Resend)

When a captain presses **Submit results**, the website can email the results secretary: the score, every frame, the breaks, who submitted it, a link to the photo and a button to **Results to approve**. One email per submitted card. Emails are sent through [Resend](https://resend.com) by a small server function (`netlify/functions/result-email.mjs`); the free plan (100 emails a day, 3,000 a month) is far more than a league needs.

**First, a test — about ten minutes, no domain needed**

1. Create a free account at <https://resend.com>, signing up with **the email address you want the test to arrive at**.
2. In Resend → **API Keys → Create API Key** ("Sending access" is enough). Copy it — it starts `re_` and is shown once.
3. In Netlify → **Site configuration → Environment variables**, add `RESEND_API_KEY` with that key and tick **Contains secret values**. Then **Deploys → Trigger deploy**.
4. On the website: **Admin → Emails**. In **Send to** type the email address of your Resend account, press **Save**, then **Send a test email**. It arrives from `onboarding@resend.dev` within a minute (look in spam the first time).
5. For the real thing: tick **Send an email when a scorecard is submitted**, Save, then log in as a captain and submit a card. The email arrives; pressing Submit twice doesn't send two.

Until a domain is verified, Resend only delivers to the address of the Resend account itself. Any other address gets the message "Resend is still in test mode…" under the test button — that's the signal to do the next part.

**Then, the real domain — so it can email Rich and anyone else**

1. In Resend → **Domains → Add Domain**. Resend recommends a subdomain, for example `mail.stblazeydistrictsnooker.co.uk`, so the emails' reputation is kept apart from the main domain.
2. Resend shows a short list of **DNS records** (they prove the league owns the domain: SPF and DKIM). Add each one exactly as shown, wherever the domain's DNS is managed — the company the domain was bought from, or Netlify if the domain uses Netlify DNS. Don't change or remove any record that is already there.
3. Back in Resend press **Verify**. It usually takes a few minutes, sometimes a few hours.
4. In Netlify add `RESULTS_EMAIL_FROM`, for example `St Blazey Snooker League <results@mail.stblazeydistrictsnooker.co.uk>` — the part after the `@` must be the domain you verified. Optionally add `SITE_URL` (the website's address). Trigger a deploy.
5. In **Admin → Emails** put the results secretary's address in **Send to** (one per line, up to 10), Save, and **Send a test email** again. Under the button it now says who it went to and which address it came from.

Handing over: the Resend account should end up belonging to the league. Either create it with a league email address from the start, or add Rich to the Resend team later and make a fresh API key (then replace `RESEND_API_KEY` in Netlify and delete the old key in Resend).

**Who gets what** (Admin → Emails):

- **Result emails** — the addresses in *Send to*, plus every Master Admin login (tick *Always send a copy to the Master Admin*, on to start with), so the Master Admin gets every submitted result. With *Send the captains and vice captains of both teams a copy* ticked (on to start with), each captain and vice captain of the two teams also gets their own copy of the card, to the address they log in with — one email each, so nobody sees anyone else's address, with a link to the match page instead of the "approve" button. A bad captain's address never stops the officials' email.
- **Competition entry emails** — each time someone enters on the entry form (`/enter`), the competition secretary gets one email: who entered, their contact, each competition, the fee and the pay-by date, and a button to *Entries to approve*. Put the address in its own *Send to* and tick the box. Each entry is emailed once (`competition_signups.emailed_at`).

The copies to the Master Admin, the captains and the competition secretary need the league's domain verified in Resend (until then, Resend only delivers to its own account's address).

Good to know: the addresses are kept in a private table that visitors and captains can't read. An email problem never stops a result being submitted or an entry being made. If a card is sent back to the captain and submitted again, the email is sent again.

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
- **Where it shows.** On its own page, **`/myteam`** — never mixed into the home page. It is opened from the gold **★ MS** star beside the person's initials on a computer, **★ My Snooker** in the phone menu, and *My Snooker* in the person's panel.
- **The Home button sticks to it.** Once it is set up, pressing Home (or the logo) opens their My Snooker page, every time. **Normal home page** on their page opens the ordinary home page (`/?home=1`), which has a dark **★ My Snooker — Back to my page** bar at the top. Anyone who would rather Home showed the normal home page chooses that under *The Home button* in their settings (saved as `place: "home"`; `mySnookerHome()` in `core/auth.js`).
- **Where it is set up:** My area → **My Snooker** (`/my/snooker`; the person icon in the menu bar → *My Snooker settings*). One form: on/off, what the Home button does, teams, players, the sections they want to see (as many as they like), news categories or **No news at all**, **Save my choices** and **Reset**.
- **Starting point.** A login linked to a team or a player starts off following them. One linked to nobody is asked to pick a team the first time (`/myteam`).
- **After logging in:** officers land on the dashboard and captains on My Team, as before. A plain **Player** login lands on their My Snooker page.
- **Team & handicaps** lists the captain first, then the vice captain, then the rest by name; the first five show, with **Show all** for the others.
- **Competition deadlines** for their own cup matches are at the top of their page, whatever sections they ticked (section 3m).
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
- **The bell** opens the notifications panel: at the top what the league has sent out lately, then a master switch and a slider for each kind of pop-up — **from the league:** Breaking news, Important updates, Offers; **from the matches:** Results, Breaks, News, Tables & rankings, Competitions, New players — and one for Celebrations (the confetti). The choices are remembered on that phone or computer (no login needed). The kinds are the `NOTIFY_KINDS` list in `core/notify.js`.
- **Sending a notification** — Admin → Website → **Notifications**: choose Breaking news, Important update or Offer, type the message (and, if you like, a little more and a link) and save. Anyone on the website at that moment gets a pop-up (red, blue or yellow); everyone else sees a **red number on the bell** on their next visit and the message in the list behind it for 14 days, or until the day you choose. Untick “Send it” to take one down. A news article ticked **Breaking news** does the same without typing it twice. These are notifications on the website itself: a phone does not buzz when the site is closed.
- **How long a pop-up stays.** Match news (results, breaks, new leaders…) stays 9 seconds; the league's own notices stay 20. Every pop-up has a **×** to close it at once, and its clock stops while a finger (or the mouse) is on it, so there is time to read it. Tapping the message itself opens what it is about. The times are the three numbers at the top of `popup()` in `core/notify.js` (`SHOW_MS`, `NOTICE_MS`, `HOLD_MS`).
- **Add to your home screen** is in the person's panel. On Android and in Chrome it offers the install prompt; on an iPhone it shows the three steps (Share → Add to Home Screen). The name and colours come from `public/manifest.webmanifest`; the icon is the one uploaded under **Admin → Branding → App icon** (section 3n). There is no stand-in icon: until one is uploaded, phones use their own default.

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

## 3k. Manage team: the captain's team sheet

For captains and vice captains only. Nobody else sees any of it.

- **The box.** In the days before their team's next match a **Manage team** box sits at the bottom of the home page (and of their My Snooker page): the match, how long to go and whether the team is picked. The × closes it for that match; it is back for the next one. How many days before a match it appears is under **Site settings → Captains: the Manage team box** (3 to start with; 0 switches it off).
- **The team sheet.** My area → **Manage team**: choose one of the next five matches and pick who plays each frame (a player can be picked a second time as the extra player, as on the card). **Save the team**. It can be changed as often as they like until the match starts.
- **Handicaps in colour.** Every name in the pick list has its handicap after it ("Frank Opie · +5"); once a player is picked, the handicap shows beside the frame in its colour, and the squad list underneath shows everyone's — the same colours as the Handicaps page (green for plus, pink for minus, grey for scratch).
- **On the night** the names are already on the scorecard when it is opened, for whichever side has picked. They can still be changed there.
- **Who can see it.** A team sheet is kept apart from the scorecard, so the other team cannot see it early: only that team's captain and vice captain, and whoever looks after match nights. From the day of the match the other captain can too (it is on the card they both fill in). The database enforces this (`lineups` and `set_lineup()` in `schema.sql`).
- **Adding a player.** Under the squad list: type a name. If someone with that name is already on the website with no team, they are offered first — choose them and their history stays with them. Otherwise **Add as a new player**. Either way the player can be picked at once, is marked “Awaiting approval”, and waits in the dashboard for the league to accept or reject (see “New players added by captains” in section 3).

## 3m. Competition deadlines and who arranges the match

Every round of a competition can have a **play-by date** and a **contact-by date** (Admin → Competitions → Draws & results → 3. Round deadlines). In a draw the first-named is the **home** player (or team) and arranges the match; the away player waits to be contacted.

- **The warnings.** A player with a login linked to their player profile — or, in a team competition, the team's captain and vice captain — sees their own cup matches coming up in **My area → Competitions**, at the top of their **My Snooker** page, and (in the last week, or when it is overdue) in a yellow or red bar on the home page. Each says when it must be played by, whether they are **at home** ("contact your opponent and arrange it by …") or **away** ("your opponent should contact you by …"), and once the contact-by date has passed without a date being set, what the away player is entitled to do. Warnings start **14 days** before the deadline (Admin → Site settings → Competitions: deadline warnings) and stop once the match has a date or a result.
- **The rule** shown to an away player whose opponent has not been in touch is in Site settings too — to start with: *the match is switched; the away player becomes the home player and offers three dates; in a competition where the opponent would get 5 extra points, the new home player gets 10*. **Check the wording against the league's competition rules** and change it there.
- **Switching a match.** When that happens, tick **now at home** under the second-named player on that match in Draws & results and press Save: both players' warnings then say who is at home.
- Where it is in the code: `core/comp-deadlines.js` (the wording is all there); the dates are `competitions.round_deadlines` and `round_contact`, the switch is `competition_matches.home_switched`.

## 3n. Sharing links, and the app icon

**What a shared link shows.** When a link to the website is posted on Facebook, WhatsApp, X, iMessage and the like, they show a title, a line of text and a picture. They read it from the page's head without running the website's JavaScript, so it is put there on Netlify's side, page by page, by **`netlify/edge-functions/social.js`**:

- **News articles** (`/news/…`): the article's own **Social preview** (Admin → News → the article: a picture, ideally 1200 × 630, and a sentence) — or, left empty, its headline, intro and background picture.
- **Every other page:** Admin → **Site settings → Sharing on social media** (title, text and picture).
- Pictures uploaded for previews are kept as JPEG, which every service reads. The services keep their own copy for a while; Facebook's **Sharing Debugger** (developers.facebook.com/tools/debug) fetches a page again at once.

**The app icon.** Admin → **Branding → App icon**: upload one square picture (512 × 512 or bigger; PNG or SVG with a clear background is best) after choosing the background colour. The site makes the four PNGs phones and browsers ask for — iPhone "Add to Home Screen" (180 px), Android and installed apps (192 and 512 px) and Android's round icons (512 px, the badge in the middle) — and uses them in the page and in `/manifest.webmanifest`. The **favicon** (browser tab) is just above it; left empty, the app icon is used. **There is no stand-in:** with nothing uploaded there is no favicon or home-screen icon, and the loading screen is plain black until a loading logo (or main logo) is set in Branding. A phone that already added the site keeps the old icon until it is removed from the home screen and added again.

**How it runs.** The edge function is deployed with the site (GitHub or the Netlify CLI, as in section 2d — not Netlify Drop). It reads the Supabase address and public key from `public/js/config.js` (or from the `SUPABASE_URL` / `SUPABASE_ANON_KEY` environment variables, if set), reads only public things (the site settings and published articles), keeps the settings for a minute, and waits at most 1.5 seconds: if anything goes wrong the page goes out exactly as `public/index.html` has it, between the `<!--social-->` marks.

## 3o. Writing news step by step, and everyone's own pictures

**Who writes news** (Rich, rounds 20–21): every officer — for now not captains, vice captains, players or visitors. It is a permission of its own, **Write news** (Admin → Roles & permissions): on for every officer role to start with, and it can be ticked for captains and vice captains later (they would then find it in **My area → Write news** and in their account panel). Officers find it in **Admin → Website → Write news step by step**. Someone with only Write news sees and changes **their own** articles (listed under the steps as *Your articles*), can't make one breaking news or featured, and doesn't get the dashboard; officers with **News & website** look after every article in Admin → News. The database enforces all of this (`articles.created_by`, the `guard_article` trigger).

**Nothing goes live until the Master Admin approves it** (Rich, round 21). When anyone else presses *Publish* (in the steps, or the Published tick in Admin → News), the article is kept off the website and marked *waiting for approval*; the Master Admin sees a red number on **Admin → Website → News to approve** (and a note on the Overview), reads each one, and presses **Approve and publish** or **Send back** (a draft again, for its writer to change and send again). The Master Admin's own articles go live at once, and changing an article that is already live doesn't need approving again. The database enforces it (`articles.awaiting_approval`, `guard_article`). The writer, the Master Admin and the News & website officers can read an article that isn't live yet at its normal address (with a red "not on the website yet" bar).

**Write news step by step** (Admin → Website, My area → Write news, and the green bar at the top of Admin → News) is the same news article as the full form, one question at a time, for anyone who finds the full form a lot: headline → category (big buttons) → sub headline → the story → a quote (or skip) → pictures (take or choose a photo, or pick one already uploaded) → this week's results, league positions and breaks (three ticks, for one league or **all leagues**; the website fills them in from the scorecards) → check and publish (or save as a draft). What has been typed is kept on that device until it is saved, so closing the page by mistake loses nothing. Headlines are typed in by the writer (the site has no AI to write one). A saved article is changed from *Your articles* under the steps (or, by the News & website officers, in Admin → News).

**Pictures are made small automatically.** Any picture uploaded anywhere on the site — a 10 MB phone photo included — is made at most 1600–1800 pixels on its longest side and about **300 KB** (the quality is stepped down until it fits; a very detailed photo is also made a little smaller). It is stored as **WebP**; on iPhones and Macs (Safari, which cannot make WebP in the browser) it is stored as a JPEG of the same size instead. Photos of paper scorecards aim for about 700 KB, so the writing stays readable. iPhone HEIC photos are read too.

**Everyone has their own pictures.** What someone uploads goes into *their* image library (Admin → Website → Image library): they see only their own; the **Master Admin sees everybody's** (choose under *Whose pictures*) and can use or delete any of them. Pictures uploaded before this change are the Master Admin's. The database enforces this (`media.owner_id`; the file store lets an officer delete only their own files). A picture's link itself is public — it has to be, to show in a news article — so "private" means nobody else can list, rename or delete it.

## 3l. Phones

Most people use the site on a phone, so a few things are done specially for small screens (all in the last blocks of `public/css/style.css`, marked v15):

- **Nothing you type in is smaller than 16px.** An iPhone zooms the whole page in when you tap a box with smaller text — and after logging in the page used to stay zoomed, so everything was slightly too wide. If you add a form field with its own text size, keep it at 16px or more on phones.
- **Lists of suggestions** (following a player, choosing your name on the CueView form, the players and venue on the live scoreboard) are the site's own (`core/suggest.js`): the browser's built-in list does not open on iPhones. Any `<input list="…">` with a `<datalist>` gets it automatically.
- **Tables fit the screen.** Public tables tighten up and their headings wrap; a team's fixture list and the cup matches in My area become one block per match with the buttons underneath; the classic scorecard becomes one block per frame (number down the side, then each team's player, points and breaks); the My area tabs wrap onto short rows so every tab can be seen.
- **League tables:** the leader is the green row with its points in a green pill; the relegation places are pink with their points in a red pill; inside the promotion places and inside the relegation places every other row is a lighter shade. The team someone follows is cream with a dark edge, the same size as the rest. In a narrow column (the sidebar, the side of My Snooker) a league table tightens up by itself so every column fits (a container query on `.lt-panel`).
- **Latest Results** (home page box and its button) is green, the colour of Fixtures & Results. **Latest Competitions** is two columns of white cards on every screen, the cards in a row always the same height; on a phone each card has the trophy on top and the words under it. A trophy or emblem is never cropped or rounded off: it sits whole in its circle.
- **The menu bar on a phone** has the person button (once logged in: the person icon in white on red, rather than initials), the My Snooker ★ (just the star), the bell, search and the menu.
- **Tables look like the league table.** The row at the top is faded green with its points (or break) in a green pill; pink is kept for what needs a warning (relegation places, losses). Long lists of players — rankings, breaks — show the top ten with a **Show all** button under them, on phones and big screens alike. The rankings and breaks of a league each take the full width, one under the other.
- **The home page is shorter**: Shield holders are one slim row per shield, Player and Team of the week are slim cards, and CueViews are small cards (photo, name and a Q&A mark with the number of answers) — the answers are one tap away.

## 3p. Round 22: newsletter, pop-ups, marketplace, chat, SEO, menu, security, versions

**After uploading this zip, run the whole of `supabase/schema.sql` once** (Supabase → SQL Editor → paste → Run). It is safe to run again. The dashboard says “The database needs updating” until you do.

| What | Where |
|---|---|
| Breaks highlighted (gold pill) everywhere — league and competition | automatic |
| Live scoring: balls that are off the table can't be pressed; a note says to end the frame | the scoring pads |
| My Snooker: the Competitions box follows the team chosen at the top; the deadlines box says it is *your own* team's | /myteam |
| Home banner: landscape 16:9 picture (30%) beside the headline (70%); headlines max 70 characters, three lines | News → Headline |
| Newsletter: sign-up pop-up and footer link, Subscribers (CSV download), Campaigns with a block builder (header, H1–H5, text, links/buttons, images, columns, social icons, footer) — table-based email | Admin → Newsletter |
| Pop-up adverts on the home page (text + picture + button, or one whole picture) | Admin → Website → Pop-up adverts |
| Snooker marketplace: anyone logged in posts an advert; it waits for approval; categories and search | /marketplace · Admin → Website → Marketplace adverts / categories |
| Match night chat under every league and cup match | Admin → Website → Comments |
| SEO: site title, language, description, preview; page settings (title, description, page image, search engines, site search); /sitemap.xml and /robots.txt | Admin → Website → SEO |
| Menu creator: buttons, order (drag or ↑ ↓), colours, show/hide, phone links | Admin → Website → Menu |
| Link checker and Performance | Admin → Website |
| Security: custom login address, login access, two-step login by role, common names blocked, login attempt limit, recent logins | Admin → Master Admin → Security |
| Version history from Netlify (Live, status, published at, changes, View, Make live); version number in `public/js/core/release.js` | Admin → Master Admin → Version history |

**New Netlify environment variables** (Site configuration → Environment variables, then redeploy):
- `NETLIFY_AUTH_TOKEN` — for Version history (Netlify → User settings → Applications → Personal access tokens). Tick “Contains secret values”. If the page says it can't find the site, also add `NETLIFY_SITE_ID` (Site configuration → General → Site ID).
- `NEWSLETTER_EMAIL_FROM` (optional) — e.g. `St Blazey Snooker League <news@your-domain.co.uk>`; otherwise `RESULTS_EMAIL_FROM` is used. Resend's free plan sends 100 emails a day / 3,000 a month.

**Two-step login:** tick roles under Security → Two-step login (set it up for yourself first). Lost phone: Security → Reset their two-step login. If the Master Admin loses theirs: Supabase → Authentication → Users → the user → remove the MFA factor.
**Custom login address:** after choosing one, `/login` shows “page not found”; tell officers and captains the new address.

## 3q. Round 23: live tables, add to home screen, adverts, sponsorship, downloads, Hall of Fame

**After uploading, run the whole of `supabase/schema.sql` again** (database version 17).

| What | Where |
|---|---|
| Tables, rankings and breaks move live as frames are saved; anything not yet approved is marked * with a note. The highest-break confetti pops up the moment the break is saved, with “not official until the scorecard has been submitted and approved” | automatic (`countedStatuses` in `core/rules.js`) |
| Add to home screen: one press on Chrome / Edge / Samsung Internet; on iPhone a picture guide (••• → Share → View More → Add to Home Screen). In the phone menu, in My account, and offered by a small bar on phones from the second page (“×” hides it for 30 days) | `core/install.js` |
| SEO section in the Info page editor (also listed in Website → SEO) | Admin → Website → Info pages & rules |
| Home banner layout: picture beside the headline, one big picture across the banner, or headline only | Admin → Site settings → Home page banner |
| Side adverts: everywhere, or only on one venue / team / competition / league, or a kind of page (presentation night, in memoriam…). Pages without a side column show them under the heading | Admin → Website → Side adverts |
| Venue pages have their own side column: results, next matches, breaks and news from that venue | /venue/… |
| Sponsorship packages (Gold / Silver / Bronze…) on /sponsorship; each sponsor can be put on a package | Admin → Website → Sponsorship packages, Sponsors |
| League downloads (/downloads): PDF, Word, Excel, PowerPoint or pictures; logged-in only by default | Admin → Website → Downloads |
| Hall of Fame (/hall-of-fame) and “Share a memory” (/hall-of-fame/submit, waits for approval) | Admin → Website → Hall of Fame |
| In memoriam: each player's story and pictures (“Read their story”) | Admin → Players → the player |
| Suggested handicaps for the yearly review (nothing changes until Apply) | Admin → League → Suggested handicaps |
| “? Rules help” on the scorecards and the live scoreboard: searches the league's rules and a short guide to the rules of snooker | scorecards |
| Latest results: team emblems, score pills; hover (or tap ⌄) for every frame, the best break and the venue | side column |

## 3r. Round 24 (fixes)

**Run `supabase/schema.sql` again** (database version 18) — adds the on/off switch for match chat.

- Suggested handicaps: fixed "<input type=" text on phones; plain-English "how it works" panel; separate "Tick / untick them all" box.
- Latest results: tapping a result now opens a small summary (winner, best break, top player, venue) with a "View full match statistics" button.
- Match chat: green "Match chat" button at the top of every match page opens the chat as a bottom sheet. "Invite your team" shares a link straight to the chat. Website managers can close/open the chat per match.
- Admin menu: the long Website list is split into News, Pages & content, Sponsors & adverts, Community, Look & settings and Tools. "Write news step by step" is now a button on the News screen, not a menu item.
- "Sponsorship, downloads & Hall of Fame pages" settings renamed "Page introductions".
- Link checker readable on phones.
- Add to home screen: hidden once installed (where the phone tells us), plus a "Don't show this again" button.

## 3s. Round 25 (form guide)

No database changes — nothing to run in Supabase this time.

- **Form out of 10.0** for every player and team, from their last 6 matches this season (league matches and knockout competitions), worked out in `public/js/core/form.js` — change the numbers at the top of that file to change the formula.
  - Players: up to 7 for the share of frames won + up to 3 for their best break that night (30+ = 1, 50+ = 2, 70+ = 3).
  - Teams: up to 7 for the share of frames won + 3 for a win, 1.5 for a draw.
  - Form = the average of those marks. ▲/▼ shows whether it went up or down with the latest match.
- **Form guide page** at `/form` (Players / Teams, league filter, search, sort by any column, most in-form player and team).
- Form also shows on player pages (with each match and its mark), team pages and squad cards, league tables (W/L/D), rankings, and the player and team of the week on the home page.
- The phone menu's standard links now include "Form guide". If the menu has been customised in Admin → Look & settings → Menu, add `/form` there.

## 3t. Round 26 (form guide extras)

**Run `supabase/schema.sql` again** (database version 19).

- **Player of the month / Team of the month:** Admin → Look & settings → Site settings, under Player and Team of the week. Shown on the home page beside them, with their form.
- **Form guide in the menu:** running schema.sql adds "Form guide" (after "Our Players") to a phone menu that was changed in Admin → Menu — once only, so if it is taken out again it stays out.
- **My Snooker:** a new "Form" section (on for everyone; it can be unticked in My Snooker settings): my own form, my team's, and the form of my teammates and the players I follow, with a link to the form guide. Team & handicaps and Players I follow show each player's form too.
- **My account menu:** "My form" (for logins linked to a player) and "Form guide". **My area → Profile** shows the player's Form box.
- **Form is one season at a time** (1.26.1): it starts again from nothing when a new season is made current. Competitions with no season set only count from the current season's first league match.

## 3u. Round 27 (real data)

**Run `supabase/schema.sql` again (database version 20), then `supabase/real-league.sql` once** (see section 3c).

- `real-league.sql` clears the test data (players, fixtures, scorecards, news, other seasons, leagues, teams, venues and competitions) and loads the real league: 2 leagues, 19 teams, 153 players, 162 fixtures, 18 bye weeks and the 26 results on record. Logins stay, still linked to their player.
- **“Not updated yet”** shows wherever the league hasn't added something yet: a handicap, a bio, a CueView, a player's stats, and a match whose night has gone by with no result (more than five hours after the start, still "scheduled", nothing on the card). Rules in `isNotUpdated()` in `core/rules.js`.
- A handicap can be left empty (Admin → Players or Admin → Handicaps). Scorecards and handicap competitions count an empty handicap as 0.
- Removed: `seed.sql`, `remove-sample-data.sql`, `add-richard-pearson.sql`, the old `real-season-2026-27.sql` and `scripts/build-seed.mjs`.

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
  _headers                  ← the security headers Netlify sends (what the browser may load, and from where)
  assets/                   ← logo.svg (header placeholder until a logo is uploaded), avatar.svg, trophy.svg (placeholder cup), hero.jpg (home page photo)
  js/
    config.js               ← Supabase keys + site name  ← EDIT THIS
    boot.js                 ← the loading screen and saved colours, applied before the page is drawn
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
      score-pad.js          ← the pad a captain scores one league frame on, ball by ball (the scorecard's third view)
      live-text.js          ← the "Live text" box used on both scoring pads, and how its lines are kept
      comp-deadlines.js     ← competition deadline warnings: whose match, who is at home, what to do (section 3m)
      suggest.js            ← the list that opens under a text box as you type (any <input list="…">): our own, because the browser's does not open on iPhones
      version.js            ← the database version this website expects (see section 7)
      squad.js              ← Manage team: the captains' box on the home page, and helpers for the team sheet
      awards.js             ← the presentation awards: the standard list and what the results say the winners are
      celebrate.js          ← confetti and card: a new highest break, new leaders, a competition winner
      terms.js              ← lists of words used in more than one place (meeting types, player statuses)
      list-field.js         ← the "add as many as you like" field (past teams)
      dom.js                ← safe HTML helper, dates in UK time, toasts
      schedule.js           ← round-robin fixture generator + date helpers
      bracket.js            ← knockout draw + who-plays-whom logic (no HTML)
      bracket-view.js       ← draws the bracket roadmap, round cards, standings
      upload.js             ← shrinks and uploads images (and adds them to the library)
      scorecard-editor.js   ← the one scorecard editor used for league AND cup matches (step-by-step, classic and ball-by-ball views)
      search.js             ← the search pop-up
      csv.js                ← CSV import: reads the file and works out what to add (no database)
      cueview.js            ← the CueView questions (add/reword one here)
      notify.js             ← live pop-up notifications: the kinds (NOTIFY_KINDS), each visitor's choices, the league's own notices, when to celebrate
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
      emails.js             ← Emails: who gets the result and entry emails, and the test buttons
      news-wizard.js        ← Write news step by step (Website → Write news step by step)
      news-approve.js       ← News to approve (Master Admin: approve or send back)
    demo/seed-data.js       ← sample league (imaginary players)
supabase/
  schema.sql                ← tables + security rules + image storage (safe to re-run)
  real-league.sql           ← the real league: test data out, real league in (generated: npm run real-league)
netlify/functions/
  admin-users.mjs           ← creates/updates/deletes logins (server-side)
  result-email.mjs          ← emails the results secretary when a card is submitted (through Resend)
netlify/lib/
  result-email-template.mjs ← what that email says
netlify/edge-functions/
  social.js                 ← fills in each page's sharing preview and the app icons on Netlify's side (section 3n)
real-data/2026-27/          ← the real season collected from the old website (see its README)
scripts/
  build-real-league.mjs     ← writes supabase/real-league.sql from real-data/2026-27/
netlify.toml                ← Netlify settings (publish folder, URL routing)
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
| Change the fonts | Admin → Branding → Fonts (standard: Space Grotesk everywhere — headings, text, buttons. Running this round's `schema.sql` put both back to the standard once; Questrial is still in the Body text list) |
| Send everyone a notification (breaking news, an important update, an offer) | Admin → Website → Notifications. Or tick “Breaking news” on a news article |
| Change how long the pop-ups stay on screen | `SHOW_MS` (match news, 9 seconds) and `NOTICE_MS` (the league's notices, 20) at the top of `popup()` in `public/js/core/notify.js` |
| Add a picture of a league's shield | Admin → Leagues → Edit → Weekly shield → Picture of the shield |
| Let captains write live text too (not only admins) | `liveText` in `public/js/pages/scorecard.js` (section 3d) |
| Change when captains see the Manage team box, or switch it off | Admin → Site settings → Captains: the Manage team box (days before the match; 0 = never) |
| Change how many frames a team sheet has | It follows `framesPerMatch` in `public/js/core/rules.js` (5), like the scorecard |
| Load something from another website and it doesn't show (a new font service, a video site, a widget) | Add its address to the matching part of `Content-Security-Policy` in `public/_headers` |
| Move to a newer version of the Supabase library | Change the version number in `public/js/core/db.js` (one line), then test logging in and saving a scorecard |
| Change how many teams are promoted and relegated (the green **P** and red **R** in this season's league tables) | Admin → Leagues → Edit → **Promotion and relegation**: a number for each league (0 = none). Which league is above which is “Display order” (1 is the highest). The colours are `--lt-top`, `--lt-down` and `--lt-mine` in the v12 block of `public/css/style.css`; the rules, and the “places moved since last week” arrows, are `leagueMarks()` in `public/js/core/components.js` and `previousStandings()` in `core/context.js` |
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
| Score a final ball by ball | Admin → Live scoreboard (needs "Live scoring" — Admin → Roles & permissions) |
| Let captains score ball by ball on their scorecards | Admin → Roles & permissions → Live scoring → tick Captain / Vice Captain |
| Set a round's play-by and contact-by dates, or switch who is at home | Admin → Competitions → Draws & results (sections 3 and 4) |
| Change when deadline warnings start, or the rule an away player is told | Admin → Site settings → Competitions: deadline warnings |
| Change what a shared link shows | Admin → Site settings → Sharing on social media; a news article: News → the article → Social preview |
| Change the phone home-screen / installed app icon, or the favicon | Admin → Branding → App icon (and Favicon just above it) |
| Change how many players a long table shows before "Show all" | `phoneLimit: 10` where the table is drawn (`rankingsPanel` / `breaksPanel` in `core/components.js`, `pages/seasons.js`) |
| Add the minutes of a meeting | Admin → Meetings → Edit → Minutes (typed) or the PDF |
| Add or change the rules | Admin → Info pages & rules → tick "Show on the Rules page" on each set of rules |
| Write a sponsor's page | Admin → Sponsors → Edit → The sponsor's page |
| Mark a player as not playing, without a team, or no longer with us | Admin → Players → Edit → Status |
| Change the size of headings, tables or the menu | Admin → Branding → Text sizes |
| Switch a celebration off (highest break, new league leaders, new rankings leader, competition winner) | Admin → Site settings → Celebrations — one switch each |
| Add a kind of notification to the bell's panel | `NOTIFY_KINDS` in `public/js/core/notify.js` |
| Add or reword a My Snooker section | `SECTIONS` in `public/js/core/my-snooker.js` |
| Change what a page's sidebar shows | `public/js/core/side.js` |
| Use the real badge as the phone home-screen icon | Admin → Branding → App icon (and Favicon) — nothing in the files |
| Change the green and red used for won and lost | `--win` and `--loss` in `public/css/style.css` (v11 block) |
| Show 25 or 100 rows per page in a dashboard list | `PAGE_SIZE` in `public/js/admin/crud.js` (or `pageSize` on one section in `resources.js`) |
| Choose who is emailed when a card is submitted | Admin → Emails |
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
3. If `supabase/schema.sql` changed, run it again: Supabase → **SQL Editor** → New query → paste the **whole** file → **Run**. It only adds what's missing and never deletes your data. It should answer “Success. No rows returned”. If Supabase asks you to confirm because the query “contains destructive operations”, that is expected (it replaces the security rules with the same rules) — confirm. If it answers with an error instead, nothing at all was changed: copy the error and get it looked at before going further.
   **The website tells you when this step has been missed.** The SQL file ends by writing a version number into the database, and the website knows the number it needs (`public/js/core/version.js`). If the files are uploaded but the SQL has not been run, a red box — **“The database needs updating”** — sits at the top of every page of the admin dashboard until it has, and anything that needed the missing piece says so in plain words instead of showing a database error. (Anyone adding to `schema.sql` later: raise the number at the bottom of that file and the one in `version.js` together.)
   Each new function also needs its environment variables in Netlify (result emails: `RESEND_API_KEY` — section 3f).
4. **Don't run `real-league.sql` again** once the league is entering results on the website. An update never needs it: it puts the league back to its starting point, wiping every result, player detail and news article added since.
5. Netlify redeploys the logins function on its own when you push — nothing to do there. If you upload by drag and drop instead, upload the **whole project folder** (not only `public`), or the functions are not updated.

## 8. Security

### How the site is protected

- **The database decides, not the page.** Every table has row-level security switched on. Hiding a button is never the protection: a captain who types another team's scorecard address, or calls the database directly, is refused by the database itself.
- **The two keys in `public/js/config.js` are meant to be public.** The address of your Supabase project and its **anon** key are what every visitor's browser uses to read the public data; every Supabase website publishes them. They open nothing that the security rules don't allow. The key that must stay secret is the **service role** key: it is only ever in Netlify's environment variables, is used only by the two functions in `netlify/functions/`, and is in no file of this project.
- **Text typed in is always escaped** (`html` in `core/dom.js`), so a name, a news article or a CueView answer can never become a script. Links typed in the dashboard are only drawn when they are ordinary web addresses (`safeHref`).
- **Pictures sent in by captains and players** (the scorecard photo, match night photos, a player's own photo and pictures) must be ones uploaded on this website: the database refuses any other address.
- **The browser is told what it may load** (`Content-Security-Policy` in `public/_headers`): scripts only from this website and the Supabase library, frames only from YouTube, Vimeo and Google Maps. A script from anywhere else does not run. The Supabase library is one exact version (`core/db.js`), not “whatever is newest”.
- **Logins** are made by the league, never by the public. Passwords are kept by Supabase (hashed); the website never sees them after they are typed. Nobody can change their own role.
- **Emails** to the results secretary are sent by a function that checks who is asking and that the match really is theirs; the links in the email always point at the website's own address.

### Checklist before launch

- [ ] Public sign-ups turned **off** in Supabase (step 2a.4). Authentication → Sign In / Providers → “Allow new users to sign up” off.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are only in Netlify environment variables, never in any file. In Netlify, tick “Contains secret values” for both.
- [ ] Two-step login switched on for your own **Supabase**, **Netlify**, **Resend** and domain accounts. Whoever gets into one of those has the whole site, whatever the website's own rules say.
- [ ] Supabase → Advisors → **Security Advisor** shows no errors (run `supabase/schema.sql` first).
- [ ] Test it: Admin → Emails → Send a test email arrives; then submit a card as a captain and check the email.
- [ ] Test it: log in as one captain, then try to open another team's scorecard URL. It should say "Scorecard locked".
- [ ] Test it: as a captain, try **Submit results** without a photo. It should be refused.
- [ ] Test it: log in as an officer (e.g. a Committee Member) and open `/admin/fixtures`. It should say the login doesn't include that part.
- [ ] Test it: as a captain, open **My area → Manage team** and save a team; log in as the other team's captain and check there is nothing of it to see.
- [ ] Open **Roles & permissions** as the Master Admin and check each role only has what you want. Keep the number of Master Admins small.
- [ ] Download a **backup** once the real data is in, and again every month or so: on Supabase's free plan your own download is the only backup you can count on.
- [ ] Test it: as the away captain, open a match page. There should be no "Add match night photos" button.
- [ ] Test it: enter a competition on `/enter` without logging in, then check it appears under Admin → Entries to approve and nowhere on the public site except as a name "waiting for payment".
- [ ] Give each captain their own login, and ask them to change their password under **My Team → User details**. Remove the login of anyone who leaves.

### What is public, and what to decide

Players' names, scores and breaks are public, as they are on the current site. Login emails are only visible to the admin. The contact details typed into the entry form are only visible to the competition secretary and the admins. A team sheet is only visible to its own captains until the day of the match.

**Birthdays.** A player's date of birth, if one is filled in, is shown on their page with their age. That is personal information: the committee should decide whether the league wants it public, and tell players it is optional. Leaving the box empty hides both.

The entry form and the CueView form are open to anyone (no login), like a paper form on a club noticeboard: someone could enter another player's name. Nothing happens until an officer approves it, so a bogus entry is simply removed, or lapses on its own.

Photos of paper scorecards and match nights are public pictures (anyone with the link can open them), like every picture on the site.

**The loading screen.** While a page is loading, the screen is black with the logo pulsing in the middle (the loading logo from Admin → Branding, or the main logo). It can be switched off, or made to stay up for a set number of seconds when the site is first opened (Admin → Branding → Loading screen). The colours and logo are remembered in each visitor's browser, so their second visit shows the right ones from the first instant.
