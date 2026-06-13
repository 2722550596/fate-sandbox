import assert from "node:assert/strict";
import test from "node:test";

import { parseSessionJsonl, reconstructActivePath } from "../engine/audit/session-audit.ts";

/**
 * Export book 的核心逻辑测试。
 * 直接测试 parseSessionJsonl + reconstructActivePath 对 fsn-prose 的提取，
 * 不测文件 I/O。
 */

const PROSE_CUSTOM_TYPE = "fsn-prose";

function buildTestSession(): string {
  const entries = [
    // header
    { type: "session_start", id: "root" },
    // user message
    {
      type: "message",
      id: "msg-1",
      parentId: "root",
      message: { role: "user", content: [{ type: "text", text: "继续探索教会。" }] },
    },
    // assistant (settlement pass — tool calls, not player-facing)
    {
      type: "message",
      id: "msg-2",
      parentId: "msg-1",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "[internal settlement output]" }],
      },
    },
    // fsn-prose custom message (rendered narrative)
    {
      type: "custom_message",
      id: "msg-3",
      parentId: "msg-2",
      customType: PROSE_CUSTOM_TYPE,
      content: "月光从彩色玻璃窗倾泻而入，在地板上投下斑驳的色彩。教会内部比想象中更加宽敞。",
    },
    // another user message
    {
      type: "message",
      id: "msg-4",
      parentId: "msg-3",
      message: { role: "user", content: "检查祭坛后面。" },
    },
    // another prose
    {
      type: "custom_message",
      id: "msg-5",
      parentId: "msg-4",
      customType: PROSE_CUSTOM_TYPE,
      content: "祭坛后方的石板微微松动。你俯身检查，发现一条通向地下的暗道。",
    },
    // a slash command (should be skipped)
    {
      type: "message",
      id: "msg-6",
      parentId: "msg-5",
      message: { role: "user", content: "/status" },
    },
  ];
  return entries.map((entry) => JSON.stringify(entry)).join("\n");
}

void test("extracting fsn-prose from session JSONL yields clean narrative", () => {
  const content = buildTestSession();
  const entries = reconstructActivePath(parseSessionJsonl(content));

  const proseEntries = entries.filter(
    (entry) => entry.type === "custom_message" && entry.customType === PROSE_CUSTOM_TYPE,
  );

  assert.equal(proseEntries.length, 2);
  assert.equal(
    typeof proseEntries[0]?.content === "string" ? proseEntries[0].content : "",
    "月光从彩色玻璃窗倾泻而入，在地板上投下斑驳的色彩。教会内部比想象中更加宽敞。",
  );
  assert.equal(
    typeof proseEntries[1]?.content === "string" ? proseEntries[1].content : "",
    "祭坛后方的石板微微松动。你俯身检查，发现一条通向地下的暗道。",
  );
});

void test("user messages are extracted with string and array content", () => {
  const content = buildTestSession();
  const entries = reconstructActivePath(parseSessionJsonl(content));

  const userEntries = entries.filter(
    (entry) => entry.type === "message" && entry.message?.["role"] === "user",
  );

  assert.equal(userEntries.length, 3); // includes /status
});

void test("active path excludes abandoned branches", () => {
  const entries = [
    { type: "session_start", id: "root" },
    { type: "message", id: "a", parentId: "root", message: { role: "user", content: "first" } },
    {
      type: "custom_message",
      id: "b",
      parentId: "a",
      customType: PROSE_CUSTOM_TYPE,
      content: "prose-1",
    },
    // abandoned branch
    {
      type: "message",
      id: "c-abandoned",
      parentId: "a",
      message: { role: "user", content: "abandoned input" },
    },
    // main branch continues from b
    {
      type: "message",
      id: "d",
      parentId: "b",
      message: { role: "user", content: "continuing" },
    },
    {
      type: "custom_message",
      id: "e",
      parentId: "d",
      customType: PROSE_CUSTOM_TYPE,
      content: "prose-2",
    },
  ];

  const jsonl = entries.map((entry) => JSON.stringify(entry)).join("\n");
  const path = reconstructActivePath(parseSessionJsonl(jsonl));
  const ids = path.map((entry) => entry.id);

  // Abandoned branch should not appear
  assert.ok(!ids.includes("c-abandoned"));
  assert.ok(ids.includes("e"));
  assert.ok(ids.includes("b"));
});
