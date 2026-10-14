// Admin → Roles & permissions (Master Admin only).
// One tick-box grid: each officer role across the parts of the dashboard.
// A tick lets that role SEE that part in their dashboard and CHANGE what is in it;
// the database enforces exactly the same list (can_manage() in supabase/schema.sql).
import { html, mount, $, toast, confirmBox } from "../core/dom.js";
import { rolePermissions, saveRolePermissions } from "../core/api.js";
import { AREAS, OFFICER_ROLES, TEAM_ROLES, TEAM_ROLE_AREAS, DEFAULT_AREAS, ROLE_LABEL } from "../core/auth.js";
import { panel } from "../core/components.js";
import { friendly } from "./crud.js";

// Captains and vice captains have columns too, but only live scoring and writing news can be ticked for them (TEAM_ROLE_AREAS in core/auth.js).
const ROLES = [...OFFICER_ROLES, ...TEAM_ROLES];
const canHave = (role, area) => !TEAM_ROLES.includes(role) || TEAM_ROLE_AREAS.includes(area);

export async function rolesPage(el) {
  const saved = await rolePermissions().catch(() => []);
  const state = Object.fromEntries(ROLES.map((role) => [role, new Set((saved.find((r) => r.role === role)?.areas ?? DEFAULT_AREAS[role] ?? []).filter((a) => canHave(role, a)))]));
  let dirty = false;

  const draw = () => mount(el, html`<div class="stack" data-roles>
    <div class="notice">Tick what each role is allowed to see and do in this dashboard. A role only sees the menu items for the parts that are ticked, and the database refuses anything else — even if someone types the address.
      <b>The Master Admin always has everything</b>, and is the only one who can open this page. Changes apply the next time that person opens the website or logs in.</div>
    ${panel("What each role can do", html`<div class="table-scroll"><table class="data perm-table">
      <thead><tr><th>Part of the dashboard</th><th class="num">Master Admin</th>${ROLES.map((r) => html`<th class="num ${TEAM_ROLES.includes(r) ? "perm-team" : ""}">${ROLE_LABEL[r]}</th>`)}</tr></thead>
      <tbody>${AREAS.map(([key, name, what]) => html`<tr>
        <td class="perm-part"><b>${name}</b><small>${what}</small></td>
        <td class="num" data-label="Master Admin"><input type="checkbox" checked disabled aria-label="Master Admin: ${name} (always)"></td>
        ${ROLES.map((r) => (canHave(r, key) ? html`<td class="num ${TEAM_ROLES.includes(r) ? "perm-team" : ""}" data-label="${ROLE_LABEL[r]}"><input type="checkbox" data-role="${r}" data-area="${key}" ${state[r].has(key) ? "checked" : ""} aria-label="${ROLE_LABEL[r]}: ${name}"></td>`
          : html`<td class="num perm-team perm-na" data-label="${ROLE_LABEL[r]}"><span aria-label="Not for ${ROLE_LABEL[r]}s" title="Captains and vice captains have their team's tools by right, and no part of the dashboard">–</span></td>`))}
      </tr>`)}</tbody></table></div>`)}
    <div class="btn-row"><button type="button" class="btn green" data-save>Save permissions</button>
      <button type="button" class="btn ghost" data-defaults>Put back the standard permissions</button></div>
    <div class="muted perm-notes">
      <p><b>Captains and Vice Captains</b> always enter scorecards, pick their team (Manage team), postpone and add match night photos for their own team only — that is not in the grid. Two things can be ticked for them. <b>Live scoring</b>: the “Ball by ball” view appears on their own team's scorecards (off unless you tick it). <b>Write news</b>: they write articles from My area → Write news, and can change only their own (on to start with). A Player login can only edit that player's own profile. An officer who also plays can be given captain rights on their login (People → Logins → Team rights) — what they can do is then what their officer role is ticked for here.</p>
      <p><b>Write news</b> lets someone write news with “Write news step by step” and change their own articles — not other people's, and they can't make an article “breaking news” or featured. <b>News &amp; website</b> is the full News list: every article, categories and the rest of the website.</p>
      <p><b>Live scoring</b> is ball-by-ball scoring: the live scoreboard used on finals nights (Admin → Live scoreboard) and the “Ball by ball” view on scorecards. It is not a part of the dashboard by itself, so ticking it for captains does not give them the dashboard.</p>
      <p><b>Logins:</b> someone with “Logins” ticked can create and change logins, but only for roles that have no more than they have themselves — and never a Master Admin's. Only a Master Admin can make another Master Admin.</p>
      <p><b>Importing from CSV</b> needs Fixtures, League and Match nights together, because an import writes to all three. <b>Roles &amp; permissions</b>, the <b>Activity log</b> and <b>Backup</b> are Master Admin only.</p>
    </div>
  </div>`);
  draw();

  el.onchange = (e) => {
    const { role, area } = e.target.dataset;
    if (!role) return;
    e.target.checked ? state[role].add(area) : state[role].delete(area);
    dirty = true;
  };
  el.onclick = async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-defaults]")) {
      if (!(await confirmBox("Every role goes back to what it could do when the website was set up. Nothing is saved until you press Save permissions.", { title: "Put back the standard permissions?", ok: "Put them back" }))) return;
      for (const role of ROLES) state[role] = new Set(DEFAULT_AREAS[role] ?? []);
      dirty = true; return draw();
    }
    if (t.matches("[data-save]")) {
      t.disabled = true;
      try {
        await saveRolePermissions(ROLES.map((role) => ({ role, areas: AREAS.map(([k]) => k).filter((k) => state[role].has(k) && canHave(role, k)) })));
        dirty = false; toast("Permissions saved");
      } catch (err) { toast(friendly(err), "error"); }
      t.disabled = false;
    }
  };
  const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}
