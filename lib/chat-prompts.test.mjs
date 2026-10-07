// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { PERSONAS } from "./chat.ts";
import { systemPromptFor } from "./chat-prompts.ts";

test("every persona has a system prompt with the shared length, off-topic and culture rules", () => {
  for (const p of PERSONAS) {
    const system = systemPromptFor(p.id);
    assert.ok(system, `${p.id}: has a prompt`);
    assert.ok(system.includes("80 words"), `${p.id}: length cap`);
    assert.ok(system.includes("steer"), `${p.id}: steer back`);
    assert.ok(system.includes("culture"), `${p.id}: culture in scope`);
  }
});

test("unknown personas get no prompt", () => {
  assert.equal(systemPromptFor("admin"), undefined);
});

test("Lotte and Frau Streng reply in German; Nigel explains in English", () => {
  assert.match(systemPromptFor("softie"), /ONLY in simple German/);
  assert.match(systemPromptFor("strict"), /ONLY in simple German/);
  assert.match(systemPromptFor("british"), /Explain in English/);
});

test("Nigel's humour is silly, ironic and British", () => {
  const prompt = systemPromptFor("british");
  for (const word of ["silly", "ironic", "dry", "understatement"]) assert.ok(prompt.includes(word), word);
});
