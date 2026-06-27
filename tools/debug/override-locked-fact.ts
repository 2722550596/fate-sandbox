import type { Static } from "typebox";

import type { TypeBoxValidator } from "../../engine/core/utils/typebox-validation.ts";
import type { FateToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  PATHWAY_ID_SCHEMA,
  SEQUENCE_RANK_SCHEMA,
  stringEnumSchema,
} from "../../engine/core/state/state-enum-schemas.ts";
import { persistStateAfterCommit } from "../../engine/core/state/state-persistence.ts";
import { cloneState, commitState } from "../../engine/core/state/state-store.ts";
import {
  parseTaggedTypeBoxUnion,
  trimStringsDeep,
} from "../../engine/core/utils/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

const OVERRIDE_LOCKED_FACT_KINDS = ["sequence-rank", "pathway-secret", "sequence-secret"] as const;
const OVERRIDE_LOCKED_FACT_KIND_SCHEMA = stringEnumSchema(OVERRIDE_LOCKED_FACT_KINDS);

const SEQUENCE_RANK_OVERRIDE_SCHEMA = Type.Object({
  kind: Type.Literal("sequence-rank"),
  actorId: Type.String({ minLength: 1 }),
  rank: SEQUENCE_RANK_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const PATHWAY_SECRET_OVERRIDE_SCHEMA = Type.Object({
  kind: Type.Literal("pathway-secret"),
  actorId: Type.String({ minLength: 1 }),
  pathway: PATHWAY_ID_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const SEQUENCE_SECRET_OVERRIDE_SCHEMA = Type.Object({
  kind: Type.Literal("sequence-secret"),
  actorId: Type.String({ minLength: 1 }),
  pathway: PATHWAY_ID_SCHEMA,
  currentSequence: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export type OverrideLockedFactParams =
  | Static<typeof SEQUENCE_RANK_OVERRIDE_SCHEMA>
  | Static<typeof PATHWAY_SECRET_OVERRIDE_SCHEMA>
  | Static<typeof SEQUENCE_SECRET_OVERRIDE_SCHEMA>;

const OVERRIDE_LOCKED_FACT_KIND_VALIDATOR = Compile(OVERRIDE_LOCKED_FACT_KIND_SCHEMA);
const SEQUENCE_RANK_OVERRIDE_VALIDATOR = Compile(SEQUENCE_RANK_OVERRIDE_SCHEMA);
const PATHWAY_SECRET_OVERRIDE_VALIDATOR = Compile(PATHWAY_SECRET_OVERRIDE_SCHEMA);
const SEQUENCE_SECRET_OVERRIDE_VALIDATOR = Compile(SEQUENCE_SECRET_OVERRIDE_SCHEMA);

const OVERRIDE_LOCKED_FACT_VARIANT_VALIDATORS = {
  "sequence-rank": SEQUENCE_RANK_OVERRIDE_VALIDATOR,
  "pathway-secret": PATHWAY_SECRET_OVERRIDE_VALIDATOR,
  "sequence-secret": SEQUENCE_SECRET_OVERRIDE_VALIDATOR,
} satisfies Record<OverrideLockedFactParams["kind"], TypeBoxValidator<OverrideLockedFactParams>>;

export function overrideLockedFactTool(params: unknown, sessionManager: unknown): ToolResult {
  const override = parseTaggedTypeBoxUnion<
    OverrideLockedFactParams["kind"],
    OverrideLockedFactParams
  >(
    trimStringsDeep(params),
    "override_locked_fact 参数",
    "kind",
    OVERRIDE_LOCKED_FACT_KIND_VALIDATOR,
    OVERRIDE_LOCKED_FACT_VARIANT_VALIDATORS,
  );
  const draft = cloneState();
  const actor = draft.public.actors[override.actorId];
  if (actor === undefined) {
    throw new Error(`actor 不存在: ${override.actorId}`);
  }
  const sequence = actor.sequence;
  if (sequence === null) {
    throw new Error(`actor ${override.actorId} 没有 sequence。`);
  }
  switch (override.kind) {
    case "sequence-rank":
      sequence.rank = override.rank;
      break;
    case "pathway-secret":
      sequence.pathway = override.pathway;
      break;
    case "sequence-secret":
      sequence.currentSequence = override.currentSequence;
      sequence.pathway = override.pathway;
      break;
  }
  commitState(draft);
  const details: Record<string, unknown> = {
    kind: override.kind,
    actorId: override.actorId,
    reason: override.reason,
  };
  persistStateAfterCommit(sessionManager, details);
  return textResult(`锁定事实已覆盖：${override.kind}。原因：${override.reason}`, details);
}

export const overrideLockedFactToolDefinition: FateToolDefinition = {
  name: "override_locked_fact",
  description:
    "【调试工具】覆盖已锁定的序列等级、途径秘密或序列秘密。仅用于开发修档，必须写明 reason。",
  parameters: Type.Object({
    kind: Type.String({
      description: "允许: sequence-rank / pathway-secret / sequence-secret",
    }),
    actorId: Type.String(),
    rank: Type.Optional(Type.String()),
    pathway: Type.Optional(Type.String()),
    currentSequence: Type.Optional(Type.String()),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    overrideLockedFactTool(params, ctx.sessionManager),
};
