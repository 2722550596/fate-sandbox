import type { State } from "./state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { updateActorCondition } from "./actor-condition.ts";
import {
  assertNoOpenObligations,
  recordObligation,
  settleOldestObligation,
} from "./obligations.ts";
import { createInitialState } from "./state-store.ts";
import { commitTurn } from "./turn-commit.ts";

function draftWithObligation(): State {
  const draft = createInitialState();
  recordObligation(draft, {
    source: "combat-exchange",
    kind: "actor-condition",
    summary: "主角在交锋中受了实质伤势，必须登记伤口。",
  });
  return draft;
}

void test("recordObligation appends to the ledger with the game clock", () => {
  const draft = draftWithObligation();

  assert.equal(draft.public.obligations.length, 1);
  assert.equal(draft.public.obligations[0]?.kind, "actor-condition");
  assert.equal(draft.public.obligations[0]?.createdAt, draft.public.clock.currentAt);
});

void test("settleOldestObligation clears FIFO, one per call", () => {
  const draft = draftWithObligation();
  recordObligation(draft, {
    source: "combat-exchange",
    kind: "actor-condition",
    summary: "第二条伤势义务。",
  });

  const settled = settleOldestObligation(draft, ["actor-condition"]);
  assert.match(settled?.summary ?? "", /必须登记伤口/);
  assert.equal(draft.public.obligations.length, 1);

  assert.equal(settleOldestObligation(draft, ["sequence"]), undefined);
  assert.equal(draft.public.obligations.length, 1);
});

void test("updateActorCondition settles a pending actor-condition obligation", () => {
  const draft = draftWithObligation();

  updateActorCondition(draft, {
    kind: "add-status-effect",
    actorId: draft.public.protagonistActorId,
    name: "撕裂伤",
    type: "debuff",
    affectedAttribute: "agility",
    value: 15,
    duration: 3,
    source: "交锋落地",
    valueType: "percentage",
    reason: "测试",
  });

  assert.equal(draft.public.obligations.length, 0);
});

void test("commitTurn rejects while the ledger has open obligations", () => {
  const draft = draftWithObligation();

  assert.throws(
    () =>
      commitTurn(draft, {
        summary: "无落地的提交。",
        time: { kind: "elapsed", elapsedMinutes: 5, reason: "对峙喘息" },
        events: [],
      }),
    /未落地的裁决义务[\s\S]*actor-condition/,
  );
});

void test("commitTurn passes when its own events settle the ledger", () => {
  const draft = draftWithObligation();

  const result = commitTurn(draft, {
    summary: "伤势落地。",
    time: { kind: "elapsed", elapsedMinutes: 5, reason: "交锋后处理伤口" },
    events: [
      {
        kind: "actor-condition",
        event: {
          kind: "add-status-effect",
          actorId: draft.public.protagonistActorId,
          name: "撕裂伤",
          type: "debuff",
          affectedAttribute: "agility",
          value: 15,
          duration: 3,
          source: "交锋落地",
          valueType: "percentage",
          reason: "测试",
        },
      },
    ],
  });

  assert.equal(draft.public.obligations.length, 0);
  assert.match(result.message, /伤势落地/);
});

void test("assertNoOpenObligations lists every open entry with guidance", () => {
  const draft = draftWithObligation();
  recordObligation(draft, {
    source: "combat-exchange",
    kind: "scene-threat",
    summary: "战场出现新威胁，必须登记。",
  });

  assert.throws(
    () => assertNoOpenObligations(draft),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      return (
        message.includes("actor-condition") &&
        message.includes("scene-threat") &&
        message.includes("落地方式")
      );
    },
  );
});
