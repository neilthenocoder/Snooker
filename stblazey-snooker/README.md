# St Blazey & District Snooker League — website

A fast, plain HTML/CSS/JavaScript website (no build step) with:

- **Public site**: home page with a rotating news banner, live & upcoming match strip, league tables, shield holders, player/team of the week and CueViews; fixtures and results, a **calendar** (with phone-calendar download), team pages, **player pages with CueView**, match scorecards, venues with maps and galleries, news with weekly round-ups, **knockout competitions with a live bracket and live cup scorecards**, standings, handicaps and a **Live** page.
- **Live extras**: the LIVE button pulses orange ("LIVE SOON") an hour before matches and green while they're on; green pop-ups announce frame wins, breaks and new players (the bell turns them on/off).
- **Members' area** (My Team · Fixtures · Profile · User details · Competitions): captains and vice captains enter scorecards frame by frame on match night — a **step-by-step view made for phones**, or the classic full card. Each save updates the live page for everyone, straight away. Every player can have a login to edit **their own profile** (photo, bio, career history, pictures, CueView).
- **Players**: an **Our Players** page (pick a team, see its players past and present) and player pages with bio, career history, past teams, pictures and **player news**. A **search** button in the menu finds players, teams, competitions, venues, news and pages.
- **Roles**: Master Admin and League Admin (everything), Competition Secretary, League Secretary, and Committee Member / President / Vice Chairman / Chairman (website) — each sees only their own part of the dashboard, and any of them can also be given captain rights for their team.
- **CSV import**: bring in teams, players, old fixtures and results, or full scorecards from a spreadsheet (Admin → Import from CSV).
- **Admin dashboard**: approve results, and manage fixtures, the fixture generator, leagues (and their weekly shield), teams, players (with CueView), venues, seasons, competitions (entrants, byes, draws — fixed bracket or redrawn every round — and results), logins, news and categories, an **image library**, info pages, sponsors, **site settings** (logo, favicon, banner, player/team of the week) and a **statistics** dashboard.
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
   select id, email, 'League Admin', 'admin' from auth.users where email = 'you@example.com';
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

**Handicap competitions** (tick "Handicap competition" under Admin → Competitions): the scorecard shows each player's handicap and works out the head start for every frame — the difference between the two sides (in doubles, each pair's handicaps are added together). So 16 against −14 is a 30 start. Scores are entered **as they finish on the scoreboard, start included**; the site refuses a score lower than the start.

**Plate competitions:** on a competition's Draws page press **Create … Plate**. Everyone who lost their first match (a first-round loser, or a second-round loser after a bye) is entered; press **Add those knocked out** again as more matches finish, then make the plate's draw like any other.

**Cup matches** work the same way: open Admin → Draws & results → **Scorecard** (or a captain of a team in the match can use the match page's **Start scoring** button). Press **Finish match** at the end and the winner moves into the next round.

Either team's captain can enter the scorecard for their match. A captain can only ever touch their own team's matches, and this is enforced by the database itself, not just hidden in the page.

---

## 3b. Who can do what

| Role | Admin dashboard | Also |
|---|---|---|
| **Master Admin**, **League Admin** | Everything | Only the Master Admin can create or change another Master Admin |
| **Competition Secretary** | Competitions (and scoring any cup match) | |
| **League Secretary** | League: leagues, teams, players, venues, seasons | |
| **Committee Member**, **President**, **Vice Chairman**, **Chairman** | Website: news, pages, images, sponsors, site settings, statistics | |
| **Captain**, **Vice Captain** | – | Scorecards and postponing for their own team; their own profile |
| **Player** | – | Their own profile only |

Any officer who also plays can be given **Team rights** (Captain or Vice Captain) on their login, and then has a **My Team** button next to **Admin**. Results to approve, fixtures and logins stay with the Master Admin and League Admin. The database enforces all of this (`can_manage()` in `schema.sql`), so a section that isn't in someone's menu can't be changed by typing its address either.

When an admin or officer is logged in, public pages show an **Edit this page** button (bottom left) that opens the right part of the dashboard.

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
| Use the real logo / favicon | Admin → Site settings & home page → Logo / Favicon |
| Change the home page banner photo | Admin → Site settings & home page → Home page banner background |
| Choose which news rotates in the banner | Admin → News → tick "Show in the home page banner" (newest 4 are shown; change the number in Site settings) |
| Player / team of the week, CueViews on the home page | Admin → Site settings & home page; pick CueViews under Players → "Show this CueView on the home page" |
| Add a CueView question | One line in `public/js/core/cueview.js` |
| Put the quote somewhere else in an article | Type `[quote]` on its own line in the article text |
| Change colours or fonts | The `:root` block at the top of `style.css` |
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
| Body font | `--font-body` near the end of `style.css`, and the Google Fonts line in `index.html` |
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
4. Using the sample data? Run `remove-sample-data.sql` **before** running a newer `seed.sql`, so the old sample rows don't clash with the new ones.
5. Netlify redeploys the logins function on its own when you push — nothing to do there.

## 8. Security checklist before launch

- [ ] Public sign-ups turned **off** in Supabase (step 2a.4).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in Netlify environment variables, never in any file.
- [ ] Test it: log in as one captain, then try to open another team's scorecard URL. It should say "Scorecard locked".
- [ ] Test it: as a captain, try **Submit results** without a photo. It should be refused.
- [ ] Test it: log in as an officer (e.g. a Committee Member) and open `/admin/fixtures`. It should say the login doesn't include that part.
- [ ] Give each captain their own login, and ask them to change their password under **My Team → User details**.

Players' names, scores and breaks are public, as they are on the current site. Login emails are only visible to the admin.
