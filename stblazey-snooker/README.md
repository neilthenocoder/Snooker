# St Blazey & District Snooker League — website

A fast, plain HTML/CSS/JavaScript website (no build step) with:

- **Public site**: home page with a rotating news banner, live & upcoming match strip, league tables, shield holders, player/team of the week and CueViews; fixtures and results, a **calendar** (with phone-calendar download), team pages, **player pages with CueView**, match scorecards, venues with maps and galleries, news with weekly round-ups, **knockout competitions with a live bracket and live cup scorecards**, standings, handicaps and a **Live** page.
- **Live extras**: the LIVE button pulses orange ("LIVE SOON") an hour before matches and green while they're on; green pop-ups announce frame wins, breaks and new players (the bell turns them on/off).
- **Captain area**: captains and vice captains log in, see their own team's fixtures, and enter scorecards frame by frame on match night. Each save updates the live page for everyone, straight away.
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

1. **Captain** logs in on their phone, which opens **My team**. They press **Enter scorecard** on tonight's match.
2. After each frame, they pick the two players, type both scores and any breaks (e.g. `34, 41` in the pink box next to the player), then press **Save progress**. The live strip, the **Live** page and the match page update for everyone within a second or two.
   - Every player appears twice in the list: **Name** and **Name (Ext)**. Pick "(Ext)" when that player is playing an extra frame as the team's extra player — the site allows it once per player per season.
   - **Upload scorecard** opens the phone camera so they can attach a photo of the paper card.
   - **+ Add a new player** registers a new player for their own team on the spot.
3. At the end of the night, they press **Submit results**.
4. **Admin** opens **Results to approve**, checks the scorecard and presses **Approve**. Approved results are locked for captains, but the admin can still edit them.

Tables and rankings count **submitted** and **approved** results. To make tables move live during the evening instead, add `"in_progress"` to `countedStatuses` in `public/js/core/rules.js`.

**The weekly shield:** set each league's shield name and the holder at the start of the season under Admin → Leagues. From then on it's automatic: the holder's match each week is the shield match (shown on the scorecard and match page), and if they lose, the winners take it. The home page shows who holds it.

**Cup matches** work the same way: open Admin → Draws & results → **Scorecard** (or a captain of a team in the match can use the match page's **Start scoring** button). Press **Finish match** at the end and the winner moves into the next round.

Either team's captain can enter the scorecard for their match. A captain can only ever touch their own team's matches, and this is enforced by the database itself, not just hidden in the page.

---

## 4. Scoring rules (all in `public/js/core/rules.js`)

| Rule | Current setting |
|---|---|
| Team league points | 1 point per frame won (a 3–2 win = 3 pts, a 2–3 loss = 2 pts, matching the current site) |
| Player ranking points | 5 per frame won, plus break points |
| Break points | 30–39 = 3, 40–49 = 4, … 140–147 = 14 (below 30 = 0) |
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
      scorecard-editor.js   ← the one scorecard editor used for league AND cup matches
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
    demo/seed-data.js       ← sample league (imaginary players)
supabase/
  schema.sql                ← tables + security rules + image storage (safe to re-run)
  seed.sql                  ← optional sample data (generated: npm run seed)
  remove-sample-data.sql    ← deletes the sample data again
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
| Change the footer text | `SITE` in `js/config.js` |
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

## 8. Security checklist before launch

- [ ] Public sign-ups turned **off** in Supabase (step 2a.4).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in Netlify environment variables, never in any file.
- [ ] Test it: log in as one captain, then try to open another team's scorecard URL. It should say "Scorecard locked".
- [ ] Give each captain their own login, and ask them to change their password under **My team**.

Players' names, scores and breaks are public, as they are on the current site. Login emails are only visible to the admin.
