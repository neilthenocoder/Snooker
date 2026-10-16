// /downloads — League downloads (Rich, round 23): posters for the club wall, the rules, competition entry forms…
// For anyone with a league login (a file can also be made open to everyone). Admin → Website → Downloads.
import { html, mount, paragraphs } from "../core/dom.js";
import { table, settings } from "../core/api.js";
import { breadcrumb } from "../core/components.js";
import { setTitle, adminEdit } from "../core/router.js";

const KIND = { pdf: "PDF", doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel", ppt: "PowerPoint", pptx: "PowerPoint", jpg: "Picture", jpeg: "Picture", png: "Picture", webp: "Picture" };
const kindOf = (url) => { const m = String(url).match(/^data:([^;,]+)/); if (m) return m[1].includes("pdf") ? "PDF" : m[1].startsWith("image") ? "Picture" : "File"; return KIND[String(url).split(/[?#]/)[0].split(".").pop().toLowerCase()] ?? "File"; };

export default async function downloads(view, { user }) {
  setTitle("League downloads");
  adminEdit("downloads", null, { label: "Edit downloads" });
  const [rows, site] = await Promise.all([table("downloads", "sort").catch(() => []), settings()]);
  const list = rows.filter((d) => d.is_active !== false);
  const cats = [...new Set(list.map((d) => d.category || "General"))];
  mount(view, html`<div class="wrap">
    ${breadcrumb([["Home", "/"], ["Our League", "/league"], ["Downloads"]])}
    <h1>League downloads</h1>
    <div class="dl-intro">${paragraphs(site.downloads_intro || "Posters for the club wall, the league rules, competition entry forms and more — free to download and print.")}</div>
    ${!user ? html`<div class="notice">Most downloads are for players and clubs with a league login. <button type="button" class="linkish" data-account-open>Log in</button> to see them all.</div>` : ""}
    ${list.length ? cats.map((c) => html`<section class="dl-cat"><h2>${c}</h2><div class="dl-grid">${list.filter((d) => (d.category || "General") === c).map((d) => html`<a class="dl-card" href="${d.file_url}" target="_blank" rel="noopener" download>
        <span class="dl-kind k-${kindOf(d.file_url).toLowerCase()}">${kindOf(d.file_url)}</span>
        <span class="dl-body"><strong>${d.title}</strong>${d.description ? html`<small>${d.description}</small>` : ""}</span><span class="dl-go" aria-hidden="true">⤓</span></a>`)}</div></section>`)
      : html`<div class="empty box">${user ? "Nothing to download yet." : "Log in to see the league's downloads."}</div>`}
  </div>`);
}
