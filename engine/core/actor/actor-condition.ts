import type { PublicActorState, State } from "../state/state.ts";
import type { ActorConditionEvent } from "./actor-condition-schema.ts";

import { settleOldestObligation } from "../ledger/obligations.ts";
import { createId } from "../utils/ids.ts";
import { assertNonEmptyString } from "../utils/typebox-validation.ts";
import { changeActorOutfit } from "./actor-impression.ts";

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
    case "add-affliction":
      return addAffliction(draft, event);
    case "resolve-condition":
      return resolveCondition(draft, event);
    case "update-wound":
      return updateWound(draft, event);
    case "change-outfit":
      return changeActorOutfit(draft, event.actorId, event.outfit, event.reason);
    default:
      throw new Error("unreachable actor condition event kind");
  }
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
    expectedDuration: event.expectedDuration ?? null,
  });
  return { message: "异常状态已记录。" };
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
  const next = actor.condition.afflictions.filter((a) => a.id !== event.conditionId);
  if (next.length === actor.condition.afflictions.length) {
    throw new Error(
      `affliction 不存在于 ${formatActorLabel(actor)}: ${event.conditionId}。当前 actor 可用 afflictions: ${formatAvailableAfflictions(actor.condition.afflictions)}`,
    );
  }
  actor.condition.afflictions = next;
  return { message: `异常状态已处理：${event.conditionId}（${event.outcome}）。` };
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
  const affliction = actor.condition.afflictions.find((a) => a.id === event.conditionId);
  if (affliction === undefined) {
    throw new Error(
      `affliction 不存在于 ${formatActorLabel(actor)}: ${event.conditionId}。当前 actor 可用 afflictions: ${formatAvailableAfflictions(actor.condition.afflictions)}`,
    );
  }
  if (event.text !== undefined) {
    affliction.text = event.text;
  }
  if (event.source !== undefined) {
    affliction.source = event.source;
  }
  if (event.expectedDuration !== undefined) {
    affliction.expectedDuration = event.expectedDuration;
  }
  return { message: `异常状态已更新：${event.conditionId}。` };
}

function formatActorLabel(actor: PublicActorState): string {
  return `${actor.id}（${actor.presentation.renderName}）`;
}

function formatAvailableAfflictions(afflictions: readonly { id: string; text: string }[]): string {
  if (afflictions.length === 0) {
    return "无";
  }
  return afflictions.map((a) => `${a.id}（${a.text}）`).join("；");
}
