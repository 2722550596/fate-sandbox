import type { TurnLogEntry } from "../state/state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import { appendTurnLogEntry } from "./turn-log.ts";

void test("appendTurnLogEntry adds entry with auto-generated sequential id", () => {
  const draft = createInitialState();

  const entry1 = appendTurnLogEntry(draft, {
    summary: "推进30分钟",
    startedAt: "1349-01-01T07:00:00.000Z",
    endedAt: "1349-01-01T07:30:00.000Z",
    time: { kind: "elapsed", elapsedMinutes: 30, reason: "推进" },
    eventCount: 1,
    resultCount: 1,
  });
  const entry2 = appendTurnLogEntry(draft, {
    summary: "推进30分钟",
    startedAt: "1349-01-01T07:30:00.000Z",
    endedAt: "1349-01-01T08:00:00.000Z",
    time: { kind: "elapsed", elapsedMinutes: 30, reason: "推进" },
    eventCount: 0,
    resultCount: 0,
  });

  assert.equal(entry1.id, "turn-1");
  assert.equal(entry2.id, "turn-2");
  assert.equal(draft.public.turnLog.length, 2);
});

void test("appendTurnLogEntry preserves input fields", () => {
  const draft = createInitialState();

  const entry = appendTurnLogEntry(draft, {
    summary: "移动到新地点",
    startedAt: "1349-01-01T07:00:00.000Z",
    endedAt: "1349-01-01T08:00:00.000Z",
    time: {
      kind: "travel",
      elapsedMinutes: 60,
      reason: "移动",
      location: { region: "贝克兰德", site: "桥区", detail: "码头", boundary: "normal" },
    },
    eventCount: 2,
    resultCount: 2,
  });

  assert.equal(entry.startedAt, "1349-01-01T07:00:00.000Z");
  assert.equal(entry.endedAt, "1349-01-01T08:00:00.000Z");
  assert.equal(entry.eventCount, 2);
  assert.equal(entry.resultCount, 2);
});

void test("appendTurnLogEntry skips existing non-numeric ids", () => {
  const draft = createInitialState();
  // Pre-populate with a non-standard id
  draft.public.turnLog.push({
    id: "turn-init",
    summary: "初始",
    startedAt: "1349-01-01T07:00:00.000Z",
    endedAt: "1349-01-01T07:00:00.000Z",
    time: { kind: "elapsed", elapsedMinutes: 0, reason: "初始" },
    eventCount: 0,
    resultCount: 0,
  } satisfies TurnLogEntry);

  const entry = appendTurnLogEntry(draft, {
    summary: "第一轮",
    startedAt: "1349-01-01T07:00:00.000Z",
    endedAt: "1349-01-01T07:10:00.000Z",
    time: { kind: "elapsed", elapsedMinutes: 10, reason: "开始" },
    eventCount: 1,
    resultCount: 1,
  });

  assert.equal(entry.id, "turn-1");
});
