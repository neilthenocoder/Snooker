// ─────────────────────────────────────────────────────────────
//  THE WELCOME SET-UP (round 111 — Rich's feedback 111, "New feature")
//
//  The first time someone opens the website or the app on a phone or computer, a
//  few app-style screens set it up for them:
//    loading → welcome ("Don't miss a frame!") → teams to follow → notifications
//    → competitions to follow → make a login → their profile → all set.
//  Back arrow top left, a bar along the top showing how far through they are, and
//  "Skip" on every step.
//
//  "Can we identify by IP …? Sometimes two people can have the same IP … What's your
//  best approach?" — not by internet address: a whole club on one Wi-Fi (or a phone
//  network) shares one address, so most people would never see it, and the address
//  is personal data we'd rather not keep. Instead each browser remembers it has been
//  through the set-up (localStorage). Admin → Site settings → Home page → Welcome
//  set-up switches it on, sets the date it stops (the "timer"), whether people can
//  make their own login in it until then, and can show it to everyone again.
//
//  What they choose before they have a login (teams, competitions) is kept in this
//  browser and added to their My Snooker the first time they log in (applyPendingPicks).
// ─────────────────────────────────────────────────────────────
import { html, mount, $, $$, toast } from "./dom.js";
import { settings, currentCompetitions, setMyPrefs, newsletterSubscribe } from "./api.js";
import { seasonContext } from "./context.js";
import { getUser, signInChecked, myPrefs, refreshUser } from "./auth.js";
import { selfSignup } from "./db.js";
import { NOTIFY_KINDS, notifyPrefs, setNotifyPref, notificationsOn, setNotifications } from "./notify.js";
import { prefsToSave } from "./my-snooker.js";
import { badge } from "./components.js";
import { refreshShell } from "./router.js";

const DONE_KEY = "sbds-onboard";          // { round, how: "finished" | "skipped", at }
const PICKS_KEY = "sbds-onboard-picks";   // { teams: [ids], comps: [ids] } waiting for their first login
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: shows again next time */ } };
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

/** Is the set-up switched on today? */
export function onboardOn(site) {
  const h = site?.home_sections ?? {};
  if (!h.onboard_on) return false;
  const until = String(h.onboard_until ?? "").slice(0, 10);
  return !until || ukToday() <= until;
}
/** Can people make their own login in it today? (The server checks the same — netlify/functions/signup.mjs.) */
export const signupOpen = (site) => onboardOn(site) && !!site?.home_sections?.onboard_signup;
const roundOf = (site) => Math.max(1, Number(site?.home_sections?.onboard_round) || 1);
/** Has this browser been through this round of the set-up? */
const seen = (site) => { const d = read(DONE_KEY, null); return !!d && (typeof d === "string" || Number(d.round || 1) >= roundOf(site)); };

