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

function injectedPromptMessage(header: string): Record<string, unknown> {
  return {
    role: "user",
    content: [{ type: "text", text: `<${header}>\ninternal prompt\n</${header}>` }],
    timestamp: 0,
  };
}

function packetCallMessage(args: Record<string, unknown>, id = "tc-1"): Record<string, unknown> {
  return {
    role: "assistant",
    content: [
      { type: "text", text: "结算完成" },
      { type: "toolCall", id, name: SUBMIT_DIRECTION_PACKET_TOOL, arguments: args },
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
  assert.match(final, /# Current Player Input/);
  assert.match(final, /贴上去！/);
  assert.match(final, /# Direction Packet/);
  assert.match(final, /Saber 突进受阻/);
  assert.match(final, /First turn # Current Player Input into in-scene action or speech/);
  assert.match(final, /Output only Chinese body prose/);
});

void test("buildRendererMessages keeps player input and filters injected settlement prompts", () => {
  const messages = buildRendererMessages(
    [
      injectedPromptMessage("settlement_principles"),
      injectedPromptMessage("prose_continuity"),
      userMessage("这是玩家真实输入。"),
      injectedPromptMessage("mechanical_state"),
      packetCallMessage(PACKET_ARGS),
    ],
    parseDirectionPacket(PACKET_ARGS, "packet"),
  );

  const final = messages.at(-1)?.text ?? "";
  assert.match(final, /# Current Player Input/);
  assert.match(final, /这是玩家真实输入。/);
  assert.doesNotMatch(final, /internal prompt/);
  assert.doesNotMatch(final, /prose_continuity/);
  assert.doesNotMatch(final, /mechanical_state/);
});

function turnsFixture(total: number): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = [];
  for (let turn = 1; turn <= total; turn++) {
    messages.push(
      userMessage(`输入 ${turn}`),
      packetCallMessage({ ...PACKET_ARGS, playerAction: `行动 ${turn}` }, `tc-${turn}`),
      proseMessage(`正文 ${turn}。`),
    );
  }
  messages.push(userMessage("最新输入"));
  return messages;
}

void test("buildRendererMessages prefers writer digests and falls back to packet digests", () => {
  const overrides = new Map([
    ["tc-2", "凛面对质问退让，同盟出现裂痕"],
    ["tc-99", "不存在的轮次"],
  ]);
  const messages = buildRendererMessages(
    turnsFixture(17),
    parseDirectionPacket(PACKET_ARGS, "packet"),
    overrides,
  );
  const digest = messages[0]?.text ?? "";
  // 第 2 轮用 writer 摘要，其余轮回退机械 packet 摘要
  assert.match(digest, /Turn 2: 凛面对质问退让，同盟出现裂痕/);
  assert.doesNotMatch(digest, /Turn 2: 行动 2/);
  assert.match(digest, /Turn 1: 行动 1/);
  assert.match(digest, /Turn 6: 行动 6/);
});

void test("buildRendererMessages keeps all turns full below the high-water mark", () => {
  const messages = buildRendererMessages(
    turnsFixture(16),
    parseDirectionPacket(PACKET_ARGS, "packet"),
  );
  // 16 轮全文（每轮 user+assistant）+ 末尾 user，无摘要层
  assert.equal(messages.length, 33);
  assert.equal(messages[0]?.text, "输入 1");
});

void test("buildRendererMessages cuts to the low-water mark with a digest layer", () => {
  const messages = buildRendererMessages(
    turnsFixture(17),
    parseDirectionPacket(PACKET_ARGS, "packet"),
  );
  // 越过高水位：边界跳到 6，全文层 = 第 7-17 轮（11 轮），前 6 轮进摘要层
  const digest = messages[0]?.text ?? "";
  assert.equal(messages[0]?.role, "user");
  assert.match(digest, /# Early Turn Digest/);
  assert.match(digest, /Turn 1: 行动 1/);
  assert.match(digest, /Turn 6: 行动 6/);
  assert.doesNotMatch(digest, /Turn 7:/);
  // 摘要 1 + 全文 11×2 + 末尾 1
  assert.equal(messages.length, 24);
  assert.equal(messages[1]?.text, "输入 7");
  // 再涨到 22 轮：边界不动（滞回），全文层 16 轮
  const grown = buildRendererMessages(
    turnsFixture(22),
    parseDirectionPacket(PACKET_ARGS, "packet"),
  );
  assert.equal(grown[1]?.text, "输入 7");
  assert.equal(grown.length, 1 + 16 * 2 + 1);
});

void test("buildRendererMessages demotes turns to digest when prose exceeds the char budget", () => {
  const messages: Record<string, unknown>[] = [];
  for (let turn = 1; turn <= 12; turn++) {
    messages.push(
      userMessage(`输入 ${turn}`),
      packetCallMessage({ ...PACKET_ARGS, playerAction: `行动 ${turn}` }),
      proseMessage(`正文 ${turn}。` + "字".repeat(5000)),
    );
  }
  messages.push(userMessage("最新输入"));
  const result = buildRendererMessages(messages, parseDirectionPacket(PACKET_ARGS, "packet"));
  // 12×5000 字超 45k 预算：前 2 轮降级进摘要，全文层保留 10 轮
  const digest = result[0]?.text ?? "";
  assert.match(digest, /Turn 2: 行动 2/);
  assert.equal(result[1]?.text, "输入 3");
});

void test("lintRenderedProse flags secret leaks as block findings", () => {
  const report = lintRenderedProse("她的真名是两仪式。", ["两仪式"]);
  assert.equal(report.leaks.length, 1);
  assert.ok(report.findings.length >= 1);
});

void test("lintRenderedProse flags underlength prose when packet context is present", () => {
  const packet = parseDirectionPacket(PACKET_ARGS, "packet");
  const report = lintRenderedProse("她抬头。雨还在下。", [], packet);
  assert.ok(report.findings.some((finding) => finding.ruleId === "underlength-prose"));
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
  const retryPrompt = retry[2]?.text ?? "";
  assert.match(retryPrompt, /fake-climax/);
  assert.match(retryPrompt, /篇幅不变/);
});

void test("buildLintRetryMessages tells renderer to grow underlength drafts", () => {
  const retry = buildLintRetryMessages([], "短。", [
    { ruleId: "underlength-prose", severity: "warn", match: "3/295 字", excerpt: "x" },
  ]);
  const prompt = retry[1]?.text ?? "";
  assert.match(prompt, /补足必要过程与篇幅/);
  assert.doesNotMatch(prompt, /篇幅不变/);
});
