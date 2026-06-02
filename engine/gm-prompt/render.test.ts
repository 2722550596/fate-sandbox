import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

void test("render prompt avoids priming the denied negation pattern", () => {
  const prompts = [
    readFileSync("agents/gm-render.md", "utf-8"),
    readFileSync("agents/gm-style.md", "utf-8"),
    readFileSync("agents/gm-think.md", "utf-8"),
    readFileSync("agents/gm-output-contract.md", "utf-8"),
  ];

  for (const prompt of prompts) {
    assert.doesNotMatch(prompt, /不是/u);
  }
});

void test("render prompt emphasizes relationship and body rendering", () => {
  const renderPrompt = readFileSync("agents/gm-render.md", "utf-8");

  assert.match(renderPrompt, /队形/u);
  assert.match(renderPrompt, /身体代价/u);
  assert.match(renderPrompt, /关系负担/u);
  assert.match(renderPrompt, /NPC 微动作/u);
});