// ── icons (line icons, like the phone menu) ─────────────────────
const svg = (d, size = 24, w = 2) => html`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const I = {
  back: "m15 6-6 6 6 6", close: "M6 6l12 12M18 6 6 18", check: "m5 12.5 4.5 4.5L19 7",
  cup: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0", eye: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};
/** The notification kinds worth asking about on the first day (the rest stay on, and are under the bell). */
const ASK_KINDS = ["results", "breaks", "breaking", "news", "comps", "leaders"];

// The steps, in order. The bar along the top counts the ones between the welcome and "all set".
const STEPS = ["welcome", "teams", "notify", "comps", "account", "profile", "done"];
const BAR = ["teams", "notify", "comps", "account", "profile"];

let shown = false;

/**
 * Called once a public page has drawn (main.js). Shows the set-up when it is switched on, nobody is logged in,
 * and this browser hasn't been through it. Returns true if it is showing (so the newsletter pop-up waits).
 */
export async function maybeOnboard(page, site, user, { force = false } = {}) {
  if (shown) return true;
  if (force) history.replaceState(null, "", location.pathname);
  if (!force && (user || !onboardOn(site) || seen(site))) return false;
  if (["admin", "login", "my", "scorecard", "cup-scorecard", "unsubscribe", "market-edit"].includes(page)) return false;
  if (!force && (navigator.webdriver || /bot|crawl|spider|lighthouse/i.test(navigator.userAgent))) return false;   // search engines and test robots
  shown = true;
  open(site).catch((err) => { console.error(err); close("skipped"); });
  return true;
}

/** After someone logs in: add the teams and competitions they picked in the set-up to their My Snooker (once). */
export async function applyPendingPicks(user) {
  const picks = read(PICKS_KEY, null);
  if (!user?.profile || !picks || (!picks.teams?.length && !picks.comps?.length)) return false;
  const p = myPrefs(user);
  const merge = (a, b) => [...new Set([...(a ?? []), ...(b ?? [])])];
  try {
    await setMyPrefs(true, prefsToSave({ ...p, teams: merge(picks.teams, p.teams), comps: merge(p.comps, picks.comps) }));
    try { localStorage.removeItem(PICKS_KEY); } catch { /* fine */ }
    await refreshUser();
    return true;
  } catch { return false; }
}

// ── the screens ─────────────────────────────────────────────────
let root = null, state = null, lastFocus = null;

function close(how = "finished") {
  write(DONE_KEY, { round: state ? roundOf(state.site) : 1, how, at: new Date().toISOString() });
  if (state && !state.account?.profile && (state.teams.size || state.comps.size)) write(PICKS_KEY, { teams: [...state.teams], comps: [...state.comps] });
  document.documentElement.classList.remove("ob-open");
  root?.classList.remove("in");
  const el = root; setTimeout(() => el?.remove(), 260);
  root = null; shown = false;
  document.removeEventListener("keydown", onKey);
  lastFocus?.focus?.({ preventScroll: true });
}
const onKey = (e) => { if (e.key === "Escape" && root) { e.preventDefault(); close("skipped"); } };

async function open(site) {
  lastFocus = document.activeElement;
  state = { site, step: "splash", teams: new Set(), comps: new Set(), name: "", email: "", account: null, confirm: false, ctx: null, cups: [], dir: 1 };
  root = document.createElement("div");
  root.className = "ob";
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Welcome");
  document.body.append(root);
  document.documentElement.classList.add("ob-open");
  document.addEventListener("keydown", onKey);
  // 1. The loading screen, while the teams and competitions load.
  mount(root, html`<div class="ob-sheet"><div class="ob-splash">
    <span class="ob-splash__logo"><img src="${site.logo_url || "/assets/logo.svg"}" alt=""></span>
    <span class="ob-splash__bar" aria-hidden="true"><i></i></span><span class="sr-only">Loading</span></div></div>`);
  requestAnimationFrame(() => root?.classList.add("in"));
  const started = Date.now();
  const [ctx, cups] = await Promise.all([seasonContext().catch(() => null), currentCompetitions().catch(() => ({ competitions: [] }))]);
  if (!root) return;
  state.ctx = ctx;
  state.cups = (cups.competitions ?? []).filter((c) => !c.season_id || c.season_id === ctx?.season?.id);
  await new Promise((r) => setTimeout(r, Math.max(0, 1100 - (Date.now() - started))));
  if (!root) return;
  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);
  go("welcome");
}

function go(step, dir = 1) {
  state.dir = dir; state.step = step;
  const sheet = $(".ob-sheet", root);
  const i = BAR.indexOf(step);
  const head = step === "welcome" || step === "done" ? html`<div class="ob-top ob-top--bare">
      <button type="button" class="ob-icon ob-x" data-ob-close aria-label="Close the welcome">${svg(I.close)}</button></div>`
    : html`<div class="ob-top">
      <button type="button" class="ob-icon" data-ob-back aria-label="Back">${svg(I.back)}</button>
      <span class="ob-bar" role="progressbar" aria-label="Set-up" aria-valuemin="1" aria-valuemax="${BAR.length}" aria-valuenow="${i + 1}"><i style="width:${((i + 1) / BAR.length) * 100}%"></i></span>
      <button type="button" class="ob-skip" data-ob-skip>Skip</button></div>`;
  mount(sheet, html`${head}<div class="ob-screen ob-screen--${step} ${dir < 0 ? "from-left" : "from-right"}" data-step="${step}">${SCREENS[step]()}</div>`);
  // keep the bar's animation: draw it at the old width first, then the new one
  const bar = $(".ob-bar i", sheet);
  if (bar && state.barWas != null) { const to = bar.style.width; bar.style.width = state.barWas; void bar.offsetWidth; bar.style.width = to; }
  state.barWas = bar ? bar.style.width : null;
  // People take more than 3 seconds to fill in the login form; robots don't (the server checks it).
  if ($("[data-ob-signup]", sheet)) state.formAt = Date.now();
  requestAnimationFrame(() => { $(".ob-screen", sheet)?.classList.add("on"); ($("[autofocus]", sheet) || $("h1", sheet))?.focus({ preventScroll: true }); });
}
const next = () => go(STEPS[STEPS.indexOf(state.step) + 1]);
const back = () => go(STEPS[Math.max(0, STEPS.indexOf(state.step) - 1)], -1);
const actions = (main, { skip = true, label = "Continue", disabled = false } = {}) => html`<div class="ob-actions">
  <button type="${main === "submit" ? "submit" : "button"}" class="ob-btn" ${main === "submit" ? "" : html`data-ob-next`} ${disabled ? "disabled" : ""}>${label}</button>
  ${skip ? html`<button type="button" class="ob-link" data-ob-skip>Skip</button>` : ""}</div>`;

const SCREENS = {
  // 3. Welcome
  welcome: () => {
    const h = state.site.home_sections ?? {};
    return html`<div class="ob-hero" aria-hidden="true"><span class="ob-hero__logo"><img src="${state.site.logo_url || "/assets/logo.svg"}" alt=""></span>
        <span class="ob-ball ob-ball--r"></span><span class="ob-ball ob-ball--y"></span><span class="ob-ball ob-ball--k"></span></div>
      <div class="ob-body ob-body--welcome"><h1 tabindex="-1">${h.onboard_title || "Don't miss a frame!"}</h1>
        <p>${h.onboard_text || "Get live match notifications and match results from your favourite teams and players, plus all the results from our competitions."}</p></div>
      <div class="ob-actions"><button type="button" class="ob-btn" data-ob-next autofocus>Get started</button>
        <button type="button" class="ob-link" data-ob-have>I already have an account</button></div>`;
  },
  // 4. Teams
  teams: () => html`<div class="ob-body"><h1 tabindex="-1">Pick a few teams to follow</h1>
      <p>Their matches, results and news will be on your <b>My Snooker</b> page.</p>
      ${(state.ctx?.leagues ?? []).map((l) => html`<h2 class="ob-h2">${l.name}</h2><div class="ob-grid">
        ${state.ctx.teamsIn(l.id).map((t) => html`<button type="button" class="ob-pick ${state.teams.has(t.id) ? "on" : ""}" data-ob-team="${t.id}" aria-pressed="${state.teams.has(t.id)}">
          ${badge(t)}<span class="ob-pick__name">${t.name}</span><span class="ob-tick">${svg(I.check, 16, 3)}</span></button>`)}</div>`)}
    </div>${actions("next")}`,
  // 5. Notifications
  notify: () => {
    const on = notificationsOn(), prefs = notifyPrefs();
    return html`<div class="ob-body"><h1 tabindex="-1">Choose your notifications</h1>
      <p>Pop-ups on the website while you have it open — as frames are won, breaks are made and news breaks. Change them any time with the bell.</p>
      <label class="ob-switch ob-switch--all"><span class="ob-switch__ico">${svg(I.bell)}</span><span class="ob-switch__text"><b>Notifications</b><small>All of them on or off</small></span>
        <input type="checkbox" data-ob-notify-all ${on ? "checked" : ""}><i aria-hidden="true"></i></label>
      <div class="ob-list" data-ob-kinds ${on ? "" : "hidden"}>${NOTIFY_KINDS.filter(([k]) => ASK_KINDS.includes(k)).map(([key, label, about]) => html`<label class="ob-switch">
        <span class="ob-switch__text"><b>${label}</b><small>${about}</small></span><input type="checkbox" data-ob-kind="${key}" ${prefs[key] ? "checked" : ""}><i aria-hidden="true"></i></label>`)}</div>
    </div>${actions("next")}`;
  },
  // 6. Competitions
  comps: () => html`<div class="ob-body"><h1 tabindex="-1">Pick a few competitions to follow</h1>
      <p>Every match of them will be on your <b>My Snooker</b> page.</p>
      ${state.cups.length ? html`<div class="ob-list">${state.cups.map((c) => html`<button type="button" class="ob-row ${state.comps.has(c.id) ? "on" : ""}" data-ob-comp="${c.id}" aria-pressed="${state.comps.has(c.id)}">
        <span class="ob-row__ico">${svg(I.cup, 22, 1.8)}</span><span class="ob-row__text"><b>${c.name}</b>${c.kind ? html`<small>${String(c.kind).replace(/_/g, " ")}</small>` : ""}</span>
        <span class="ob-tick">${svg(I.check, 16, 3)}</span></button>`)}</div>` : html`<p class="ob-empty">No competitions this season yet.</p>`}
    </div>${actions("next")}`,
  // 7. Make a login (or log in)
  account: () => {
    if (state.account) return html`<div class="ob-body"><h1 tabindex="-1">${state.confirm ? "Check your email" : "You're logged in"}</h1>
      <p>${state.confirm ? html`We've sent a link to <b>${state.email}</b>. Press it to finish making your login — then log in with your email and password, and everything you picked here will be on your My Snooker page.` : html`Your choices are saved to your login.`}</p></div>${actions("next", { skip: false })}`;
    const can = signupOpen(state.site), login = state.mode === "login" || !can;
    return login ? html`<form class="ob-body ob-form" data-ob-login novalidate><h1 tabindex="-1">Log in</h1>
        <p>${can ? "Log in with the email address and password of your login." : "Logins come from the league — players, captains and officers get theirs from the league secretary. Got one? Log in to keep your choices."}</p>
        <label class="ob-field"><span>Email address</span><input name="email" type="email" autocomplete="email" required maxlength="254" autofocus></label>
        <label class="ob-field"><span>Password</span><span class="ob-pw"><input name="password" type="password" autocomplete="current-password" required maxlength="72"><button type="button" class="ob-icon ob-eye" data-ob-eye aria-label="Show the password">${svg(I.eye, 20, 1.8)}</button></span></label>
        <p class="ob-error" data-ob-error role="alert"></p>
        ${can ? html`<button type="button" class="ob-link ob-link--left" data-ob-mode="signup">New here? Make a login</button>` : ""}
        <div class="ob-actions"><button class="ob-btn">Log in</button><button type="button" class="ob-link" data-ob-skip>Not now</button></div></form>`
      : html`<form class="ob-body ob-form" data-ob-signup novalidate><h1 tabindex="-1">Create an account</h1>
        <p>Keep your teams and competitions on any phone or computer, and use My Snooker.</p>
        <label class="ob-field"><span>Your name</span><input name="full_name" autocomplete="name" required maxlength="120" value="${state.name}" autofocus></label>
        <label class="ob-field"><span>Email address</span><input name="email" type="email" autocomplete="email" required maxlength="254" value="${state.email}"></label>
        <label class="ob-field"><span>Password <small>at least 8 characters, with a letter and a number</small></span><span class="ob-pw"><input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="72"><button type="button" class="ob-icon ob-eye" data-ob-eye aria-label="Show the password">${svg(I.eye, 20, 1.8)}</button></span></label>
        <label class="ob-hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
        <label class="ob-check"><input type="checkbox" name="agree" required><span>I agree to the <a href="/page/terms-of-use" target="_blank" rel="noopener">Terms of Use</a> and <a href="/page/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a></span></label>
        <p class="ob-error" data-ob-error role="alert"></p>
        <button type="button" class="ob-link ob-link--left" data-ob-mode="login">I already have an account</button>
        <div class="ob-actions"><button class="ob-btn">Continue</button><button type="button" class="ob-link" data-ob-skip>Not now</button></div></form>`;
  },
  // 8. Profile
  profile: () => {
    const teams = (state.ctx?.leagues ?? []).flatMap((l) => state.ctx.teamsIn(l.id).map((t) => ({ t, l })));
    return html`<form class="ob-body ob-form" data-ob-profile><h1 tabindex="-1">Complete your profile</h1>
      <p>A couple of things so the website fits you.</p>
      <fieldset class="ob-field"><legend>Do you play in the league?</legend>
        <span class="ob-seg"><label><input type="radio" name="plays" value="yes" ${state.plays === "yes" ? "checked" : ""}><span>Yes</span></label><label><input type="radio" name="plays" value="no" ${state.plays === "no" ? "checked" : ""}><span>No, I follow it</span></label></span></fieldset>
      <label class="ob-field" data-ob-myteam ${state.plays === "yes" ? "" : "hidden"}><span>Your team</span><select name="team"><option value="">Choose your team…</option>
        ${teams.map(({ t, l }) => html`<option value="${t.id}" ${state.myTeam === t.id ? "selected" : ""}>${t.name} — ${l.name}</option>`)}</select>
        <small>Your team comes first on your My Snooker page. The league links your login to your player profile.</small></label>
      <label class="ob-check"><input type="checkbox" name="newsletter" ${state.newsletter ? "checked" : ""}><span><b>Send me the newsletter</b><br><small>Results, competition draws and league news by email${state.email ? html` to ${state.email}` : ""}. Unsubscribe any time.</small></span></label>
      ${state.email ? "" : html`<label class="ob-field" data-ob-nlmail ${state.newsletter ? "" : "hidden"}><span>Email for the newsletter</span><input name="nl_email" type="email" autocomplete="email" maxlength="254"></label>`}
      <p class="ob-error" data-ob-error role="alert"></p>
      <div class="ob-actions"><button class="ob-btn">Finish</button><button type="button" class="ob-link" data-ob-skip>Skip</button></div></form>`;
  },
  // 9. All set
  done: () => html`<div class="ob-body ob-body--done"><span class="ob-done" aria-hidden="true">${svg(I.check, 44, 2.6)}</span>
      <h1 tabindex="-1">${state.account && !state.confirm ? "Account set up successfully" : state.confirm ? "Nearly there!" : "You're all set"}</h1>
      <p>${state.confirm ? "Confirm your email with the link we've sent, then log in." : ""}
        ${state.teams.size || state.comps.size ? `You're following ${[state.teams.size && `${state.teams.size} team${state.teams.size > 1 ? "s" : ""}`, state.comps.size && `${state.comps.size} competition${state.comps.size > 1 ? "s" : ""}`].filter(Boolean).join(" and ")}${state.account && !state.confirm ? " — they're on your My Snooker page." : " — they'll be on your My Snooker page when you log in."}` : "Find everything from the menu, any time."}</p></div>
    <div class="ob-actions">${state.account && !state.confirm ? html`<a class="ob-btn" href="/mysnooker" data-ob-finish>Open My Snooker</a><button type="button" class="ob-link" data-ob-finish>Start exploring</button>`
      : html`<button type="button" class="ob-btn" data-ob-finish>Start exploring</button>`}</div>`,
};

// ── what each press does ────────────────────────────────────────
function onClick(e) {
  const t = e.target;
  if (t.closest("[data-ob-close]")) return close("skipped");
  if (t.closest("[data-ob-finish]")) return close("finished");
  if (t.closest("[data-ob-back]")) return back();
  if (t.closest("[data-ob-skip]")) return next();
  if (t.closest("[data-ob-next]")) return next();
  if (t.closest("[data-ob-have]")) { state.mode = "login"; return go("account"); }
  const mode = t.closest("[data-ob-mode]"); if (mode) { state.mode = mode.dataset.obMode; return go("account"); }
  const eye = t.closest("[data-ob-eye]");
  if (eye) { const i = eye.parentElement.querySelector("input"); const show = i.type === "password"; i.type = show ? "text" : "password"; eye.setAttribute("aria-label", show ? "Hide the password" : "Show the password"); eye.classList.toggle("on", show); return; }
  const pick = t.closest("[data-ob-team], [data-ob-comp]");
  if (pick) {
    const set = pick.dataset.obTeam ? state.teams : state.comps, id = pick.dataset.obTeam || pick.dataset.obComp;
    set.has(id) ? set.delete(id) : set.add(id);
    pick.classList.toggle("on", set.has(id)); pick.setAttribute("aria-pressed", String(set.has(id)));
    return;
  }
  if (t.matches("[data-ob-notify-all]")) { setNotifications(t.checked); $("[data-ob-kinds]", root).hidden = !t.checked; return; }
  if (t.matches("[data-ob-kind]")) return setNotifyPref(t.dataset.obKind, t.checked);
  if (t.matches("[name=plays]")) { state.plays = t.value; const f = $("[data-ob-myteam]", root); if (f) f.hidden = t.value !== "yes"; return; }
  if (t.matches("[name=newsletter]")) { state.newsletter = t.checked; const f = $("[data-ob-nlmail]", root); if (f) f.hidden = !t.checked; }
}

const fail = (form, msg) => { const el = $("[data-ob-error]", form); el.textContent = msg; const b = form.querySelector(".ob-btn"); if (b) { b.disabled = false; b.textContent = b.dataset.was || b.textContent; } };
const busy = (form, text) => { const b = form.querySelector(".ob-btn"); b.dataset.was = b.textContent; b.disabled = true; b.textContent = text; $("[data-ob-error]", form).textContent = ""; };

async function saveToLogin(user) {
  if (!user?.profile) return;
  const p = myPrefs(user);
  const teams = [...new Set([...(state.myTeam ? [state.myTeam] : []), ...state.teams, ...p.teams])];
  await setMyPrefs(true, prefsToSave({ ...p, teams, comps: [...new Set([...p.comps, ...state.comps])] }));
  await refreshUser();
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.target, f = form.elements;
  if (form.matches("[data-ob-login]")) {
    const email = f.email.value.trim(), password = f.password.value;
    if (!email || !password) return fail(form, "Please type your email address and password.");
    busy(form, "Logging in…");
    try {
      const user = await signInChecked(email, password);
      state.account = user; state.email = email; state.name = user?.profile?.full_name || "";
      await saveToLogin(user).catch(() => {});
      refreshShell();
      go("account");
    } catch (err) { fail(form, err.message || "That email and password don't match."); }
    return;
  }
  if (form.matches("[data-ob-signup]")) {
    const full_name = f.full_name.value.trim(), email = f.email.value.trim(), password = f.password.value;
    state.name = full_name; state.email = email;
    if (full_name.length < 2) return fail(form, "Please type your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(form, "Please type your email address, like name@example.com.");
    if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) return fail(form, "Your password needs at least 8 characters, with a letter and a number.");
    if (!f.agree.checked) return fail(form, "Please tick to agree to the Terms of Use and Privacy Policy.");
    busy(form, "Creating your account…");
    try {
      const res = await selfSignup({ full_name, email, password, website: f.website.value, took_ms: Date.now() - (state.formAt ?? 0) });
      state.confirm = !!res.confirm;
      if (!res.confirm) {         // the demo (no email to confirm): log straight in
        const user = await signInChecked(email, password);
        state.account = user;
        await saveToLogin(user).catch(() => {});
        refreshShell();
      } else state.account = { pending: true };
      go("account");
    } catch (err) { fail(form, err.message); }
    return;
  }
  if (form.matches("[data-ob-profile]")) {
    state.myTeam = state.plays === "yes" ? f.team.value || null : null;
    const nlEmail = state.email || f.nl_email?.value.trim();
    busy(form, "Saving…");
    try {
      if (state.myTeam) {
        if (state.account?.profile) await saveToLogin(state.account);
        else state.teams = new Set([state.myTeam, ...state.teams]);
      }
      if (state.newsletter && nlEmail) await newsletterSubscribe(nlEmail, state.name).then(() => write("sbds-newsletter", "subscribed"));
      next();
    } catch (err) { fail(form, err.message); }
  }
}

/** The footer's "Show me the welcome again" (and Admin's preview). */
export async function startOnboarding() {
  const [site, user] = await Promise.all([settings(), getUser()]);
  if (user) { toast("You're logged in already — change what you follow in My Snooker settings."); return; }
  shown = false;
  maybeOnboard("home", site, null, { force: true });
}
