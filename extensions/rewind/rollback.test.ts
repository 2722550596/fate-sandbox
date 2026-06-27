import type { AssistantMessage, UserMessage } from "@earendil-works/pi-ai";
import type { SessionEntry, SessionMessageEntry } from "@earendil-works/pi-coding-agent";

import { SessionManager } from "@earendil-works/pi-coding-agent";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { isRecord } from "../../engine/core/utils/typebox-validation.ts";
import { pruneAbandonedSubtree } from "./prune.ts";
import {
  collectSubtreeIds,
  extractUserMessageText,
  findRollbackTarget,
  parseRollbackSteps,
} from "./rollback.ts";

function userMessage(text: string): UserMessage {
  return { role: "user", content: text, timestamp: Date.now() };
}

function assistantMessage(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
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
    stopReason: "stop",
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

function assistantEntry(id: string, parentId: string | null): SessionMessageEntry {
  return {
    type: "message",
    id,
    parentId,
    timestamp: new Date().toISOString(),
    message: assistantMessage("回复"),
  };
}

void test("parseRollbackSteps 默认 1 步并拒绝非法输入", () => {
  assert.equal(parseRollbackSteps(""), 1);
  assert.equal(parseRollbackSteps("  "), 1);
  assert.equal(parseRollbackSteps("3"), 3);
  assert.equal(parseRollbackSteps(" 2 "), 2);
  assert.equal(parseRollbackSteps("0"), undefined);
  assert.equal(parseRollbackSteps("-1"), undefined);
  assert.equal(parseRollbackSteps("abc"), undefined);
  assert.equal(parseRollbackSteps("1.5"), undefined);
});

void test("findRollbackTarget 从后往前定位第 N 条用户输入", () => {
  const branch: SessionEntry[] = [
    userEntry("u1", null, "第一句"),
    assistantEntry("a1", "u1"),
    userEntry("u2", "a1", "第二句"),
    assistantEntry("a2", "u2"),
  ];

  assert.equal(findRollbackTarget(branch, 1)?.id, "u2");
  assert.equal(findRollbackTarget(branch, 2)?.id, "u1");
  assert.equal(findRollbackTarget(branch, 3), undefined);
});

void test("collectSubtreeIds 覆盖整棵子树且不波及旁支", () => {
  const entries: SessionEntry[] = [
    userEntry("u1", null, "开局"),
    assistantEntry("a1", "u1"),
    userEntry("u2", "a1", "坏输入"),
    assistantEntry("a2", "u2"),
    assistantEntry("a3", "a2"),
    // 旁支：从 a1 分出的另一条线，不应被删除
    userEntry("u2b", "a1", "好输入"),
    assistantEntry("a2b", "u2b"),
  ];

  const doomed = collectSubtreeIds(entries, "u2");
  assert.deepEqual([...doomed].toSorted(), ["a2", "a3", "u2"]);
});

void test("extractUserMessageText 支持字符串与分段内容", () => {
  assert.equal(extractUserMessageText(userEntry("u1", null, "纯文本")), "纯文本");

  const segmented: SessionMessageEntry = {
    type: "message",
    id: "u2",
    parentId: null,
    timestamp: new Date().toISOString(),
    message: {
      role: "user",
      content: [
        { type: "text", text: "第一段" },
        { type: "image", data: "...", mimeType: "image/png" },
        { type: "text", text: "第二段" },
      ],
      timestamp: Date.now(),
    },
  };
  assert.equal(extractUserMessageText(segmented), "第一段\n第二段");

  assert.equal(extractUserMessageText(assistantEntry("a1", null)), "");
});

void test("pruneAbandonedSubtree 物理删除废弃分支并恢复 leaf", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "fuck-rewind-test-"));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const sessionManager = SessionManager.create(dir, dir);
  const u1 = sessionManager.appendMessage(userMessage("第一回合"));
  const a1 = sessionManager.appendMessage(assistantMessage("GM 回复一"));
  const u2 = sessionManager.appendMessage(userMessage("坏输入"));
  sessionManager.appendMessage(assistantMessage("GM 回复二"));

  const file = sessionManager.getSessionFile();
  assert.ok(file !== undefined && existsSync(file), "session 文件应已落盘");

  const pruned = pruneAbandonedSubtree(sessionManager, u2, a1);
  assert.equal(pruned, true);

  // 内存索引：废弃条目消失，leaf 恢复到回退点
  assert.equal(sessionManager.getEntry(u2), undefined);
  assert.equal(sessionManager.getLeafId(), a1);
  const branchIds = sessionManager.getBranch().map((entry) => entry.id);
  assert.deepEqual(branchIds, [u1, a1]);

  // 磁盘文件：只剩 header + 存活条目
  const lines = readFileSync(file, "utf8").trim().split("\n").map(parseJsonLine);
  assert.equal(lines[0]?.["type"], "session");
  const ids = lines.slice(1).map((line) => line["id"]);
  assert.deepEqual(ids, [u1, a1]);
});

void test("pruneAbandonedSubtree 回退到根时清空会话", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "fuck-rewind-root-test-"));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const sessionManager = SessionManager.create(dir, dir);
  const u1 = sessionManager.appendMessage(userMessage("开局输入"));
  sessionManager.appendMessage(assistantMessage("GM 回复"));

  const pruned = pruneAbandonedSubtree(sessionManager, u1, null);
  assert.equal(pruned, true);
  assert.equal(sessionManager.getLeafId(), null);
  assert.deepEqual(sessionManager.getEntries(), []);
});

void test("pruneAbandonedSubtree 对未持久化 session 安全跳过", () => {
  const sessionManager = SessionManager.inMemory();
  sessionManager.appendMessage(userMessage("内存输入"));

  assert.equal(pruneAbandonedSubtree(sessionManager, "whatever", null), false);
});

function parseJsonLine(line: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(line);
  if (!isRecord(parsed)) {
    throw new Error(`session 行不是 JSON 对象：${line}`);
  }
  return parsed;
}
