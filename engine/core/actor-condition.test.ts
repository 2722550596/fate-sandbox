import assert from "node:assert/strict";
import test from "node:test";

import { upsertActor } from "./actor";
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

void test("updateActorCondition updates non-servant magecraft circuits", () => {
  resetState();
  upsertActor({
    kind: "setup-protagonist",
    actor: {
      id: "protagonist",
      kind: "human",
      roles: [{ kind: "social", label: "测试魔术师" }],
      magecraft: {
        circuits: { count: "27", quality: "E", od: 30, status: "normal", traits: [] },
        disciplines: [{ name: "强化", rank: "E", notes: "测试" }],
        affiliation: null,
      },
      servantForm: null,
      identity: { publicIdentity: "测试魔术师", background: "测试", lockedFacts: [] },
      presentation: {
        displayName: "测试魔术师",
        apparentAge: "17岁",
        outfit: { label: "制服", details: "测试" },
        demeanor: "测试",
      },
      condition: { wounds: [], afflictions: [], permanentEffects: [] },
      inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
      abilities: [],
      relationshipToProtagonist: { stance: "neutral", summary: "测试" },
    },
    reason: "测试",
  });

  updateActorCondition({
    kind: "update-magecraft-circuits",
    actorId: "protagonist",
    circuits: { count: "27", quality: "E", od: 12, status: "depleted", traits: ["低效率"] },
    reason: "强化魔术消耗",
  });

  const actor = getState().public.actors["protagonist"];
  assert.equal(actor?.magecraft?.circuits.od, 12);
  assert.equal(actor?.magecraft?.circuits.status, "depleted");
});

void test("updateActorCondition updates wound treatment in place", () => {
  resetState();

  updateActorCondition({
    kind: "add-wound",
    actorId: "protagonist",
    severity: "minor",
    text: "右膝擦伤",
    source: "石阶滑倒",
    recoverable: true,
  });
  const woundId = getState().public.actors.protagonist?.condition.wounds[0]?.id;
  if (woundId === undefined) {
    throw new Error("expected wound id");
  }

  updateActorCondition({
    kind: "update-wound",
    actorId: "protagonist",
    conditionId: woundId,
    text: "右膝擦伤——已清洁包扎",
    treatment: "消毒棉清创，消炎软膏，新绷带包扎",
    reason: "正式处理擦伤",
  });

  const wounds = getState().public.actors.protagonist?.condition.wounds;
  assert.equal(wounds?.length, 1);
  assert.equal(wounds?.[0]?.text, "右膝擦伤——已清洁包扎");
  assert.equal(wounds?.[0]?.treatment, "消毒棉清创，消炎软膏，新绷带包扎");
});

void test("updateActorCondition resolves recovered afflictions", () => {
  resetState();

  updateActorCondition({
    kind: "add-affliction",
    actorId: "protagonist",
    text: "魔术回路近乎干涸",
    source: "连续强化",
    expectedDuration: "睡眠一夜",
  });
  const afflictionId = getState().public.actors.protagonist?.condition.afflictions[0]?.id;
  if (afflictionId === undefined) {
    throw new Error("expected affliction id");
  }

  updateActorCondition({
    kind: "resolve-condition",
    actorId: "protagonist",
    conditionKind: "affliction",
    conditionId: afflictionId,
    outcome: "recovered",
    reason: "睡眠后恢复",
  });

  const protagonist = getState().public.actors["protagonist"];
  assert.deepEqual(protagonist?.condition.afflictions, []);
});

void test("updateActorCondition lists available afflictions when resolve id is missing", () => {
  resetState();

  updateActorCondition({
    kind: "add-affliction",
    actorId: "protagonist",
    text: "魔术回路近乎干涸",
    source: "连续强化",
    expectedDuration: "睡眠一夜",
  });
  const afflictionId = getState().public.actors.protagonist?.condition.afflictions[0]?.id;
  if (afflictionId === undefined) {
    throw new Error("expected affliction id");
  }

  assert.throws(
    () =>
      updateActorCondition({
        kind: "resolve-condition",
        actorId: "protagonist",
        conditionKind: "affliction",
        conditionId: "ayaka-mana-strain-resting-fatigue",
        outcome: "recovered",
        reason: "睡眠后恢复",
      }),
    {
      message: `affliction 不存在: ayaka-mana-strain-resting-fatigue。可用 affliction: ${afflictionId}（魔术回路近乎干涸）`,
    },
  );
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

void test("add-tracked-item creates item in trackedItems map", () => {
  resetState();

  upsertActor({
    kind: "setup-protagonist",
    actor: {
      id: "protagonist",
      kind: "human",
      roles: [],
      magecraft: null,
      servantForm: null,
      identity: {
        publicIdentity: "测试",
        background: "测试",
        lockedFacts: [],
      },
      presentation: {
        displayName: "测试",
        apparentAge: "20",
        outfit: { label: "测试", details: "测试" },
        demeanor: "测试",
      },
      condition: { wounds: [], afflictions: [], permanentEffects: [] },
      inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
      abilities: [],
      relationshipToProtagonist: { stance: "self", summary: "测试" },
    },
    reason: "测试 setup",
  });

  const result = updateActorCondition({
    kind: "add-tracked-item",
    label: "魔力遮蔽用玻璃珠",
    itemKind: "mystic-code",
    holderActorId: "protagonist",
    ownerActorId: null,
    condition: "intact",
    visibility: "player-known",
    notes: ["棕红发女性魔术师赠予", "内含蓝色符文碎片"],
    reason: "测试物品追踪",
  });

  assert.match(result.message, /已记录到追踪列表/);

  const state = getState();
  const items = Object.values(state.public.trackedItems);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.label, "魔力遮蔽用玻璃珠");
  assert.equal(items[0]?.kind, "mystic-code");
  assert.equal(items[0]?.holderActorId, "protagonist");
  assert.equal(items[0]?.condition, "intact");
  assert.equal(items[0]?.visibility, "player-known");
  assert.equal(items[0]?.notes.length, 2);
});

void test("update-tracked-item records item consumption", () => {
  resetState();

  updateActorCondition({
    kind: "add-tracked-item",
    label: "药妆店应急处理用品",
    itemKind: "mundane",
    holderActorId: "protagonist",
    ownerActorId: "protagonist",
    condition: "intact",
    visibility: "player-known",
    notes: ["宽绷带×1", "消毒棉×1包", "消炎软膏×1管"],
    reason: "测试物品追踪",
  });
  const itemId = Object.values(getState().public.trackedItems)[0]?.id;
  if (itemId === undefined) {
    throw new Error("expected item id");
  }

  updateActorCondition({
    kind: "update-tracked-item",
    itemId,
    condition: "damaged",
    notes: ["绷带已裁一截", "消毒棉已开封", "软膏已使用一次"],
    reason: "处理右膝擦伤消耗部分用品",
  });

  const item = getState().public.trackedItems[itemId];
  assert.equal(item?.condition, "damaged");
  assert.deepEqual(item?.notes, ["绷带已裁一截", "消毒棉已开封", "软膏已使用一次"]);
});

void test("add-tracked-item rejects invalid holder actor", () => {
  resetState();

  assert.throws(
    () =>
      updateActorCondition({
        kind: "add-tracked-item",
        label: "测试物品",
        itemKind: "key-item",
        holderActorId: "missing-actor",
        ownerActorId: null,
        condition: "intact",
        visibility: "player-known",
        notes: [],
        reason: "测试",
      }),
    /holder actor 不存在/,
  );
});
