import assert from "node:assert/strict";
import test from "node:test";

import { parseDirectionPacket } from "./packet-schema.ts";
import {
  buildLintRetryMessages,
  buildRendererMessages,
  findPendingDirectionPacket,
  lintRenderedProse,
  PROSE_CUSTOM_TYPE,
  redactSecrets,
  SUBMIT_DIRECTION_PACKET_TOOL,
} from "./render-turn.ts";

const PACKET_ARGS = {
  needsRender: true,
  playerAction: "下达突进指令",
  resolvedChanges: ["Saber 突进受阻"],
  npcStances: [],
  sensoryAnchors: ["灼热气浪"],
  endWindow: "玩家必须创造破绽",
  eventWeight: "normal",
  canonFacts: [],
};

function userMessage(text: string): Record<string, unknown> {
  return { role: "user", content: [{ type: "text", text }], timestamp: 0 };
}

function proseMessage(text: string): Record<string, unknown> {
  return { role: "custom", customType: PROSE_CUSTOM_TYPE, content: text, display: true };
}

function packetCallMessage(args: Record<string, unknown>): Record<string, unknown> {
  return {
    role: "assistant",
    content: [
      { type: "text", text: "结算完成" },
      { type: "toolCall", id: "tc-1", name: SUBMIT_DIRECTION_PACKET_TOOL, arguments: args },
    ],
    timestamp: 0,
  };
}

void test("findPendingDirectionPacket returns the latest unrendered packet with its call id", () => {
  const pending = findPendingDirectionPacket([
    userMessage("贴上去！"),
    packetCallMessage(PACKET_ARGS),
  ]);
  assert.ok(pending);
  assert.equal(pending.packet.needsRender, true);
  assert.equal(pending.toolCallId, "tc-1");
});

void test("findPendingDirectionPacket ignores already-rendered turns", () => {
  const pending = findPendingDirectionPacket([
    userMessage("贴上去！"),
    packetCallMessage(PACKET_ARGS),
    proseMessage("已渲染的正文。"),
  ]);
  assert.equal(pending, undefined);
});

void test("findPendingDirectionPacket returns undefined without a packet call", () => {
  assert.equal(
    findPendingDirectionPacket([
      userMessage("继续。"),
      { role: "assistant", content: [{ type: "text", text: "……" }], timestamp: 0 },
    ]),
    undefined,
  );
});

void test("buildRendererMessages builds an append-only conversation shape", () => {
  const messages = buildRendererMessages(
    [
      userMessage("第一轮输入"),
      packetCallMessage(PACKET_ARGS),
      proseMessage("第一轮正文。"),
      userMessage("贴上去！"),
      packetCallMessage(PACKET_ARGS),
    ],
    parseDirectionPacket(PACKET_ARGS, "packet"),
  );

  // user(第一轮输入) / assistant(第一轮正文) / user(本轮输入+packet)
  assert.equal(messages.length, 3);
  assert.deepEqual(
    messages.map((entry) => entry.role),
    ["user", "assistant", "user"],
  );
  assert.equal(messages[0]?.text, "第一轮输入");
  assert.equal(messages[1]?.text, "第一轮正文。");
  const final = messages[2]?.text ?? "";
  assert.match(final, /# 玩家本轮输入/);
  assert.match(final, /贴上去！/);
  assert.match(final, /# Direction Packet/);
  assert.match(final, /Saber 突进受阻/);
  assert.match(final, /只输出正文/);
});

function turnsFixture(total: number): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = [];
  for (let turn = 1; turn <= total; turn++) {
    messages.push(
      userMessage(`输入 ${turn}`),
      packetCallMessage({ ...PACKET_ARGS, playerAction: `行动 ${turn}` }),
      proseMessage(`正文 ${turn}。`),
    );
  }
  messages.push(userMessage("最新输入"));
  return messages;
}

void test("buildRendererMessages keeps all turns full below the high-water mark", () => {
  const messages = buildRendererMessages(
    turnsFixture(12),
    parseDirectionPacket(PACKET_ARGS, "packet"),
  );
  // 12 轮全文（每轮 user+assistant）+ 末尾 user，无摘要层
  assert.equal(messages.length, 25);
  assert.equal(messages[0]?.text, "输入 1");
});

void test("buildRendererMessages cuts to the low-water mark with a digest layer", () => {
  const messages = buildRendererMessages(
    turnsFixture(13),
    parseDirectionPacket(PACKET_ARGS, "packet"),
  );
  // 越过高水位：边界跳到 6，全文层 = 第 7-13 轮（7 轮），前 6 轮进摘要层
  const digest = messages[0]?.text ?? "";
  assert.equal(messages[0]?.role, "user");
  assert.match(digest, /# 早期轮次摘要/);
  assert.match(digest, /第1轮：行动 1/);
  assert.match(digest, /第6轮：行动 6/);
  assert.doesNotMatch(digest, /第7轮/);
  // 摘要 1 + 全文 7×2 + 末尾 1
  assert.equal(messages.length, 16);
  assert.equal(messages[1]?.text, "输入 7");
  // 再涨到 18 轮：边界不动（滞回），全文层 12 轮
  const grown = buildRendererMessages(
    turnsFixture(18),
    parseDirectionPacket(PACKET_ARGS, "packet"),
  );
  assert.equal(grown[1]?.text, "输入 7");
  assert.equal(grown.length, 1 + 12 * 2 + 1);
});

void test("buildRendererMessages demotes turns to digest when prose exceeds the char budget", () => {
  const messages: Record<string, unknown>[] = [];
  for (let turn = 1; turn <= 10; turn++) {
    messages.push(
      userMessage(`输入 ${turn}`),
      packetCallMessage({ ...PACKET_ARGS, playerAction: `行动 ${turn}` }),
      proseMessage(`正文 ${turn}。` + "字".repeat(5000)),
    );
  }
  messages.push(userMessage("最新输入"));
  const result = buildRendererMessages(messages, parseDirectionPacket(PACKET_ARGS, "packet"));
  // 10×5000 字超 30k 预算：前 4 轮降级进摘要，全文层保留 6 轮
  const digest = result[0]?.text ?? "";
  assert.match(digest, /第4轮：行动 4/);
  assert.equal(result[1]?.text, "输入 5");
});

void test("lintRenderedProse flags secret leaks as block findings", () => {
  const report = lintRenderedProse("她的真名是两仪式。", ["两仪式"]);
  assert.equal(report.leaks.length, 1);
  assert.ok(report.findings.length >= 1);
});

void test("redactSecrets masks unrevealed secret strings", () => {
  const redacted = redactSecrets("两仪式出刀，两仪式收刀。", ["两仪式"]);
  assert.doesNotMatch(redacted, /两仪式/);
  assert.match(redacted, /▮/);
});

void test("buildLintRetryMessages appends draft and violations after the base prefix", () => {
  const base = [{ role: "user" as const, text: "BASE" }];
  const retry = buildLintRetryMessages(base, "首稿正文", [
    { ruleId: "fake-climax", severity: "warn", match: "第一次真正", excerpt: "x" },
  ]);
  assert.equal(retry.length, 3);
  assert.equal(retry[0]?.text, "BASE");
  assert.equal(retry[1]?.role, "assistant");
  assert.equal(retry[1]?.text, "首稿正文");
  assert.match(retry[2]?.text ?? "", /fake-climax/);
});
