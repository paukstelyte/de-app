// Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extractDocxText } from "./docx.ts";

test("reads the text and paragraph breaks of a real Word file", () => {
  const text = extractDocxText(readFileSync(new URL("./fixtures/sample.docx", import.meta.url)));
  assert.match(text, /Lektion 7: Präpositionen mit Dativ/);
  assert.match(text, /aus, bei, mit, nach, seit, von, zu/);
  assert.match(text, /Ich fahre mit dem Bus zur Arbeit\./);
  assert.ok(text.split("\n").length >= 3);
});

test("returns null for files that aren't Word documents", () => {
  assert.equal(extractDocxText(Buffer.from("not a zip")), null);
  assert.equal(extractDocxText(Buffer.alloc(0)), null);
});
