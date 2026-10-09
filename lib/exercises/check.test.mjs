// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ROUND_SIZE, correctAnswer, isCorrect, makeRound, normalise, shuffle } from "./check.ts";

const choice = { id: "c", type: "choice", prompt: "Ich gehe ___ Bus.", options: ["dem", "den"], answer: "dem", explanation: "x" };
const type = { id: "t", type: "type", prompt: "Er ___ nach Hause.", answers: ["geht", "läuft"], explanation: "x" };
const order = { id: "o", type: "order", words: ["Ich", "gehe", "heim."], answers: ["Ich gehe heim.", "Heim gehe ich."], explanation: "x" };
const items = (n) => Array.from({ length: n }, (_, i) => ({ ...choice, id: `i${i}` }));
const seeded = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

test("normalise trims and collapses whitespace", () => {
  assert.equal(normalise("  dem  Bus "), "dem Bus");
});

test("isCorrect: choice is exact and case-sensitive", () => {
  assert.equal(isCorrect(choice, "dem"), true);
  assert.equal(isCorrect(choice, "Dem"), false);
  assert.equal(isCorrect(choice, "den"), false);
});

test("isCorrect: type accepts any listed answer, ignoring spacing, not case", () => {
  assert.equal(isCorrect(type, " geht "), true);
  assert.equal(isCorrect(type, "läuft"), true);
  assert.equal(isCorrect(type, "Geht"), false);
});

test("isCorrect: order accepts alternatives", () => {
  assert.equal(isCorrect(order, "Ich gehe heim."), true);
  assert.equal(isCorrect(order, "Heim  gehe ich."), true);
  assert.equal(isCorrect(order, "Ich heim gehe."), false);
});

test("correctAnswer gives the first accepted answer", () => {
  assert.equal(correctAnswer(choice), "dem");
  assert.equal(correctAnswer(type), "geht");
  assert.equal(correctAnswer(order), "Ich gehe heim.");
});

test("shuffle copies and keeps all items", () => {
  const xs = [1, 2, 3, 4, 5];
  const out = shuffle(xs, seeded());
  assert.deepEqual(xs, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort(), xs);
});

test("makeRound picks 10 distinct of 30, all if fewer, deterministic when seeded", () => {
  assert.equal(ROUND_SIZE, 10);
  const r = makeRound(items(30));
  assert.equal(r.length, 10);
  assert.equal(new Set(r.map((i) => i.id)).size, 10);
  assert.equal(makeRound(items(4)).length, 4);
  assert.deepEqual(makeRound(items(30), 10, seeded()), makeRound(items(30), 10, seeded()));
});
