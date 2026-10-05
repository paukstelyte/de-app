// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize, percent } from "./progress.ts";

const items = [
  { id: "a", article: "der", ruleId: "r1" },
  { id: "b", article: "die", ruleId: "r1" },
  { id: "c", article: "das", ruleId: "r2" },
];
const at = (item_id, correct) => ({ item_id, correct });

test("accuracy overall, per article and per rule", () => {
  const s = summarize([at("a", true), at("a", false), at("b", true), at("c", false), at("zzz", true)], items);
  assert.deepEqual(s.overall, { correct: 2, total: 4 }); // unknown item ignored
  assert.deepEqual(s.byArticle.der, { correct: 1, total: 2 });
  assert.deepEqual(s.byRule.get("r1"), { correct: 2, total: 3 });
  assert.equal(percent(s.overall), 50);
  assert.equal(percent({ correct: 0, total: 0 }), null);
});

test("a word leaves the trouble list after 2 correct in a row", () => {
  const ids = (attempts) => summarize(attempts, items).trouble.map((t) => t.id);
  assert.deepEqual(ids([at("a", true)]), []); // never missed
  assert.deepEqual(ids([at("a", false)]), ["a"]);
  assert.deepEqual(ids([at("a", false), at("a", true)]), ["a"]);
  assert.deepEqual(ids([at("a", false), at("a", true), at("a", true)]), []);
  assert.deepEqual(ids([at("a", false), at("a", true), at("a", false), at("a", true)]), ["a"]);
});

test("trouble list is most-missed first", () => {
  const s = summarize([at("a", false), at("b", false), at("b", false)], items);
  assert.deepEqual(s.trouble, [{ id: "b", misses: 2 }, { id: "a", misses: 1 }]);
});
