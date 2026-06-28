import assert from "node:assert/strict";
import test from "node:test";

import { getState, replaceStateForDebug, resetState } from "../../core/state/state-store.ts";
import { setScenePresenceTool } from "./set-scene-presence.ts";

void test("setScenePresenceTool updates presence without error", () => {
  resetState();

  const result = setScenePresenceTool(
    { presentActorIds: ["protagonist"], allyActorIds: [], reason: "进入场景" },
    undefined,
  );

  assert.equal(result.content[0]?.text, "场景在场 actor 已更新。");
  const state = getState();
  assert.ok(state.public.scene.presentActorIds.includes("protagonist"));
});

void test("setScenePresenceTool adds ally actors", () => {
  resetState();

  // Add ally actor to the store before calling the tool
  const stateWithAlly = getState();
  stateWithAlly.public.actors["ally-1"] = {
    id: "ally-1",
    kind: "human",
    roles: [],
    sequence: null,
    identity: { publicIdentity: "盟友", background: "协助者", lockedFacts: [] },
    presentation: {
      canonicalName: "盟友",
      renderName: "盟友",
      apparentAge: "未知",
      outfit: { label: "日常装束", details: "普通装束" },
      demeanor: "友善",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "ally", summary: "盟友" },
  } as (typeof stateWithAlly.public.actors)[string];
  replaceStateForDebug(stateWithAlly);

  const result = setScenePresenceTool(
    { presentActorIds: ["protagonist", "ally-1"], allyActorIds: ["ally-1"], reason: "组队" },
    undefined,
  );

  assert.equal(result.content[0]?.text, "场景在场 actor 已更新。");
  assert.ok(getState().public.allyActorIds.includes("ally-1"));
});
