// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHUNK_OVERLAP, CHUNK_SIZE, EMBEDDING_DIMENSIONS, chunkText, embeddingsFrom, validateNote } from "./notes.ts";

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const prose = (sentences) =>
  Array.from({ length: sentences }, (_, i) => `This is sentence number ${i} about German grammar and the dative case.`).join(" ");

test("defaults are about 500 characters with 100 of overlap", () => {
  assert.equal(CHUNK_SIZE, 500);
  assert.equal(CHUNK_OVERLAP, 100);
});

test("chunkText returns nothing for empty or blank text", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   \n\t "), []);
});

test("chunkText keeps a short note as one chunk", () => {
  assert.deepEqual(chunkText("  Der Dativ zeigt den Empfänger.  "), ["Der Dativ zeigt den Empfänger."]);
  const exactly500 = "a".repeat(500);
  assert.deepEqual(chunkText(exactly500), [exactly500]);
});

test("chunkText never makes a chunk longer than 500 characters", () => {
  for (const text of [prose(40), words(600), "x".repeat(2300)]) {
    for (const chunk of chunkText(text)) assert.ok(chunk.length <= CHUNK_SIZE, `chunk of ${chunk.length}`);
  }
});

test("consecutive chunks overlap, so a boundary sentence is never lost", () => {
  const chunks = chunkText(prose(40));
  assert.ok(chunks.length > 2);
  for (let i = 0; i + 1 < chunks.length; i++) {
    const tail = chunks[i].slice(-40); // the last bit of a chunk reappears at the start of the next
    assert.ok(chunks[i + 1].includes(tail.trim().split(" ").slice(1).join(" ")), `no overlap between chunk ${i} and ${i + 1}`);
  }
});

test("chunkText covers the whole note: every word appears in some chunk", () => {
  const text = words(700);
  const joined = chunkText(text).join(" ");
  for (let i = 0; i < 700; i++) assert.ok(joined.includes(`word${i}`), `word${i} missing`);
});

test("chunkText breaks at word boundaries in normal text", () => {
  const text = words(700);
  for (const chunk of chunkText(text)) {
    assert.match(chunk, /^word\d+/, "starts mid-word");
    assert.match(chunk, /word\d+$/, "ends mid-word");
    assert.ok(text.includes(chunk));
  }
});

test("chunkText prefers to end a chunk at the end of a sentence", () => {
  for (const chunk of chunkText(prose(40)).slice(0, -1)) assert.match(chunk, /\.$/);
});

test("chunkText hard-cuts text with no spaces and still overlaps", () => {
  const chunks = chunkText("x".repeat(1200));
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((c) => c.length <= CHUNK_SIZE));
});

test("a maximum-length note (20,000 characters) stays around 50 chunks (40–60)", () => {
  const n = chunkText(prose(400).slice(0, 20000)).length;
  assert.ok(n >= 40 && n <= 60, `${n} chunks`);
});

const vec = (fill = 0.01) => Array(EMBEDDING_DIMENSIONS).fill(fill);

test("embeddingsFrom returns one 1536-number vector per chunk, in input order", () => {
  const data = { data: [{ index: 1, embedding: vec(0.2) }, { index: 0, embedding: vec(0.1) }] };
  const out = embeddingsFrom(data, 2);
  assert.equal(out.length, 2);
  assert.equal(out[0][0], 0.1);
  assert.equal(out[1][0], 0.2);
});

test("embeddingsFrom rejects a wrong count, wrong size or malformed response", () => {
  assert.equal(embeddingsFrom({ data: [{ index: 0, embedding: vec() }] }, 2), null);
  assert.equal(embeddingsFrom({ data: [{ index: 0, embedding: [1, 2, 3] }] }, 1), null);
  assert.equal(embeddingsFrom({ data: [{ index: 0, embedding: [...vec().slice(1), "x"] }] }, 1), null);
  assert.equal(embeddingsFrom({ error: { message: "nope" } }, 1), null);
  assert.equal(embeddingsFrom(null, 1), null);
});

test("validateNote trims and checks title and content lengths", () => {
  assert.deepEqual(validateNote("  Cases ", " Der Dativ. "), { title: "Cases", content: "Der Dativ." });
  assert.equal(validateNote("", "text"), null);
  assert.equal(validateNote("title", "   "), null);
  assert.equal(validateNote("t".repeat(201), "text"), null);
  assert.equal(validateNote("title", "c".repeat(20001)), null);
  assert.equal(validateNote(42, "text"), null);
});
