import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialState,
  commitState,
  getState,
  resetState,
} from "../../engine/core/state-store.ts";
import { overrideLockedFactTool } from "./override-locked-fact.ts";

void test("overrideLockedFactTool can override sequence rank", () => {
  resetState();
  const draft = createInitialState();
  draft.public.actors["caster"] = {
    id: "caster",
    kind: "beyonder",
    roles: [],
    sequence: {
      currentSequence: "序列7-魔术师",
      rank: "seq-7",
      pathway: "seer",
      promotionSystem: "potion",
      divinity: 1,
      digestionProgress: 30,
      lossOfControlProgress: 0,
    },
    identity: { publicIdentity: "身份非凡者", background: "", lockedFacts: [] },
    presentation: {
      internalName: "Caster",
      renderName: "Caster",
      apparentAge: "二十岁后半",
      outfit: { label: "长袍", details: "深蓝色连帽长袍。" },
      demeanor: "沉静寡言",
    },
    condition: { statusEffects: [] },
    inventory: { ordinaryItems: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "neutral", summary: "尚未建立关系。" },
  };
  commitState(draft);

  overrideLockedFactTool(
    {
      kind: "sequence-rank",
      actorId: "caster",
      rank: "seq-6",
      reason: "debug override",
    },
    { appendCustomEntry: () => "entry-test" },
  );

  assert.equal(getState().public.actors["caster"]?.sequence?.rank, "seq-6");
});

void test("overrideLockedFactTool can override sequence secret display", () => {
  resetState();
  const draft = createInitialState();
  draft.public.actors["caster"] = {
    id: "caster",
    kind: "beyonder",
    roles: [],
    sequence: {
      currentSequence: "序列7-魔术师",
      rank: "seq-7",
      pathway: "seer",
      promotionSystem: "potion",
      divinity: 1,
      digestionProgress: 30,
      lossOfControlProgress: 0,
    },
    identity: { publicIdentity: "身份非凡者", background: "", lockedFacts: [] },
    presentation: {
      internalName: "Caster",
      renderName: "Caster",
      apparentAge: "二十岁后半",
      outfit: { label: "长袍", details: "深蓝色连帽长袍。" },
      demeanor: "沉静寡言",
    },
    condition: { statusEffects: [] },
    inventory: { ordinaryItems: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "neutral", summary: "尚未建立关系。" },
  };
  commitState(draft);

  overrideLockedFactTool(
    {
      kind: "pathway-secret",
      actorId: "caster",
      display: "序列6-记录官",
      reason: "debug override",
    },
    { appendCustomEntry: () => "entry-test" },
  );

  assert.equal(getState().public.actors["caster"]?.sequence?.currentSequence, "序列6-记录官");
});
