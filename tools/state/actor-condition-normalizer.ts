import type { ActorConditionEvent } from "../../engine/core/actor-condition";
import type { MagecraftCircuitState, OutfitState, TrackedItemState, WoundSeverity } from "../../engine/core/state";

import { assertFateRank } from "../../engine/core/fate-rank";
import { assertNonNegativeInteger } from "../../engine/core/state";
import { assertOneOfString } from "./domain-assert";

const ACTOR_CONDITION_KINDS = [
  "add-wound",
  "update-wound",
  "add-affliction",
  "add-permanent-effect",
  "update-magecraft-circuits",
  "resolve-condition",
  "change-outfit",
  "transfer-tracked-item",
  "update-tracked-item",
  "add-tracked-item",
] as const;

const WOUND_SEVERITIES = ["minor", "moderate", "severe", "critical"] as const satisfies readonly WoundSeverity[];
const CIRCUIT_STATUSES = ["normal", "overheated", "depleted", "dormant", "damaged"] as const satisfies readonly MagecraftCircuitState["status"][];
const CONDITION_KINDS = ["wound", "affliction"] as const;
const ITEM_KINDS = ["mundane", "weapon", "mystic-code", "document", "key-item", "other"] as const satisfies readonly TrackedItemState["kind"][];
const ITEM_CONDITIONS = ["intact", "damaged", "broken", "spent", "unknown"] as const satisfies readonly TrackedItemState["condition"][];
const ITEM_VISIBILITIES = ["player-known", "suspected"] as const satisfies readonly TrackedItemState["visibility"][];
const ACTOR_ID_FIELD = "actorId";

type ActorConditionKind = (typeof ACTOR_CONDITION_KINDS)[number];
type ActorConditionNormalizer = (
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
) => ActorConditionEvent;

const ACTOR_CONDITION_NORMALIZERS = {
  "add-wound": normalizeAddWound,
  "update-wound": normalizeUpdateWound,
  "add-affliction": normalizeAddAffliction,
  "add-permanent-effect": normalizeAddPermanentEffect,
  "update-magecraft-circuits": normalizeUpdateMagecraftCircuits,
  "resolve-condition": normalizeResolveCondition,
  "change-outfit": normalizeChangeOutfit,
  "transfer-tracked-item": normalizeTransferTrackedItem,
  "update-tracked-item": normalizeUpdateTrackedItem,
  "add-tracked-item": normalizeAddTrackedItem,
} satisfies Record<ActorConditionKind, ActorConditionNormalizer>;

export function normalizeActorConditionEvent(
  params: unknown,
  fallbackReason?: string,
): ActorConditionEvent {
  const input = assertRecord(params, "actor-condition 参数");
  const kindText = assertString(input["kind"], "kind");
  if (isOutfitAlias(kindText) || isMistakenOutfitUpdate(input, kindText)) {
    return normalizeChangeOutfit(input, fallbackReason);
  }

  const kind = assertOneOfString(input["kind"], ACTOR_CONDITION_KINDS, "actor-condition.kind");
  return ACTOR_CONDITION_NORMALIZERS[kind](input, fallbackReason);
}

function normalizeAddWound(input: Record<string, unknown>): ActorConditionEvent {
  return {
    kind: "add-wound",
    actorId: assertActorId(input),
    severity: assertOneOfString(input["severity"], WOUND_SEVERITIES, "severity"),
    text: assertString(input["text"], "text"),
    source: assertString(input["source"], "source"),
    recoverable: assertBoolean(input["recoverable"], "recoverable"),
  };
}

function normalizeUpdateWound(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): ActorConditionEvent {
  const conditionId = normalizeOptionalString(input["conditionId"]);
  if (conditionId === null) {
    throw new Error(
      "update-wound 必须提供已有 wound 的 conditionId；更换服装/外观请使用 kind=change-outfit。",
    );
  }
  return {
    kind: "update-wound",
    actorId: assertActorId(input),
    conditionId,
    severity: assertOptionalOneOf(input["severity"], WOUND_SEVERITIES, "severity"),
    text: normalizeOptionalString(input["text"]) ?? undefined,
    treatment: normalizeOptionalString(input["treatment"]) ?? undefined,
    recoverable: normalizeOptionalBoolean(input["recoverable"], "recoverable"),
    reason: normalizeReason(input["reason"], fallbackReason),
  };
}

function normalizeAddAffliction(input: Record<string, unknown>): ActorConditionEvent {
  return {
    kind: "add-affliction",
    actorId: assertActorId(input),
    text: assertString(input["text"], "text"),
    source: assertString(input["source"], "source"),
    expectedDuration: normalizeNullableString(input["expectedDuration"], "expectedDuration"),
  };
}

