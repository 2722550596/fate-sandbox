import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../engine/core/state-store";
import { upsertActorTool } from "../state/upsert-actor";
import { overrideLockedFactTool } from "./override-locked-fact";

void test("overrideLockedFactTool can hide an accidentally revealed true name", () => {
  resetState();
  upsertActorTool(
    {
      kind: "upsert-servant",
      servant: baseServant(),
      reason: "建立测试从者",
    },
    createNoopSessionManager(),
  );

  overrideLockedFactTool(
    {
      kind: "servant-true-name",
      actorId: "caster",
      display: "Caster",
      status: "hidden",
      reason: "修正误公开真名",
    },
    createNoopSessionManager(),
  );

  assert.deepEqual(getState().public.actors["caster"]?.servantForm?.identity.trueName, {
    status: "hidden",
    display: "Caster",
  });
});

void test("overrideLockedFactTool defaults true name override to revealed", () => {
  resetState();
  upsertActorTool(
    {
      kind: "upsert-servant",
      servant: baseServant(),
      reason: "建立测试从者",
    },
    createNoopSessionManager(),
  );

  overrideLockedFactTool(
    {
      kind: "servant-true-name",
      actorId: "caster",
      display: "美狄亚",
      reason: "测试默认公开真名",
    },
    createNoopSessionManager(),
  );

  assert.deepEqual(getState().public.actors["caster"]?.servantForm?.identity.trueName, {
    status: "revealed",
    display: "美狄亚",
  });
});

function baseServant(): Record<string, unknown> {
  return {
    id: "caster",
    displayName: "Caster",
    publicIdentity: "身份不明的从者",
    apparentAge: "二十岁后半",
    outfit: { label: "长袍", details: "深蓝色连帽长袍。" },
    demeanor: "沉静寡言",
    className: "Caster",
    trueNameDisplay: "美狄亚",
    trueNameStatus: "revealed",
    parameters: {
      strength: "E",
      endurance: "D",
      agility: "C",
      mana: "A",
      luck: "B",
      noblePhantasm: "A",
    },
    classSkills: [{ name: "阵地作成", rank: "A", summary: "可建造魔术阵地。" }],
    personalSkills: [{ name: "高速神言", rank: "A", summary: "无需咏唱发动大魔术。" }],
    noblePhantasms: [],
    spiritualCore: 100,
    mana: 100,
    spiritualCondition: "完好",
    masterActorId: null,
    masterName: null,
    contractStatus: "masterless",
    manaSupply: "starved",
    currentOrder: "自主行动",
  };
}

function createNoopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}
