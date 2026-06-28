import assert from "node:assert/strict";
import test from "node:test";

import { SUBMIT_DIRECTION_PACKET_TOOL } from "./render-turn.ts";
import { buildSettlementCompactionSummary } from "./settlement-compaction.ts";

function userMessage(text: string): Record<string, unknown> {
  return { role: "user", content: [{ type: "text", text }], timestamp: 0 };
}

function packetCallMessage(args: Record<string, unknown>): Record<string, unknown> {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id: "tc", name: SUBMIT_DIRECTION_PACKET_TOOL, arguments: args }],
    timestamp: 0,
  };
}

void test("buildSettlementCompactionSummary indexes turns from packet calls", () => {
  const summary = buildSettlementCompactionSummary(
    [
      userMessage("贴上去！"),
      packetCallMessage({
        needsRender: true,
        playerAction: "Saber 突进",
        resolvedChanges: ["受阻", "魔力 -10"],
      }),
      userMessage("规则问题：令咒怎么用？"),
      packetCallMessage({ needsRender: false, directReply: "……" }),
    ],
    undefined,
  );

  assert.match(summary, /\[结算上下文截断摘要/);
  assert.match(summary, /以注入的 state 为准/);
  assert.match(summary, /- 玩家「贴上去！」｜Saber 突进→ 受阻；魔力 -10/);
  assert.match(summary, /- 玩家「规则问题：令咒怎么用？」｜meta\/OOC 轮/);
});

void test("buildSettlementCompactionSummary folds previous digest lines and caps total", () => {
  const previousLines = Array.from({ length: 90 }, (_, i) => `- 旧轮 ${i + 1}`).join("\n");
  const previous = `[结算上下文截断摘要｜机械生成]\n说明行\n${previousLines}`;
  const summary = buildSettlementCompactionSummary(
    [userMessage("新行动"), packetCallMessage({ needsRender: true, playerAction: "新行动落地" })],
    previous,
  );

  // 90 旧行 + 1 新行 → 保留尾部 80 行，丢弃 11 行
  assert.match(summary, /更早的 11 轮索引已丢弃/);
  assert.doesNotMatch(summary, /- 旧轮 11\n/);
  assert.match(summary, /- 旧轮 90/);
  assert.match(summary, /- 玩家「新行动」｜新行动落地/);
  assert.doesNotMatch(summary, /说明行/);
});

void test("buildSettlementCompactionSummary is deterministic", () => {
  const messages = [
    userMessage("行动"),
    packetCallMessage({ needsRender: true, playerAction: "落地" }),
  ];
  assert.equal(
    buildSettlementCompactionSummary(messages, undefined),
    buildSettlementCompactionSummary(messages, undefined),
  );
});

void test("long player input is excerpted", () => {
  const summary = buildSettlementCompactionSummary(
    [
      userMessage("这是一段非常长的玩家输入".repeat(10)),
      packetCallMessage({ needsRender: true, playerAction: "行动" }),
    ],
    undefined,
  );
  assert.match(summary, /…」/);
});

void test("buildSettlementCompactionSummary includes prose excerpt when prose message exists", () => {
  const summary = buildSettlementCompactionSummary(
    [
      userMessage("抱起她"),
      proseMessage("你一手托住膝弯，一手稳住她的后背，站起来的瞬间她整个人的重量压过来。"),
      packetCallMessage({
        needsRender: true,
        playerAction: "Saber offers to carry",
        resolvedChanges: ["princess carry established"],
      }),
    ],
    undefined,
  );

  assert.match(summary, /▸ 正文：/);
  assert.match(summary, /一手托住膝弯/);
});

void test("buildSettlementCompactionSummary omits prose marker when no prose message", () => {
  const summary = buildSettlementCompactionSummary(
    [userMessage("行动"), packetCallMessage({ needsRender: true, playerAction: "行动落地" })],
    undefined,
  );

  assert.doesNotMatch(summary, /▸ 正文/);
});

function proseMessage(text: string): Record<string, unknown> {
  return { role: "custom", customType: "rendered-prose", content: text };
}
