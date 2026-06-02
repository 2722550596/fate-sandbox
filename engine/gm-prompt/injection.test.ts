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

  assert.equal(injected.length, 8);
  assert.match(texts[0] ?? "", /<world_context>/);
  assert.match(texts[1] ?? "", /<writing_guide>/);
  assert.match(texts[2] ?? "", /<render_protocol>/);
  assert.equal(texts[3], "继续。");
  assert.match(texts[4] ?? "", /<mechanical_state>/);
  assert.match(texts[5] ?? "", /<hard_rules>/);
  assert.match(texts[6] ?? "", /<story_driver>/);
  assert.match(texts[7] ?? "", /<output_contract>/);
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
