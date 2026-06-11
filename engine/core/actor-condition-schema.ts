import type { Static } from "typebox";

import type { TypeBoxValidator } from "./typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { FATE_RANK_OR_NONE_SCHEMA, OUTFIT_STATE_SCHEMA } from "./actor-schema.ts";
import {
  CIRCUIT_STATUS_SCHEMA,
  stringEnumSchema,
  TRACKED_ITEM_CONDITION_SCHEMA,
  TRACKED_ITEM_KIND_SCHEMA,
  TRACKED_ITEM_VISIBILITY_SCHEMA,
  WOUND_SEVERITY_SCHEMA,
} from "./state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "./typebox-validation.ts";

/**
 * Actor condition 领域事件（update_actor_condition 工具 / commit_turn 子事件）
 * 边界 schema：单一事实来源。ActorConditionEvent 由此派生
 * （actor-condition.ts re-export 原名）。
 *
 * outfit 别名重路由、fallback reason、nullable 缺省归一等领域归一化
 * 留在 tools/state/actor-condition-normalizer.ts。
 */
export const ACTOR_CONDITION_EVENT_KINDS = [
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
const ACTOR_CONDITION_EVENT_KIND_SCHEMA = stringEnumSchema(ACTOR_CONDITION_EVENT_KINDS);

export const MAGECRAFT_CIRCUIT_STATE_SCHEMA = Type.Object({
  count: Type.String({ minLength: 1 }),
  quality: FATE_RANK_OR_NONE_SCHEMA,
  od: Type.Integer({ minimum: 0 }),
  status: CIRCUIT_STATUS_SCHEMA,
  traits: Type.Array(Type.String({ minLength: 1 })),
});

const ADD_WOUND_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-wound"),
  actorId: Type.String({ minLength: 1 }),
  severity: WOUND_SEVERITY_SCHEMA,
  text: Type.String({ minLength: 1 }),
  source: Type.String({ minLength: 1 }),
  recoverable: Type.Boolean(),
});

const UPDATE_WOUND_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("update-wound"),
  actorId: Type.String({ minLength: 1 }),
  conditionId: Type.String({ minLength: 1 }),
  severity: Type.Optional(WOUND_SEVERITY_SCHEMA),
  text: Type.Optional(Type.String({ minLength: 1 })),
  treatment: Type.Optional(Type.String({ minLength: 1 })),
  recoverable: Type.Optional(Type.Boolean()),
  reason: Type.String({ minLength: 1 }),
});

const ADD_AFFLICTION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-affliction"),
  actorId: Type.String({ minLength: 1 }),
  text: Type.String({ minLength: 1 }),
  source: Type.String({ minLength: 1 }),
  expectedDuration: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
});

const ADD_PERMANENT_EFFECT_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-permanent-effect"),
  actorId: Type.String({ minLength: 1 }),
  text: Type.String({ minLength: 1 }),
  source: Type.String({ minLength: 1 }),
  mechanicalEffect: Type.String({ minLength: 1 }),
});

const UPDATE_MAGECRAFT_CIRCUITS_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("update-magecraft-circuits"),
  actorId: Type.String({ minLength: 1 }),
  circuits: MAGECRAFT_CIRCUIT_STATE_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const RESOLVE_CONDITION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("resolve-condition"),
  actorId: Type.String({ minLength: 1 }),
  conditionKind: stringEnumSchema(["wound", "affliction"]),
  conditionId: Type.String({ minLength: 1 }),
  outcome: stringEnumSchema(["recovered", "stabilized"]),
  reason: Type.String({ minLength: 1 }),
});

const CHANGE_OUTFIT_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("change-outfit"),
  actorId: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

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

