import assert from "node:assert/strict";
import test from "node:test";

import { stripThinkingResidue, THINKING_PREFILL_TEXT } from "./strip-thinking.ts";

void test("THINKING_PREFILL_TEXT covers the three SillyTavern variants plus Gemini thoughtPart", () => {
  assert.match(THINKING_PREFILL_TEXT, /<\/thinking>/);
  assert.match(THINKING_PREFILL_TEXT, /<\/think>/);
  assert.match(THINKING_PREFILL_TEXT, /<\/thought>/);
  assert.match(THINKING_PREFILL_TEXT, /<｜end▁of▁thinking｜>/);
});

void test("stripThinkingResidue removes closed <think> blocks at the start", () => {
  const draft = "<think>规划这一轮先动作再对白</think>\n\n你迈步上前，掌心已经覆上剑柄。";
  assert.equal(stripThinkingResidue(draft), "你迈步上前，掌心已经覆上剑柄。");
});

void test("stripThinkingResidue removes closed <thinking>/<thought> blocks anywhere", () => {
  const draft = [
    "你迈步上前。",
    "<thinking>middle scratchpad</thinking>",
    "她垂眼避开你的视线。",
    "<thought>another part</thought>",
  ].join("\n");
  assert.equal(stripThinkingResidue(draft), "你迈步上前。\n\n她垂眼避开你的视线。");
});

void test("stripThinkingResidue strips multi-line thinking blocks", () => {
  const draft = `<think>
This is a long
multi-line chain of thought
</think>

实际正文。`;
  assert.equal(stripThinkingResidue(draft), "实际正文。");
});

void test("stripThinkingResidue strips leading residue closing tags echoed from the prefill", () => {
  const draft = "</thinking>\n</think>\n</thought>\n<｜end▁of▁thinking｜>\n\n你迈步上前。";
  assert.equal(stripThinkingResidue(draft), "你迈步上前。");
});

void test("stripThinkingResidue is case-insensitive for the tag name", () => {
  const draft = "<Think>uppercase tag</Think>正文";
  assert.equal(stripThinkingResidue(draft), "正文");
});

void test("stripThinkingResidue tolerates attributes on the opening tag", () => {
  // 有些中转会塞 <think type="cot"> 之类的属性进来
  const draft = '<think type="cot">scratchpad</think>\n正文。';
  assert.equal(stripThinkingResidue(draft), "正文。");
});

void test("stripThinkingResidue leaves unclosed openers alone (lint will catch the empty draft)", () => {
  // 没闭合就当作脏数据保留：无脑删会把整段正文删光，反而让 fallback 不触发。
  const draft = "<think>没有闭合\n后面其实也是思维内容";
  assert.equal(stripThinkingResidue(draft), draft.trim());
});

void test("stripThinkingResidue leaves clean prose untouched", () => {
  const draft = "你迈步上前，掌心已经覆上剑柄。\n\n她垂眼避开你的视线。";
  assert.equal(stripThinkingResidue(draft), draft);
});

void test("stripThinkingResidue handles prefill residue followed by closed think block", () => {
  // 实战里见过的混合形态：模型先回吐一截 prefill，又自己写了一段思维段才进正文
  const draft = "</think>\n\n<think>another chain</think>\n\n你迈步上前。";
  assert.equal(stripThinkingResidue(draft), "你迈步上前。");
});
