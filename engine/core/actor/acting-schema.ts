import type { Static } from "typebox";

import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { stringEnumSchema } from "../state/state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "../utils/typebox-validation.ts";

// ===========================================================================
// 扮演事件 — 可审计的消化进度变更
// ===========================================================================

export const ACTING_EVENT_KINDS = ["advance-acting"] as const;
const ACTING_EVENT_KIND_SCHEMA = stringEnumSchema(ACTING_EVENT_KINDS);

const NON_EMPTY_STRING = Type.String({ minLength: 1 });

/** 单条扮演行为记录：key=行为维度标识, label=显示名 */
const CUE_ENTRY_SCHEMA = Type.Object({
  key: NON_EMPTY_STRING,
  label: NON_EMPTY_STRING,
});

const ADVANCE_ACTING_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("advance-acting"),
  actorId: NON_EMPTY_STRING,
  cues: Type.Array(CUE_ENTRY_SCHEMA, { minItems: 1 }),
  reason: NON_EMPTY_STRING,
});

export type AdvanceActingInput = Static<typeof ADVANCE_ACTING_EVENT_SCHEMA>;

export type ActingEvent = AdvanceActingInput;

const ACTING_EVENT_KIND_VALIDATOR = Compile(ACTING_EVENT_KIND_SCHEMA);
const ADVANCE_ACTING_EVENT_VALIDATOR = Compile(ADVANCE_ACTING_EVENT_SCHEMA);

const ACTING_EVENT_VARIANT_VALIDATORS = {
  "advance-acting": ADVANCE_ACTING_EVENT_VALIDATOR,
} satisfies Record<ActingEvent["kind"], TypeBoxValidator<ActingEvent>>;

export function parseActingEvent(value: unknown, fieldName: string): ActingEvent {
  return parseTaggedTypeBoxUnion<ActingEvent["kind"], ActingEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    ACTING_EVENT_KIND_VALIDATOR,
    ACTING_EVENT_VARIANT_VALIDATORS,
  );
}
