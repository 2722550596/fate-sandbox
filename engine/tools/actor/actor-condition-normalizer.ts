import type { ActorConditionEvent } from "../../core/actor/actor-condition.ts";

import { parseActorConditionEvent } from "../../core/actor/actor-schema.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";

/**
 * update_actor_condition / commit_turn 子事件的领域归一化层。
 * 结构校验交给 actor-condition-schema；这里只保留真正的领域逻辑：
 * fallback reason 注入、nullable 字段缺省归一，以及两条指向性更强的领域报错。
 *
 * 更换外观/服装请使用 update_actor_outfit 工具，不要通过 actor-condition 事件。
 */
export function normalizeActorConditionEvent(
  params: unknown,
  fallbackReason?: string,
): ActorConditionEvent {
  const input = assertRecord(params, "actor-condition 参数");
  guardUpdateWoundConditionId(input);
  guardResolveOutcome(input);
  return parseActorConditionEvent(
    withNullableDefaults(withFallbackReason(input, fallbackReason)),
    "actor-condition 参数",
  );
}

function guardUpdateWoundConditionId(input: Record<string, unknown>): void {
  if (input["kind"] !== "update-wound") return;
  if (isBlank(input["conditionId"]) && isBlank(input["text"])) {
    throw new Error(
      "update-wound 必须提供 conditionId（更新已有）或 text（新建）；更换服装/外观请使用 update_actor_outfit 工具。",
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
