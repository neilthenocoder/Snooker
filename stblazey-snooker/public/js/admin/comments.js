// Admin → Website → Comments (Rich, round 22): the match night chat. Every comment, newest first,
// with the match it is on; hide one (it stays, but only officers see it) or remove it. And the switch for the whole site.
import { html, mount, toast, fmtDate, fmtTime, confirmBox } from "../core/dom.js";
import { allRows, save, remove, settings, invalidate, table } from "../core/api.js";
import { panel, dataTable } from "../core/components.js";
import { friendly } from "./crud.js";

export async function commentsPage(el) {
  const draw = async () => {
    invalidate();
    const [list, site, fixtures, teams, cms] = await Promise.all([allRows("match_comments").catch(() => []), settings(), table("fixtures", "starts_at").catch(() => []), table("teams", "name").catch(() => []), table("competition_matches", "id").catch(() => [])]);
    const team = (id) => teams.find((t) => t.id === id)?.name ?? "?";
    const where = (c) => {
      const f = c.fixture_id && fixtures.find((x) => x.id === c.fixture_id);
      if (f) return html`<a href="/match/${f.code ?? f.id}" target="_blank" rel="noopener">${team(f.home_team_id)} v ${team(f.away_team_id)}</a>`;
      const m = c.comp_match_id && cms.find((x) => x.id === c.comp_match_id);
      return m ? html`<a href="/cup-match/${m.no ?? m.id}" target="_blank" rel="noopener">Cup match ${m.no ?? ""}</a>` : "–";
    };
    const rows = [...list].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    mount(el, html`
      ${panel("Match night chat", html`<form class="form" data-cm-settings>
        <label class="check"><input type="checkbox" name="comments_on" ${site.comments_on !== false ? "checked" : ""}> Show the chat under each match (league and cup), so people with a login can comment</label>
        <div class="btn-row form-actions"><button class="btn">Save</button></div></form>`, { color: "yellow" })}
      <div class="notice">Anyone logged in can comment (500 letters at most, one every 10 seconds). <b>Hide</b> takes a comment off the page for everyone except officers; <b>Remove</b> deletes it. You can do the same on the match page itself.</div>
      ${panel(`Comments (${rows.length})`, dataTable([
        { label: "When", cell: (c) => `${fmtDate(c.created_at)} ${fmtTime(c.created_at)}`, cls: "hide-sm" },
        { label: "Who", cell: (c) => c.author_name ?? "?" },
        { label: "Comment", cell: (c) => html`<span class="${c.hidden ? "muted" : ""}">${c.body}</span>${c.hidden ? html` <span class="cm-flag">hidden</span>` : ""}` },
        { label: "Match", cell: where, cls: "hide-sm" },
        { label: "", cls: "right", cell: (c) => html`<span class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">
          <button type="button" class="btn small ghost" data-hide="${c.id}">${c.hidden ? "Show" : "Hide"}</button>
          <button type="button" class="btn small" data-del="${c.id}">Remove</button></span>` },
      ], rows, { empty: "No comments yet." }))}`);
    el.onclick = async (e) => {
      const t = e.target.closest("button");
      if (!t?.dataset.hide && !t?.dataset.del) return;
      try {
        if (t.dataset.del) { if (!(await confirmBox("The comment is removed for good.", { title: "Remove this comment?", ok: "Remove" }))) return; await remove("match_comments", t.dataset.del); }
        else { const c = list.find((x) => x.id === t.dataset.hide); await save("match_comments", { id: c.id, hidden: !c.hidden }); }
        await draw();
      } catch (err) { toast(friendly(err), "error"); }
    };
  };
  el.onsubmit = async (e) => {
    if (!e.target.matches("[data-cm-settings]")) return;
    e.preventDefault();
    try { await save("settings", { id: 1, comments_on: e.target.elements.comments_on.checked }); toast("Saved"); } catch (err) { toast(friendly(err), "error"); }
  };
  await draw();
}
