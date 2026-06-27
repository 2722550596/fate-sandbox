import type { ActorConditionEvent } from "../../core/actor/actor-condition.ts";

import { parseActorConditionEvent } from "../../core/actor/actor-condition-schema.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";

/**
 * update_actor_condition / commit_turn 子事件的领域归一化层。
 * 结构校验交给 actor-condition-schema；这里只保留真正的领域逻辑：
 * outfit 别名重路由、误用 update-wound 换装的抢救、fallback reason 注入、
 * nullable 字段缺省归一，以及两条指向性更强的领域报错。
 */
export function normalizeActorConditionEvent(
  params: unknown,
  fallbackReason?: string,
): ActorConditionEvent {
  const input = assertRecord(params, "actor-condition 参数");
  const rerouted = rerouteOutfitAliases(input);
  guardUpdateWoundConditionId(rerouted);
  guardResolveOutcome(rerouted);
  return parseActorConditionEvent(
    withNullableDefaults(withFallbackReason(rerouted, fallbackReason)),
    "actor-condition 参数",
  );
}

/** update-outfit / change-clothes 别名，以及“误用 update-wound 换装”的抢救。 */
function rerouteOutfitAliases(input: Record<string, unknown>): Record<string, unknown> {
  const kind = input["kind"];
  if (kind === "update-outfit" || kind === "change-clothes") {
    return { ...input, kind: "change-outfit" };
  }
  if (kind === "update-wound" && isRecord(input["outfit"]) && isBlank(input["conditionId"])) {
    return { ...input, kind: "change-outfit" };
  }
  return input;
}

function guardUpdateWoundConditionId(input: Record<string, unknown>): void {
  if (input["kind"] === "update-wound" && isBlank(input["conditionId"])) {
    throw new Error(
      "update-wound 必须提供已有 wound 的 conditionId；更换服装/外观请使用 kind=change-outfit。",
    );
  }
}

function guardResolveOutcome(input: Record<string, unknown>): void {
  if (input["kind"] !== "resolve-condition") {
    return;
  }
  const outcome = input["outcome"];
  if (outcome !== "recovered" && outcome !== "stabilized") {
    throw new Error(
      "resolve-condition outcome 必须是 recovered 或 stabilized；新增、恶化或更新伤势请用 add-wound/update-wound，不要写 outcome。",
    );
  }
}

/** commit_turn 路径下 reason 缺省继承本轮 summary。 */
function withFallbackReason(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): Record<string, unknown> {
  if (!isBlank(input["reason"]) || fallbackReason === undefined) {
    return input;
  }
  return { ...input, reason: fallbackReason };
}

function withNullableDefaults(input: Record<string, unknown>): Record<string, unknown> {
  switch (input["kind"]) {
    case "add-affliction":
      return { ...input, expectedDuration: input["expectedDuration"] ?? null };
    case "transfer-tracked-item":
      return { ...input, holderActorId: input["holderActorId"] ?? null };
    case "add-tracked-item":
      return {
        ...input,
        holderActorId: input["holderActorId"] ?? null,
        ownerActorId: input["ownerActorId"] ?? null,
      };
    default:
      return input;
  }
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}
