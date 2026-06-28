import assert from "node:assert/strict";
import test from "node:test";

import { rollDiceTool } from "./roll-dice.ts";

function message(result: { content: Array<{ type: string; text: string }> }): string {
  return result.content[0]?.text ?? "";
}

function extractResults(details: Record<string, unknown>): number[] {
  const raw = details.results;
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is number => typeof n === "number");
}

void test("rollDiceTool rolls a single d100 by default", () => {
  const result = rollDiceTool({});
  const results = extractResults(result.details);

  assert.ok(message(result).startsWith("骰子结果 (1d100)"));
  assert.equal(result.details.count, 1);
  assert.equal(result.details.diceType, 100);
  assert.equal(results.length, 1);
  assert.ok(results[0]! >= 1);
  assert.ok(results[0]! <= 100);
});

void test("rollDiceTool rolls specified dice type", () => {
  const result = rollDiceTool({ diceType: 20 });
  const results = extractResults(result.details);

  assert.ok(message(result).startsWith("骰子结果 (1d20)"));
  assert.equal(result.details.diceType, 20);
  assert.ok(results[0]! >= 1);
  assert.ok(results[0]! <= 20);
});

void test("rollDiceTool rolls multiple dice", () => {
  const result = rollDiceTool({ diceType: 6, count: 4 });
  const results = extractResults(result.details);

  assert.ok(message(result).startsWith("骰子结果 (4d6)"));
  assert.equal(result.details.count, 4);
  assert.equal(results.length, 4);
  const total = results.reduce((a: number, b: number) => a + b, 0);
  assert.equal(result.details.total, total);
});

void test("rollDiceTool clamps count to min 1", () => {
  const result = rollDiceTool({ diceType: 10, count: 0 });

  assert.equal(result.details.count, 1);
});

void test("rollDiceTool clamps count to max 10", () => {
  const result = rollDiceTool({ diceType: 10, count: 100 });

  assert.equal(result.details.count, 10);
});

void test("rollDiceTool handles null params gracefully", () => {
  const result = rollDiceTool(null);

  assert.equal(result.details.count, 1);
  assert.equal(result.details.diceType, 100);
});
