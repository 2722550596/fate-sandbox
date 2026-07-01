import type { LocationState, TurnTimePolicy } from "../state/state.ts";
import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { BOUNDARY_KIND_SCHEMA } from "../state/state-enum-schemas.ts";
import { isRecord, parseTaggedTypeBoxUnion } from "../utils/typebox-validation.ts";

export const TURN_TIME_KIND_SCHEMA = Type.Unsafe<TurnTimePolicy["kind"]>({
  enum: ["elapsed", "travel"],
});

export const LOCATION_STATE_SCHEMA = Type.Object({
  region: Type.String({ minLength: 1 }),
  site: Type.String({ minLength: 1 }),
  detail: Type.String({ minLength: 1 }),
  boundary: BOUNDARY_KIND_SCHEMA,
});

export const ELAPSED_TURN_TIME_SCHEMA = Type.Object({
  kind: Type.Literal("elapsed"),
  elapsedMinutes: Type.Integer(),
  reason: Type.String({ minLength: 1 }),
});

export const TRAVEL_TURN_TIME_SCHEMA = Type.Object({
  kind: Type.Literal("travel"),
  location: LOCATION_STATE_SCHEMA,
  elapsedMinutes: Type.Integer(),
  reason: Type.String({ minLength: 1 }),
});

export const TURN_TIME_KIND_VALIDATOR = Compile(TURN_TIME_KIND_SCHEMA);
export const ELAPSED_TURN_TIME_VALIDATOR = Compile(ELAPSED_TURN_TIME_SCHEMA);
export const TRAVEL_TURN_TIME_VALIDATOR = Compile(TRAVEL_TURN_TIME_SCHEMA);

const TURN_TIME_VARIANT_VALIDATORS = {
  elapsed: ELAPSED_TURN_TIME_VALIDATOR,
  travel: TRAVEL_TURN_TIME_VALIDATOR,
} satisfies Record<TurnTimePolicy["kind"], TypeBoxValidator<TurnTimePolicy>>;

export function parseTurnTimePolicySchema(value: unknown, fieldName: string): TurnTimePolicy {
  const normalized = normalizeToolTime(value);
  const time = parseTaggedTypeBoxUnion<TurnTimePolicy["kind"], TurnTimePolicy>(
    normalized,
    fieldName,
    "kind",
    TURN_TIME_KIND_VALIDATOR,
    TURN_TIME_VARIANT_VALIDATORS,
  );
  return time.kind === "elapsed"
    ? normalizeElapsedTime(time, fieldName)
    : normalizeTravelTime(time, fieldName);
}

/**
 * tool 层把 elapsedMinutes 设计为 { minutes, reason } 对象以强迫 LLM 算总时间，
 * core 层只需要数字 + 顶层 reason。这里在进入 TypeBox 校验前：
 * 1. kind 缺省时默认为 "elapsed"（travel 是少数情况，LLM 忘了填也能走通）
 * 2. elapsedMinutes 对象展开为数字并提升 reason
 */
function normalizeToolTime(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const record = value;
  const kind =
    typeof record["kind"] === "string" && record["kind"] !== "" ? record["kind"] : "elapsed";
  const em = record["elapsedMinutes"];
  if (!isRecord(em)) {
    return { ...record, kind };
  }
  const emRecord = em;
  if (typeof emRecord["minutes"] !== "number" && typeof emRecord["minutes"] !== "string") {
    return { ...record, kind };
  }
  const innerReason = typeof emRecord["reason"] === "string" ? emRecord["reason"] : null;
  return {
    ...record,
    kind,
    elapsedMinutes: emRecord["minutes"],
    reason: record["reason"] ?? innerReason ?? "",
  };
}
function normalizeElapsedTime(
  time: Extract<TurnTimePolicy, { kind: "elapsed" }>,
  fieldName: string,
): TurnTimePolicy {
  return {
    kind: time.kind,
    elapsedMinutes: assertPositiveInteger(time.elapsedMinutes, `${fieldName}.elapsedMinutes`),
    reason: assertNonEmptyString(time.reason, `${fieldName}.reason`),
  };
}

function normalizeTravelTime(
  time: Extract<TurnTimePolicy, { kind: "travel" }>,
  fieldName: string,
): TurnTimePolicy {
  return {
    kind: time.kind,
    location: normalizeLocation(time.location, `${fieldName}.location`),
    elapsedMinutes: assertPositiveInteger(time.elapsedMinutes, `${fieldName}.elapsedMinutes`),
    reason: assertNonEmptyString(time.reason, `${fieldName}.reason`),
  };
}

function normalizeLocation(location: LocationState, fieldName: string): LocationState {
  return {
    region: assertNonEmptyString(location.region, `${fieldName}.region`),
    site: assertNonEmptyString(location.site, `${fieldName}.site`),
    detail: assertNonEmptyString(location.detail, `${fieldName}.detail`),
    boundary: location.boundary,
  };
}
function assertPositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} 必须是大于 0 的整数。`);
  }
  return value;
}

function assertNonEmptyString(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return trimmed;
}
