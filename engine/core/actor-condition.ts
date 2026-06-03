import type {
  ActorId,
  ItemId,
  MagecraftCircuitState,
  OutfitState,
  PermanentEffect,
  WoundSeverity,
} from "./state";

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
      kind: "update-wound";
      actorId: ActorId;
      conditionId: string;
      severity?: WoundSeverity;
      text?: string;
      treatment?: string;
      recoverable?: boolean;
      reason: string;
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
  | {
      kind: "update-magecraft-circuits";
      actorId: ActorId;
      circuits: MagecraftCircuitState;
      reason: string;
    }
  | {
      kind: "resolve-condition";
      actorId: ActorId;
      conditionKind: "wound" | "affliction";
      conditionId: string;
      outcome: "recovered" | "stabilized";
      reason: string;
    }
  | { kind: "change-outfit"; actorId: ActorId; outfit: OutfitState; reason: string }
  | {
      kind: "transfer-tracked-item";
      itemId: ItemId;
      holderActorId: ActorId | null;
      reason: string;
    }
  | {
      kind: "update-tracked-item";
      itemId: ItemId;
      condition?: "intact" | "damaged" | "broken" | "spent" | "unknown";
      holderActorId?: ActorId | null;
      ownerActorId?: ActorId | null;
      notes?: string[];
      reason: string;
    }
  | {
      kind: "add-tracked-item";
      label: string;
      itemKind: "mundane" | "weapon" | "mystic-code" | "document" | "key-item" | "other";
      holderActorId: ActorId | null;
      ownerActorId: ActorId | null;
      condition: "intact" | "damaged" | "broken" | "spent" | "unknown";
      visibility: "player-known" | "suspected";
      notes: string[];
      reason: string;
    };

export interface ActorConditionEventResult {
  message: string;
}

