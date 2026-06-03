import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../core/state";
import { buildSystemPrompt, injectGmPromptMessages } from "./injection";

interface UserMessage {
  role: "user";
  content: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

void test("buildSystemPrompt appends only the stable narrative lens identity", () => {
  const systemPrompt = buildSystemPrompt("base");

  assert.match(systemPrompt, /base/);
  assert.match(systemPrompt, /Fate\/Stay Night 沙盒/);
  assert.match(systemPrompt, /叙事镜头/);
  assert.doesNotMatch(systemPrompt, /叙事者（GM）/);
  assert.doesNotMatch(systemPrompt, /内部检查模块/);
  assert.doesNotMatch(systemPrompt, /最终叙事风格模块/);
});

void test("injectGmPromptMessages inserts slot-based prompt stack", () => {
  resetState();
  const messages: UserMessage[] = [createUserMessage("继续。")];

  const injected = injectGmPromptMessages<UserMessage>(messages);
  const texts = injected.map((message) => textOf(message));

  assert.equal(injected.length, 14);
  assert.match(texts[0] ?? "", /<creative_constitution>/);
  assert.match(texts[1] ?? "", /<world_context>/);
  assert.match(texts[2] ?? "", /<input_guide>/);
  assert.match(texts[3] ?? "", /<social_guide>/);
  assert.match(texts[4] ?? "", /<style_blacklist>/);
  assert.match(texts[5] ?? "", /<writing_guide>/);
  assert.match(texts[6] ?? "", /<render_protocol>/);
  assert.equal(texts[7], "继续。");
  assert.match(texts[8] ?? "", /<mechanical_state>/);
  assert.match(texts[8] ?? "", /目标选择规则/);
  assert.match(texts[8] ?? "", /逐字复制上方 summary/);
  assert.match(texts[9] ?? "", /<protagonist_impression>/);
  assert.match(texts[9] ?? "", /Saber \/ 两仪式/);
  assert.match(texts[10] ?? "", /<tool_policy>/);
  assert.match(texts[11] ?? "", /<hard_rules>/);
  assert.match(texts[12] ?? "", /<story_driver>/);
  assert.match(texts[13] ?? "", /<output_contract>/);
});

void test("injectGmPromptMessages keeps conversation history contiguous before runtime slots", () => {
  resetState();
  const messages: UserMessage[] = [createUserMessage("第一句。"), createUserMessage("第二句。")];

  const injected = injectGmPromptMessages<UserMessage>(messages);
  const texts = injected.map((message) => textOf(message));

  assert.equal(texts[7], "第一句。");
  assert.equal(texts[8], "第二句。");
  assert.match(texts[9] ?? "", /<mechanical_state>/);
});

function createUserMessage(text: string): UserMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 0,
  };
}

function textOf(message: UserMessage): string {
  return message.content.map((part) => part.text).join("\n");
}
