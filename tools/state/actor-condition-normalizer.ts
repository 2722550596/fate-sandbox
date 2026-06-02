import type { ActorConditionEvent } from "../../engine/core/actor-condition";
import type { OutfitState } from "../../engine/core/state";

export function normalizeActorConditionEvent(
  params: unknown,
  fallbackReason?: string,
): ActorConditionEvent {
  const input = assertRecord(params, "actor-condition 参数");
  const kind = assertString(input["kind"], "kind");
  if (isOutfitAlias(kind) || isMistakenOutfitUpdate(input, kind)) {
    return normalizeChangeOutfit(input, fallbackReason);
  }
  if (kind === "update-wound" && normalizeOptionalString(input["conditionId"]) === null) {
    throw new Error(
      "update-wound 必须提供已有 wound 的 conditionId；更换服装/外观请使用 kind=change-outfit。",
    );
  }
  const reason = normalizeOptionalString(input["reason"]);
  return {
    ...input,
    kind,
    ...(reason !== null || fallbackReason !== undefined
      ? { reason: normalizeReason(input["reason"], fallbackReason) }
      : {}),
  } as unknown as ActorConditionEvent; // safe: non-outfit variants keep engine validation; this boundary only normalizes LLM-facing aliases/default noise.
}

function normalizeChangeOutfit(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): ActorConditionEvent {
  return {
    kind: "change-outfit",
    actorId: assertString(input["actorId"], "actorId"),
    outfit: assertOutfit(input["outfit"], "outfit"),
    reason: normalizeReason(input["reason"], fallbackReason),
  };
}

function isOutfitAlias(kind: string): boolean {
  return kind === "change-outfit" || kind === "update-outfit" || kind === "change-clothes";
}

function isMistakenOutfitUpdate(input: Record<string, unknown>, kind: string): boolean {
  return kind === "update-wound" && isRecord(input["outfit"]) && normalizeOptionalString(input["conditionId"]) === null;
}

function assertOutfit(value: unknown, fieldName: string): OutfitState {
  const outfit = assertRecord(value, fieldName);
  return {
    label: assertString(outfit["label"], `${fieldName}.label`),
    details: assertString(outfit["details"], `${fieldName}.details`),
  };
}

function normalizeReason(value: unknown, fallbackReason: string | undefined): string {
  const explicit = normalizeOptionalString(value);
  if (explicit !== null) {
    return explicit;
  }
  if (fallbackReason !== undefined) {
    return assertString(fallbackReason, "reason");
  }
  throw new Error("reason 必须是非空字符串。");
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
