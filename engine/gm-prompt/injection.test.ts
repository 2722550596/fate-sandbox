import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import test from "node:test";

import { resetState } from "../core/state-store";
import { buildSystemPrompt, injectGmPromptMessages } from "./injection";

interface UserMessage {
  role: "user";
  content: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

void test("buildSystemPrompt appends only the stable narrative lens identity", () => {
  const systemPrompt = buildSystemPrompt("base");

  assert.match(systemPrompt, /base/);
  assert.match(systemPrompt, /Fate\/Stay Night Sandbox/);
  assert.match(systemPrompt, /narrative camera/);
  assert.doesNotMatch(systemPrompt, /narrator \(GM\)/u);
  assert.doesNotMatch(systemPrompt, /Internal Check Module/);
  assert.doesNotMatch(systemPrompt, /Final Output Contract/);
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
  assert.match(texts[8] ?? "", /目标推进规则/);
  assert.match(texts[8] ?? "", /当前没有可 resolve 的目标/);
  assert.doesNotMatch(texts[8] ?? "", /active beat 收口/);
  assert.match(texts[9] ?? "", /<protagonist_impression>/);
  assert.match(texts[10] ?? "", /<tool_policy>/);
  assert.match(texts[11] ?? "", /<hard_rules>/);
  assert.match(texts[12] ?? "", /<story_driver>/);
  assert.match(texts[13] ?? "", /<output_contract>/);
});

void test("injectGmPromptMessages prefers local user prompt overrides", () => {
  resetState();
  const overridePath = "agents/user/protagonist-impression.md";
  const original = existsSync(overridePath) ? readFileSync(overridePath, "utf-8") : null;
  mkdirSync("agents/user", { recursive: true });
  writeFileSync(overridePath, "# 本地主角印象\n\n本地覆盖测试。\n");
  try {
    const injected = injectGmPromptMessages<UserMessage>([createUserMessage("继续。")]);
    const texts = injected.map((message) => textOf(message));

    assert.match(texts[9] ?? "", /本地覆盖测试/);
    assert.doesNotMatch(texts[9] ?? "", /待填写/);
  } finally {
    if (original === null) {
      rmSync(overridePath, { force: true });
    } else {
      writeFileSync(overridePath, original);
    }
  }
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
