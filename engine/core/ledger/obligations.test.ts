import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import {
  recordObligation,
  settleOldestObligation,
  assertNoOpenObligations,
} from "./obligations.ts";

void test("recordObligation adds obligation with auto-generated id and clock timestamp", () => {
  const draft = createInitialState();

  const obligation = recordObligation(draft, {
    source: "裁决：combat",
    kind: "actor-condition",
    summary: "根据 combat 裁决结果更新伤势",
  });

  assert.ok(obligation.id);
  assert.equal(obligation.kind, "actor-condition");
  assert.equal(obligation.createdAt, draft.public.clock.currentAt);
  assert.equal(draft.public.obligations.length, 1);
});

void test("settleOldestObligation removes matching obligation FIFO", () => {
  const draft = createInitialState();

  recordObligation(draft, { source: "a", kind: "scene-objective", summary: "目标A" });
  recordObligation(draft, { source: "b", kind: "scene-threat", summary: "威胁B" });
  recordObligation(draft, { source: "c", kind: "scene-objective", summary: "目标C" });

  // Settle first scene-objective
  const settled = settleOldestObligation(draft, ["scene-objective"]);
  assert.equal(settled?.summary, "目标A");
  assert.equal(draft.public.obligations.length, 2);
});

void test("settleOldestObligation only removes first match of given kinds", () => {
  const draft = createInitialState();

  recordObligation(draft, { source: "a", kind: "scene-objective", summary: "目标A" });
  recordObligation(draft, { source: "b", kind: "scene-objective", summary: "目标B" });

  settleOldestObligation(draft, ["scene-objective"]);

  assert.equal(draft.public.obligations.length, 1);
  assert.equal(draft.public.obligations[0]?.summary, "目标B");
});

void test("settleOldestObligation can match any of multiple kinds", () => {
  const draft = createInitialState();

  recordObligation(draft, { source: "a", kind: "actor-condition", summary: "伤势" });
  recordObligation(draft, { source: "b", kind: "scene-objective", summary: "目标" });

  // Settle with scene-objective or scene-threat — should skip actor-condition
  const settled = settleOldestObligation(draft, ["scene-objective", "scene-threat"]);
  assert.equal(settled?.summary, "目标");
  assert.equal(draft.public.obligations.length, 1);
});

void test("settleOldestObligation returns undefined when no match", () => {
  const draft = createInitialState();

  recordObligation(draft, { source: "a", kind: "memory", summary: "记忆" });

  const settled = settleOldestObligation(draft, ["scene-objective"]);
  assert.equal(settled, undefined);
  assert.equal(draft.public.obligations.length, 1);
});

void test("assertNoOpenObligations passes when no obligations", () => {
  const draft = createInitialState();

  assertNoOpenObligations(draft);
});

void test("assertNoOpenObligations throws when obligations exist", () => {
  const draft = createInitialState();

  recordObligation(draft, { source: "裁决", kind: "actor-condition", summary: "更新伤势" });

  assert.throws(() => assertNoOpenObligations(draft), /未落地的裁决义务/);
});
