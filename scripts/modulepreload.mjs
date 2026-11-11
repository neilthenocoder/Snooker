// Writes the <link rel="modulepreload"> lines in public/index.html (round 116, speed).
//
// The site's scripts are small files that load each other. Without a hint, a browser only finds out about a file
// once the file before it has arrived, so they come down in a long chain. These lines tell it about all of them
// at once: the files every page needs (everything main.js loads) and the home page's own.
//
// Run it after adding, removing or renaming a script file:   node scripts/modulepreload.mjs
// (Nothing breaks if you forget — the page just starts a little slower until it is run again.)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const seen = new Set();
function walk(file) {
  if (seen.has(file) || !fs.existsSync(file)) return;
  seen.add(file);
  const src = fs.readFileSync(file, "utf8");
  // Only what is imported at the top of a file (import … from "./x.js"), not what is fetched later with import().
  for (const m of src.matchAll(/^\s*(?:import|export)\s[^"'()]*?from\s*["'](\.{1,2}\/[^"']+)["']/gm)) walk(path.resolve(path.dirname(file), m[1]));
  for (const m of src.matchAll(/^\s*import\s*["'](\.{1,2}\/[^"']+)["']/gm)) walk(path.resolve(path.dirname(file), m[1]));
}
walk(path.join(root, "js/main.js"));
walk(path.join(root, "js/pages/home.js"));
const skip = /\/(demo-client|seed-data)\.js$/;                       // demo mode only
const hrefs = [...seen].map((f) => "/" + path.relative(root, f).split(path.sep).join("/")).filter((h) => h !== "/js/main.js" && !skip.test(h)).sort();
const block = `<!--modulepreload: written by scripts/modulepreload.mjs — do not edit by hand-->\n${hrefs.map((h) => `  <link rel="modulepreload" href="${h}">`).join("\n")}\n  <!--/modulepreload-->`;
const index = path.join(root, "index.html");
let page = fs.readFileSync(index, "utf8");
page = /<!--modulepreload[\s\S]*?<!--\/modulepreload-->/.test(page) ? page.replace(/<!--modulepreload[\s\S]*?<!--\/modulepreload-->/, () => block)
  : page.replace(/(\s*)<script type="module" src="\/js\/main\.js"><\/script>/, (m, sp) => `${sp}${block}${m}`);
fs.writeFileSync(index, page);
console.log(`${hrefs.length} modulepreload lines written to public/index.html`);
