// ─────────────────────────────────────────────────────────────
//  FORMATTED TEXT — turns plain text typed in the dashboard into
//  headings, bullets, sub-bullets, numbered lists and tables.
//  Used for info pages, the rules page, meeting minutes and sponsor
//  pages. Everything typed is escaped first, so it is always safe.
//
//    # Heading            ## Smaller heading        ### Smallest
//    - bullet             (two spaces first) - sub-bullet
//    1. numbered          (two spaces first) a. or 1. sub-item
//    | Column | Column |  one row per line; the first row is the heading row
//    **bold**  *italic*  [link text](https://…)
//    > a quote            --- a line across
//  A blank line starts a new paragraph.
// ─────────────────────────────────────────────────────────────
import { esc, raw } from "./dom.js";

export const MARKUP_HELP = "Formatting: “# Heading”, “## Sub-heading”, “- bullet”, two spaces then “- sub-bullet”, “1. numbered”, a table as “| Column | Column |” (one row per line, first row = headings), **bold**, *italic*, [link text](https://…). A blank line starts a new paragraph.";

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const safeUrl = (u) => (/^(https?:\/\/|\/|mailto:|tel:|#)/i.test(u) ? u : null);

/** Bold, italic and links inside one line (the text is escaped first). */
function inline(text) {
  let out = esc(text);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = safeUrl(url.replace(/&amp;/g, "&"));
    return href ? `<a href="${esc(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : ""}>${label}</a>` : m;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return out;
}

/** One list line → { indent, ordered, letter, text } (or null). Lettered items (a. b. c.) only count as sub-items, i.e. when indented. */
function listItem(line) {
  const l = line.replace(/\t/g, "  ");
  let m = l.match(/^(\s*)[-*•]\s+(.*)$/);
  if (m) return { indent: m[1].length, ordered: false, letter: false, text: m[2] };
  m = l.match(/^(\s*)\d+[.)]\s+(.*)$/);
  if (m) return { indent: m[1].length, ordered: true, letter: false, text: m[2] };
  m = l.match(/^(\s{2,})[a-z][.)]\s+(.*)$/);
  return m ? { indent: m[1].length, ordered: true, letter: true, text: m[2] } : null;
}
const LIST = { test: (line) => !!listItem(line) };
const isTable = (l) => /^\s*\|.*\|\s*$/.test(l);
const isRule = (l) => /^\s*(-{3,}|\*{3,})\s*$/.test(l);

function listHtml(items) {
  let out = "";
  const stack = [];
  for (const it of items) {
    while (stack.length && it.indent < stack.at(-1).indent) out += `</li></${stack.pop().tag}>`;
    if (!stack.length || it.indent > stack.at(-1).indent) {
      const tag = it.ordered ? "ol" : "ul";
      stack.push({ indent: it.indent, tag });
      out += `<${tag}${it.letter ? ' type="a"' : ""}><li>${inline(it.text)}`;
    } else out += `</li><li>${inline(it.text)}`;
  }
  while (stack.length) out += `</li></${stack.pop().tag}>`;
  return out;
}

function tableHtml(lines) {
  const rows = lines.filter((l) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(l) || !l.includes("-"))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  if (!rows.length) return "";
  const [head, ...body] = rows;
  return `<div class="table-scroll"><table class="data rich-table"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`
    + `<tbody>${body.map((r) => `<tr>${head.map((_, i) => `<td>${inline(r[i] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/** Returns { html, headings: [{ level, text, id }] } — the headings make a contents list. */
export function renderMarkup(text) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const headings = [], used = new Set();
  let out = "", i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,3})\s+(.+?)\s*#*$/);
    if (h) {
      let id = slug(h[2]) || "section";
      for (let n = 2; used.has(id); n++) id = `${slug(h[2])}-${n}`;
      used.add(id);
      headings.push({ level: h[1].length, text: h[2], id });
      out += `<h${h[1].length + 1} id="${id}">${inline(h[2])}</h${h[1].length + 1}>`;
      i++; continue;
    }
    if (isRule(line)) { out += "<hr>"; i++; continue; }
    if (isTable(line)) {
      const block = [];
      while (i < lines.length && isTable(lines[i])) block.push(lines[i++]);
      out += tableHtml(block); continue;
    }
    if (LIST.test(line)) {
      const items = [];
      while (i < lines.length && lines[i].trim() && (LIST.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        const item = listItem(lines[i]);
        if (item) items.push(item);
        else items.at(-1).text += ` ${lines[i].trim()}`;   // a long item carried onto the next line
        i++;
      }
      out += listHtml(items); continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const block = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) block.push(lines[i++].replace(/^\s*>\s?/, ""));
      out += `<blockquote>${block.map(inline).join("<br>")}</blockquote>`; continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,3}\s/.test(lines[i]) && !isTable(lines[i]) && !LIST.test(lines[i]) && !isRule(lines[i]) && !/^\s*>\s?/.test(lines[i])) para.push(lines[i++]);
    out += `<p>${para.map((l) => inline(l.trim())).join("<br>")}</p>`;
  }
  return { html: raw(out), headings };
}

/** Just the formatted text. */
export const markup = (text) => renderMarkup(text).html;
