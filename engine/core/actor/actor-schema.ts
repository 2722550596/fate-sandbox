import type { Static } from "typebox";

import type { PublicActorState } from "../state/state.ts";
import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  ACTOR_KIND_SCHEMA,
  ACTOR_STANCE_SCHEMA,
  PATHWAY_ID_SCHEMA,
  PROMOTION_SYSTEM_SCHEMA,
  SEQUENCE_RANK_SCHEMA,
  stringEnumSchema,
} from "../state/state-enum-schemas.ts";
import {
  parseTaggedTypeBoxUnion,
  parseTypeBoxValue,
  trimStringsDeep,
} from "../utils/typebox-validation.ts";

/**
 * Actor 领域工具边界 schema：单一事实来源。
 * 对应输入类型由此派生（actor.ts re-export 原名）。
 */
export const SCENE_PRESENCE_INPUT_SCHEMA = Type.Object({
  presentActorIds: Type.Array(Type.String({ minLength: 1 })),
  allyActorIds: Type.Array(Type.String({ minLength: 1 })),
  reason: Type.String({ minLength: 1 }),
});

export type ScenePresenceInput = Static<typeof SCENE_PRESENCE_INPUT_SCHEMA>;

const SCENE_PRESENCE_INPUT_VALIDATOR = Compile(SCENE_PRESENCE_INPUT_SCHEMA);

export function parseScenePresenceInput(value: unknown, fieldName: string): ScenePresenceInput {
  return parseTypeBoxValue(trimStringsDeep(value), fieldName, SCENE_PRESENCE_INPUT_VALIDATOR);
}

