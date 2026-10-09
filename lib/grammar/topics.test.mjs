// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { LEVELS, LEVEL_NAMES, TOPICS, getTopic, topicsByLevel } from "./topics.ts";

test("the catalogue has 82 topics with unique, address-safe slugs", () => {
  assert.equal(TOPICS.length, 82);
  const slugs = TOPICS.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("levels run A1 to C2 and every topic has one of them", () => {
  assert.deepEqual(LEVELS, ["A1", "A2", "B1", "B2", "C1", "C2"]);
  assert.equal(LEVEL_NAMES.C2, "Proficient");
  for (const t of TOPICS) assert.ok(LEVELS.includes(t.level), t.slug);
});

test("getTopic finds a topic by slug and returns undefined otherwise", () => {
  assert.equal(getTopic("dative-case")?.level, "A2");
  assert.equal(getTopic("nope"), undefined);
  assert.equal(getTopic("constructor"), undefined);
});

test("noun-gender links to the der·die·das flashcards and the rules", () => {
  const t = getTopic("noun-gender");
  assert.deepEqual(t?.exercises, [{ title: "der · die · das flashcards", href: "/articles" }]);
  assert.equal(t?.rulesHref, "/rules");
});

test("topicsByLevel groups every topic once, in level order, keeping the list's order", () => {
  const grouped = topicsByLevel();
  assert.deepEqual(grouped.map((g) => g.level), LEVELS);
  assert.equal(grouped.reduce((n, g) => n + g.topics.length, 0), TOPICS.length);
  assert.equal(grouped[0].topics[0].slug, "noun-gender");
  assert.deepEqual(grouped.map((g) => g.topics.length), [19, 15, 17, 10, 14, 7]);
});
