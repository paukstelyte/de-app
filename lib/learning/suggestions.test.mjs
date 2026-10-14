// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ANALYSIS_SCHEMA, MAX_TEXT, parseAnalysis } from "./suggestions.ts";

const KNOWN = new Set(["dative-case", "prepositions-dative", "perfect-tense", "noun-gender", "accusative-case", "plural-nouns", "imperative"]);
const t = (slug, fromMistake = false, reason = "because") => ({ slug, fromMistake, reason });
const raw = (topics, extra = {}) => ({ title: "Lektion 7", extractedText: "mit dem Bus", noGrammar: false, topics, ...extra });

test("keeps known topics, mistakes first, original order otherwise", () => {
  const a = parseAnalysis(raw([t("dative-case"), t("perfect-tense", true), t("prepositions-dative")]), KNOWN);
  assert.deepEqual(a.topics.map((x) => x.slug), ["perfect-tense", "dative-case", "prepositions-dative"]);
});

test("drops unknown slugs and duplicates, caps at 6", () => {
  const many = ["dative-case", "made-up-topic", "dative-case", "noun-gender", "accusative-case", "plural-nouns", "imperative", "perfect-tense", "prepositions-dative"].map((s) => t(s));
  const a = parseAnalysis(raw(many), KNOWN);
  assert.equal(a.topics.length, 6);
  assert.ok(!a.topics.some((x) => x.slug === "made-up-topic"));
  assert.equal(new Set(a.topics.map((x) => x.slug)).size, 6);
});

test("trims long reasons, titles and text", () => {
  const a = parseAnalysis(raw([t("dative-case", false, "x".repeat(500))], { title: "T".repeat(300), extractedText: "y".repeat(MAX_TEXT + 50) }), KNOWN);
  assert.equal(a.topics[0].reason.length, 200);
  assert.equal(a.title.length, 80);
  assert.equal(a.extractedText.length, MAX_TEXT);
});

test("topics but none from the catalogue is an invalid answer, not \"no grammar\"", () => {
  assert.equal(parseAnalysis(raw([t("made-up-topic")]), KNOWN), "invalid");
  assert.equal(parseAnalysis(raw([]), KNOWN), "invalid");
});

test("one well-supported topic is enough", () => {
  assert.deepEqual(parseAnalysis(raw([t("dative-case")]), KNOWN).topics.map((x) => x.slug), ["dative-case"]);
});

test("no readable text means unreadable, whatever else the model said", () => {
  assert.equal(parseAnalysis(raw([t("dative-case")], { extractedText: "  \n " }), KNOWN), "unreadable");
  assert.equal(parseAnalysis(raw([], { extractedText: "", noGrammar: true }), KNOWN), "unreadable");
});

test("noGrammar from the model clears any topics", () => {
  const a = parseAnalysis(raw([t("dative-case")], { noGrammar: true }), KNOWN);
  assert.equal(a.noGrammar, true);
  assert.deepEqual(a.topics, []);
});

test("an empty title falls back to a neutral one", () => {
  assert.equal(parseAnalysis(raw([t("dative-case")], { title: "  " }), KNOWN).title, "Untitled document");
});

test("malformed answers are invalid", () => {
  for (const bad of [null, "text", {}, { title: "x" }, raw("nope"), raw([{ slug: 5 }])]) {
    assert.equal(parseAnalysis(bad, KNOWN), "invalid");
  }
});

test("an extra key in the answer is dropped, not a wasted upload", () => {
  const a = parseAnalysis(raw([{ ...t("dative-case"), confidence: 0.9 }], { language: "de" }), KNOWN);
  assert.deepEqual(a.topics, [{ slug: "dative-case", reason: "because", fromMistake: false }]);
  assert.equal("language" in a, false);
});

test("the JSON schema sent to the model is strict, lists the four fields and has no $schema key", () => {
  assert.equal(ANALYSIS_SCHEMA.strict, true);
  assert.deepEqual(ANALYSIS_SCHEMA.schema.required, ["title", "extractedText", "noGrammar", "topics"]);
  assert.equal(ANALYSIS_SCHEMA.schema.additionalProperties, false);
  assert.equal(ANALYSIS_SCHEMA.schema.properties.topics.items.additionalProperties, false);
  assert.equal("$schema" in ANALYSIS_SCHEMA.schema, false);
});