export const RETIRE_ACTOR_INPUT_SCHEMA = Type.Object({
  actorId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export type RetireActorInput = Static<typeof RETIRE_ACTOR_INPUT_SCHEMA>;

const RETIRE_ACTOR_INPUT_VALIDATOR = Compile(RETIRE_ACTOR_INPUT_SCHEMA);

export function parseRetireActorInput(value: unknown, fieldName: string): RetireActorInput {
  return parseTypeBoxValue(trimStringsDeep(value), fieldName, RETIRE_ACTOR_INPUT_VALIDATOR);
}

export const OUTFIT_STATE_SCHEMA = Type.Object({
  label: Type.String({ minLength: 1 }),
  details: Type.String({ minLength: 1 }),
});

export const RELATIONSHIP_STATE_SCHEMA = Type.Object({
  stance: ACTOR_STANCE_SCHEMA,
  summary: Type.String({ minLength: 1 }),
});

export const PUBLIC_NPC_INPUT_SCHEMA = Type.Object({
  id: Type.String({ minLength: 1 }),
  kind: ACTOR_KIND_SCHEMA,
  canonicalName: Type.String({ minLength: 1 }),
  renderName: Type.Optional(Type.String({ minLength: 1 })),
  publicIdentity: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  relationshipToProtagonist: RELATIONSHIP_STATE_SCHEMA,
  ordinaryItems: Type.Array(Type.String({ minLength: 1 })),
});
export type PublicNpcInput = Static<typeof PUBLIC_NPC_INPUT_SCHEMA>;

export const PUBLIC_NPC_SKELETON_INPUT_SCHEMA = Type.Object({
  actorId: Type.String({ minLength: 1 }),
  npcKind: Type.Optional(ACTOR_KIND_SCHEMA),
  canonicalName: Type.String({ minLength: 1 }),
  renderName: Type.Optional(Type.String({ minLength: 1 })),
  publicIdentity: Type.String({ minLength: 1 }),
  apparentAge: Type.Optional(Type.String({ minLength: 1 })),
  outfit: Type.Optional(OUTFIT_STATE_SCHEMA),
  demeanor: Type.Optional(Type.String({ minLength: 1 })),
  relationshipToProtagonist: Type.Optional(RELATIONSHIP_STATE_SCHEMA),
  ordinaryItems: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});
export type PublicNpcSkeletonInput = Static<typeof PUBLIC_NPC_SKELETON_INPUT_SCHEMA>;

export const SEQUENCE_INPUT_SCHEMA = Type.Object({
  actorId: Type.String({ minLength: 1 }),
  currentSequence: Type.String({ minLength: 1 }),
  rank: SEQUENCE_RANK_SCHEMA,
  pathway: PATHWAY_ID_SCHEMA,
  promotionSystem: PROMOTION_SYSTEM_SCHEMA,
});
export type SequenceInput = Static<typeof SEQUENCE_INPUT_SCHEMA>;

const SEQUENCE_INPUT_VALIDATOR = Compile(SEQUENCE_INPUT_SCHEMA);

export function parseSequenceInput(value: unknown, fieldName: string): SequenceInput {
  return parseTypeBoxValue(trimStringsDeep(value), fieldName, SEQUENCE_INPUT_VALIDATOR);
}
/** setup-protagonist 的 actor 整体由 Domain Event Tool Runner 提交时的 assertState 负责校验；这里故意放行。 */
const PUBLIC_ACTOR_STATE_DELEGATED_SCHEMA = Type.Unsafe<PublicActorState>({});

export const ACTOR_REGISTRY_KINDS = [
  "setup-protagonist",
  "upsert-public-npc",
  "init-npc",
  "upsert-sequence",
] as const;
const ACTOR_REGISTRY_KIND_SCHEMA = stringEnumSchema(ACTOR_REGISTRY_KINDS);

const SETUP_PROTAGONIST_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("setup-protagonist"),
  actor: PUBLIC_ACTOR_STATE_DELEGATED_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const UPSERT_PUBLIC_NPC_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("upsert-public-npc"),
  npc: PUBLIC_NPC_INPUT_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const INIT_NPC_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("init-npc"),
  npc: PUBLIC_NPC_SKELETON_INPUT_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const UPSERT_SEQUENCE_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("upsert-sequence"),
  sequence: SEQUENCE_INPUT_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export type ActorRegistryInput =
  | Static<typeof SETUP_PROTAGONIST_INPUT_SCHEMA>
  | Static<typeof UPSERT_PUBLIC_NPC_INPUT_SCHEMA>
  | Static<typeof INIT_NPC_INPUT_SCHEMA>
  | Static<typeof UPSERT_SEQUENCE_INPUT_SCHEMA>;

const ACTOR_REGISTRY_KIND_VALIDATOR = Compile(ACTOR_REGISTRY_KIND_SCHEMA);
const SETUP_PROTAGONIST_INPUT_VALIDATOR = Compile(SETUP_PROTAGONIST_INPUT_SCHEMA);
const UPSERT_PUBLIC_NPC_INPUT_VALIDATOR = Compile(UPSERT_PUBLIC_NPC_INPUT_SCHEMA);
const INIT_NPC_INPUT_VALIDATOR = Compile(INIT_NPC_INPUT_SCHEMA);
const UPSERT_SEQUENCE_INPUT_VALIDATOR = Compile(UPSERT_SEQUENCE_INPUT_SCHEMA);

const ACTOR_REGISTRY_VARIANT_VALIDATORS = {
  "setup-protagonist": SETUP_PROTAGONIST_INPUT_VALIDATOR,
  "upsert-public-npc": UPSERT_PUBLIC_NPC_INPUT_VALIDATOR,
  "init-npc": INIT_NPC_INPUT_VALIDATOR,
  "upsert-sequence": UPSERT_SEQUENCE_INPUT_VALIDATOR,
} satisfies Record<ActorRegistryInput["kind"], TypeBoxValidator<ActorRegistryInput>>;

export function parseActorRegistryInput(value: unknown, fieldName: string): ActorRegistryInput {
  return parseTaggedTypeBoxUnion<ActorRegistryInput["kind"], ActorRegistryInput>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    ACTOR_REGISTRY_KIND_VALIDATOR,
    ACTOR_REGISTRY_VARIANT_VALIDATORS,
  );
}

// ===========================================================================
// Acting — 扮演消化事件
// ===========================================================================

export const ACTING_EVENT_KINDS = ["advance-acting"] as const;
const ACTING_EVENT_KIND_SCHEMA = stringEnumSchema(ACTING_EVENT_KINDS);

const NON_EMPTY_STRING = Type.String({ minLength: 1 });

/** 单条扮演行为记录：key=行为维度标识, label=显示名 */
const CUE_ENTRY_SCHEMA = Type.Object({
  key: NON_EMPTY_STRING,
  label: NON_EMPTY_STRING,
});

export const ADVANCE_ACTING_EVENT_SCHEMA = Type.Object({
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

// ===========================================================================
// Actor Condition — 状态效果事件
// ===========================================================================

export const ACTOR_CONDITION_EVENT_KINDS = [
  "add-affliction",
  "resolve-condition",
  "update-wound",
] as const;
const ACTOR_CONDITION_EVENT_KIND_SCHEMA = stringEnumSchema(ACTOR_CONDITION_EVENT_KINDS);

const AFFLICTION_SOURCE_SCHEMA = Type.String({
  description:
    "来源标识。建议值：combat / beyonder-ability / environment / item / other，但可以是任意自由文本。",
});

const AFFLICTION_OUTCOME_SCHEMA = stringEnumSchema(["recovered", "stabilized"]);

export const ADD_AFFLICTION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-affliction"),
  actorId: Type.String({ minLength: 1 }),
  source: AFFLICTION_SOURCE_SCHEMA,
  text: Type.String({ minLength: 1 }),
  expectedDuration: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  reason: Type.String({ minLength: 1 }),
});

export const RESOLVE_CONDITION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("resolve-condition"),
  actorId: Type.String({ minLength: 1 }),
  conditionId: Type.String({ minLength: 1 }),
  outcome: AFFLICTION_OUTCOME_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export const UPDATE_WOUND_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("update-wound"),
  actorId: Type.String({ minLength: 1 }),
  conditionId: Type.String({ minLength: 1 }),
  text: Type.Optional(Type.String({ minLength: 1 })),
  source: Type.Optional(AFFLICTION_SOURCE_SCHEMA),
  expectedDuration: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  reason: Type.String({ minLength: 1 }),
});

export type ActorConditionEvent =
  | Static<typeof ADD_AFFLICTION_EVENT_SCHEMA>
  | Static<typeof RESOLVE_CONDITION_EVENT_SCHEMA>
  | Static<typeof UPDATE_WOUND_EVENT_SCHEMA>;

const ACTOR_CONDITION_EVENT_KIND_VALIDATOR = Compile(ACTOR_CONDITION_EVENT_KIND_SCHEMA);
const ADD_AFFLICTION_EVENT_VALIDATOR = Compile(ADD_AFFLICTION_EVENT_SCHEMA);
const RESOLVE_CONDITION_EVENT_VALIDATOR = Compile(RESOLVE_CONDITION_EVENT_SCHEMA);
const UPDATE_WOUND_EVENT_VALIDATOR = Compile(UPDATE_WOUND_EVENT_SCHEMA);

// Compile 必须在独立常量上调用（satisfies 上下文会干扰泛型推导）。
const ACTOR_CONDITION_EVENT_VARIANT_VALIDATORS = {
  "add-affliction": ADD_AFFLICTION_EVENT_VALIDATOR,
  "resolve-condition": RESOLVE_CONDITION_EVENT_VALIDATOR,
  "update-wound": UPDATE_WOUND_EVENT_VALIDATOR,
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
