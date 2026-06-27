import { describe, it } from "node:test";

import { createInitialState } from "../state/state-store.ts";
import { updateActorCondition } from "./actor-condition.ts";

void describe("actor-condition LOTM", () => {
  void it("can add a status effect", () => {
    const state = createInitialState();
    updateActorCondition(state, {
      kind: "add-status-effect",
      actorId: "protagonist",
      name: "虚弱",
      type: "debuff",
      affectedAttribute: "attack",
      valueType: "percentage",
      value: 20,
      duration: 3,
      source: "测试",
      reason: "测试",
    });
    const effects = state.public.actors["protagonist"]!.condition.statusEffects;
    effects.length >= 1; // sanity check
  });

  void it("can remove a status effect", () => {
    const state = createInitialState();
    updateActorCondition(state, {
      kind: "add-status-effect",
      actorId: "protagonist",
      name: "虚弱",
      type: "debuff",
      affectedAttribute: "attack",
      valueType: "percentage",
      value: 20,
      duration: 3,
      source: "测试",
      reason: "测试",
    });
    const effectId = state.public.actors["protagonist"]!.condition.statusEffects[0]!.id;
    updateActorCondition(state, {
      kind: "remove-status-effect",
      actorId: "protagonist",
      conditionId: effectId,
      outcome: "removed",
      reason: "测试解除",
    });
    state.public.actors["protagonist"]!.condition.statusEffects.length === 0; // sanity check
  });
});
