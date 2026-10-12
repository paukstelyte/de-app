// Applies the owner's decisions in review.csv: appends approved words to seed.json and the new
// rules that have at least 3 words to rules.json. Refuses undecided or kept-blocked rows.
// Run: node scripts/c-levels/apply.mjs   (running it twice changes nothing)
import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv } from "./csv.mjs";
import { applyReview } from "./lib.mjs";

const here = (f) => new URL(f, import.meta.url);
const seedPath = here("../../lib/flashcards/data/seed.json");
const rulesPath = here("../../lib/flashcards/data/rules.json");
const read = (u) => JSON.parse(readFileSync(u, "utf8"));
const rows = parseCsv(readFileSync(here("review.csv"), "utf8"));
const out = applyReview(read(seedPath), read(rulesPath), read(here("new-rules.json")), rows);
writeFileSync(seedPath, JSON.stringify(out.seed, null, 2) + "\n");
writeFileSync(rulesPath, JSON.stringify(out.rules, null, 2) + "\n");
console.log(`added ${out.added} cards; seed has ${out.seed.length} cards and ${out.rules.length} rules`);
