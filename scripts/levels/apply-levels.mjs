// Step 2 of levelling: write `level` into seed.json from levels-matched.csv
// (Goethe lists) and levels-review.csv (hand-reviewed; it wins on conflicts).
// A review row with level REMOVE drops that card. Ids are never renumbered.
import { readFileSync, writeFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url);
const seedPath = here("../../lib/flashcards/data/seed.json");
const LEVELS = new Set(["A1", "A2", "B1", "B2", "REMOVE"]);

const levelById = new Map();
for (const file of ["levels-matched.csv", "levels-review.csv"]) {
  const [, ...rows] = readFileSync(here(file), "utf8").trim().split("\n");
  for (const row of rows) {
    const [id, , noun, level] = row.split(",");
    if (!LEVELS.has(level)) throw new Error(`${file}: bad level "${level}" for ${noun}`);
    levelById.set(id, level);
  }
}

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const out = seed
  .map((card) => {
    const level = levelById.get(card.id);
    if (!level) throw new Error(`No level for ${card.id} ${card.noun}`);
    return { ...card, level };
  })
  .filter((card) => card.level !== "REMOVE");
writeFileSync(seedPath, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${out.length} cards (${seed.length - out.length} removed)`);
