import type { NewGameInitializationInput } from "./new-game-initialization.ts";
import type { TypeBoxValidator } from "./typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { FATE_PARAMS_SCHEMA, OUTFIT_STATE_SCHEMA } from "./actor-schema.ts";
import { SERVANT_SECRET_STRING_INPUT_SCHEMA } from "./secrets-schema.ts";
import { SERVANT_CLASS_SCHEMA, stringEnumSchema } from "./state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "./typebox-validation.ts";

/**
 * initialize_new_game 工具边界 schema。
 *
 * 注意：故意只声明旧工具边界放行的字段子集（引擎 NewGameInitializationInput
 * 还支持 roles/magecraft/master/knownFacts 等），多余字段由 Clean 剥除——
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
  displayName: Type.String({ minLength: 1 }),
  publicIdentity: Type.String({ minLength: 1 }),
  background: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  abilities: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  ordinaryItems: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

const SERVANT_PROTAGONIST_OPENING_SCHEMA = Type.Object({
  displayName: Type.String({ minLength: 1 }),
  publicIdentity: Type.String({ minLength: 1 }),
  apparentAge: Type.String({ minLength: 1 }),
  outfit: OUTFIT_STATE_SCHEMA,
  demeanor: Type.String({ minLength: 1 }),
  className: SERVANT_CLASS_SCHEMA,
  trueNameDisplay: Type.String({ minLength: 1 }),
  trueNameStatus: stringEnumSchema(["hidden", "suspected"]),
  parameters: Type.Optional(FATE_PARAMS_SCHEMA),
  ordinaryItems: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

export const NEW_GAME_KINDS = ["human-protagonist", "servant-protagonist"] as const;
const NEW_GAME_KIND_SCHEMA = stringEnumSchema(NEW_GAME_KINDS);

const HUMAN_NEW_GAME_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("human-protagonist"),
  campaign: NEW_GAME_CAMPAIGN_INPUT_SCHEMA,
  protagonist: HUMAN_PROTAGONIST_OPENING_SCHEMA,
  presence: Type.Optional(NEW_GAME_PRESENCE_INPUT_SCHEMA),
  reason: Type.String({ minLength: 1 }),
});

const SERVANT_NEW_GAME_INPUT_SCHEMA = Type.Object({
  kind: Type.Literal("servant-protagonist"),
  campaign: NEW_GAME_CAMPAIGN_INPUT_SCHEMA,
  protagonist: SERVANT_PROTAGONIST_OPENING_SCHEMA,
  presence: Type.Optional(NEW_GAME_PRESENCE_INPUT_SCHEMA),
  hiddenTrueName: Type.Optional(SERVANT_SECRET_STRING_INPUT_SCHEMA),
  reason: Type.String({ minLength: 1 }),
});

const NEW_GAME_KIND_VALIDATOR = Compile(NEW_GAME_KIND_SCHEMA);
const HUMAN_NEW_GAME_INPUT_VALIDATOR = Compile(HUMAN_NEW_GAME_INPUT_SCHEMA);
const SERVANT_NEW_GAME_INPUT_VALIDATOR = Compile(SERVANT_NEW_GAME_INPUT_SCHEMA);

// Compile 必须在独立常量上调用（satisfies 上下文会干扰泛型推导）。
const NEW_GAME_VARIANT_VALIDATORS = {
  "human-protagonist": HUMAN_NEW_GAME_INPUT_VALIDATOR,
  "servant-protagonist": SERVANT_NEW_GAME_INPUT_VALIDATOR,
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
