import assert from "node:assert/strict";
import test from "node:test";

import { stripLeakedSettlementProse } from "./settlement-prose-firewall.ts";

const toolCall = {
  type: "toolCall",
  toolCallId: "t1",
  toolName: "submit_direction_packet",
  args: {},
};
const thinking = { type: "thinking", thinking: "先动作再对白" };
const text = { type: "text", text: "你迈步上前，掌心覆上剑柄。" };

void test("strips leaked text parts from a tool-calling assistant message", () => {
  const message = { role: "assistant", content: [text, toolCall], stopReason: "toolUse" };
  const result = stripLeakedSettlementProse(message);
  assert.deepEqual(result, { role: "assistant", content: [toolCall], stopReason: "toolUse" });
});

void test("keeps thinking parts, drops only text", () => {
  const message = { role: "assistant", content: [thinking, text, toolCall], stopReason: "toolUse" };
  const result = stripLeakedSettlementProse(message);
  assert.deepEqual(result?.content, [thinking, toolCall]);
});

void test("removes multiple leaked text parts", () => {
  const text2 = { type: "text", text: "她垂眼避开视线。" };
  const message = { role: "assistant", content: [text, toolCall, text2], stopReason: "toolUse" };
  const result = stripLeakedSettlementProse(message);
  assert.deepEqual(result?.content, [toolCall]);
});

void test("leaves a pure-text assistant message untouched (no packet = player-visible reply)", () => {
  const message = { role: "assistant", content: [text], stopReason: "endTurn" };
  assert.equal(stripLeakedSettlementProse(message), undefined);
});

void test("leaves a tool-call-only assistant message untouched", () => {
  const message = { role: "assistant", content: [thinking, toolCall], stopReason: "toolUse" };
  assert.equal(stripLeakedSettlementProse(message), undefined);
});

void test("ignores non-assistant messages", () => {
  assert.equal(stripLeakedSettlementProse({ role: "user", content: "在干嘛" }), undefined);
  assert.equal(
    stripLeakedSettlementProse({ role: "toolResult", toolCallId: "t1", content: [] }),
    undefined,
  );
});

void test("does not mutate the original message", () => {
  const content = [text, toolCall];
  const message = { role: "assistant", content, stopReason: "toolUse" };
  stripLeakedSettlementProse(message);
  assert.equal(content.length, 2);
});

void test("tolerates malformed content", () => {
  assert.equal(stripLeakedSettlementProse({ role: "assistant" }), undefined);
  assert.equal(stripLeakedSettlementProse({ role: "assistant", content: "oops" }), undefined);
  assert.equal(stripLeakedSettlementProse("nope"), undefined);
});
