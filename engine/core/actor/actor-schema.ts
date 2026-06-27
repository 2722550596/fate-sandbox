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

const SOCIAL_ROLE_SCHEMA = Type.Object({
  kind: Type.Literal("social"),
  label: Type.String({ minLength: 1 }),
});

const FACTION_ROLE_SCHEMA = Type.Object({
  kind: Type.Literal("faction"),
  factionId: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
});

export const ACTOR_ROLE_SCHEMA = Type.Union([SOCIAL_ROLE_SCHEMA, FACTION_ROLE_SCHEMA]);

export const PUBLIC_NPC_INPUT_SCHEMA = Type.Object({
  id: Type.String({ minLength: 1 }),
  kind: ACTOR_KIND_SCHEMA,
  internalName: Type.String({ minLength: 1 }),
  renderName: Type.Optional(Type.String({ minLength: 1 })),
  publicIdentity: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  publicRoles: Type.Array(ACTOR_ROLE_SCHEMA),
  relationshipToProtagonist: RELATIONSHIP_STATE_SCHEMA,
  ordinaryItems: Type.Array(Type.String({ minLength: 1 })),
});
export type PublicNpcInput = Static<typeof PUBLIC_NPC_INPUT_SCHEMA>;

export const PUBLIC_NPC_SKELETON_INPUT_SCHEMA = Type.Object({
  actorId: Type.String({ minLength: 1 }),
  npcKind: Type.Optional(ACTOR_KIND_SCHEMA),
  internalName: Type.String({ minLength: 1 }),
  renderName: Type.Optional(Type.String({ minLength: 1 })),
  publicIdentity: Type.String({ minLength: 1 }),
  apparentAge: Type.Optional(Type.String({ minLength: 1 })),
  outfit: Type.Optional(OUTFIT_STATE_SCHEMA),
  demeanor: Type.Optional(Type.String({ minLength: 1 })),
  publicRoles: Type.Optional(Type.Array(ACTOR_ROLE_SCHEMA)),
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
  divinity: Type.Number({ minimum: 0 }),
  digestionProgress: Type.Integer({ minimum: 0, maximum: 100 }),
  lossOfControlProgress: Type.Integer({ minimum: 0, maximum: 100 }),
  reason: Type.String({ minLength: 1 }),
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
  "ensure-public-npc",
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

const ENSURE_PUBLIC_NPC_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("ensure-public-npc"),
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
  | Static<typeof ENSURE_PUBLIC_NPC_INPUT_SCHEMA>
  | Static<typeof UPSERT_SEQUENCE_INPUT_SCHEMA>;

const ACTOR_REGISTRY_KIND_VALIDATOR = Compile(ACTOR_REGISTRY_KIND_SCHEMA);
const SETUP_PROTAGONIST_INPUT_VALIDATOR = Compile(SETUP_PROTAGONIST_INPUT_SCHEMA);
const UPSERT_PUBLIC_NPC_INPUT_VALIDATOR = Compile(UPSERT_PUBLIC_NPC_INPUT_SCHEMA);
const ENSURE_PUBLIC_NPC_INPUT_VALIDATOR = Compile(ENSURE_PUBLIC_NPC_INPUT_SCHEMA);
const UPSERT_SEQUENCE_INPUT_VALIDATOR = Compile(UPSERT_SEQUENCE_INPUT_SCHEMA);

const ACTOR_REGISTRY_VARIANT_VALIDATORS = {
  "setup-protagonist": SETUP_PROTAGONIST_INPUT_VALIDATOR,
  "upsert-public-npc": UPSERT_PUBLIC_NPC_INPUT_VALIDATOR,
  "ensure-public-npc": ENSURE_PUBLIC_NPC_INPUT_VALIDATOR,
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
