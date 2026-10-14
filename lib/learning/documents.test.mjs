// Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deflateRawSync, deflateSync } from "node:zlib";
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

// A minimal zip: local headers + central directory + end record. `declared` is the entry count
// the end record claims (JSZip reads every entry it finds, whatever that says).
function zip(entries, { declared = entries.length, prefix = Buffer.alloc(0) } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, method, data] of entries) {
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, data);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(declared, 8);
  eocd.writeUInt16LE(declared, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([prefix, ...locals, cd, eocd]);
}
const zipWith = (name, method, data) => zip([[name, method, data]]);

test("a real Word file is within the size limits", () => {
  assert.equal(docxWithinLimits(sample), true);
});

test("a zip bomb (inflates past the cap) is refused before mammoth reads it", async () => {
  const bomb = zipWith("word/document.xml", 8, deflateRawSync(Buffer.alloc(25 * 1024 * 1024)));
  assert.equal(docxWithinLimits(bomb), false);
  assert.equal(await readDocxText(bomb), null);
});

test("a bomb hidden after the declared entries is refused (JSZip reads every entry it finds)", () => {
  const bomb = deflateRawSync(Buffer.alloc(25 * 1024 * 1024, 0x41));
  assert.equal(docxWithinLimits(zip([["a.txt", 0, Buffer.from("hi")], ["word/document.xml", 8, bomb]], { declared: 1 })), false);
});

test("a zip with data in front of it is refused (JSZip would shift every offset)", () => {
  assert.equal(docxWithinLimits(zip([["word/document.xml", 0, Buffer.from("<w/>")]], { prefix: Buffer.from("junk") })), false);
  assert.equal(docxWithinLimits(zip([["word/document.xml", 0, Buffer.from("<w/>")]])), true);
});

test("a zip with zip64 markers is refused", () => {
  assert.equal(docxWithinLimits(zip([["word/document.xml", 0, Buffer.from("<w/>")]], { declared: 0xffff })), false);
});

test("a zip with an unknown compression method is refused", () => {
  assert.equal(docxWithinLimits(zipWith("word/document.xml", 12, Buffer.from("x"))), false);
});

test("counts PDF pages, including pages in compressed object streams", async () => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 23; i++) pdf.addPage();
  assert.equal(pdfPageCount(Buffer.from(await pdf.save({ useObjectStreams: true }))), 23);
  assert.equal(pdfPageCount(Buffer.from(await pdf.save({ useObjectStreams: false }))), 23);
});

test("a PDF whose object stream unpacks past the cap is refused, without unpacking it all", () => {
  const inner = deflateSync(Buffer.alloc(60 * 1024 * 1024, 0x20));
  const pdf = Buffer.concat([
    Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nendobj\n"),
    Buffer.from(`4 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${inner.length} >>\nstream\n`),
    inner,
    Buffer.from("\nendstream\nendobj\n%%EOF\n"),
  ]);
  const before = process.memoryUsage().rss;
  assert.equal(pdfPageCount(pdf), null);
  assert.ok(process.memoryUsage().rss - before < 100 * 1024 * 1024);
});

test("the sample worksheet PDF has 1 page", () => {
  assert.equal(pdfPageCount(readFileSync(new URL("../../e2e/fixtures/lektion7.pdf", import.meta.url))), 1);
});

test("a file of many fake streams is handled in linear time, and refused past the stream cap", () => {
  const pdf = Buffer.from("%PDF-1.7\n" + "xstream\n".repeat(125_000)); // 1 MB, no " obj" to find
  const start = Date.now();
  assert.equal(pdfPageCount(pdf), null);
  assert.ok(Date.now() - start < 2000, `took ${Date.now() - start} ms`);
});

test("a zip whose entries re-read the same data is refused", () => {
  const data = deflateRawSync(Buffer.from("<w/>"));
  const many = zip(Array.from({ length: 600 }, (_, i) => [`e${i}.xml`, 8, data]));
  assert.equal(docxWithinLimits(many), false);
});

test("a file that isn't a PDF has no page count", () => {
  assert.equal(pdfPageCount(Buffer.from("not a pdf")), null);
});
