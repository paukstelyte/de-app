// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { focusPracticeItems } from "./focus-practice.ts";

const item = (id) => ({ id, type: "choice", prompt: "a ___ b", options: ["x", "y"], answer: "x", explanation: "because x." });
const SETS = {
  "dative-case": { slug: "dative-case", instructions: "i", items: [item("dat-01"), item("dat-02")] },
  "modal-verbs": { slug: "modal-verbs", instructions: "i", items: [item("modal-01")] },
};

test("collects every exercise of the focus topics, tagged with its topic", () => {
  const items = focusPracticeItems(["dative-case", "modal-verbs"], SETS);
  assert.deepEqual(items.map((i) => `${i.topic}:${i.id}`), ["dative-case:dat-01", "dative-case:dat-02", "modal-verbs:modal-01"]);
});

test("skips topics without exercises (noun-gender, unknown) and prototype keys", () => {
  assert.deepEqual(focusPracticeItems(["noun-gender", "made-up", "__proto__", "constructor"], SETS), []);
  assert.equal(focusPracticeItems(["noun-gender", "modal-verbs"], SETS).length, 1);
});

test("does not change the shared exercise data", () => {
  focusPracticeItems(["dative-case"], SETS);
  assert.equal("topic" in SETS["dative-case"].items[0], false);
});
