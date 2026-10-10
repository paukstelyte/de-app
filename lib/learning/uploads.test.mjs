// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_FILE_BYTES, mimeFor, ownedPaths, storagePath, validateSelection } from "./uploads.ts";

const f = (name, size = 1000, type = "") => ({ name, size, type });
const UID = "4a8a0fe2-22b4-4266-88eb-f214f6c7af2e";

test("one PDF or one Word file is accepted", () => {
  assert.deepEqual(validateSelection([f("Lektion 7.pdf", 1000, "application/pdf")]), { kind: "pdf" });
  assert.deepEqual(validateSelection([f("notes.DOCX")]), { kind: "docx" });
});

test("1 to 5 photos are accepted, including HEIC with an empty browser type", () => {
  assert.deepEqual(validateSelection([f("a.jpg", 1, "image/jpeg"), f("b.HEIC")]), { kind: "images" });
  assert.deepEqual(validateSelection([1, 2, 3, 4, 5].map((i) => f(`p${i}.png`, 1, "image/png"))), { kind: "images" });
});

test("rejects: nothing, 6 photos, mixed kinds, two PDFs, too big, unsupported", () => {
  assert.match(validateSelection([]).error, /Choose/);
  assert.match(validateSelection([1, 2, 3, 4, 5, 6].map((i) => f(`p${i}.jpg`))).error, /5 photos/);
  assert.match(validateSelection([f("a.pdf"), f("b.jpg")]).error, /one PDF, one Word file or up to 5 photos/);
  assert.match(validateSelection([f("a.pdf"), f("b.pdf")]).error, /one PDF, one Word file or up to 5 photos/);
  assert.match(validateSelection([f("a.pdf", MAX_FILE_BYTES + 1)]).error, /10 MB/);
  assert.match(validateSelection([f("old.doc")]).error, /PDF, Word \(.docx\), JPG, PNG, WebP or HEIC/);
  assert.match(validateSelection([f("x.gif", 1, "image/gif")]).error, /PDF, Word/);
});

test("mimeFor decides the type by extension", () => {
  assert.equal(mimeFor("a.heic"), "image/heic");
  assert.equal(mimeFor("a.HEIF"), "image/heif");
  assert.equal(mimeFor("a.jpeg"), "image/jpeg");
  assert.equal(mimeFor("a.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(mimeFor("a.exe"), null);
});

test("storagePath keeps files in the user's own folder with a safe name", () => {
  assert.equal(storagePath(UID, "b1", 0, "Lektion 7 (neu).PDF"), `${UID}/b1/0.pdf`);
});

test("ownedPaths only accepts 1–5 paths inside the caller's folder", () => {
  const ok = [`${UID}/b1/0.jpg`, `${UID}/b1/1.heic`];
  assert.deepEqual(ownedPaths(ok, UID), ok);
  assert.equal(ownedPaths([`someone-else/b1/0.jpg`], UID), null);
  assert.equal(ownedPaths([`${UID}/../x/0.jpg`], UID), null);
  assert.equal(ownedPaths([`${UID}/b1/0.exe`], UID), null);
  assert.equal(ownedPaths([], UID), null);
  assert.equal(ownedPaths("nope", UID), null);
  assert.equal(ownedPaths(Array(6).fill(`${UID}/b1/0.jpg`), UID), null);
});
