// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, toCsv } from "./csv.mjs";
import { articleFromWikitext, checkRow, frequencyRanks, mergeDecisions, REVIEW_HEADERS, COMMON_RANK } from "./lib.mjs";

test("CSV round trip keeps commas, quotes and line breaks", () => {
  const rows = [{ noun: "Nomade", exception: 'A person, so "der", not die\nsee -ade' }];
  assert.deepEqual(parseCsv(toCsv(rows, ["noun", "exception"])), rows);
});

test("CSV from Excel/Numbers: BOM, \\r\\n and blank lines", () => {
  const text = "﻿noun,level\r\nFassade,C1\r\n\r\nParade,B2\r\n";
  assert.deepEqual(parseCsv(text), [{ noun: "Fassade", level: "C1" }, { noun: "Parade", level: "B2" }]);
  assert.deepEqual(parseCsv(""), []);
});

const page = (body) => `== Reportage ({{Sprache|Deutsch}}) ==\n${body}\n== X ({{Sprache|Englisch}}) ==\n|Genus=m`;

test("Wiktionary: one gender gives the article; anything else blocks", () => {
  assert.deepEqual(articleFromWikitext(page("{{Deutsch Substantiv Übersicht\n|Genus=f")), { article: "die", reason: "" });
  assert.equal(articleFromWikitext(page("|Genus 1=m\n|Genus 2=f")).article, null); // der/die Leiter
  assert.equal(articleFromWikitext(page("|Genus=0")).reason, "plural only");
  assert.equal(articleFromWikitext("== x ({{Sprache|Englisch}}) ==\n|Genus=m").reason, "no German entry");
  assert.equal(articleFromWikitext("").reason, "no German entry");
  assert.equal(articleFromWikitext(page("no template")).reason, "no gender found");
});

test("frequency ranks are 1-based, first occurrence wins", () => {
  const ranks = frequencyRanks("ich 100\nteppich 50\nich 3\n");
  assert.equal(ranks.get("ich"), 1);
  assert.equal(ranks.get("teppich"), 2);
});

const rulesById = new Map([
  ["die-age", { id: "die-age", article: "die", matchType: "suffix", suffixes: ["-age"] }],
  ["das-ge-prefix", { id: "das-ge-prefix", article: "das", matchType: "suffix", suffixes: ["ge-"] }],
  ["der-male-persons", { id: "der-male-persons", article: "der", matchType: "semantic" }],
]);
const ctx = (over = {}) => ({ rulesById, existingNouns: new Set(["garage"]), ranks: new Map([["reportage", 20412], ["etage", 900]]), wiktionary: { article: "die", reason: "" }, ...over });
const row = (over = {}) => ({ noun: "Reportage", article: "die", ruleId: "die-age", level: "C1", exception: "", ...over });

test("a good row passes; frequency only flags", () => {
  assert.deepEqual(checkRow(row(), ctx()), { status: "ok", problems: "", rank: 20412 });
  assert.match(checkRow(row({ noun: "Etage" }), ctx()).problems, /common/);
  assert.equal(checkRow(row({ noun: "Etage" }), ctx()).status, "ok");
  assert.match(checkRow(row({ noun: "Sabotage" }), ctx()).problems, /rare/);
  assert.ok(COMMON_RANK > 0);
});

test("blocks: wrong or missing Wiktionary gender, duplicate, bad rule fit, bad level", () => {
  const blocked = (r, c) => checkRow(row(r), ctx(c));
  assert.match(blocked({}, { wiktionary: { article: "der", reason: "" } }).problems, /Wiktionary says der/);
  assert.match(blocked({}, { wiktionary: { article: null, reason: "more than one gender" } }).problems, /more than one gender/);
  assert.match(blocked({ noun: "Garage" }).problems, /duplicate/);
  assert.match(blocked({ noun: "Fassade" }).problems, /doesn't end with -age/);
  assert.match(blocked({ level: "A2" }).problems, /bad level/);
  assert.match(blocked({ ruleId: "nope" }).problems, /unknown rule/);
  assert.equal(blocked({ noun: "Fassade" }).status, "blocked");
});

test("prefix rules match the start; going against a rule needs exception text", () => {
  const ge = row({ noun: "Gebirge", article: "das", ruleId: "das-ge-prefix" });
  assert.equal(checkRow(ge, ctx({ wiktionary: { article: "das", reason: "" } })).status, "ok");
  const against = row({ noun: "Nomage", article: "der" });
  assert.match(checkRow(against, ctx({ wiktionary: { article: "der", reason: "" } })).problems, /no exception text/);
  const explained = row({ noun: "Nomage", article: "der", exception: "A person." });
  assert.equal(checkRow(explained, ctx({ wiktionary: { article: "der", reason: "" } })).status, "ok");
});

test("re-running the check keeps the owner's decision and note", () => {
  const fresh = [{ noun: "Fassade", status: "ok", decision: "", note: "" }, { noun: "Parade", status: "ok", decision: "", note: "" }];
  const old = [{ noun: "Fassade", decision: "C1", note: "fine" }];
  assert.deepEqual(mergeDecisions(fresh, old), [
    { noun: "Fassade", status: "ok", decision: "C1", note: "fine" },
    { noun: "Parade", status: "ok", decision: "", note: "" },
  ]);
  assert.equal(REVIEW_HEADERS.at(-2), "decision");
});
