import type { Static } from "typebox";

import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { stringEnumSchema } from "../state/state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "../utils/typebox-validation.ts";
/**
 * Secrets 领域（configure_secret / reveal_secret 工具）边界 schema：单一事实来源。
 * 对应输入类型由此派生（secrets.ts re-export 原名）。
 */
export const SECRET_STRING_INPUT_SCHEMA = Type.Object({
  value: Type.String({ minLength: 1 }),
  revealConditions: Type.Array(Type.String({ minLength: 1 })),
});
export type SecretStringInput = Static<typeof SECRET_STRING_INPUT_SCHEMA>;

// ===========================================================================
// configure_secret — 配置隐藏秘密（actor 级 + 世界级）
// ===========================================================================

export const CONFIGURE_SECRET_KINDS = ["actor-beyonder", "actor-private", "world-fact"] as const;
const CONFIGURE_SECRET_KIND_SCHEMA = stringEnumSchema(CONFIGURE_SECRET_KINDS);

export const CONFIGURE_ACTOR_BEYONDER_SCHEMA = Type.Object({
  kind: Type.Literal("actor-beyonder"),
  actorId: Type.String({ minLength: 1 }),
  secrets: Type.Array(SECRET_STRING_INPUT_SCHEMA, { minItems: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export const CONFIGURE_ACTOR_PRIVATE_SCHEMA = Type.Object({
  kind: Type.Literal("actor-private"),
  actorId: Type.String({ minLength: 1 }),
  secrets: Type.Array(SECRET_STRING_INPUT_SCHEMA, { minItems: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export const CONFIGURE_WORLD_FACT_SCHEMA = Type.Object({
  kind: Type.Literal("world-fact"),
  text: Type.String({ minLength: 1 }),
  revealConditions: Type.Array(Type.String({ minLength: 1 })),
  relatedActorIds: Type.Array(Type.String({ minLength: 1 })),
  reason: Type.String({ minLength: 1 }),
});

export type ConfigureSecretInput =
  | Static<typeof CONFIGURE_ACTOR_BEYONDER_SCHEMA>
  | Static<typeof CONFIGURE_ACTOR_PRIVATE_SCHEMA>
  | Static<typeof CONFIGURE_WORLD_FACT_SCHEMA>;

const CONFIGURE_SECRET_KIND_VALIDATOR = Compile(CONFIGURE_SECRET_KIND_SCHEMA);
const CONFIGURE_ACTOR_BEYONDER_VALIDATOR = Compile(CONFIGURE_ACTOR_BEYONDER_SCHEMA);
const CONFIGURE_ACTOR_PRIVATE_VALIDATOR = Compile(CONFIGURE_ACTOR_PRIVATE_SCHEMA);
const CONFIGURE_WORLD_FACT_VALIDATOR = Compile(CONFIGURE_WORLD_FACT_SCHEMA);

const CONFIGURE_SECRET_VARIANT_VALIDATORS = {
  "actor-beyonder": CONFIGURE_ACTOR_BEYONDER_VALIDATOR,
  "actor-private": CONFIGURE_ACTOR_PRIVATE_VALIDATOR,
  "world-fact": CONFIGURE_WORLD_FACT_VALIDATOR,
} satisfies Record<ConfigureSecretInput["kind"], TypeBoxValidator<ConfigureSecretInput>>;

export function parseConfigureSecretInput(value: unknown, fieldName: string): ConfigureSecretInput {
  return parseTaggedTypeBoxUnion<ConfigureSecretInput["kind"], ConfigureSecretInput>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    CONFIGURE_SECRET_KIND_VALIDATOR,
    CONFIGURE_SECRET_VARIANT_VALIDATORS,
  );
}

// ===========================================================================
// reveal_secret — 纯揭示
// ===========================================================================

export const REVEAL_SECRET_KINDS = ["claim-reveal", "observed-reveal"] as const;
const REVEAL_SECRET_KIND_SCHEMA = stringEnumSchema(REVEAL_SECRET_KINDS);

export const CLAIM_REVEAL_SCHEMA = Type.Object({
  kind: Type.Literal("claim-reveal"),
  actorId: Type.String({ minLength: 1 }),
  claim: Type.String({ minLength: 1 }),
  evidence: Type.String({ minLength: 1 }),
});

export const OBSERVED_REVEAL_SCHEMA = Type.Object({
  kind: Type.Literal("observed-reveal"),
  actorId: Type.String({ minLength: 1 }),
  trigger: Type.String({ minLength: 1 }),
  evidence: Type.String({ minLength: 1 }),
});

export type RevealSecretEvent =
  | Static<typeof CLAIM_REVEAL_SCHEMA>
  | Static<typeof OBSERVED_REVEAL_SCHEMA>;

const REVEAL_SECRET_KIND_VALIDATOR = Compile(REVEAL_SECRET_KIND_SCHEMA);
const CLAIM_REVEAL_VALIDATOR = Compile(CLAIM_REVEAL_SCHEMA);
const OBSERVED_REVEAL_VALIDATOR = Compile(OBSERVED_REVEAL_SCHEMA);

const REVEAL_SECRET_VARIANT_VALIDATORS = {
  "claim-reveal": CLAIM_REVEAL_VALIDATOR,
  "observed-reveal": OBSERVED_REVEAL_VALIDATOR,
} satisfies Record<RevealSecretEvent["kind"], TypeBoxValidator<RevealSecretEvent>>;

export function parseRevealSecretInput(value: unknown, fieldName: string): RevealSecretEvent {
  return parseTaggedTypeBoxUnion<RevealSecretEvent["kind"], RevealSecretEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    REVEAL_SECRET_KIND_VALIDATOR,
    REVEAL_SECRET_VARIANT_VALIDATORS,
  );
}

// ===========================================================================
// private_resolve
// ===========================================================================

export const PRIVATE_RESOLVE_EVENT_KINDS = ["hidden-reaction", "secret-compatibility"] as const;
const PRIVATE_RESOLVE_EVENT_KIND_SCHEMA = stringEnumSchema(PRIVATE_RESOLVE_EVENT_KINDS);

export const HIDDEN_REACTION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("hidden-reaction"),
  actorId: Type.String({ minLength: 1 }),
  stimulus: Type.String({ minLength: 1 }),
  publicContext: Type.String({ minLength: 1 }),
});

export const SECRET_COMPATIBILITY_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("secret-compatibility"),
  actorId: Type.String({ minLength: 1 }),
  targetActorId: Type.String({ minLength: 1 }),
  interaction: Type.String({ minLength: 1 }),
});

export type PrivateResolveEvent =
  | Static<typeof HIDDEN_REACTION_EVENT_SCHEMA>
  | Static<typeof SECRET_COMPATIBILITY_EVENT_SCHEMA>;

const PRIVATE_RESOLVE_EVENT_KIND_VALIDATOR = Compile(PRIVATE_RESOLVE_EVENT_KIND_SCHEMA);
const HIDDEN_REACTION_EVENT_VALIDATOR = Compile(HIDDEN_REACTION_EVENT_SCHEMA);
const SECRET_COMPATIBILITY_EVENT_VALIDATOR = Compile(SECRET_COMPATIBILITY_EVENT_SCHEMA);

const PRIVATE_RESOLVE_EVENT_VARIANT_VALIDATORS = {
  "hidden-reaction": HIDDEN_REACTION_EVENT_VALIDATOR,
  "secret-compatibility": SECRET_COMPATIBILITY_EVENT_VALIDATOR,
} satisfies Record<PrivateResolveEvent["kind"], TypeBoxValidator<PrivateResolveEvent>>;

export function parsePrivateResolveEvent(value: unknown, fieldName: string): PrivateResolveEvent {
  return parseTaggedTypeBoxUnion<PrivateResolveEvent["kind"], PrivateResolveEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    PRIVATE_RESOLVE_EVENT_KIND_VALIDATOR,
    PRIVATE_RESOLVE_EVENT_VARIANT_VALIDATORS,
  );
}
