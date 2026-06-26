import type { LocationState, TurnTimePolicy } from "./state.ts";
import type { TypeBoxValidator } from "./typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { BOUNDARY_KIND_SCHEMA } from "./state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion } from "./typebox-validation.ts";

export const TURN_TIME_KIND_SCHEMA = Type.Unsafe<TurnTimePolicy["kind"]>({
  enum: ["elapsed", "travel"],
});

export const LOCATION_STATE_SCHEMA = Type.Object({
  region: Type.String({ minLength: 1 }),
  site: Type.String({ minLength: 1 }),
  detail: Type.String({ minLength: 1 }),
  boundary: BOUNDARY_KIND_SCHEMA,
  coordinates: Type.Union([Type.Object({ x: Type.Number(), y: Type.Number() }), Type.Null()]),
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
  const time = parseTaggedTypeBoxUnion<TurnTimePolicy["kind"], TurnTimePolicy>(
    value,
    fieldName,
    "kind",
    TURN_TIME_KIND_VALIDATOR,
    TURN_TIME_VARIANT_VALIDATORS,
  );
  return time.kind === "elapsed"
    ? normalizeElapsedTime(time, fieldName)
    : normalizeTravelTime(time, fieldName);
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
    coordinates: location.coordinates,
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
