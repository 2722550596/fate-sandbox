import type { AssistantMessage, UserMessage } from "@earendil-works/pi-ai";
import type {
  CustomEntry,
  CustomMessageEntry,
  SessionEntry,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";

import type { RenderDirectionPacket } from "../../engine/direction/packet-schema.ts";

import assert from "node:assert/strict";
import test from "node:test";

import {
  SUBMIT_DIRECTION_PACKET_TOOL,
  PROSE_CUSTOM_TYPE,
} from "../../engine/direction/render-turn.ts";
import { findRerollTarget, isRerollTargetStillCurrent } from "./reroll.ts";

const PACKET: RenderDirectionPacket = {
  needsRender: true,
  playerAction: "调查祭坛",
  resolvedChanges: ["主角发现祭坛背面有新鲜划痕"],
  npcStances: [],
  sensoryAnchors: ["冷灰尘"],
  endWindow: "划痕延伸到石板缝隙里，等待下一步检查。",
  eventWeight: "normal",
  canonFacts: [],
};

function userMessage(text: string): UserMessage {
  return { role: "user", content: text, timestamp: Date.now() };
}

function assistantPacketMessage(id: string): AssistantMessage {
  return {
    role: "assistant",
    content: [
      {
        type: "toolCall",
        id,
        name: SUBMIT_DIRECTION_PACKET_TOOL,
        arguments: PACKET,
      },
    ],
    api: "anthropic-messages",
    provider: "anthropic",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "toolUse",
    timestamp: Date.now(),
  };
}

function userEntry(id: string, parentId: string | null, text: string): SessionMessageEntry {
  return {
    type: "message",
    id,
    parentId,
    timestamp: new Date().toISOString(),
    message: userMessage(text),
  };
}

function assistantPacketEntry(id: string, parentId: string | null): SessionMessageEntry {
  return {
    type: "message",
    id,
    parentId,
    timestamp: new Date().toISOString(),
    message: assistantPacketMessage(`call-${id}`),
  };
}

function proseEntry(id: string, parentId: string | null): CustomMessageEntry {
  return {
    type: "custom_message",
    id,
    parentId,
    timestamp: new Date().toISOString(),
    customType: PROSE_CUSTOM_TYPE,
    content: "旧正文",
    display: true,
  };
}

function hiddenStateEntry(id: string, parentId: string | null): CustomEntry {
  return {
    type: "custom",
    id,
    parentId,
    timestamp: new Date().toISOString(),
    customType: "fsn-state",
    data: { state: {} },
  };
}

void test("findRerollTarget 定位最后正文与对应结算包", () => {
  const branch: SessionEntry[] = [
    userEntry("u1", null, "调查祭坛"),
    assistantPacketEntry("a1", "u1"),
    proseEntry("p1", "a1"),
  ];

  const target = findRerollTarget(branch);
  assert.equal(target.kind, "ready");
  if (target.kind !== "ready") {
    assert.fail("expected ready reroll target");
  }
  assert.equal(target.proseEntry.id, "p1");
  assert.equal(target.parentId, "a1");
  assert.equal(target.pending.toolCallId, "call-a1");
  assert.equal(target.pending.packet.needsRender, true);
  assert.equal(target.renderMessages.length, 2);
});

void test("findRerollTarget 允许正文后的隐藏非消息 entry", () => {
  const branch: SessionEntry[] = [
    userEntry("u1", null, "调查祭坛"),
    assistantPacketEntry("a1", "u1"),
    proseEntry("p1", "a1"),
    hiddenStateEntry("s1", "p1"),
  ];

  const target = findRerollTarget(branch);
  assert.equal(target.kind, "ready");
  if (target.kind !== "ready") {
    assert.fail("expected ready reroll target");
  }
  assert.equal(target.proseEntry.id, "p1");
  assert.equal(target.parentId, "a1");
  assert.equal(target.pending.toolCallId, "call-a1");
});

void test("isRerollTargetStillCurrent 允许渲染期间保留隐藏非消息 leaf", () => {
  const initialBranch: SessionEntry[] = [
    userEntry("u1", null, "调查祭坛"),
    assistantPacketEntry("a1", "u1"),
    proseEntry("p1", "a1"),
  ];
  const target = findRerollTarget(initialBranch);
  assert.equal(target.kind, "ready");
  if (target.kind !== "ready") {
    assert.fail("expected ready reroll target");
  }

  const currentBranch = [...initialBranch, hiddenStateEntry("s1", "p1")];
  assert.equal(isRerollTargetStillCurrent(currentBranch, target), true);
});

void test("isRerollTargetStillCurrent 拒绝渲染期间出现的新消息", () => {
  const initialBranch: SessionEntry[] = [
    userEntry("u1", null, "调查祭坛"),
    assistantPacketEntry("a1", "u1"),
    proseEntry("p1", "a1"),
  ];
  const target = findRerollTarget(initialBranch);
  assert.equal(target.kind, "ready");
  if (target.kind !== "ready") {
    assert.fail("expected ready reroll target");
  }

  const currentBranch = [...initialBranch, userEntry("u2", "p1", "继续检查")];
  assert.equal(isRerollTargetStillCurrent(currentBranch, target), false);
});

void test("findRerollTarget 拒绝没有正文的分支", () => {
  const target = findRerollTarget([
    userEntry("u1", null, "调查祭坛"),
    assistantPacketEntry("a1", "u1"),
  ]);

  assert.deepEqual(target, { kind: "no-prose" });
});

void test("findRerollTarget 拒绝正文后的新消息", () => {
  const target = findRerollTarget([
    userEntry("u1", null, "调查祭坛"),
    assistantPacketEntry("a1", "u1"),
    proseEntry("p1", "a1"),
    userEntry("u2", "p1", "继续检查"),
  ]);

  assert.deepEqual(target, { kind: "not-leaf", proseEntryId: "p1", leafId: "u2" });
});

void test("findRerollTarget 拒绝缺少结算包的正文", () => {
  const target = findRerollTarget([userEntry("u1", null, "调查祭坛"), proseEntry("p1", "u1")]);

  assert.deepEqual(target, { kind: "no-packet", proseEntryId: "p1" });
});
