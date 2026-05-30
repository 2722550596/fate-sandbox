import type { ActorId, ItemId, OutfitState, PermanentEffect, WoundSeverity } from "./state";

import { assertNonEmptyString, createId, updateState } from "./state";

export type ActorConditionEvent =
  | {
      kind: "add-wound";
      actorId: ActorId;
      severity: WoundSeverity;
      text: string;
      source: string;
      recoverable: boolean;
    }
  | {
      kind: "add-affliction";
      actorId: ActorId;
      text: string;
      source: string;
      expectedDuration: string | null;
    }
  | {
      kind: "add-permanent-effect";
      actorId: ActorId;
      text: string;
      source: string;
      mechanicalEffect: string;
    }
  | { kind: "change-outfit"; actorId: ActorId; outfit: OutfitState; reason: string }
  | {
      kind: "transfer-tracked-item";
      itemId: ItemId;
      holderActorId: ActorId | null;
      reason: string;
    };

export interface ActorConditionEventResult {
  message: string;
}

export function updateActorCondition(event: ActorConditionEvent): ActorConditionEventResult {
  switch (event.kind) {
    case "add-wound":
      return addWound(event);
    case "add-affliction":
      return addAffliction(event);
    case "add-permanent-effect":
      return addPermanentEffect(event);
    case "change-outfit":
      return changeOutfit(event);
    case "transfer-tracked-item":
      return transferTrackedItem(event);
    default:
      throw new Error("unreachable actor condition event kind");
  }
}

function addWound(
  event: Extract<ActorConditionEvent, { kind: "add-wound" }>,
): ActorConditionEventResult {
  updateState((draft) => {
    const actor = draft.public.actors[event.actorId];
    if (actor === undefined) {
      throw new Error(`actor 不存在: ${event.actorId}`);
    }
    actor.condition.wounds.push({
      id: createId("wound"),
      severity: event.severity,
      text: assertNonEmptyString(event.text, "text"),
      recoverable: event.recoverable,
      treatment: assertNonEmptyString(event.source, "source"),
    });
  });
  return { message: "伤势已记录。" };
}

function addAffliction(
  event: Extract<ActorConditionEvent, { kind: "add-affliction" }>,
): ActorConditionEventResult {
  updateState((draft) => {
    const actor = draft.public.actors[event.actorId];
    if (actor === undefined) {
      throw new Error(`actor 不存在: ${event.actorId}`);
    }
    actor.condition.afflictions.push({
      id: createId("affliction"),
      source: assertNonEmptyString(event.source, "source"),
      text: assertNonEmptyString(event.text, "text"),
      expectedDuration:
        event.expectedDuration === null
          ? null
          : assertNonEmptyString(event.expectedDuration, "expectedDuration"),
    });
  });
  return { message: "异常状态已记录。" };
}

function addPermanentEffect(
  event: Extract<ActorConditionEvent, { kind: "add-permanent-effect" }>,
): ActorConditionEventResult {
  const effect: PermanentEffect = {
    id: createId("effect"),
    source: assertNonEmptyString(event.source, "source"),
    text: assertNonEmptyString(event.text, "text"),
    mechanicalEffect: assertNonEmptyString(event.mechanicalEffect, "mechanicalEffect"),
  };
  updateState((draft) => {
    const actor = draft.public.actors[event.actorId];
    if (actor === undefined) {
      throw new Error(`actor 不存在: ${event.actorId}`);
    }
    actor.condition.permanentEffects.push(effect);
  });
  return { message: "长期影响已记录。" };
}

function changeOutfit(
  event: Extract<ActorConditionEvent, { kind: "change-outfit" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  updateState((draft) => {
    const actor = draft.public.actors[event.actorId];
    if (actor === undefined) {
      throw new Error(`actor 不存在: ${event.actorId}`);
    }
    actor.presentation.outfit = event.outfit;
  });
  return { message: "外观装备已更新。" };
}

function transferTrackedItem(
  event: Extract<ActorConditionEvent, { kind: "transfer-tracked-item" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  updateState((draft) => {
    const item = draft.public.trackedItems[event.itemId];
    if (item === undefined) {
      throw new Error(`tracked item 不存在: ${event.itemId}`);
    }
    if (event.holderActorId !== null && draft.public.actors[event.holderActorId] === undefined) {
      throw new Error(`holder actor 不存在: ${event.holderActorId}`);
    }
    item.holderActorId = event.holderActorId;
    item.location = null;
  });
  return { message: "重要物品持有者已更新。" };
}
