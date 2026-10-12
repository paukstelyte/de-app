// Run: npm test. Guards the built-in deck: ids, levels, rules, and the original 976 cards.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const load = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const seed = load("seed.json");
const rules = load("rules.json");
const rulesById = new Map(rules.map((r) => [r.id, r]));
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
// sha256 of JSON.stringify(seed.slice(0, 976)) on 2026-10-12, before C1/C2 words were added.
const ORIGINAL_FINGERPRINT = "8825ec0229139c1dc4f4c7f95c9180c222a152010e1dd13e75f34b9a7d305fa1";

test("the original 976 cards are unchanged", () => {
  const hash = createHash("sha256").update(JSON.stringify(seed.slice(0, 976))).digest("hex");
  assert.equal(hash, ORIGINAL_FINGERPRINT);
});

test("every card has a unique id, a valid article and level, and an existing rule", () => {
  assert.equal(new Set(seed.map((c) => c.id)).size, seed.length);
  for (const c of seed) {
    assert.ok(["der", "die", "das"].includes(c.article), c.id);
    assert.ok(LEVELS.includes(c.level), c.id);
    assert.ok(rulesById.has(c.ruleId), `${c.id} → ${c.ruleId}`);
  }
});

test("new ids start at seed-996 and continue without gaps", () => {
  const added = seed.slice(976).map((c) => Number(c.id.slice(5)));
  added.forEach((n, i) => assert.equal(n, 996 + i));
});

test("no noun appears twice", () => {
  const nouns = seed.map((c) => c.noun.toLowerCase());
  assert.equal(new Set(nouns).size, nouns.length);
});

test("ending-rule cards have that ending, or explain why not", () => {
  for (const c of seed.slice(976)) {
    const rule = rulesById.get(c.ruleId);
    if (rule.matchType !== "suffix") continue;
    const n = c.noun.toLowerCase();
    const fits = rule.suffixes.some((s) => (s.startsWith("-") ? n.endsWith(s.slice(1).toLowerCase()) : n.startsWith(s.slice(0, -1).toLowerCase())));
    assert.ok(fits || c.exception, `${c.noun} vs ${rule.suffixes}`);
  }
});

test("each band has at least a full round (30 cards)", () => {
  for (const band of ["A", "B", "C"]) {
    assert.ok(seed.filter((c) => c.level.startsWith(band)).length >= 30, band);
  }
});

test("every rule is complete and has at least 3 cards", () => {
  for (const r of rules) {
    assert.ok(r.title && r.description, r.id);
    if (r.matchType === "suffix") assert.ok(r.suffixes?.length, r.id);
    assert.ok(seed.filter((c) => c.ruleId === r.id).length >= 3, r.id);
  }
});
