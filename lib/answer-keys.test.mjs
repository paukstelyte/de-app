// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ADVANCE_DELAY_MS, clickContinues, keyContinues, nextEnabled } from "./answer-keys.ts";

const el = (interactive) => ({ closest: (sel) => (interactive && sel.includes(interactive) ? {} : null) });

test("a click continues unless it lands on a link, button or field", () => {
  assert.equal(clickContinues(el(null)), true); // empty space, text, the card
  for (const tag of ["a", "button", "input", "textarea", "select", "label", "[role=button]"]) assert.equal(clickContinues(el(tag)), false, tag);
  assert.equal(clickContinues(null), true);
  assert.equal(ADVANCE_DELAY_MS, 1500);
});

test("Enter continues unless a button, link or editable field is focused; repeats never do", () => {
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "BODY" }), true);
  assert.equal(keyContinues({ key: "Enter", repeat: false }, null), true);
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "INPUT", readOnly: true }), true); // answered typed item
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "INPUT", readOnly: false }), false);
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "BUTTON" }), false); // the button handles Enter itself
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "A" }), false);
  assert.equal(keyContinues({ key: "Enter", repeat: true }, { tagName: "BODY" }), false);
  assert.equal(keyContinues({ key: " ", repeat: false }, { tagName: "BODY" }), false);
});

test("arrow focus moves to the next enabled box and wraps", () => {
  assert.equal(nextEnabled(0, [true, true, true], 1), 1);
  assert.equal(nextEnabled(2, [true, true, true], 1), 0); // wraps right
  assert.equal(nextEnabled(0, [true, true, true], -1), 2); // wraps left
  assert.equal(nextEnabled(0, [true, false, true], 1), 2); // skips disabled
  assert.equal(nextEnabled(1, [false, true, false], 1), 1); // nothing else enabled
  assert.equal(nextEnabled(-1, [true, true], 1), 0); // nothing focused yet
});
