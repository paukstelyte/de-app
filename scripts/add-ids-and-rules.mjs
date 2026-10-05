// One-off: freeze each seed card's id (seed-N, its original index) and link it
// to its rule by id. Answer history references these ids — never renumber.
import { readFileSync, writeFileSync } from "node:fs";

const seedPath = new URL("../lib/flashcards/data/seed.json", import.meta.url);
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const rules = JSON.parse(
  readFileSync(new URL("../lib/flashcards/data/rules.json", import.meta.url), "utf8"),
);
const ruleIdByText = new Map(rules.map((r) => [r.description, r.id]));

const out = seed.map((card, i) => {
  const ruleId = ruleIdByText.get(card.rule);
  if (!ruleId) throw new Error(`No rule for ${card.noun}`);
  const { rule: _rule, ...rest } = card; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { id: card.id ?? `seed-${i}`, ...rest, ruleId };
});
writeFileSync(seedPath, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${out.length} cards`);
