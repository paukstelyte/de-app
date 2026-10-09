// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFocus } from "./focus.ts";
import { topicProgress } from "./progress.ts";

const NOW = new Date("2026-10-20T12:00:00Z");
const s = (slug, fromMistake = false) => ({ slug, reason: "r", fromMistake });
const doc = (id, date, topics, title = `Doc ${id}`) => ({ id, title, createdAt: date, topics });

test("combines recent documents: mistakes first, then how many documents, then most recent", () => {
  const items = buildFocus([
    doc(1, "2026-10-01T10:00:00Z", [s("dative-case"), s("perfect-tense")]),
    doc(2, "2026-10-15T10:00:00Z", [s("dative-case"), s("accusative-case", true)]),
  ], [], NOW);
  assert.deepEqual(items.map((i) => i.slug), ["accusative-case", "dative-case", "perfect-tense"]);
  const dative = items.find((i) => i.slug === "dative-case");
  assert.equal(dative.documents, 2);
  assert.equal(dative.since, "2026-10-01T10:00:00Z");
  assert.equal(dative.fromTitle, "Doc 1");
});

test("documents older than 30 days drop out of the focus", () => {
  const items = buildFocus([doc(1, "2026-09-10T10:00:00Z", [s("dative-case")])], [], NOW);
  assert.deepEqual(items, []);
});

test("a removed topic stays hidden until a newer document suggests it again", () => {
  const docs = [doc(1, "2026-10-10T10:00:00Z", [s("dative-case")])];
  assert.deepEqual(buildFocus(docs, [{ slug: "dative-case", kind: "removed", updatedAt: "2026-10-12T10:00:00Z" }], NOW), []);
  const later = [...docs, doc(2, "2026-10-14T10:00:00Z", [s("dative-case")])];
  assert.equal(buildFocus(later, [{ slug: "dative-case", kind: "removed", updatedAt: "2026-10-12T10:00:00Z" }], NOW).length, 1);
});

test("a topic added by hand shows even without documents, after suggested ones", () => {
  const items = buildFocus([doc(1, "2026-10-10T10:00:00Z", [s("dative-case")])], [{ slug: "modal-verbs", kind: "added", updatedAt: "2026-10-11T10:00:00Z" }], NOW);
  assert.deepEqual(items.map((i) => [i.slug, i.added]), [["dative-case", false], ["modal-verbs", true]]);
  assert.equal(items[1].fromTitle, null);
});

test("topicProgress maps the flashcard topic to noun-gender and counts answers", () => {
  const p = topicProgress([
    { topic: "articles", correct: true, created_at: "2026-10-01T10:00:00Z" },
    { topic: "articles", correct: false, created_at: "2026-10-03T10:00:00Z" },
    { topic: "unknown", correct: true, created_at: "2026-10-03T10:00:00Z" },
  ]);
  assert.deepEqual(p, { "noun-gender": { total: 2, correct: 1, lastPractised: "2026-10-03T10:00:00Z" } });
});