export function updateActorCondition(event: ActorConditionEvent): ActorConditionEventResult {
  switch (event.kind) {
    case "add-wound":
      return addWound(event);
    case "update-wound":
      return updateWound(event);
    case "add-affliction":
      return addAffliction(event);
    case "add-permanent-effect":
      return addPermanentEffect(event);
    case "update-magecraft-circuits":
      return updateMagecraftCircuits(event);
    case "resolve-condition":
      return resolveCondition(event);
    case "change-outfit":
      return changeOutfit(event);
    case "transfer-tracked-item":
      return transferTrackedItem(event);
    case "update-tracked-item":
      return updateTrackedItem(event);
    case "add-tracked-item":
      return addTrackedItem(event);
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

function updateWound(
  event: Extract<ActorConditionEvent, { kind: "update-wound" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  updateState((draft) => {
    const actor = draft.public.actors[event.actorId];
    if (actor === undefined) {
      throw new Error(`actor 不存在: ${event.actorId}`);
    }
    const wound = actor.condition.wounds.find((condition) => condition.id === event.conditionId);
    if (wound === undefined) {
      throw new Error(`wound 不存在: ${event.conditionId}`);
    }
    if (event.severity !== undefined) {
      wound.severity = event.severity;
    }
    if (event.text !== undefined) {
      wound.text = assertNonEmptyString(event.text, "text");
    }
    if (event.treatment !== undefined) {
      wound.treatment = assertNonEmptyString(event.treatment, "treatment");
    }
    if (event.recoverable !== undefined) {
      wound.recoverable = event.recoverable;
    }
  });
  return { message: `伤势已更新：${event.conditionId}。` };
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

function updateMagecraftCircuits(
  event: Extract<ActorConditionEvent, { kind: "update-magecraft-circuits" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  updateState((draft) => {
    const actor = draft.public.actors[event.actorId];
    if (actor === undefined) {
      throw new Error(`actor 不存在: ${event.actorId}`);
    }
    if (actor.magecraft === null) {
      throw new Error(`actor 没有 magecraft: ${event.actorId}`);
    }
    actor.magecraft.circuits = event.circuits;
  });
  return { message: "魔术回路状态已更新。" };
}

function resolveCondition(
  event: Extract<ActorConditionEvent, { kind: "resolve-condition" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  updateState((draft) => {
    const actor = draft.public.actors[event.actorId];
    if (actor === undefined) {
      throw new Error(`actor 不存在: ${event.actorId}`);
    }
    switch (event.conditionKind) {
      case "wound":
        actor.condition.wounds = removeCondition(
          actor.condition.wounds,
          event.conditionId,
          "wound",
        );
        break;
      case "affliction":
        actor.condition.afflictions = removeCondition(
          actor.condition.afflictions,
          event.conditionId,
          "affliction",
        );
        break;
      default:
        throw new Error("unreachable condition kind");
    }
  });
  return { message: `状态已处理：${event.conditionId} (${event.outcome})。` };
}

function removeCondition<TCondition extends { id: string; text?: string }>(
  conditions: TCondition[],
  conditionId: string,
  conditionKind: string,
): TCondition[] {
  const id = assertNonEmptyString(conditionId, "conditionId");
  const next = conditions.filter((condition) => condition.id !== id);
  if (next.length === conditions.length) {
    throw new Error(
      `${conditionKind} 不存在: ${id}。可用 ${conditionKind}: ${formatAvailableConditions(conditions)}`,
    );
  }
  return next;
}

function formatAvailableConditions(conditions: readonly { id: string; text?: string }[]): string {
  if (conditions.length === 0) {
    return "无";
  }
  return conditions.map(formatAvailableCondition).join("；");
}

function formatAvailableCondition(condition: { id: string; text?: string }): string {
  if (condition.text === undefined) {
    return condition.id;
  }
  return `${condition.id}（${condition.text}）`;
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
    const holderId = event.holderActorId || null;
    if (holderId !== null && draft.public.actors[holderId] === undefined) {
      throw new Error(`holder actor 不存在: ${holderId}`);
    }
    item.holderActorId = holderId;
    item.location = null;
  });
  return { message: "重要物品持有者已更新。" };
}

function updateTrackedItem(
  event: Extract<ActorConditionEvent, { kind: "update-tracked-item" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  updateState((draft) => {
    const item = draft.public.trackedItems[event.itemId];
    if (item === undefined) {
      throw new Error(`tracked item 不存在: ${event.itemId}`);
    }
    if (event.holderActorId !== undefined) {
      const holderId = event.holderActorId ?? null;
      if (holderId !== null && draft.public.actors[holderId] === undefined) {
        throw new Error(`holder actor 不存在: ${holderId}`);
      }
      item.holderActorId = holderId;
      item.location = null;
    }
    if (event.ownerActorId !== undefined) {
      const ownerId = event.ownerActorId ?? null;
      if (ownerId !== null && draft.public.actors[ownerId] === undefined) {
        throw new Error(`owner actor 不存在: ${ownerId}`);
      }
      item.ownerActorId = ownerId;
    }
    if (event.condition !== undefined) {
      item.condition = event.condition;
    }
    if (event.notes !== undefined) {
      item.notes = event.notes;
    }
  });
  return { message: `重要物品已更新：${event.itemId}。` };
}

function addTrackedItem(
  event: Extract<ActorConditionEvent, { kind: "add-tracked-item" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.label, "label");
  assertNonEmptyString(event.reason, "reason");
  const holderId = event.holderActorId ?? null;
  const ownerId = event.ownerActorId ?? null;
  updateState((draft) => {
    if (holderId !== null && draft.public.actors[holderId] === undefined) {
      throw new Error(`holder actor 不存在: ${holderId}`);
    }
    if (ownerId !== null && draft.public.actors[ownerId] === undefined) {
      throw new Error(`owner actor 不存在: ${ownerId}`);
    }
    const id = createId("item");
    draft.public.trackedItems[id] = {
      id,
      label: event.label,
      kind: event.itemKind,
      ownerActorId: ownerId,
      holderActorId: holderId,
      location: null,
      condition: event.condition,
      visibility: event.visibility,
      notes: event.notes,
    };
  });
  return { message: "重要物品已记录到追踪列表。" };
}
