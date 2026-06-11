import type { Static } from "typebox";

import type { FateRank, PublicActorState } from "./state.ts";
import type { TypeBoxValidator } from "./typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  ACTOR_KIND_SCHEMA,
  ACTOR_STANCE_SCHEMA,
  REVEAL_STATUS_SCHEMA,
  SERVANT_CLASS_SCHEMA,
  stringEnumSchema,
} from "./state-enum-schemas.ts";
import {
  parseTaggedTypeBoxUnion,
  parseTypeBoxValue,
  trimStringsDeep,
} from "./typebox-validation.ts";

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

/** Fate rank 文法与 engine/core/fate-rank.ts 保持一致。 */
export const FATE_RANK_OR_NONE_SCHEMA = Type.Unsafe<FateRank | "none">({
  type: "string",
  pattern: "^(?:(?:E|D|C|B|A|EX)(?:\\+{1,3}|-)?|none)$",
});

export const NOBLE_PHANTASM_SCHEMA = Type.Object({
  name: Type.String({ minLength: 1 }),
  rank: FATE_RANK_OR_NONE_SCHEMA,
  kind: Type.String({ minLength: 1 }),
  status: REVEAL_STATUS_SCHEMA,
  summary: Type.String({ minLength: 1 }),
});

export type NoblePhantasm = Static<typeof NOBLE_PHANTASM_SCHEMA>;

export const OUTFIT_STATE_SCHEMA = Type.Object({
  label: Type.String({ minLength: 1 }),
  details: Type.String({ minLength: 1 }),
});

export const FATE_RANK_SCHEMA = Type.Unsafe<FateRank>({
  type: "string",
  pattern: "^(?:E|D|C|B|A|EX)(?:\\+{1,3}|-)?$",
});

export const FATE_PARAMS_SCHEMA = Type.Object({
  strength: FATE_RANK_SCHEMA,
  endurance: FATE_RANK_SCHEMA,
  agility: FATE_RANK_SCHEMA,
  mana: FATE_RANK_SCHEMA,
  luck: FATE_RANK_SCHEMA,
  noblePhantasm: FATE_RANK_SCHEMA,
});

export const SERVANT_SKILL_SCHEMA = Type.Object({
  name: Type.String({ minLength: 1 }),
  rank: FATE_RANK_OR_NONE_SCHEMA,
  summary: Type.String({ minLength: 1 }),
});

export const RELATIONSHIP_STATE_SCHEMA = Type.Object({
  stance: ACTOR_STANCE_SCHEMA,
  summary: Type.String({ minLength: 1 }),
});

export const COMMAND_SPELL_STATE_SCHEMA = Type.Object({
  total: Type.Integer({ minimum: 0 }),
  remaining: Type.Integer({ minimum: 0 }),
});

