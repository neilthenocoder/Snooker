// ─────────────────────────────────────────────────────────────
//  THE GUIDE — "Show me around" (round 48, Rich: "an interactive help of some kind").
//  A few steps that each light up one part of the page with a short note beside it:
//  Next / Back / Skip, and the arrow keys and Esc. It starts by itself the first time
//  someone sees their own home page (if Site settings → Home page → Welcome guide is on),
//  and anyone can start it again from their account menu or the footer ("Show me around").
//  Steps whose part of the page isn't there (no team followed, a phone menu…) are left out.
// ─────────────────────────────────────────────────────────────
const DONE_KEY = "sbds-guide-done-v1";     // this device has seen (or skipped) the guide
const NOW_KEY = "sbds-guide-now";          // "start the guide when the home page has drawn" (after Show me around)

const seen = () => { try { return localStorage.getItem(DONE_KEY) === "1"; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(DONE_KEY, "1"); } catch { /* private browsing */ } };

/** The steps for a logged-in person's own home page, then for everyone else's. */
function steps(personal) {
  const mine = [
    { title: "Welcome to your home page", text: "When you're logged in, the home page is <b>My Snooker</b>: your own page of the league, built round the team and players you follow. This takes about a minute. Use <b>Next</b>, or the arrow keys." },
    { at: "[data-guide=hero]", title: "Your team", text: "Who your page is for. Everything below follows this team." },
    { at: ".ms-teams", title: "More than one team?", text: "Follow more teams and you get a button for each. Press one to see that team's matches, table and players." },
    { at: ".ms-sec-next", title: "Your next match", text: "When and where you play next. Press it for the match preview, and on the night to follow the score live." },
    { at: ".ms-sec-team", title: "How you're doing", text: "League position, games played and won, points, and your last five results." },
    { at: ".ms-sec-fixtures", title: "Your fixtures", text: "Every match to come, with bye weeks. <b>See these on the calendar</b> shows them by month." },
    { at: ".ms-sec-table", title: "The table, round your team", text: "Your team is picked out. Press <b>View full table</b> to see the whole league." },
    { at: ".ms-sec-rankings", title: "Your players in the rankings", text: "The top of the rankings, plus wherever your team's players and the players you follow are, picked out." },
    { at: "[data-guide=settings]", title: "Make it yours", text: "<b>Home page settings</b>: follow more teams and players, tick the sections you want, and use <b>↑ ↓</b> to put the most important first." },
    { at: "[data-guide=normal]", title: "Everyone's home page", text: "Want the news and all the leagues instead? <b>Normal home page</b> shows the page everyone sees. Home brings you back here." },
    { at: ".live-strip", title: "Live and upcoming", text: "Tonight's matches and what's coming up. A green card is being played now: press it to follow it live." },
    { at: ".quick-links", title: "The rest of the league", text: "Competitions, the calendar, handicaps and every team's fixtures are always here." },
    { at: ".nav-account", title: "Your account", text: "Home page settings, your password, and <b>Show me around</b> to see this guide again." },
    { at: ".nav-bell", title: "Notifications", text: "League news and alerts. Choose which ones you get in here." },
    { at: ".nav-search", title: "Search", text: "Find any player, team, venue or news story." },
    { title: "One more thing: Follow", text: "On any team or player page, press <b>☆ Follow</b> to add them to your home page. That's it. Enjoy the snooker!" },
  ];
  const all = [
    { title: "Welcome!", text: "A quick look round the St Blazey & District Snooker League website. Use <b>Next</b>, or the arrow keys." },
    { at: ".live-strip", title: "Live and upcoming", text: "Tonight's matches and what's coming up. A green card is being played now: press it to follow it live." },
    { at: ".quick-links", title: "Find your way", text: "Competitions, the calendar, handicaps and every team's fixtures." },
    { at: ".main-nav", title: "The menu", text: "Results, tables, competitions and news, all from here." },
    { at: ".ms-invite", title: "Make this page your own", text: "Log in and the home page becomes <b>My Snooker</b>: your team's table, fixtures, results, rankings and breaks, in the order you choose." },
    { at: ".nav-account", title: "Log in", text: "Players, captains and officers log in here. Your login comes from the league secretary." },
    { at: ".nav-search", title: "Search", text: "Find any player, team, venue or news story." },
  ];
  return personal ? mine : all;
}

const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };

let stopCurrent = null;

