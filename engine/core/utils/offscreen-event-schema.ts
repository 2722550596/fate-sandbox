import type { RecordOffscreenEventInput } from "./offscreen-event.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { OFFSCREEN_EVENT_SOURCE_SCHEMA, stringEnumSchema } from "../state/state-enum-schemas.ts";
import { parseTypeBoxValue, trimStringsDeep } from "./typebox-validation.ts";

/**
 * record_offscreen_event 工具边界 schema。
 * visibility 在工具边界故意只放行 secret/foreshadowed——player-known 在
 * 工具层有指向 record_memory 的领域报错，不进 schema。
 */
const TOOL_OFFSCREEN_EVENT_VISIBILITY_SCHEMA = stringEnumSchema(["secret", "foreshadowed"]);

export const RECORD_OFFSCREEN_EVENT_INPUT_SCHEMA = Type.Object({
  lineId: Type.String({ minLength: 1 }),
  actorIds: Type.Array(Type.String({ minLength: 1 })),
  timeRange: Type.Object({
    start: Type.String({ minLength: 1 }),
    end: Type.String({ minLength: 1 }),
  }),
  visibility: TOOL_OFFSCREEN_EVENT_VISIBILITY_SCHEMA,
  summary: Type.String({ minLength: 1 }),
  consequences: Type.Array(Type.String({ minLength: 1 })),
  futureHooks: Type.Array(Type.String({ minLength: 1 })),
  createdFrom: OFFSCREEN_EVENT_SOURCE_SCHEMA,
  pressureType: Type.String({ minLength: 1 }),
  pressureSlotId: Type.Optional(Type.String({ minLength: 1 })),
});

const RECORD_OFFSCREEN_EVENT_INPUT_VALIDATOR = Compile(RECORD_OFFSCREEN_EVENT_INPUT_SCHEMA);

export function parseRecordOffscreenEventInput(
  value: unknown,
  fieldName: string,
): RecordOffscreenEventInput {
  return parseTypeBoxValue(
    trimStringsDeep(value),
    fieldName,
    RECORD_OFFSCREEN_EVENT_INPUT_VALIDATOR,
  );
}