const MASTER_ROLE_SCHEMA = Type.Object({
  kind: Type.Literal("master"),
  commandSpells: COMMAND_SPELL_STATE_SCHEMA,
  contractedServantIds: Type.Array(Type.String({ minLength: 1 })),
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

export const ACTOR_ROLE_SCHEMA = Type.Union([
  MASTER_ROLE_SCHEMA,
  SOCIAL_ROLE_SCHEMA,
  FACTION_ROLE_SCHEMA,
]);

export const PUBLIC_NPC_INPUT_SCHEMA = Type.Object({
  id: Type.String({ minLength: 1 }),
  kind: ACTOR_KIND_SCHEMA,
  displayName: Type.String({ minLength: 1 }),
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
  displayName: Type.String({ minLength: 1 }),
  publicIdentity: Type.String({ minLength: 1 }),
  apparentAge: Type.Optional(Type.String({ minLength: 1 })),
  outfit: Type.Optional(OUTFIT_STATE_SCHEMA),
  demeanor: Type.Optional(Type.String({ minLength: 1 })),
  publicRoles: Type.Optional(Type.Array(ACTOR_ROLE_SCHEMA)),
  relationshipToProtagonist: Type.Optional(RELATIONSHIP_STATE_SCHEMA),
  ordinaryItems: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});
export type PublicNpcSkeletonInput = Static<typeof PUBLIC_NPC_SKELETON_INPUT_SCHEMA>;

export const SERVANT_INPUT_SCHEMA = Type.Object({
  id: Type.String({ minLength: 1 }),
  displayName: Type.String({ minLength: 1 }),
  publicIdentity: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  className: SERVANT_CLASS_SCHEMA,
  trueNameDisplay: Type.String({ minLength: 1 }),
  trueNameStatus: REVEAL_STATUS_SCHEMA,
  parameters: FATE_PARAMS_SCHEMA,
  classSkills: Type.Array(SERVANT_SKILL_SCHEMA),
  personalSkills: Type.Array(SERVANT_SKILL_SCHEMA),
  noblePhantasms: Type.Array(NOBLE_PHANTASM_SCHEMA),
  spiritualCore: Type.Integer(),
  mana: Type.Integer(),
  spiritualCondition: Type.String({ minLength: 1 }),
  masterActorId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  masterName: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  contractStatus: stringEnumSchema(["stable", "weak", "cut", "masterless"]),
  manaSupply: stringEnumSchema(["sufficient", "strained", "starved"]),
  currentOrder: Type.String({ minLength: 1 }),
  publicRoles: Type.Optional(Type.Array(ACTOR_ROLE_SCHEMA)),
  relationshipToProtagonist: Type.Optional(RELATIONSHIP_STATE_SCHEMA),
  ordinaryItems: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});
export type ServantInput = Static<typeof SERVANT_INPUT_SCHEMA>;

/** setup-protagonist 的 actor 整体由 Domain Event Tool Runner 提交时的 assertState 负责校验；这里故意放行。 */
const PUBLIC_ACTOR_STATE_DELEGATED_SCHEMA = Type.Unsafe<PublicActorState>({});

export const ACTOR_REGISTRY_KINDS = [
  "setup-protagonist",
  "upsert-public-npc",
  "ensure-public-npc",
  "upsert-servant",
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

const UPSERT_SERVANT_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("upsert-servant"),
  servant: SERVANT_INPUT_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export type ActorRegistryInput =
  | Static<typeof SETUP_PROTAGONIST_INPUT_SCHEMA>
  | Static<typeof UPSERT_PUBLIC_NPC_INPUT_SCHEMA>
  | Static<typeof ENSURE_PUBLIC_NPC_INPUT_SCHEMA>
  | Static<typeof UPSERT_SERVANT_INPUT_SCHEMA>;

const ACTOR_REGISTRY_KIND_VALIDATOR = Compile(ACTOR_REGISTRY_KIND_SCHEMA);
const SETUP_PROTAGONIST_INPUT_VALIDATOR = Compile(SETUP_PROTAGONIST_INPUT_SCHEMA);
const UPSERT_PUBLIC_NPC_INPUT_VALIDATOR = Compile(UPSERT_PUBLIC_NPC_INPUT_SCHEMA);
const ENSURE_PUBLIC_NPC_INPUT_VALIDATOR = Compile(ENSURE_PUBLIC_NPC_INPUT_SCHEMA);
const UPSERT_SERVANT_INPUT_VALIDATOR = Compile(UPSERT_SERVANT_INPUT_SCHEMA);

// Compile 必须在独立常量上调用（satisfies 上下文会干扰泛型推导）。
const ACTOR_REGISTRY_VARIANT_VALIDATORS = {
  "setup-protagonist": SETUP_PROTAGONIST_INPUT_VALIDATOR,
  "upsert-public-npc": UPSERT_PUBLIC_NPC_INPUT_VALIDATOR,
  "ensure-public-npc": ENSURE_PUBLIC_NPC_INPUT_VALIDATOR,
  "upsert-servant": UPSERT_SERVANT_INPUT_VALIDATOR,
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
