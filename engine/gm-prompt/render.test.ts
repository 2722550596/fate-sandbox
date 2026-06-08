import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

void test("render prompt avoids priming the denied negation pattern", () => {
  const prompts = [
    readFileSync("agents/gm-render.md", "utf-8"),
    readFileSync("agents/gm-style.md", "utf-8"),
    readFileSync("agents/gm-think.md", "utf-8"),
    readFileSync("agents/gm-style-blacklist.md", "utf-8"),
    readFileSync("agents/gm-output-contract.md", "utf-8"),
  ];

  for (const prompt of prompts) {
    assert.doesNotMatch(prompt, /不是/u);
  }
});

void test("output contract blocks assistant delivery wrappers", () => {
  const outputContract = readFileSync("agents/gm-output-contract.md", "utf-8");

  assert.match(outputContract, /状态已经/u);
  assert.match(outputContract, /现在为你写/u);
  assert.match(outputContract, /Markdown dividers/u);
  assert.match(outputContract, /first line must be in-scene/u);
});

void test("render prompt emphasizes relationship and body rendering", () => {
  const renderPrompt = readFileSync("agents/gm-render.md", "utf-8");

  assert.match(renderPrompt, /Formation \/ distance/u);
  assert.match(renderPrompt, /Body cost/u);
  assert.match(renderPrompt, /Relationship burden/u);
  assert.match(renderPrompt, /NPC scene participation/u);
});
