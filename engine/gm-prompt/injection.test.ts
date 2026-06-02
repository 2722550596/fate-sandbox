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

void test("injectGmPromptMessages inserts modular prompt stack", () => {
  resetState();
  const messages: UserMessage[] = [createUserMessage("继续。")];

  const injected = injectGmPromptMessages<UserMessage>(messages);
  const texts = injected.map((message) => textOf(message));

  assert.equal(injected.length, 7);
  assert.match(texts[0] ?? "", /世界观与参考信息/);
  assert.equal(texts[1], "继续。");
  assert.match(texts[2] ?? "", /当前机械状态简报/);
  assert.match(texts[3] ?? "", /硬规则模块/);
  assert.match(texts[4] ?? "", /内部检查模块/);
  assert.match(texts[5] ?? "", /最终叙事风格模块/);
  assert.match(texts[6] ?? "", /最终叙事渲染协议/);
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
