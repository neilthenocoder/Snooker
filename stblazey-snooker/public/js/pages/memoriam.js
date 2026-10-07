// /in-memoriam — "Sadly no longer with us": players the league has lost. A player appears
// here when their status is set to "No longer with us" in Admin → Players; the years and
// a few words of tribute are optional.
import { html, mount } from "../core/dom.js";
import { table } from "../core/api.js";
import { breadcrumb, urls } from "../core/components.js";
import { listItems } from "../core/list-field.js";
import { setTitle, adminEdit } from "../core/router.js";

/** "1948 – 2024", "d. 2024" or "". */
export const lifeYears = (p) => {
  const born = p.birth_date?.slice(0, 4), died = p.died_on?.slice(0, 4);
  return born && died ? `${born} – ${died}` : died ? `d. ${died}` : "";
};

export default async function memoriam(view) {
  setTitle("Sadly no longer with us");
  adminEdit("players", null, { label: "Edit players" });
  const [players, teams] = await Promise.all([table("players", "full_name"), table("teams", "name")]);
  const list = players.filter((p) => p.status === "deceased")
    .sort((a, b) => String(b.died_on ?? "").localeCompare(String(a.died_on ?? "")) || a.full_name.localeCompare(b.full_name));
  const clubs = (p) => [...new Set([teams.find((t) => t.id === p.team_id)?.name, ...listItems(p.past_teams)].filter(Boolean))].slice(0, 3).join(", ");
  view.classList.add("flush");
  mount(view, html`
    <section class="mem-hero"><div class="wrap">
      ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["In memoriam"]])}
      <h1>Sadly no longer with us</h1>
      <p>Remembering the players and friends of the league who are no longer with us. They are part of this league's story, and their results stay in its records.</p>
    </div></section>
    <div class="wrap mem-list">
      ${list.length ? list.map((p) => html`<article class="mem-card">
        <img src="${p.avatar_url || "/assets/avatar.svg"}" alt="" class="${p.avatar_url ? "" : "blank"}" loading="lazy">
        <div><h2><a href="${urls.player(p)}">${p.full_name}</a></h2>
          <p class="mem-years">${[lifeYears(p), clubs(p)].filter(Boolean).join(" · ")}</p>
          ${p.memorial ? html`<p class="mem-words">${p.memorial}</p>` : ""}
          <a class="mem-link" href="${urls.player(p)}">Their record in the league</a></div>
      </article>`) : html`<div class="empty box">No one is listed here.</div>`}
    </div>`);
}
