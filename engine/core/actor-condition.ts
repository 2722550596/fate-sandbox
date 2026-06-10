import type { ActorConditionEvent } from "./actor-condition-schema";
import type { ActorId, PermanentEffect, PublicActorState, State } from "./state";

import { createId } from "./ids";
import { assertNonEmptyString } from "./typebox-validation";

export type { ActorConditionEvent } from "./actor-condition-schema";

export interface ActorConditionEventResult {
  message: string;
}

export function updateActorCondition(
  draft: State,
  event: ActorConditionEvent,
): ActorConditionEventResult {
  switch (event.kind) {
    case "add-wound":
      return addWound(draft, event);
    case "update-wound":
      return updateWound(draft, event);
    case "add-affliction":
      return addAffliction(draft, event);
    case "add-permanent-effect":
      return addPermanentEffect(draft, event);
    case "update-magecraft-circuits":
      return updateMagecraftCircuits(draft, event);
    case "resolve-condition":
      return resolveCondition(draft, event);
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

function addWound(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "add-wound" }>,
): ActorConditionEventResult {
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  actor.condition.wounds.push({
    id: createId(draft, "wound"),
    severity: event.severity,
    text: assertNonEmptyString(event.text, "text"),
    recoverable: event.recoverable,
    treatment: assertNonEmptyString(event.source, "source"),
  });
  return { message: "伤势已记录。" };
}

function updateWound(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "update-wound" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
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
  return { message: `伤势已更新：${event.conditionId}。` };
}

function addAffliction(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "add-affliction" }>,
): ActorConditionEventResult {
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  actor.condition.afflictions.push({
    id: createId(draft, "affliction"),
    source: assertNonEmptyString(event.source, "source"),
    text: assertNonEmptyString(event.text, "text"),
    expectedDuration:
      event.expectedDuration === null
        ? null
        : assertNonEmptyString(event.expectedDuration, "expectedDuration"),
  });
  return { message: "异常状态已记录。" };
}

function addPermanentEffect(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "add-permanent-effect" }>,
): ActorConditionEventResult {
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  const effect: PermanentEffect = {
    id: createId(draft, "effect"),
    source: assertNonEmptyString(event.source, "source"),
    text: assertNonEmptyString(event.text, "text"),
    mechanicalEffect: assertNonEmptyString(event.mechanicalEffect, "mechanicalEffect"),
  };
  actor.condition.permanentEffects.push(effect);
  return { message: "长期影响已记录。" };
}

function updateMagecraftCircuits(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "update-magecraft-circuits" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  if (actor.magecraft === null) {
    throw new Error(`actor 没有 magecraft: ${event.actorId}`);
  }
  actor.magecraft.circuits = event.circuits;
  return { message: "魔术回路状态已更新。" };
}

function resolveCondition(
  draft: State,
  event: Extract<ActorConditionEvent, { kind: "resolve-condition" }>,
): ActorConditionEventResult {
  assertNonEmptyString(event.reason, "reason");
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${event.actorId}`);
  }
  switch (event.conditionKind) {
    case "wound":
      actor.condition.wounds = removeCondition({
        conditions: actor.condition.wounds,
        conditionId: event.conditionId,
        conditionKind: "wound",
        actor,
        actors: draft.public.actors,
      });
      break;
    case "affliction":
      actor.condition.afflictions = removeCondition({
        conditions: actor.condition.afflictions,
        conditionId: event.conditionId,
        conditionKind: "affliction",
        actor,
        actors: draft.public.actors,
      });
      break;
    default:
      throw new Error("unreachable condition kind");
  }
  return { message: `状态已处理：${event.conditionId} (${event.outcome})。` };
}

interface RemoveConditionInput<TCondition extends { id: string; text?: string }> {
  conditions: TCondition[];
  conditionId: string;
  conditionKind: "wound" | "affliction";
  actor: PublicActorState;
  actors: Record<ActorId, PublicActorState>;
}

function removeCondition<TCondition extends { id: string; text?: string }>(
  input: RemoveConditionInput<TCondition>,
): TCondition[] {
  const id = assertNonEmptyString(input.conditionId, "conditionId");
  const next = input.conditions.filter((condition) => condition.id !== id);
  if (next.length === input.conditions.length) {
    throw new Error(formatMissingConditionMessage(input, id));
  }
  return next;
}

function formatMissingConditionMessage<TCondition extends { id: string; text?: string }>(
  input: RemoveConditionInput<TCondition>,
  conditionId: string,
): string {
  const owner = findConditionOwner(input.actors, input.conditionKind, conditionId);
  const ownerHint =
    owner === null
      ? ""
      : `。该 ${input.conditionKind} 存在于 ${formatActorLabel(owner)}；请改用 actorId=${owner.id}`;
  return `${input.conditionKind} 不存在于 ${formatActorLabel(input.actor)}: ${conditionId}。当前 actor 可用 ${input.conditionKind}: ${formatAvailableConditions(input.conditions)}${ownerHint}`;
}

function findConditionOwner(
  actors: Record<ActorId, PublicActorState>,
  conditionKind: "wound" | "affliction",
  conditionId: string,
): PublicActorState | null {
  return (
    Object.values(actors).find((actor) =>
      getConditionsByKind(actor, conditionKind).some((condition) => condition.id === conditionId),
    ) ?? null
  );
}

function getConditionsByKind(
  actor: PublicActorState,
  conditionKind: "wound" | "affliction",
): readonly { id: string; text?: string }[] {
  switch (conditionKind) {
    case "wound":
      return actor.condition.wounds;
    case "affliction":
      return actor.condition.afflictions;
    default:
      throw new Error("unreachable condition kind");
  }
}

function formatActorLabel(actor: PublicActorState): string {
  return `${actor.id}（${actor.presentation.displayName}）`;
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
