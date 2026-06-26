import type { NewGameInitializationInput } from "./new-game-initialization.ts";
import type { TypeBoxValidator } from "./typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { OUTFIT_STATE_SCHEMA } from "./actor-schema.ts";
import {
  PATHWAY_ID_SCHEMA,
  PROMOTION_SYSTEM_SCHEMA,
  SEQUENCE_RANK_SCHEMA,
  stringEnumSchema,
} from "./state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "./typebox-validation.ts";

/**
 * initialize_new_game 工具边界 schema。
 *
 * 注意：故意只声明工具边界放行的字段子集（引擎 NewGameInitializationInput
 * 还支持 roles/abilities/knownFacts 等），多余字段由 Clean 剥除——
 * 与旧手写 assert 重建对象的行为一致。开放新字段时在这里显式加。
 */
const NEW_GAME_CAMPAIGN_INPUT_SCHEMA = Type.Object({
  presetId: Type.String({ minLength: 1 }),
  title: Type.Optional(Type.String({ minLength: 1 })),
  premise: Type.Optional(Type.String({ minLength: 1 })),
  startedAt: Type.Optional(Type.String({ minLength: 1 })),
  currentAt: Type.Optional(Type.String({ minLength: 1 })),
  reason: Type.Optional(Type.String({ minLength: 1 })),
});

const NEW_GAME_PRESENCE_INPUT_SCHEMA = Type.Object({
  presentActorIds: Type.Array(Type.String({ minLength: 1 })),
  allyActorIds: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

const HUMAN_PROTAGONIST_OPENING_SCHEMA = Type.Object({
  internalName: Type.String({ minLength: 1 }),
  renderName: Type.Optional(Type.String({ minLength: 1 })),
  publicIdentity: Type.String({ minLength: 1 }),
  background: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  abilities: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  ordinaryItems: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

const BEYONDER_PROTAGONIST_OPENING_SCHEMA = Type.Object({
  internalName: Type.String({ minLength: 1 }),
  renderName: Type.Optional(Type.String({ minLength: 1 })),
  publicIdentity: Type.String({ minLength: 1 }),
  background: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  currentSequence: Type.String({ minLength: 1 }),
  rank: SEQUENCE_RANK_SCHEMA,
  pathway: PATHWAY_ID_SCHEMA,
  promotionSystem: Type.Optional(PROMOTION_SYSTEM_SCHEMA),
  divinity: Type.Optional(Type.Number({ minimum: 0 })),
  digestionProgress: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  lossOfControlProgress: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  abilities: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  ordinaryItems: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

export const NEW_GAME_KINDS = ["human-protagonist", "beyonder-protagonist"] as const;
const NEW_GAME_KIND_SCHEMA = stringEnumSchema(NEW_GAME_KINDS);

const HUMAN_NEW_GAME_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("human-protagonist"),
  campaign: NEW_GAME_CAMPAIGN_INPUT_SCHEMA,
  protagonist: HUMAN_PROTAGONIST_OPENING_SCHEMA,
  presence: Type.Optional(NEW_GAME_PRESENCE_INPUT_SCHEMA),
  reason: Type.String({ minLength: 1 }),
});

const BEYONDER_NEW_GAME_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("beyonder-protagonist"),
  campaign: NEW_GAME_CAMPAIGN_INPUT_SCHEMA,
  protagonist: BEYONDER_PROTAGONIST_OPENING_SCHEMA,
  presence: Type.Optional(NEW_GAME_PRESENCE_INPUT_SCHEMA),
  reason: Type.String({ minLength: 1 }),
});

const NEW_GAME_KIND_VALIDATOR = Compile(NEW_GAME_KIND_SCHEMA);
const HUMAN_NEW_GAME_INPUT_VALIDATOR = Compile(HUMAN_NEW_GAME_INPUT_SCHEMA);
const BEYONDER_NEW_GAME_INPUT_VALIDATOR = Compile(BEYONDER_NEW_GAME_INPUT_SCHEMA);

const NEW_GAME_VARIANT_VALIDATORS = {
  "human-protagonist": HUMAN_NEW_GAME_INPUT_VALIDATOR,
  "beyonder-protagonist": BEYONDER_NEW_GAME_INPUT_VALIDATOR,
} satisfies Record<
  NewGameInitializationInput["kind"],
  TypeBoxValidator<NewGameInitializationInput>
>;

export function parseNewGameInitializationInput(
  value: unknown,
  fieldName: string,
): NewGameInitializationInput {
  return parseTaggedTypeBoxUnion<NewGameInitializationInput["kind"], NewGameInitializationInput>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    NEW_GAME_KIND_VALIDATOR,
    NEW_GAME_VARIANT_VALIDATORS,
  );
}
