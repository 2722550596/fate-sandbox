import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { extractLastAssistantText, readBackstageCandidateRaw } from "./backstage-session-read.ts";

function assistantLine(text: string): string {
  return JSON.stringify({
    type: "message",
    id: "a1",
    message: {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "reasoning" },
        { type: "text", text },
      ],
    },
  });
}

const SESSION_HEADER = [
  JSON.stringify({ type: "session", id: "s1" }),
  JSON.stringify({ type: "model_change", model: "deepseek-v4-pro" }),
  JSON.stringify({
    type: "message",
    id: "u1",
    message: { role: "user", content: [{ type: "text", text: "prompt" }] },
  }),
].join("\n");

void test("extractLastAssistantText returns the assistant text part, skipping thinking", () => {
  const jsonl = SESSION_HEADER + "\n" + assistantLine('{"lineId":"x"}') + "\n";
  assert.equal(extractLastAssistantText(jsonl), '{"lineId":"x"}');
});

void test("extractLastAssistantText takes the LAST assistant message", () => {
  const jsonl = [SESSION_HEADER, assistantLine("first"), assistantLine("second")].join("\n");
  assert.equal(extractLastAssistantText(jsonl), "second");
});

void test("extractLastAssistantText tolerates a partially-flushed trailing line", () => {
  const jsonl = SESSION_HEADER + "\n" + assistantLine("good") + '\n{"type":"mess';
  assert.equal(extractLastAssistantText(jsonl), "good");
});

void test("extractLastAssistantText throws when no assistant candidate exists yet", () => {
  assert.throws(() => extractLastAssistantText(SESSION_HEADER), /还没有 assistant 候选/);
});

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), "tmp-session-read-"));
}

void test("readBackstageCandidateRaw locates a run's session by run_id", () => {
  const dir = freshDir();
  writeFileSync(
    join(dir, "2026-06-22T07-42-09-399Z_bl-archer.jsonl"),
    SESSION_HEADER + "\n" + assistantLine('{"outcome":"progress"}') + "\n",
  );
  assert.equal(readBackstageCandidateRaw("bl-archer", dir), '{"outcome":"progress"}');
});

void test("readBackstageCandidateRaw picks the newest of several runs (ISO prefix sorts)", () => {
  const dir = freshDir();
  writeFileSync(
    join(dir, "2026-06-22T07-00-00-000Z_bl-x.jsonl"),
    SESSION_HEADER + "\n" + assistantLine("old") + "\n",
  );
  writeFileSync(
    join(dir, "2026-06-22T09-30-00-000Z_bl-x.jsonl"),
    SESSION_HEADER + "\n" + assistantLine("new") + "\n",
  );
  assert.equal(readBackstageCandidateRaw("bl-x", dir), "new");
});

void test("readBackstageCandidateRaw throws for an unknown run_id", () => {
  const dir = freshDir();
  assert.throws(() => readBackstageCandidateRaw("bl-missing", dir), /找不到 run_id=bl-missing/);
});

void test("readBackstageCandidateRaw throws when the session dir is absent", () => {
  assert.throws(
    () => readBackstageCandidateRaw("bl-x", join(tmpdir(), "tmp-nonexistent-dir-xyz")),
    /session 目录不存在/,
  );
});
