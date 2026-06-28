import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../core/state/state-store.ts";
import { commitTurnTool } from "./commit-turn.ts";

function noopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}

void test("commitTurnTool advances time with elapsed event", () => {
  resetState();
  const state = getState();
  const before = state.public.clock.currentAt;
  const sm = noopSessionManager();

  const result = commitTurnTool(
    {
      time: { kind: "elapsed", elapsedMinutes: 30, reason: "短暂调查" },
      events: [],
    },
    sm,
  );

  const after = getState().public.clock.currentAt;
  assert.ok(after > before);
  assert.match(result.content[0]?.text ?? "", /已提交/);
});

void test("commitTurnTool applies scene events like set-location", () => {
  resetState();
  const sm = noopSessionManager();

  const result = commitTurnTool(
    {
      time: { kind: "elapsed", elapsedMinutes: 60, reason: "前往廷根市" },
      events: [
        {
          kind: "scene",
          event: {
            kind: "set-location",
            reason: "移动",
            location: {
              region: "鲁恩王国",
              site: "廷根市",
              detail: "佐特兰街",
              boundary: "normal",
            },
          },
        },
      ],
    },
    sm,
  );

  const state = getState();
  assert.equal(state.public.scene.location.region, "鲁恩王国");
  assert.equal(state.public.scene.location.site, "廷根市");
  assert.match(result.content[0]?.text ?? "", /已提交/);
});

void test("commitTurnTool applies actor-condition event", () => {
  resetState();
  const sm = noopSessionManager();

  const result = commitTurnTool(
    {
      time: { kind: "elapsed", elapsedMinutes: 5, reason: "战斗受伤" },
      events: [
        {
          kind: "actor-condition",
          event: {
            kind: "add-affliction",
            actorId: "protagonist",
            source: "combat",
            text: "左臂被撕裂",
            expectedDuration: "需要治疗",
            reason: "combat",
          },
        },
      ],
    },
    sm,
  );

  const state = getState();
  const actor = state.public.actors["protagonist"];
  assert.ok(actor);
  assert.equal(actor.condition.afflictions.length, 1);
  const affliction = actor.condition.afflictions[0]!;
  assert.match(affliction.text, /左臂被撕裂/);
  assert.match(result.content[0]?.text ?? "", /已提交/);
});

void test("commitTurnTool rejects without time", () => {
  resetState();

  assert.throws(() => commitTurnTool({ events: [] }, noopSessionManager()), /time/);
});
