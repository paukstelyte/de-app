// Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { docxWithinLimits, pdfPageCount, readDocxText } from "./documents.ts";

const sample = readFileSync(new URL("./fixtures/sample.docx", import.meta.url));

test("reads the text and paragraph breaks of a real Word file", async () => {
  const text = await readDocxText(sample);
  assert.match(text, /Lektion 7: Präpositionen mit Dativ/);
  assert.match(text, /aus, bei, mit, nach, seit, von, zu/);
  assert.match(text, /Ich fahre mit dem Bus zur Arbeit\./);
  assert.ok(text.split("\n").length >= 3);
});

test("returns null for files that aren't Word documents", async () => {
  assert.equal(await readDocxText(Buffer.from("not a zip")), null);
  assert.equal(await readDocxText(Buffer.alloc(0)), null);
});

// Minimal one-entry zip: local header + central directory + end record.
function zipWith(name, method, data) {
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt16LE(n.length, 28);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(30 + n.length + data.length, 16);
  return Buffer.concat([local, n, data, central, n, eocd]);
}

test("a real Word file is within the size limits", () => {
  assert.equal(docxWithinLimits(sample), true);
});

test("a zip bomb (inflates past the cap) is refused before mammoth reads it", async () => {
  const bomb = zipWith("word/document.xml", 8, deflateRawSync(Buffer.alloc(25 * 1024 * 1024)));
  assert.equal(docxWithinLimits(bomb), false);
  assert.equal(await readDocxText(bomb), null);
});

test("a zip with an unknown compression method is refused", () => {
  assert.equal(docxWithinLimits(zipWith("word/document.xml", 12, Buffer.from("x"))), false);
});

test("counts PDF pages, including pages in compressed object streams", async () => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 23; i++) pdf.addPage();
  assert.equal(await pdfPageCount(Buffer.from(await pdf.save({ useObjectStreams: true }))), 23);
  assert.equal(await pdfPageCount(Buffer.from(await pdf.save({ useObjectStreams: false }))), 23);
});

test("a file that isn't a PDF has no page count", async () => {
  assert.equal(await pdfPageCount(Buffer.from("not a pdf")), null);
});
