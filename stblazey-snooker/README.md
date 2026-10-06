# St Blazey & District Snooker League — website

A fast, plain HTML/CSS/JavaScript website (no build step) with:

- **Public site**: home page with a rotating news banner, live & upcoming match strip, league tables, shield holders, player/team of the week and CueViews; fixtures and results, a **calendar** (with phone-calendar download), team pages, **player pages with CueView**, match scorecards, venues with maps and galleries, news with weekly round-ups, **knockout competitions with a live bracket and live cup scorecards**, standings, handicaps and a **Live** page.
- **Live extras**: the LIVE button pulses orange ("LIVE SOON") an hour before matches and green while they're on; green pop-ups announce frame wins, breaks and new players (the bell turns them on/off).
- **Members' area** (My Team · Fixtures · Profile · User details · Competitions): captains and vice captains enter scorecards frame by frame on match night — a **step-by-step view made for phones**, or the classic full card. Each save updates the live page for everyone, straight away. Every player can have a login to edit **their own profile** (photo, bio, career history, pictures, CueView).
- **Players**: an **Our Players** page (pick a team, see its players past and present) and player pages with bio, career history, past teams, pictures and **player news**. A **search** button in the menu finds players, teams, competitions, venues, news and pages.
- **Roles & permissions**: the Master Admin decides, in a tick-box grid, what each officer role (League Admin, Competition Secretary, League Secretary, Committee Member, President, Vice Chairman, Chairman) can see and do. Each login only sees its own parts of the dashboard, and the database enforces it. Any officer can also be given captain rights for their team.
- **Master Admin tools**: an **activity log** (who added, changed or removed what), a **backup** download, and **maintenance mode**.
- **Home page extras**: an **announcements ticker** along the very top, and a **Latest Results** box in the side column with an all-results page (`/results`).
- **CSV import**: bring in teams, players, old fixtures and results, or full scorecards from a spreadsheet (Admin → Import from CSV).
- **Admin dashboard**: approve results, and manage fixtures, the fixture generator, leagues (and their weekly shield), teams, players (with CueView), venues, seasons, competitions (entrants, byes, draws — fixed bracket or redrawn every round — and results), logins, news and categories, an **image library**, info pages, sponsors, **site settings** (logo, favicon, banner, player/team of the week) and a **statistics** dashboard.
- **Competition entry form** (`/enter`): players pick their name and the competitions they want, are shown the league's bank details and a pay-by date, and the entry waits for the competition secretary to confirm the payment.
- **Live draws**: a competition's draw can be made live on the website, one tie at a time, with a named witness.
- **Branding**: logo, loading logo, the colour of each menu button and its section, fonts and page layout are all set in the dashboard.
- **Season archive & roll of honour** (`/archive`): every season's champions, top player and highest break, with its full tables and breaks a click away.
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
| **Match nights** | Approve results, edit any scorecard, rearrange postponed matches |
| **Fixtures** | Add and edit fixtures, the fixture generator |
| **League** | Leagues, teams, players, venues, seasons |
| **Handicaps** | Change handicaps, run the yearly review |
| **Competitions** | Competitions, entries to approve, draws, cup scorecards |
| **News & website** | News, categories, announcements, info pages, sponsors, image library |
| **Settings & branding** | Site settings, home page, branding, statistics |
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
| **Player** | Not in the grid: their own profile only |

Things worth knowing:

- **It is enforced by the database**, not just hidden in the menu (`can_manage()` and the `role_permissions` table in `schema.sql`). A section that isn't ticked can't be changed by typing its address either.
- **Logins:** someone with "Logins" ticked can only create or change logins for roles that are allowed no more than they are themselves, and never a Master Admin's. Only a Master Admin can make another Master Admin.
- **Import from CSV** needs Fixtures, League and Match nights together, because an import writes to all three.
- A change takes effect the next time that person opens the website or logs in.
- Any officer who also plays can be given **Team rights** (Captain or Vice Captain) on their login, and then has a **My Team** button next to **Admin**.

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

---

## 4. Scoring rules (all in `public/js/core/rules.js`)

| Rule | Current setting |
|---|---|
| Team league points | 1 point per frame won (a 3–2 win = 3 pts, a 2–3 loss = 2 pts, matching the current site) |
| Player ranking points | 5 per frame won, plus break points |
| Break points | 30–39 = 3, 40–49 = 4, … 140 and over = 14 (below 30 = 0) |
| Highest break allowed | 155 (`MAX_BREAK`) |
| Table order | Points, then wins, then frame difference; tied teams share a position |

