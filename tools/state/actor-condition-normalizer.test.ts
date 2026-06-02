import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../engine/core/state";
import { normalizeActorConditionEvent } from "./actor-condition-normalizer";
import { commitTurnTool } from "./commit-turn";
import { updateActorConditionTool } from "./update-actor-condition";

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

void test("commitTurnTool accepts actor-condition update-outfit alias", () => {
  resetState();

  commitTurnTool(
    {
      summary: "Saber 灵子化和服并换上员工外套。",
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
