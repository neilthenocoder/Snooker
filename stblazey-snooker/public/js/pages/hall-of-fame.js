// ─────────────────────────────────────────────────────────────
//  HALL OF FAME (Rich, round 23 — a player's idea): achievements past and present,
//  the league's history, and memories people send in.
//    /hall-of-fame          everything approved, by category, featured ones first
//    /hall-of-fame/:id      one entry: the story, achievements, pictures and a quote
//    /hall-of-fame/submit   "Share a memory": anyone can send one in; it waits for the
//                           league (Admin → Website → Hall of Fame). Pictures need a login.
// ─────────────────────────────────────────────────────────────
import { html, mount, $, toast, paragraphs } from "../core/dom.js";
import { hallOfFame, submitMemory, settings, table } from "../core/api.js";
import { breadcrumb, urls, gallery, quoteBox } from "../core/components.js";
import { markup } from "../core/markup.js";
import { setTitle, adminEdit } from "../core/router.js";
import { uploadImage } from "../core/upload.js";

const lines = (t) => String(t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
const href = (e) => `/hall-of-fame/${e.no ?? e.id}`;
const pic = (e) => (Array.isArray(e.images) ? e.images[0] : null);

export default async function hallOfFamePage(view, { params, user }) {
  if (params.id === "submit") return submitForm(view, user);
  const [all, site, players] = await Promise.all([hallOfFame().catch(() => []), settings(), table("players", "full_name").catch(() => [])]);
  const list = all.filter((e) => e.status === "approved");
  const crumbs = [["Home", "/"], ["Our League", "/league"], ["Hall of Fame", params.id ? "/hall-of-fame" : null]];
  if (params.id) {
    const e = list.find((x) => String(x.no) === params.id || x.id === params.id);
    if (!e) { setTitle("Hall of Fame"); return mount(view, html`<div class="wrap">${breadcrumb(crumbs)}<h1>Not found</h1><div class="empty box">This entry isn't in the Hall of Fame (yet). <a href="/hall-of-fame">See them all</a></div></div>`); }
    setTitle(e.title);
    adminEdit("hall_of_fame", e.id);
    const player = players.find((p) => p.id === e.player_id);
    return mount(view, html`<div class="wrap hof-entry">
      ${breadcrumb([...crumbs, [e.title]])}
      <p class="hof-cat">${e.category}${e.year ? ` · ${e.year}` : ""}</p>
      <h1>${e.title}</h1>
      ${e.subject ? html`<p class="hof-subject">${player ? html`<a href="${urls.player(player)}">${e.subject}</a>` : e.subject}</p>` : ""}
      <div class="hof-layout">
        <div class="stack">
          ${pic(e) ? html`<img class="hof-hero" src="${pic(e)}" alt="" data-lightbox="${pic(e)}">` : ""}
          ${e.body ? html`<div class="prose">${markup(e.body)}</div>` : ""}
          ${quoteBox(e.quote, e.quote_by)}
          ${e.images?.length > 1 ? html`<div><h3>Pictures</h3>${gallery(e.images.slice(1))}</div>` : ""}
          ${e.submitted_by ? html`<p class="muted">Shared by ${e.submitted_by}</p>` : ""}
        </div>
        ${lines(e.achievements).length ? html`<aside class="hof-ach box"><h3>Achievements</h3><ul>${lines(e.achievements).map((a) => html`<li>🏆 ${a}</li>`)}</ul></aside>` : ""}
      </div>
      <p><a class="btn ghost" href="/hall-of-fame">‹ The Hall of Fame</a> <a class="btn" href="/hall-of-fame/submit">Share a memory</a></p>
    </div>`);
  }
  setTitle("Hall of Fame");
  adminEdit("hall_of_fame", null, { label: "Edit the Hall of Fame" });
  const cats = [...new Set(list.map((e) => e.category || "Hall of Fame"))];
  const featured = list.filter((e) => e.featured);
  const card = (e, big = false) => html`<a class="hof-card ${big ? "big" : ""}" href="${href(e)}">
    <span class="hof-pic">${pic(e) ? html`<img src="${pic(e)}" alt="" loading="lazy">` : html`<span>🏆</span>`}</span>
    <span class="hof-body"><small>${e.category}${e.year ? ` · ${e.year}` : ""}</small><strong>${e.title}</strong>${e.subject ? html`<em>${e.subject}</em>` : ""}
      ${lines(e.achievements).length ? html`<span class="hof-mini">${lines(e.achievements).slice(0, 2).join(" · ")}</span>` : ""}</span></a>`;
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Hall of Fame"]])}
    <div class="mk-head"><h1>Hall of Fame</h1><a class="btn green" href="/hall-of-fame/submit">Share a memory</a></div>
    <div class="mk-intro">${paragraphs(site.hof_intro || "The players, teams and moments that made the league — past and present. Have a story, a photo or a memory? Share it, and the league will add it here.")}</div>
    ${featured.length ? html`<div class="hof-featured">${featured.map((e) => card(e, true))}</div>` : ""}
    ${list.length ? cats.map((c) => html`<section class="hof-sec"><h2>${c}</h2><div class="hof-grid">${list.filter((e) => (e.category || "Hall of Fame") === c && !e.featured).map((e) => card(e))}</div></section>`)
      : html`<div class="empty box">The Hall of Fame is just getting started. <a href="/hall-of-fame/submit">Share the first memory</a>.</div>`}
  </div>`);
}

function submitForm(view, user) {
  setTitle("Share a memory");
  let images = [];
  mount(view, html`<div class="wrap" style="max-width:760px">
    ${breadcrumb([["Home", "/"], ["Hall of Fame", "/hall-of-fame"], ["Share a memory"]])}
    <h1>Share a memory</h1>
    <p>A great player, a famous match, a team that won everything, a photo from years ago — send it in and the league will add it to the Hall of Fame or the league's history. Nothing appears until the league has read it.</p>
    <form class="form box" data-mem-form>
      <div class="grid-2"><label>Category<select name="category">${["Hall of Fame", "History", "Memories", "Champions", "Famous matches"].map((c) => html`<option>${c}</option>`)}</select></label>
        <label>Year or season <span class="muted">(optional)</span><input name="year" maxlength="40" placeholder="1987 or 1986–87"></label></div>
      <label>Title<input name="title" required minlength="3" maxlength="160" placeholder="e.g. The night Bugle won the shield"></label>
      <label>Who is it about? <span class="muted">(a person or a team — optional)</span><input name="subject" maxlength="160"></label>
      <label>Achievements <span class="muted">(one per line — optional)</span><textarea name="achievements" rows="3" maxlength="3000"></textarea></label>
      <label>The story<textarea name="body" rows="8" maxlength="20000" placeholder="Tell us what happened…"></textarea></label>
      <div class="grid-2"><label>A quote <span class="muted">(optional)</span><input name="quote" maxlength="600"></label><label>Who said it<input name="quote_by" maxlength="120"></label></div>
      <div class="mem-pics">${user ? html`<label class="btn small secondary">Add pictures (up to 12)<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-mem-pics></label><div class="gal-thumbs" data-mem-thumbs></div>`
        : html`<p class="muted"><button type="button" class="linkish" data-account-open>Log in</button> to add pictures — or send your story now and the league will be in touch for photos.</p>`}</div>
      <div class="grid-2"><label>Your name<input name="submitted_by" required minlength="2" maxlength="120" value="${user?.profile?.full_name ?? ""}"></label>
        <label>Your phone or email <span class="muted">(only the league sees this)</span><input name="contact" maxlength="300" value="${user?.email ?? ""}"></label></div>
      <div data-mem-error></div>
      <button class="btn green">Send it to the league</button>
    </form></div>`);
  const form = $("[data-mem-form]", view);
  const drawThumbs = () => mount($("[data-mem-thumbs]", view), images.map((u, i) => html`<figure class="gal-thumb"><img src="${u}" alt=""><button type="button" data-mem-rm="${i}" aria-label="Remove">×</button></figure>`));
  view.addEventListener("change", async (e) => {
    if (!e.target.matches("[data-mem-pics]")) return;
    const label = e.target.closest("label"); label.classList.add("busy");
    try { for (const f of [...e.target.files].slice(0, 12 - images.length)) images.push(await uploadImage(f, { folder: "memories", maxSize: 1600, library: false })); drawThumbs(); }
    catch (err) { toast(err.message, "error"); }
    label.classList.remove("busy"); e.target.value = "";
  });
  view.addEventListener("click", (e) => { const i = e.target.dataset.memRm; if (i != null) { images.splice(Number(i), 1); drawThumbs(); } });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries()), btn = form.querySelector("button:not([type=button])");
    btn.disabled = true;
    try {
      await submitMemory({ ...f, images });
      mount(view, html`<div class="wrap" style="max-width:760px">${breadcrumb([["Home", "/"], ["Hall of Fame", "/hall-of-fame"], ["Thank you"]])}
        <h1>Thank you!</h1><div class="notice ok">Your memory has gone to the league. Once they have read it, it will appear in the Hall of Fame.</div>
        <p><a class="btn" href="/hall-of-fame">Back to the Hall of Fame</a></p></div>`);
    } catch (err) { mount($("[data-mem-error]", view), html`<div class="notice error">${err.message}</div>`); btn.disabled = false; }
  });
  return () => {};
}
