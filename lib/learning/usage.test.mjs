// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCost, formatModel, readUsage } from "./usage.ts";

test("readUsage takes the model and token counts from an OpenRouter response", () => {
  const u = readUsage({ model: "google/gemini-2.5-flash-lite", usage: { prompt_tokens: 2900, completion_tokens: 220, cost: 0.000378 } }, "fallback/model");
  assert.deepEqual(u, { model: "google/gemini-2.5-flash-lite", promptTokens: 2900, completionTokens: 220, costUsd: 0.000378 });
});

test("readUsage falls back to the requested model and nulls when parts are missing or odd", () => {
  assert.deepEqual(readUsage({}, "google/gemini-2.5-flash-lite"), { model: "google/gemini-2.5-flash-lite", promptTokens: null, completionTokens: null, costUsd: null });
  assert.deepEqual(readUsage({ model: 5, usage: { prompt_tokens: -1, completion_tokens: 1.5, cost: "x" } }, "m/x"), { model: "m/x", promptTokens: null, completionTokens: null, costUsd: null });
  assert.deepEqual(readUsage(null, "m/x"), { model: "m/x", promptTokens: null, completionTokens: null, costUsd: null });
});

test("formatModel turns a slug into a readable name", () => {
  assert.equal(formatModel("google/gemini-2.5-flash-lite"), "Gemini 2.5 Flash Lite");
  assert.equal(formatModel("plain"), "Plain");
});

test("formatCost shows tiny amounts readably", () => {
  assert.equal(formatCost(0.000378), "$0.0004");
  assert.equal(formatCost(0.0123), "$0.012");
  assert.equal(formatCost(0), "$0");
  assert.equal(formatCost(0.0000003), "under $0.000001");
  assert.equal(formatCost(null), null);
});