If Rich confirms a different team rule (for example 3 points for a win), change the one line inside `teamMatchPoints()`. The whole site follows automatically.

---

## 5. How the code is organised

```
public/                     ← everything Netlify serves
  index.html                ← the only HTML page (the app shell)
  css/style.css             ← all styling; colours are variables at the top
  assets/                   ← logo.svg, avatar.svg, hero.jpg (home page photo)
  js/
    config.js               ← Supabase keys + site name  ← EDIT THIS
    main.js                 ← header, footer, and which page to show for each URL
    core/
      rules.js              ← ALL scoring maths
      api.js                ← ALL database reads/writes
      context.js            ← turns raw data into tables/rankings for pages
      components.js         ← ALL reusable tables, panels, cards, sidebar
      auth.js               ← login + "who can edit what" (UI side)
      branding.js           ← turns Admin → Branding (colours, fonts, page layouts, loading screen) into CSS variables
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
      notify.js             ← live pop-up notifications + the bell toggle
      db.js                 ← picks real Supabase or the demo database
      demo-client.js        ← the in-browser demo database
      router.js             ← navigate() / setTitle() for pages
    pages/                  ← one small file per page (home, team, match, …)
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
    demo/seed-data.js       ← sample league (imaginary players)
supabase/
  schema.sql                ← tables + security rules + image storage (safe to re-run)
  seed.sql                  ← optional sample data (generated: npm run seed)
  remove-sample-data.sql    ← deletes the sample data again
  add-richard-pearson.sql   ← adds Rich as a player (run once)
netlify/functions/
  admin-users.mjs           ← creates/updates/deletes logins (server-side)
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
| Change the main colour or the page background | Admin → Branding → Other colours |
| Change the fonts | Admin → Branding → Fonts |
| Give a part of the site a right sidebar, or make it full width | Admin → Branding → Page layout. One choice each for Home, Competitions, Fixtures, League and News: **Standard** (as designed), **Right sidebar on every page** (pages without side boxes get the standard ones), or **Full width on every page** (a page's own side boxes move underneath) |
| Put sidebars on the left | Admin → Branding → Page layout → Which side a sidebar goes on |
| Use a Google font that isn't in the lists | Admin → Branding → Fonts → paste the font's embed link from fonts.google.com ("Get font" → "Get embed code"). Its fonts join both lists straight away; choose them and Save |
| Turn the loading screen off, or keep it up longer | Admin → Branding → Loading screen (on/off, and the minimum seconds it shows when the site is first opened) |
| Change the order of the sections on the News page, or their columns | Admin → News categories & layout → Edit → "Position on the News page" and "Columns" |
| Add, change or stop an announcement in the ticker | Admin → Announcements. The ticker's on/off switch and speed are in Site settings → Announcements ticker |
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
| See past seasons | League → Season archive (`/archive`), or the Season list on any table, fixtures or competitions page |
| Change the home page banner photo | Admin → Site settings & home page → Home page banner background |
| Choose which news rotates in the banner | Admin → News → tick "Show in the home page banner" (newest 4 are shown; change the number in Site settings) |
| Player / team of the week, CueViews on the home page | Admin → Site settings & home page; pick CueViews under Players → "Show this CueView on the home page" |
| Add a CueView question | One line in `public/js/core/cueview.js` |
| Put the quote somewhere else in an article | Type `[quote]` on its own line in the article text |
| Footer: partner logos | Admin → Sponsors (they appear under "Principal Partners") |
| Footer: Facebook / X / Instagram / YouTube links | Admin → Site settings & home page → Social links (an icon only shows when its link is filled in) |
| Footer: Privacy Policy, Terms, Accessibility, About, Contact Us | Admin → Info pages — edit the text; "Show in the footer" / "Show on the League page" decide where each page is linked |
| Footer: copyright line | `SITE` in `js/config.js` |
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
4. **Don't run `seed.sql` or `remove-sample-data.sql` again.** An update never needs them. `remove-sample-data.sql` deletes the sample players, teams, venues and articles — together with any photos, emblems or details you attached to them — and `seed.sql` puts back blank ones. Only use them if you deliberately want to reset the sample league.
5. Netlify redeploys the logins function on its own when you push — nothing to do there.

## 8. Security checklist before launch

- [ ] Public sign-ups turned **off** in Supabase (step 2a.4).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in Netlify environment variables, never in any file.
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
