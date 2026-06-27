import type { PublicActorState, State } from "../state/state.ts";
import type { ActorConditionEvent } from "./actor-condition-schema.ts";

import { createId } from "../utils/ids.ts";
import { settleOldestObligation } from "../utils/obligations.ts";
import { assertNonEmptyString } from "../utils/typebox-validation.ts";

export type { ActorConditionEvent } from "./actor-condition-schema.ts";

export interface ActorConditionEventResult {
  message: string;
}

export function updateActorCondition(
  draft: State,
  event: ActorConditionEvent,
): ActorConditionEventResult {
  const result = applyActorConditionEvent(draft, event);
  settleOldestObligation(draft, ["actor-condition"]);
  return result;
}

function applyActorConditionEvent(
  draft: State,
  event: ActorConditionEvent,
): ActorConditionEventResult {
  switch (event.kind) {
    case "add-status-effect":
      return addStatusEffect(draft, event);
    case "remove-status-effect":
      return removeStatusEffect(draft, event);
    case "change-outfit":
      return changeOutfit(draft, event);
    case "transfer-tracked-item":
      return transferTrackedItem(draft, event);
    case "update-tracked-item":
      return updateTrackedItem(draft, event);
    case "add-tracked-item":
      return addTrackedItem(draft, event);
    default:
      throw new Error("unreachable actor condition event kind");
  }
}

function addStatusEffect(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "add-status-effect" }>,
): ActorConditionEventResult {
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  actor.condition.statusEffects.push({
    id: createId(draft, "effect"),
    name: assertNonEmptyString(event.name, "name"),
    type: event.type,
    affectedAttribute: assertNonEmptyString(event.affectedAttribute, "affectedAttribute"),
    valueType: event.valueType,
    value: event.value,
    duration: event.duration,
    source: assertNonEmptyString(event.source, "source"),
  });
  return { message: "状态效果已记录。" };
}

function removeStatusEffect(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "remove-status-effect" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  const next = actor.condition.statusEffects.filter((effect) => effect.id !== event.conditionId);
  if (next.length === actor.condition.statusEffects.length) {
    throw new Error(
      `status effect 不存在于 ${formatActorLabel(actor)}: ${event.conditionId}。当前 actor 可用 status effects: ${formatAvailableConditions(actor.condition.statusEffects)}`,
    );
  }
  actor.condition.statusEffects = next;
  return { message: `状态效果已处理：${event.conditionId} (${event.outcome})。` };
}

function formatActorLabel(actor: PublicActorState): string {
  return `${actor.id}（${actor.presentation.renderName}）`;
}

function formatAvailableConditions(conditions: readonly { id: string; name: string }[]): string {
  if (conditions.length === 0) {
    return "无";
  }
  return conditions.map((c) => `${c.id}（${c.name}）`).join("；");
}

function changeOutfit(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "change-outfit" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  actor.presentation.outfit = event.outfit;
  return { message: "外观装备已更新。" };
}

function transferTrackedItem(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "transfer-tracked-item" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
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
  return { message: "重要物品持有者已更新。" };
}

function updateTrackedItem(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "update-tracked-item" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
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
  return { message: `重要物品已更新：${event.itemId}。` };
}

function addTrackedItem(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "add-tracked-item" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.label, "label");
  assertNonEmptyString(event.reason, "reason");
  const holderId = event.holderActorId ?? null;
  const ownerId = event.ownerActorId ?? null;
  if (holderId !== null && draft.public.actors[holderId] === undefined) {
    throw new Error(`holder actor 不存在: ${holderId}`);
  }
  if (ownerId !== null && draft.public.actors[ownerId] === undefined) {
    throw new Error(`owner actor 不存在: ${ownerId}`);
  }
  const id = createId(draft, "item");
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
  return { message: "重要物品已记录到追踪列表。" };
}
