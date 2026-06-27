import type { TrackedItemEvent } from "../../core/inventory/tracked-item-schema.ts";

import { parseTrackedItemEvent } from "../../core/inventory/tracked-item-schema.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";

export function normalizeTrackedItemEvent(
  params: unknown,
  fallbackReason?: string,
): TrackedItemEvent {
  const input = assertRecord(params, "tracked-item 参数");
  return parseTrackedItemEvent(
    withNullableDefaults(withFallbackReason(input, fallbackReason)),
    "tracked-item 参数",
  );
}

function withNullableDefaults(input: Record<string, unknown>): Record<string, unknown> {
  switch (input["kind"]) {
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

function withFallbackReason(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): Record<string, unknown> {
  if (typeof input["reason"] === "string" && input["reason"].trim().length > 0) {
    return input;
  }
  if (fallbackReason === undefined) {
    return input;
  }
  return { ...input, reason: fallbackReason };
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}
