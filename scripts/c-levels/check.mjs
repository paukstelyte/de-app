// Builds review.csv from candidates.csv: Wiktionary article, rule fit, duplicates, frequency.
// Run: node scripts/c-levels/check.mjs   (Wiktionary answers are cached in wiktionary-cache.json)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseCsv, toCsv } from "./csv.mjs";
import { articleFromWikitext, checkRow, frequencyRanks, mergeDecisions, REVIEW_HEADERS } from "./lib.mjs";

const here = (f) => new URL(f, import.meta.url);
const read = (f) => readFileSync(here(f), "utf8");
const seed = JSON.parse(read("../../lib/flashcards/data/seed.json"));
const newRules = JSON.parse(read("new-rules.json"));
const newRuleIds = new Set(newRules.map((r) => r.id));
const rules = [...JSON.parse(read("../../lib/flashcards/data/rules.json")), ...newRules];
const rulesById = new Map(rules.map((r) => [r.id, r]));
const ranks = frequencyRanks(read("de_50k.txt"));
const cachePath = here("wiktionary-cache.json");
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};

async function lookup(noun) {
  if (Object.hasOwn(cache, noun)) return cache[noun];
  await new Promise((resolve) => setTimeout(resolve, 1000)); // at most one request a second
  const url = `https://de.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(noun)}&prop=wikitext&format=json&formatversion=2&redirects=1`;
  const res = await fetch(url, { headers: { "User-Agent": "DE-app word check (https://github.com/paukstelyte/de-app)" } });
  if (!res.ok) throw new Error(`Wiktionary answered ${res.status} for ${noun}; re-run later (finished lookups are cached)`);
  const json = await res.json();
  cache[noun] = articleFromWikitext(json.parse?.wikitext ?? ""); // a missing page has no wikitext
  writeFileSync(cachePath, JSON.stringify(cache, null, 1) + "\n");
  return cache[noun];
}

const seen = new Set(seed.map((c) => c.noun.toLowerCase()));
const rows = [];
for (const row of parseCsv(read("candidates.csv"))) {
  const wiktionary = await lookup(row.noun);
  const { status, problems, rank } = checkRow(row, { rulesById, existingNouns: seen, ranks, wiktionary, newRuleIds });
  seen.add(row.noun.toLowerCase());
  rows.push({ ...row, wiktionary: wiktionary.article ?? "", rank: rank ?? "", problems, status, decision: "", note: "" });
}
rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "blocked" ? -1 : 1));
const reviewPath = here("review.csv");
const old = existsSync(reviewPath) ? parseCsv(readFileSync(reviewPath, "utf8")) : [];
writeFileSync(reviewPath, toCsv(mergeDecisions(rows, old), REVIEW_HEADERS));

const count = (pred) => rows.filter(pred).length;
console.log(`${rows.length} rows: ${count((r) => r.status === "ok")} ok, ${count((r) => r.status === "blocked")} blocked`);
for (const level of ["B2", "C1", "C2"]) console.log(`  ${level}: ${count((r) => r.level === level && r.status === "ok")} ok`);
