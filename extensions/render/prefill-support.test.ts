import assert from "node:assert/strict";
import test from "node:test";

import { supportsAssistantPrefill } from "./index.ts";

void test("Claude models reject assistant prefill regardless of provider routing", () => {
  // 原生 anthropic 渠道
  assert.equal(supportsAssistantPrefill({ id: "claude-sonnet-4", provider: "anthropic" }), false);
  // Claude 经第三方代理：provider 不是 anthropic，但模型名仍含 claude
  assert.equal(
    supportsAssistantPrefill({ id: "anthropic/claude-3.5-sonnet", provider: "openrouter" }),
    false,
  );
  // 大小写不敏感
  assert.equal(supportsAssistantPrefill({ id: "Claude-Opus", provider: "openrouter" }), false);
});

void test("non-anthropic non-Claude models keep the thinking prefill", () => {
  assert.equal(supportsAssistantPrefill({ id: "gemini-2.5-pro", provider: "google" }), true);
  assert.equal(supportsAssistantPrefill({ id: "deepseek-v4-pro", provider: "deepseek" }), true);
});

void test("anthropic provider rejects prefill even for non-claude model id", () => {
  assert.equal(supportsAssistantPrefill({ id: "test-model", provider: "anthropic" }), false);
});
