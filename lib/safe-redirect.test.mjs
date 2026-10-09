import assert from "node:assert/strict";
import { test } from "node:test";
import { safeRedirectPath } from "./safe-redirect.ts";

test("keeps in-app paths", () => {
  assert.equal(safeRedirectPath("/progress"), "/progress");
  assert.equal(safeRedirectPath("/articles?mode=mistakes"), "/articles?mode=mistakes");
  assert.equal(safeRedirectPath(null), "/learning");
});

test("rejects every off-site variant", () => {
  for (const evil of [
    "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)",
    "/.//evil.com", "/a/..//evil.com", "/%2e//evil.com", "/..//evil.com",
  ]) {
    assert.equal(safeRedirectPath(evil), "/learning", evil);
  }
});
