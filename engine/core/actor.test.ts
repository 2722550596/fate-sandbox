import { describe, it } from "node:test";

import { upsertActor } from "./actor.ts";
import { createInitialState } from "./state-store.ts";

void describe("actor LOTM", () => {
  void it("can create a human protagonist", () => {
    const state = createInitialState();
    upsertActor(state, {
      kind: "setup-protagonist",
      actor: {
        id: "protagonist",
        kind: "human",
        roles: [],
        sequence: null,
        identity: { publicIdentity: "玩家", background: "普通人", lockedFacts: [] },
        presentation: {
          internalName: "你",
          renderName: "你",
          apparentAge: "青年",
          outfit: { label: "日常", details: "日常服装" },
          demeanor: "普通",
        },
        condition: { statusEffects: [] },
        inventory: { ordinaryItems: [] },
        abilities: [],
        relationshipToProtagonist: { stance: "self", summary: "玩家本人" },
      },
      reason: "测试",
    });
    state.public.actors["protagonist"]!.id; // existence check
  });

  void it("can create a beyonder with sequence", () => {
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
        identity: { publicIdentity: "玩家", background: "非凡者", lockedFacts: [] },
        presentation: {
          internalName: "你",
          renderName: "你",
          apparentAge: "青年",
          outfit: { label: "日常", details: "日常服装" },
          demeanor: "普通",
        },
        condition: { statusEffects: [] },
        inventory: { ordinaryItems: [] },
        abilities: [],
        relationshipToProtagonist: { stance: "self", summary: "玩家本人" },
      },
      reason: "测试",
    });
    state.public.actors["protagonist"]!.sequence!.pathway; // existence check
  });

  void it("can upsert a public NPC without sequence", () => {
    const state = createInitialState();
    upsertActor(state, {
      kind: "upsert-public-npc",
      npc: {
        id: "npc-1",
        kind: "human",
        internalName: "路人甲",
        publicIdentity: "市民",
        apparentAge: "中年",
        outfit: { label: "日常", details: "日常服装" },
        demeanor: "普通",
        publicRoles: [],
        relationshipToProtagonist: { stance: "neutral", summary: "陌生人" },
        ordinaryItems: [],
      },
      reason: "测试",
    });
    state.public.actors["npc-1"]!.id; // existence check
  });

  void it("can ensure a public NPC", () => {
    const state = createInitialState();
    upsertActor(state, {
      kind: "ensure-public-npc",
      npc: { actorId: "npc-1", internalName: "路人甲", publicIdentity: "市民" },
      reason: "测试",
    });
    state.public.actors["npc-1"]!.id; // existence check
  });

  void it("can upsert a sequence for an existing actor", () => {
    const state = createInitialState();
    upsertActor(state, {
      kind: "ensure-public-npc",
      npc: { actorId: "npc-1", internalName: "路人甲", publicIdentity: "市民" },
      reason: "测试",
    });
    upsertActor(state, {
      kind: "upsert-sequence",
      sequence: {
        actorId: "npc-1",
        currentSequence: "序列9-占卜家",
        rank: "seq-9",
        pathway: "seer",
        promotionSystem: "potion",
        divinity: 1,
        digestionProgress: 0,
        lossOfControlProgress: 0,
        reason: "测试",
      },
      reason: "测试",
    });
    state.public.actors["npc-1"]!.sequence!.pathway; // existence check
  });
});
