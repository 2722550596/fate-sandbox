import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../engine/core/state-store.ts";
import { normalizeActorConditionEvent } from "./actor-condition-normalizer.ts";
import { commitTurnTool } from "./commit-turn.ts";
import { updateActorConditionTool } from "./update-actor-condition.ts";

void test("normalizeActorConditionEvent accepts update-outfit alias", () => {
  const event = normalizeActorConditionEvent({
    kind: "update-outfit",
    actorId: "protagonist",
    outfit: { label: "员工外套", details: "深色后勤员工外套。" },
    reason: "换装伪装",
  });

  assert.equal(event.kind, "change-outfit");
  assert.equal(event.actorId, "protagonist");
});

void test("updateActorConditionTool recovers mistaken update-wound outfit payload", () => {
  resetState();

  updateActorConditionTool(
    {
      kind: "update-wound",
      actorId: "protagonist",
      conditionId: "",
      outfit: { label: "员工外套", details: "深色后勤员工外套。" },
      reason: "换装伪装",
    },
    createNoopSessionManager(),
  );

  assert.equal(getState().public.actors.protagonist?.presentation.outfit.label, "员工外套");
});

void test("normalizeActorConditionEvent reports empty wound id when no outfit is present", () => {
  assert.throws(
    () =>
      normalizeActorConditionEvent({
        kind: "update-wound",
        actorId: "protagonist",
        conditionId: "",
        reason: "误更新伤势",
      }),
    /update-wound 必须提供已有 wound 的 conditionId/,
  );
});

void test("normalizeActorConditionEvent strips stray outcome from non-resolve events", () => {
  const event = normalizeActorConditionEvent({
    kind: "add-wound",
    actorId: "protagonist",
    severity: "minor",
    text: "手背擦伤。",
    source: "玻璃碎片",
    recoverable: true,
    outcome: "worsened",
  });

  assert.equal(event.kind, "add-wound");
  assert.equal("outcome" in event, false);
});

void test("normalizeActorConditionEvent reports invalid resolve outcome clearly", () => {
  assert.throws(
    () =>
      normalizeActorConditionEvent({
        kind: "resolve-condition",
        actorId: "protagonist",
        conditionKind: "wound",
        conditionId: "wound-test",
        outcome: "worsened",
        reason: "错误地把伤势恶化写成 resolve。",
      }),
    /resolve-condition outcome 必须是 recovered 或 stabilized/,
  );
});

void test("normalizeActorConditionEvent reports invalid condition enums clearly", () => {
  assert.throws(
    () =>
      normalizeActorConditionEvent({
        kind: "add-wound",
        actorId: "protagonist",
        severity: "dangerous",
        text: "手背擦伤。",
        source: "玻璃碎片",
        recoverable: true,
      }),
    /severity 必须是允许值之一: minor, moderate, severe, critical/,
  );

  assert.throws(
    () =>
      normalizeActorConditionEvent({
        kind: "add-tracked-item",
        label: "暗金色碎屑",
        itemKind: "clue",
        holderActorId: "protagonist",
        ownerActorId: "protagonist",
        condition: "intact",
        visibility: "player-known",
        notes: [],
        reason: "模型误填物品类型",
      }),
    /itemKind 必须是允许值之一: mundane, weapon, mystic-code, document, key-item, other/,
  );
});

void test("commitTurnTool accepts actor-condition update-outfit alias", () => {
  resetState();

  commitTurnTool(
    {
      summary: "Saber 灵子化和服并换上员工外套。",
      time: { kind: "elapsed", elapsedMinutes: 1, reason: "换装耗时。" },
      events: [
        {
          kind: "actor-condition",
          event: {
            kind: "update-outfit",
            actorId: "protagonist",
            outfit: {
              label: "后勤员工外套",
              details: "宽大的后勤员工外套披在身上，显眼和服灵装退入灵子化。",
            },
          },
        },
      ],
    },
    createNoopSessionManager(),
  );

  assert.equal(getState().public.actors.protagonist?.presentation.outfit.label, "后勤员工外套");
});

function createNoopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}
