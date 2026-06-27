import type { Static } from "typebox";

import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  TRACKED_ITEM_CONDITION_SCHEMA,
  TRACKED_ITEM_KIND_SCHEMA,
  TRACKED_ITEM_VISIBILITY_SCHEMA,
  stringEnumSchema,
} from "../state/state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "../utils/typebox-validation.ts";

export const TRACKED_ITEM_EVENT_KINDS = [
  "transfer-tracked-item",
  "update-tracked-item",
  "add-tracked-item",
] as const;
const TRACKED_ITEM_EVENT_KIND_SCHEMA = stringEnumSchema(TRACKED_ITEM_EVENT_KINDS);

const TRANSFER_TRACKED_ITEM_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("transfer-tracked-item"),
  itemId: Type.String({ minLength: 1 }),
  holderActorId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  reason: Type.String({ minLength: 1 }),
});

const UPDATE_TRACKED_ITEM_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("update-tracked-item"),
  itemId: Type.String({ minLength: 1 }),
  condition: Type.Optional(TRACKED_ITEM_CONDITION_SCHEMA),
  holderActorId: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  ownerActorId: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  notes: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  reason: Type.String({ minLength: 1 }),
});

const ADD_TRACKED_ITEM_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-tracked-item"),
  label: Type.String({ minLength: 1 }),
  itemKind: TRACKED_ITEM_KIND_SCHEMA,
  holderActorId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  ownerActorId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  condition: TRACKED_ITEM_CONDITION_SCHEMA,
  visibility: TRACKED_ITEM_VISIBILITY_SCHEMA,
  notes: Type.Array(Type.String({ minLength: 1 })),
  reason: Type.String({ minLength: 1 }),
});

export type TrackedItemEvent =
  | Static<typeof TRANSFER_TRACKED_ITEM_EVENT_SCHEMA>
  | Static<typeof UPDATE_TRACKED_ITEM_EVENT_SCHEMA>
  | Static<typeof ADD_TRACKED_ITEM_EVENT_SCHEMA>;

const TRACKED_ITEM_EVENT_KIND_VALIDATOR = Compile(TRACKED_ITEM_EVENT_KIND_SCHEMA);
const TRANSFER_TRACKED_ITEM_EVENT_VALIDATOR = Compile(TRANSFER_TRACKED_ITEM_EVENT_SCHEMA);
const UPDATE_TRACKED_ITEM_EVENT_VALIDATOR = Compile(UPDATE_TRACKED_ITEM_EVENT_SCHEMA);
const ADD_TRACKED_ITEM_EVENT_VALIDATOR = Compile(ADD_TRACKED_ITEM_EVENT_SCHEMA);

const TRACKED_ITEM_EVENT_VARIANT_VALIDATORS = {
  "transfer-tracked-item": TRANSFER_TRACKED_ITEM_EVENT_VALIDATOR,
  "update-tracked-item": UPDATE_TRACKED_ITEM_EVENT_VALIDATOR,
  "add-tracked-item": ADD_TRACKED_ITEM_EVENT_VALIDATOR,
} satisfies Record<TrackedItemEvent["kind"], TypeBoxValidator<TrackedItemEvent>>;

export function parseTrackedItemEvent(value: unknown, fieldName: string): TrackedItemEvent {
  return parseTaggedTypeBoxUnion<TrackedItemEvent["kind"], TrackedItemEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    TRACKED_ITEM_EVENT_KIND_VALIDATOR,
    TRACKED_ITEM_EVENT_VARIANT_VALIDATORS,
  );
}

export type { TypeBoxValidator };