export type ActorConditionEvent =
  | Static<typeof ADD_WOUND_EVENT_SCHEMA>
  | Static<typeof UPDATE_WOUND_EVENT_SCHEMA>
  | Static<typeof ADD_AFFLICTION_EVENT_SCHEMA>
  | Static<typeof ADD_PERMANENT_EFFECT_EVENT_SCHEMA>
  | Static<typeof UPDATE_MAGECRAFT_CIRCUITS_EVENT_SCHEMA>
  | Static<typeof RESOLVE_CONDITION_EVENT_SCHEMA>
  | Static<typeof CHANGE_OUTFIT_EVENT_SCHEMA>
  | Static<typeof TRANSFER_TRACKED_ITEM_EVENT_SCHEMA>
  | Static<typeof UPDATE_TRACKED_ITEM_EVENT_SCHEMA>
  | Static<typeof ADD_TRACKED_ITEM_EVENT_SCHEMA>;

const ACTOR_CONDITION_EVENT_KIND_VALIDATOR = Compile(ACTOR_CONDITION_EVENT_KIND_SCHEMA);
const ADD_WOUND_EVENT_VALIDATOR = Compile(ADD_WOUND_EVENT_SCHEMA);
const UPDATE_WOUND_EVENT_VALIDATOR = Compile(UPDATE_WOUND_EVENT_SCHEMA);
const ADD_AFFLICTION_EVENT_VALIDATOR = Compile(ADD_AFFLICTION_EVENT_SCHEMA);
const ADD_PERMANENT_EFFECT_EVENT_VALIDATOR = Compile(ADD_PERMANENT_EFFECT_EVENT_SCHEMA);
const UPDATE_MAGECRAFT_CIRCUITS_EVENT_VALIDATOR = Compile(UPDATE_MAGECRAFT_CIRCUITS_EVENT_SCHEMA);
const RESOLVE_CONDITION_EVENT_VALIDATOR = Compile(RESOLVE_CONDITION_EVENT_SCHEMA);
const CHANGE_OUTFIT_EVENT_VALIDATOR = Compile(CHANGE_OUTFIT_EVENT_SCHEMA);
const TRANSFER_TRACKED_ITEM_EVENT_VALIDATOR = Compile(TRANSFER_TRACKED_ITEM_EVENT_SCHEMA);
const UPDATE_TRACKED_ITEM_EVENT_VALIDATOR = Compile(UPDATE_TRACKED_ITEM_EVENT_SCHEMA);
const ADD_TRACKED_ITEM_EVENT_VALIDATOR = Compile(ADD_TRACKED_ITEM_EVENT_SCHEMA);

// Compile 必须在独立常量上调用（satisfies 上下文会干扰泛型推导）。
const ACTOR_CONDITION_EVENT_VARIANT_VALIDATORS = {
  "add-wound": ADD_WOUND_EVENT_VALIDATOR,
  "update-wound": UPDATE_WOUND_EVENT_VALIDATOR,
  "add-affliction": ADD_AFFLICTION_EVENT_VALIDATOR,
  "add-permanent-effect": ADD_PERMANENT_EFFECT_EVENT_VALIDATOR,
  "update-magecraft-circuits": UPDATE_MAGECRAFT_CIRCUITS_EVENT_VALIDATOR,
  "resolve-condition": RESOLVE_CONDITION_EVENT_VALIDATOR,
  "change-outfit": CHANGE_OUTFIT_EVENT_VALIDATOR,
  "transfer-tracked-item": TRANSFER_TRACKED_ITEM_EVENT_VALIDATOR,
  "update-tracked-item": UPDATE_TRACKED_ITEM_EVENT_VALIDATOR,
  "add-tracked-item": ADD_TRACKED_ITEM_EVENT_VALIDATOR,
} satisfies Record<ActorConditionEvent["kind"], TypeBoxValidator<ActorConditionEvent>>;

export function parseActorConditionEvent(value: unknown, fieldName: string): ActorConditionEvent {
  return parseTaggedTypeBoxUnion<ActorConditionEvent["kind"], ActorConditionEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    ACTOR_CONDITION_EVENT_KIND_VALIDATOR,
    ACTOR_CONDITION_EVENT_VARIANT_VALIDATORS,
  );
}