function normalizeAddPermanentEffect(input: Record<string, unknown>): ActorConditionEvent {
  return {
    kind: "add-permanent-effect",
    actorId: assertActorId(input),
    text: assertString(input["text"], "text"),
    source: assertString(input["source"], "source"),
    mechanicalEffect: assertString(input["mechanicalEffect"], "mechanicalEffect"),
  };
}

function normalizeUpdateMagecraftCircuits(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): ActorConditionEvent {
  return {
    kind: "update-magecraft-circuits",
    actorId: assertActorId(input),
    circuits: assertCircuits(input["circuits"]),
    reason: normalizeReason(input["reason"], fallbackReason),
  };
}

function normalizeResolveCondition(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): ActorConditionEvent {
  return {
    kind: "resolve-condition",
    actorId: assertActorId(input),
    conditionKind: assertOneOfString(input["conditionKind"], CONDITION_KINDS, "conditionKind"),
    conditionId: assertString(input["conditionId"], "conditionId"),
    outcome: assertResolveOutcome(input["outcome"]),
    reason: normalizeReason(input["reason"], fallbackReason),
  };
}

function normalizeTransferTrackedItem(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): ActorConditionEvent {
  return {
    kind: "transfer-tracked-item",
    itemId: assertString(input["itemId"], "itemId"),
    holderActorId: normalizeNullableString(input["holderActorId"], "holderActorId"),
    reason: normalizeReason(input["reason"], fallbackReason),
  };
}

function normalizeUpdateTrackedItem(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): ActorConditionEvent {
  return {
    kind: "update-tracked-item",
    itemId: assertString(input["itemId"], "itemId"),
    condition: assertOptionalOneOf(input["condition"], ITEM_CONDITIONS, "condition"),
    holderActorId: normalizeOptionalNullableString(input["holderActorId"], "holderActorId"),
    ownerActorId: normalizeOptionalNullableString(input["ownerActorId"], "ownerActorId"),
    notes: normalizeOptionalStringArray(input["notes"], "notes"),
    reason: normalizeReason(input["reason"], fallbackReason),
  };
}

function normalizeAddTrackedItem(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): ActorConditionEvent {
  return {
    kind: "add-tracked-item",
    label: assertString(input["label"], "label"),
    itemKind: assertOneOfString(input["itemKind"], ITEM_KINDS, "itemKind"),
    holderActorId: normalizeNullableString(input["holderActorId"], "holderActorId"),
    ownerActorId: normalizeNullableString(input["ownerActorId"], "ownerActorId"),
    condition: assertOneOfString(input["condition"], ITEM_CONDITIONS, "condition"),
    visibility: assertOneOfString(input["visibility"], ITEM_VISIBILITIES, "visibility"),
    notes: assertStringArray(input["notes"], "notes"),
    reason: normalizeReason(input["reason"], fallbackReason),
  };
}

function assertActorId(input: Record<string, unknown>): string {
  return assertString(input[ACTOR_ID_FIELD], ACTOR_ID_FIELD);
}

function assertCircuits(value: unknown): MagecraftCircuitState {
  const circuits = assertRecord(value, "circuits");
  return {
    count: assertString(circuits["count"], "circuits.count"),
    quality: circuits["quality"] === "none" ? "none" : assertFateRank(circuits["quality"], "circuits.quality"),
    od: assertNonNegativeInteger(circuits["od"], "circuits.od"),
    status: assertOneOfString(circuits["status"], CIRCUIT_STATUSES, "circuits.status"),
    traits: assertStringArray(circuits["traits"], "circuits.traits"),
  };
}

function assertResolveOutcome(value: unknown): "recovered" | "stabilized" {
  if (value === "recovered" || value === "stabilized") {
    return value;
  }
  throw new Error(
    "resolve-condition outcome 必须是 recovered 或 stabilized；新增、恶化或更新伤势请用 add-wound/update-wound，不要写 outcome。",
  );
}

function normalizeChangeOutfit(
  input: Record<string, unknown>,
  fallbackReason: string | undefined,
): ActorConditionEvent {
  return {
    kind: "change-outfit",
    actorId: assertActorId(input),
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

function assertOptionalOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fieldName: string,
): T[number] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertOneOfString(value, allowed, fieldName);
}

function normalizeOptionalNullableString(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return normalizeNullableString(value, fieldName);
}

function normalizeNullableString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return assertString(value, fieldName);
}

function normalizeOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertBoolean(value, fieldName);
}

function assertBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} 必须是 boolean。`);
  }
  return value;
}

function normalizeOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertStringArray(value, fieldName);
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是字符串数组。`);
  }
  return value.map((entry, index) => assertString(entry, `${fieldName}[${index}]`));
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
