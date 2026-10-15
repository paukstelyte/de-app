// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_SIZE, readAllPages } from "./account.ts";

const table = (n) => Array.from({ length: n }, (_, i) => i);
const pages = (rows) => async (from, to) => ({ data: rows.slice(from, to + 1), error: null });

test("readAllPages reads past the 1000-row limit, including an exact multiple", async () => {
  for (const n of [0, 5, PAGE_SIZE, PAGE_SIZE * 2 + 3]) assert.deepEqual(await readAllPages(pages(table(n))), table(n));
});

test("readAllPages throws on a failed page instead of returning part of the data", async () => {
  const failing = async (from) => (from === 0 ? { data: table(PAGE_SIZE), error: null } : { data: null, error: { message: "boom" } });
  await assert.rejects(readAllPages(failing), /boom/);
});
