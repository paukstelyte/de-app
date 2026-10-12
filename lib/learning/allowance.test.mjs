// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { freeAtLabel, parseAllowance } from "./allowance.ts";

test("parseAllowance reads the row the database returns", () => {
  const row = { user_left: 7, user_limit: 10, shared_left: 90, next_free_at: null };
  assert.deepEqual(parseAllowance([row], 12), { userLeft: 7, userLimit: 10, sharedLeft: 90, nextFreeAt: null, documents: 12 });
  const full = { user_left: 0, user_limit: 10, shared_left: 90, next_free_at: "2026-10-12T14:20:00+00:00" };
  assert.equal(parseAllowance([full], 0)?.nextFreeAt, "2026-10-12T14:20:00+00:00");
});

test("parseAllowance gives null for a missing or odd row, so the page just hides the numbers", () => {
  assert.equal(parseAllowance([], 0), null);
  assert.equal(parseAllowance(null, 0), null);
  assert.equal(parseAllowance([{ user_left: -1, user_limit: 10, shared_left: 5 }], 0), null);
  assert.equal(parseAllowance([{ user_left: "3", user_limit: 10, shared_left: 5 }], 0), null);
  assert.equal(parseAllowance([{ user_left: 0, user_limit: 0, shared_left: 5 }], 0), null);
});

test("freeAtLabel shows the time today and 'tomorrow' otherwise", () => {
  const now = new Date(2026, 9, 12, 9, 0);
  assert.equal(freeAtLabel(new Date(2026, 9, 12, 14, 20).toISOString(), now), "at 14:20");
  assert.equal(freeAtLabel(new Date(2026, 9, 13, 2, 5).toISOString(), now), "tomorrow at 02:05");
});
