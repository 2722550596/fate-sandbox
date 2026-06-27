import type { Static } from "typebox";

import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { stringEnumSchema } from "../state/state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "../utils/typebox-validation.ts";

/**
 * Secrets 领域（reveal_secret 工具）边界 schema：单一事实来源。
 * 对应输入类型由此派生（secrets.ts re-export 原名）。
 */
export const SECRET_STRING_INPUT_SCHEMA = Type.Object({
  value: Type.String({ minLength: 1 }),
  revealConditions: Type.Array(Type.String({ minLength: 1 })),
});
export type SecretStringInput = Static<typeof SECRET_STRING_INPUT_SCHEMA>;

export const REVEAL_SECRET_TOOL_KINDS = [
  "configure-sequence-secrets",
  "configure-actor-secrets",
  "claim-reveal",
  "observed-reveal",
] as const;
const REVEAL_SECRET_TOOL_KIND_SCHEMA = stringEnumSchema(REVEAL_SECRET_TOOL_KINDS);

export const CONFIGURE_SEQUENCE_SECRETS_SCHEMA = Type.Object({
  kind: Type.Literal("configure-sequence-secrets"),
  actorId: Type.String({ minLength: 1 }),
  pathwaySecret: Type.Optional(SECRET_STRING_INPUT_SCHEMA),
  sequenceSecret: Type.Optional(SECRET_STRING_INPUT_SCHEMA),
  reason: Type.String({ minLength: 1 }),
});
export type ConfigureSequenceSecretsInput = Static<typeof CONFIGURE_SEQUENCE_SECRETS_SCHEMA>;

export const CONFIGURE_ACTOR_SECRETS_SCHEMA = Type.Object({
  kind: Type.Literal("configure-actor-secrets"),
  actorId: Type.String({ minLength: 1 }),
  privateMotives: Type.Optional(Type.Array(SECRET_STRING_INPUT_SCHEMA)),
  unrevealedAffiliations: Type.Optional(Type.Array(SECRET_STRING_INPUT_SCHEMA)),
  reason: Type.String({ minLength: 1 }),
});
export type ConfigureActorSecretsInput = Static<typeof CONFIGURE_ACTOR_SECRETS_SCHEMA>;

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

export type RevealSecretToolInput =
  | ConfigureSequenceSecretsInput
  | ConfigureActorSecretsInput
  | RevealSecretEvent;

const REVEAL_SECRET_TOOL_KIND_VALIDATOR = Compile(REVEAL_SECRET_TOOL_KIND_SCHEMA);
const CONFIGURE_SEQUENCE_SECRETS_VALIDATOR = Compile(CONFIGURE_SEQUENCE_SECRETS_SCHEMA);
const CONFIGURE_ACTOR_SECRETS_VALIDATOR = Compile(CONFIGURE_ACTOR_SECRETS_SCHEMA);
const CLAIM_REVEAL_VALIDATOR = Compile(CLAIM_REVEAL_SCHEMA);
const OBSERVED_REVEAL_VALIDATOR = Compile(OBSERVED_REVEAL_SCHEMA);

const REVEAL_SECRET_TOOL_VARIANT_VALIDATORS = {
  "configure-sequence-secrets": CONFIGURE_SEQUENCE_SECRETS_VALIDATOR,
  "configure-actor-secrets": CONFIGURE_ACTOR_SECRETS_VALIDATOR,
  "claim-reveal": CLAIM_REVEAL_VALIDATOR,
  "observed-reveal": OBSERVED_REVEAL_VALIDATOR,
} satisfies Record<RevealSecretToolInput["kind"], TypeBoxValidator<RevealSecretToolInput>>;

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

export function parseRevealSecretToolInput(
  value: unknown,
  fieldName: string,
): RevealSecretToolInput {
  return parseTaggedTypeBoxUnion<RevealSecretToolInput["kind"], RevealSecretToolInput>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    REVEAL_SECRET_TOOL_KIND_VALIDATOR,
    REVEAL_SECRET_TOOL_VARIANT_VALIDATORS,
  );
}
