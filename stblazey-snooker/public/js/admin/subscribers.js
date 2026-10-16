// Admin → Newsletter → Subscribers (Rich, round 22): the usual list (search, add, change, remove) and a CSV download.
import { html, mount, toast } from "../core/dom.js";
import { subscribers } from "../core/api.js";
import { RESOURCES } from "./resources.js";
import { crud } from "./crud.js";

const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function subscribersPage(el, { onChange } = {}) {
  mount(el, html`<div class="btn-row" style="margin-bottom:14px"><button type="button" class="btn small secondary" data-csv>Download the list (CSV)</button>
    <a class="btn small ghost" href="/admin/campaigns">Campaigns →</a></div><div></div>`);
  el.querySelector("[data-csv]").addEventListener("click", async () => {
    try {
      const list = await subscribers();
      const csv = ["email,name,status,signed up,source", ...list.map((s) => [s.email, s.name, s.status, s.created_at?.slice(0, 10), s.source].map(cell).join(","))].join("\r\n");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv" })), download: `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) { toast(err.message, "error"); }
  });
  return crud(el.lastElementChild, RESOURCES.subscribers, { onChange });
}
