# St Blazey & District Snooker League — website

A fast, plain HTML/CSS/JavaScript website (no build step) with:

- **Public site**: home page with league tables, fixtures and results, team pages, match scorecards, venues, news, competitions, standings, handicaps and a **Live** page.
- **Captain area**: captains and vice captains log in, see their own team's fixtures, and enter scorecards frame by frame on match night. Each save updates the live page for everyone, straight away.
- **Admin dashboard**: approve results, and manage fixtures, the fixture generator, teams, players, venues, leagues, seasons, logins, news/competitions, info pages and sponsors.
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
2. Open **SQL Editor → New query**, paste in all of **`supabase/schema.sql`** and press **Run**. This creates the tables and the security rules.
3. *(Optional)* Run **`supabase/seed.sql`** the same way to load the sample league. You can delete it later from the admin dashboard, or skip this step and enter your real teams.
4. Go to **Authentication → Sign In / Providers** and turn **off "Allow new users to sign up"**. Only the admin should create accounts.

### b) Create your own admin login

1. Go to **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
2. In the **SQL Editor**, run this, using your own email:

   ```sql
   insert into profiles (id, email, full_name, role)
   select id, email, 'League Admin', 'admin' from auth.users where email = 'you@example.com';
   ```

### c) Connect the website

1. In Supabase, go to **Project Settings → API**. Copy the **Project URL** and the **anon / publishable** key.
2. Paste them into **`public/js/config.js`**:

   ```js
   export const SUPABASE_URL = "https://xxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...";
   ```

   The anon key is designed to be public. The database security rules protect the data, not this key.

### d) Deploy to Netlify, with the logins function

The admin "Logins" page uses a small server function, because creating accounts needs a **secret** key that must never be in the browser. Netlify Drop doesn't run functions, so deploy the whole folder instead.

**Option 1: GitHub (recommended).**
1. Push this whole folder to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project** and pick the repository. The settings come from `netlify.toml` automatically.

**Option 2: Netlify CLI.** Run `npm install`, then `npx netlify deploy --prod` in this folder.

Then, in Netlify, go to **Site configuration → Environment variables** and add:

| Key | Value |
|---|---|
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role / secret** key (keep it secret!) |

Redeploy once after adding the variables. Now log in at `/login` and create captain logins under **Admin → Logins**.

---

## 3. Match night: how it works

1. **Captain** logs in on their phone, which opens **My team**. They press **Enter scorecard** on tonight's match.
2. After each frame, they pick the two players, type both scores and add any breaks, then press **Save**. The **Live** page and the match page update for everyone within a second or two.
3. At the end of the night, they press **Submit final result**.
4. **Admin** opens **Results to approve**, checks the scorecard and presses **Approve**. Approved results are locked for captains, but the admin can still edit them.

Tables and rankings count **submitted** and **approved** results. To make tables move live during the evening instead, add `"in_progress"` to `countedStatuses` in `public/js/core/rules.js`.

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
  assets/                   ← logo.svg and avatar.svg (replace with the real logo)
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
      db.js                 ← picks real Supabase or the demo database
      demo-client.js        ← the in-browser demo database
      router.js             ← navigate() / setTitle() for pages
    pages/                  ← one small file per page (home, team, match, …)
    admin/
      resources.js          ← describes each admin section (add a field = add a line)
      crud.js               ← one list/search/form engine used by every section
    demo/seed-data.js       ← sample league (imaginary players)
supabase/
  schema.sql                ← tables + security rules (run once)
  seed.sql                  ← optional sample data (generated: npm run seed)
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
| Use the real logo | Replace `public/assets/logo.svg` |
| Add the header photo | Add `--header-img: url("/assets/header.jpg");` to `.site-header` in `style.css` |
| Change colours or fonts | The `:root` block at the top of `style.css` |
| Change the footer text | `SITE` in `js/config.js` |
| Add sponsors, news, rules pages | Admin dashboard (no code) |
| Create next season's fixtures | Admin → Seasons (add, tick "current"), then Admin → Fixture generator |

## 7. Security checklist before launch

- [ ] Public sign-ups turned **off** in Supabase (step 2a.4).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in Netlify environment variables, never in any file.
- [ ] Test it: log in as one captain, then try to open another team's scorecard URL. It should say "Scorecard locked".
- [ ] Give each captain their own login, and ask them to change their password under **My team**.

Players' names, scores and breaks are public, as they are on the current site. Login emails are only visible to the admin.