/** Run the guide now. personal: the logged-in home page version. */
export function startGuide({ personal = false } = {}) {
  stopCurrent?.();
  const list = steps(personal).filter((s) => !s.at || visible(document.querySelector(s.at)));
  if (!list.length) return;
  let at = 0;
  const shade = Object.assign(document.createElement("div"), { className: "guide-shade" });
  const spot = Object.assign(document.createElement("div"), { className: "guide-spot" });
  const tip = Object.assign(document.createElement("div"), { className: "guide-tip" });
  tip.setAttribute("role", "dialog"); tip.setAttribute("aria-modal", "true"); tip.setAttribute("aria-live", "polite");
  document.body.append(shade, spot, tip);
  document.documentElement.classList.add("guide-on");

  const place = () => {
    const step = list[at], el = step.at && document.querySelector(step.at);
    const pad = 8, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    if (!el) {                                        // a step about the whole page: in the middle, no spotlight
      spot.classList.add("none"); tip.classList.add("middle"); shade.style.clipPath = "none";
      tip.style.left = `${Math.max(12, (vw - tip.offsetWidth) / 2)}px`; tip.style.top = `${Math.max(12, (vh - tip.offsetHeight) / 2)}px`;
      return;
    }
    spot.classList.remove("none"); tip.classList.remove("middle");
    const r = el.getBoundingClientRect();
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    // The dimmed layer has a hole cut where the part being shown is (so it stays bright, and can be pressed).
    const [L, T, R, B] = [r.left - pad, r.top - pad, r.right + pad, r.bottom + pad];
    shade.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${L}px ${T}px, ${L}px ${B}px, ${R}px ${B}px, ${R}px ${T}px, ${L}px ${T}px)`;
    // The note goes underneath if there's room, otherwise above; kept inside the screen.
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const below = r.bottom + pad + 12 + th < vh || r.top - pad - 12 - th < 0;
    const top = below ? Math.min(vh - th - 12, r.bottom + pad + 12) : Math.max(12, r.top - pad - 12 - th);
    const left = Math.min(vw - tw - 12, Math.max(12, r.left + r.width / 2 - tw / 2));
    tip.style.left = `${left}px`; tip.style.top = `${Math.max(12, top)}px`;
  };
  const draw = () => {
    const step = list[at], last = at === list.length - 1;
    tip.innerHTML = `<div class="guide-count">${at + 1} of ${list.length}</div>
      <h3 class="guide-title">${step.title}</h3><p class="guide-text">${step.text}</p>
      <div class="guide-dots" aria-hidden="true">${list.map((_, i) => `<i class="${i === at ? "on" : i < at ? "done" : ""}"></i>`).join("")}</div>
      <div class="guide-btns">
        ${last ? "" : `<button type="button" class="guide-skip" data-g="skip">Skip</button>`}
        <span></span>
        ${at ? `<button type="button" class="btn small ghost" data-g="back">Back</button>` : ""}
        <button type="button" class="btn small" data-g="next">${last ? "Finish" : "Next"}</button>
      </div>`;
    tip.setAttribute("aria-label", step.title);
    const el = step.at && document.querySelector(step.at);
    if (el) {
      // Bring it into view first (below the sticky menu bar), then put the spotlight on it.
      const r = el.getBoundingClientRect(), head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 80;
      const fits = r.top >= head + 10 && r.bottom <= window.innerHeight - 180;
      const fixedEl = getComputedStyle(el).position === "fixed" || el.closest(".site-header");
      if (!fits && !fixedEl) window.scrollTo({ top: window.scrollY + r.top - head - 24, behavior: "smooth" });
    }
    place();
    setTimeout(place, 380); setTimeout(place, 700);   // again once the smooth scroll has settled
    tip.querySelector('[data-g="next"]').focus({ preventScroll: true });
  };
  const go = (n) => { if (n >= list.length) return end(); at = Math.max(0, n); draw(); };
  const end = () => {
    markSeen();
    shade.remove(); spot.remove(); tip.remove();
    document.documentElement.classList.remove("guide-on");
    window.removeEventListener("resize", place); window.removeEventListener("scroll", place);
    document.removeEventListener("keydown", keys, true);
    document.removeEventListener("click", pressedPage, true);
    stopCurrent = null;
  };
  const keys = (e) => {
    if (e.key === "Escape") { e.preventDefault(); end(); }
    else if (e.key === "ArrowRight" || e.key === "Enter") { if (e.key === "Enter" && e.target.closest?.("[data-g]")) return; e.preventDefault(); go(at + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); }
  };
  tip.addEventListener("click", (e) => {
    const b = e.target.closest("[data-g]");
    if (!b) return;
    if (b.dataset.g === "next") go(at + 1); else if (b.dataset.g === "back") go(at - 1); else end();
  });
  shade.addEventListener("click", () => go(at + 1));
  // Pressing the lit-up part itself (Home page settings, a match…) does what it normally does, and the guide closes.
  const pressedPage = (e) => { if (!tip.contains(e.target) && e.target !== shade) end(); };
  document.addEventListener("click", pressedPage, true);
  window.addEventListener("resize", place, { passive: true });
  window.addEventListener("scroll", place, { passive: true });
  document.addEventListener("keydown", keys, true);
  stopCurrent = end;
  draw();
}

/**
 * Called by the home page once it has drawn: starts the guide if "Show me around" was just pressed, or —
 * the first time on this device — for a logged-in person's own home page when the league has the guide on.
 */
export function maybeStartGuide({ personal, site }) {
  let asked = false;
  try { asked = sessionStorage.getItem(NOW_KEY) === "1"; sessionStorage.removeItem(NOW_KEY); } catch { /* nothing remembered */ }
  if (asked || (personal && site?.home_sections?.guide_on !== false && !seen())) setTimeout(() => startGuide({ personal }), asked ? 300 : 900);
}

/** "Show me around": go to the home page (if not there) and start the guide when it has drawn. */
export function requestGuide(navigate) {
  try { sessionStorage.setItem(NOW_KEY, "1"); } catch { /* falls back to starting it here */ }
  if (location.pathname === "/" && !new URLSearchParams(location.search).has("home")) {
    try { sessionStorage.removeItem(NOW_KEY); } catch { /* */ }
    return startGuide({ personal: !!document.querySelector("[data-guide=hero]") });
  }
  navigate("/");
}
