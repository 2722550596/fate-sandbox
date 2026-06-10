import type { State } from "./state";

import assert from "node:assert/strict";
import test from "node:test";

import { upsertActor } from "./actor";
import { updateServantForm } from "./servant";
import { createInitialState } from "./state-store";
import { advanceClock } from "./turn-time";

void test("advanceClock removes expired servant parameter modifiers", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);

  updateServantForm(draft, {
    kind: "add-param-modifier",
    actorId: "caster",
    modifier: {
      id: "",
      source: "测试供魔",
      affectedParams: ["mana"],
      summary: "短时魔力提升",
      expiresAt: "2004-01-30T07:30:00.000Z",
    },
    reason: "测试加入限时修正",
  });

  advanceClock(draft, 31, "测试时间推进超过修正过期点");

  const modifiers = draft.public.actors["caster"]?.servantForm?.parameters.modifiers;
  assert.deepEqual(modifiers, []);
});

void test("advanceClock keeps permanent and future servant parameter modifiers", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);

  updateServantForm(draft, {
    kind: "add-param-modifier",
    actorId: "caster",
    modifier: {
      id: "",
      source: "永久缺损",
      affectedParams: ["strength"],
      summary: "筋力长期下降",
      expiresAt: null,
    },
    reason: "测试加入永久修正",
  });
  updateServantForm(draft, {
    kind: "add-param-modifier",
    actorId: "caster",
    modifier: {
      id: "",
      source: "短时加护",
      affectedParams: ["mana"],
      summary: "魔力暂时提升",
      expiresAt: "2004-01-30T07:32:00.000Z",
    },
    reason: "测试加入未来修正",
  });

  advanceClock(draft, 31, "测试时间推进但未越过未来修正");

  const modifiers = draft.public.actors["caster"]?.servantForm?.parameters.modifiers;
  assert.deepEqual(
    modifiers?.map((modifier) => modifier.source),
    ["永久缺损", "短时加护"],
  );
});

function upsertTestCaster(draft: State): void {
  upsertActor(draft, {
    kind: "upsert-servant",
    servant: {
      id: "caster",
      displayName: "Caster",
      publicIdentity: "柳洞寺驻留的从者",
      apparentAge: "不明",
      outfit: { label: "深紫色长袍与兜帽", details: "遮住面容" },
      demeanor: "谨慎、孤高",
      className: "Caster",
      trueNameDisplay: "Caster",
      trueNameStatus: "hidden",
      parameters: {
        strength: "E",
        endurance: "D",
        agility: "C",
        mana: "A+",
        luck: "B",
        noblePhantasm: "C",
      },
      classSkills: [{ name: "阵地作成", rank: "A", summary: "建造工房级别的魔术阵地" }],
      personalSkills: [{ name: "高速神言", rank: "A", summary: "无需咏唱发动大魔术" }],
      noblePhantasms: [],
      spiritualCore: 100,
      mana: 90,
      spiritualCondition: "完好",
      masterActorId: null,
      masterName: "葛木宗一郎",
      contractStatus: "masterless",
      manaSupply: "sufficient",
      currentOrder: "守卫柳洞寺山门",
    },
    reason: "测试从者入场",
  });
}
