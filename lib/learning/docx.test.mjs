// Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
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

// Minimal one-entry zip: local header + central directory + end record.
function zipWith(name, method, data, size = data.length) {
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(size, 20);
  central.writeUInt16LE(n.length, 28);
  const cdOffset = 30 + n.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, n, data, central, n, eocd]);
}

test("returns null for a zip bomb (deflates past the size cap)", () => {
  const bomb = deflateRawSync(Buffer.alloc(6 * 1024 * 1024));
  assert.equal(extractDocxText(zipWith("word/document.xml", 8, bomb)), null);
});

test("returns null for a valid zip without word/document.xml", () => {
  assert.equal(extractDocxText(zipWith("other.txt", 0, Buffer.from("hi"))), null);
});
