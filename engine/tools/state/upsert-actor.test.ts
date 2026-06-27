import { describe, it } from "node:test";
import { deepEqual, equal } from "node:assert/strict";

import { upsertActor } from "../../core/actor/actor.ts";
import { createInitialState } from "../../core/state/state-store.ts";

describe("upsertActor LOTM", () => {
  it("sets up a human protagonist", () => {
    const state = createInitialState();
     upsertActor(state, {
      kind: "setup-protagonist",
      actor: {
        id: "protagonist",
        kind: "human",
        roles: [],
        sequence: null,
    stats: null,
        identity: { publicIdentity: "玩家", background: "普通人", lockedFacts: [] },
        presentation: { internalName: "你", renderName: "你", apparentAge: "青年", outfit: { label: "日常", details: "日常服装" }, demeanor: "普通" },
        condition: { statusEffects: [] },
        inventory: { ordinaryItems: [] },
        abilities: [],
        relationshipToProtagonist: { stance: "self", summary: "玩家本人" },
      },
      reason: "测试",
    });
    equal(state.public.actors["protagonist"]!.kind, "human");
  });

  it("creates a beyonder actor", () => {
    const state = createInitialState();
     upsertActor(state, {
      kind: "setup-protagonist",
      actor: {
        id: "protagonist",
        kind: "beyonder",
        roles: [],
        sequence: {
          currentSequence: "序列9-偷盗者",
          rank: "seq-9",
          pathway: "thief",
          promotionSystem: "potion",
          divinity: 1,
          digestionProgress: 0,
          lossOfControlProgress: 0,
        },
        stats: null,
        identity: { publicIdentity: "玩家", background: "非凡者", lockedFacts: [] },
        presentation: { internalName: "你", renderName: "你", apparentAge: "青年", outfit: { label: "日常", details: "日常服装" }, demeanor: "普通" },
        condition: { statusEffects: [] },
        inventory: { ordinaryItems: [] },
        abilities: [],
        relationshipToProtagonist: { stance: "self", summary: "玩家本人" },
      },
      reason: "测试",
    });
    deepEqual(state.public.actors["protagonist"]!.sequence!.rank, "seq-9");
  });

  it("creates a creature actor", () => {
    const state = createInitialState();
     upsertActor(state, {
      kind: "upsert-public-npc",
      npc: {
        id: "npc-1",
        kind: "creature",
        internalName: "神秘生物",
        publicIdentity: "未知",
        apparentAge: "不明",
        outfit: { label: "未知", details: "无法描述" },
        demeanor: "威胁",
        publicRoles: [],
        relationshipToProtagonist: { stance: "hostile", summary: "敌对" },
        ordinaryItems: [],
      },
      reason: "测试",
    });
    equal(state.public.actors["npc-1"]!.kind, "creature");
  });
});