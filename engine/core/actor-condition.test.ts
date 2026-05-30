import assert from "node:assert/strict";
import test from "node:test";

import { updateActorCondition } from "./actor-condition";
import { getState, resetState } from "./state";

void test("updateActorCondition records discrete wounds", () => {
  resetState();

  updateActorCondition({
    kind: "add-wound",
    actorId: "protagonist",
    severity: "moderate",
    text: "左臂裂伤",
    source: "Lancer 追击",
    recoverable: true,
  });

  const protagonist = getState().public.actors["protagonist"];
  assert.equal(protagonist?.condition.wounds[0]?.text, "左臂裂伤");
  assert.equal(protagonist?.condition.wounds[0]?.severity, "moderate");
});

void test("updateActorCondition rejects missing tracked item transfer", () => {
  resetState();

  assert.throws(
    () =>
      updateActorCondition({
        kind: "transfer-tracked-item",
        itemId: "missing-item",
        holderActorId: "protagonist",
        reason: "测试",
      }),
    /tracked item 不存在/,
  );
});
