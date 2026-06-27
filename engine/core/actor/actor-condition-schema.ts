import type { Static } from "typebox";

import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { stringEnumSchema } from "../state/state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "../utils/typebox-validation.ts";
import { OUTFIT_STATE_SCHEMA } from "./actor-schema.ts";

/**
 * Actor condition 领域事件（update_actor_condition 工具 / commit_turn 子事件）
 * 边界 schema：单一事实来源。ActorConditionEvent 由此派生
 * （actor-condition.ts re-export 原名）。
 *
 * outfit 别名重路由、fallback reason、nullable 缺省归一等领域归一化
 * 留在 tools/state/actor-condition-normalizer.ts。
 */
export const ACTOR_CONDITION_EVENT_KINDS = [
  "add-affliction",
  "resolve-condition",
  "update-wound",
  "change-outfit",
] as const;
const ACTOR_CONDITION_EVENT_KIND_SCHEMA = stringEnumSchema(ACTOR_CONDITION_EVENT_KINDS);

const AFFLICTION_SOURCE_SCHEMA = stringEnumSchema([
  "combat",
  "beyonder-ability",
  "environment",
  "item",
  "other",
]);

const AFFLICTION_OUTCOME_SCHEMA = stringEnumSchema(["recovered", "stabilized"]);

const ADD_AFFLICTION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-affliction"),
  actorId: Type.String({ minLength: 1 }),
  source: AFFLICTION_SOURCE_SCHEMA,
  text: Type.String({ minLength: 1 }),
  expectedDuration: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  reason: Type.String({ minLength: 1 }),
});

const RESOLVE_CONDITION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("resolve-condition"),
  actorId: Type.String({ minLength: 1 }),
  conditionId: Type.String({ minLength: 1 }),
  outcome: AFFLICTION_OUTCOME_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const UPDATE_WOUND_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("update-wound"),
  actorId: Type.String({ minLength: 1 }),
  conditionId: Type.String({ minLength: 1 }),
  text: Type.Optional(Type.String({ minLength: 1 })),
  source: Type.Optional(AFFLICTION_SOURCE_SCHEMA),
  expectedDuration: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  reason: Type.String({ minLength: 1 }),
});

const CHANGE_OUTFIT_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("change-outfit"),
  actorId: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export type ActorConditionEvent =
  | Static<typeof ADD_AFFLICTION_EVENT_SCHEMA>
  | Static<typeof RESOLVE_CONDITION_EVENT_SCHEMA>
  | Static<typeof UPDATE_WOUND_EVENT_SCHEMA>
  | Static<typeof CHANGE_OUTFIT_EVENT_SCHEMA>;

const ACTOR_CONDITION_EVENT_KIND_VALIDATOR = Compile(ACTOR_CONDITION_EVENT_KIND_SCHEMA);
const ADD_AFFLICTION_EVENT_VALIDATOR = Compile(ADD_AFFLICTION_EVENT_SCHEMA);
const RESOLVE_CONDITION_EVENT_VALIDATOR = Compile(RESOLVE_CONDITION_EVENT_SCHEMA);
const UPDATE_WOUND_EVENT_VALIDATOR = Compile(UPDATE_WOUND_EVENT_SCHEMA);
const CHANGE_OUTFIT_EVENT_VALIDATOR = Compile(CHANGE_OUTFIT_EVENT_SCHEMA);

// Compile 必须在独立常量上调用（satisfies 上下文会干扰泛型推导）。
const ACTOR_CONDITION_EVENT_VARIANT_VALIDATORS = {
  "add-affliction": ADD_AFFLICTION_EVENT_VALIDATOR,
  "resolve-condition": RESOLVE_CONDITION_EVENT_VALIDATOR,
  "update-wound": UPDATE_WOUND_EVENT_VALIDATOR,
  "change-outfit": CHANGE_OUTFIT_EVENT_VALIDATOR,
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
