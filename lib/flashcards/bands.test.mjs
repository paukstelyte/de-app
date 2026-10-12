// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { BANDS, inBand, bandFromStorage } from "./bands.ts";

test("each band holds only its own levels; all holds every level", () => {
  assert.equal(inBand("A2", "A"), true);
  assert.equal(inBand("B1", "A"), false);
  assert.equal(inBand("C2", "C"), true);
  assert.equal(inBand("B2", "C"), false);
  for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"]) assert.equal(inBand(level, "all"), true);
  assert.deepEqual([...BANDS], ["A", "B", "C", "all"]);
});

test("a saved band wins; otherwise the old saved level is converted; default is all", () => {
  assert.equal(bandFromStorage("C", "A1"), "C");
  assert.equal(bandFromStorage(null, "A1"), "A");
  assert.equal(bandFromStorage(null, "A2"), "A");
  assert.equal(bandFromStorage(null, "B1"), "B");
  assert.equal(bandFromStorage(null, "B2"), "all"); // old "All (A1–B2)"
  assert.equal(bandFromStorage(null, null), "all");
  assert.equal(bandFromStorage("Z9", "nonsense"), "all"); // junk never crashes
});
