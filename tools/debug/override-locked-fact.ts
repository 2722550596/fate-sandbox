import type { Static } from "typebox";

import type { TypeBoxValidator } from "../../engine/core/typebox-validation";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { FATE_PARAMS_SCHEMA } from "../../engine/core/actor-schema";
import {
  REVEAL_STATUS_SCHEMA,
  SERVANT_CLASS_SCHEMA,
  stringEnumSchema,
} from "../../engine/core/state-enum-schemas";
import { persistCurrentState, writeStateToDetails } from "../../engine/core/state-persistence";
import { cloneState, commitState } from "../../engine/core/state-store";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "../../engine/core/typebox-validation";
import { textResult, type ToolResult } from "../runtime/tool-result";

const OVERRIDE_LOCKED_FACT_KINDS = [
  "servant-class",
  "servant-true-name",
  "servant-base-params",
] as const;
const OVERRIDE_LOCKED_FACT_KIND_SCHEMA = stringEnumSchema(OVERRIDE_LOCKED_FACT_KINDS);

const SERVANT_CLASS_OVERRIDE_SCHEMA = Type.Object({
  kind: Type.Literal("servant-class"),
  actorId: Type.String({ minLength: 1 }),
  className: SERVANT_CLASS_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const SERVANT_TRUE_NAME_OVERRIDE_SCHEMA = Type.Object({
  kind: Type.Literal("servant-true-name"),
  actorId: Type.String({ minLength: 1 }),
  display: Type.String({ minLength: 1 }),
  status: Type.Optional(REVEAL_STATUS_SCHEMA),
  reason: Type.String({ minLength: 1 }),
});

const SERVANT_BASE_PARAMS_OVERRIDE_SCHEMA = Type.Object({
  kind: Type.Literal("servant-base-params"),
  actorId: Type.String({ minLength: 1 }),
  base: FATE_PARAMS_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export type OverrideLockedFactParams =
  | Static<typeof SERVANT_CLASS_OVERRIDE_SCHEMA>
  | Static<typeof SERVANT_TRUE_NAME_OVERRIDE_SCHEMA>
  | Static<typeof SERVANT_BASE_PARAMS_OVERRIDE_SCHEMA>;

const OVERRIDE_LOCKED_FACT_KIND_VALIDATOR = Compile(OVERRIDE_LOCKED_FACT_KIND_SCHEMA);
const SERVANT_CLASS_OVERRIDE_VALIDATOR = Compile(SERVANT_CLASS_OVERRIDE_SCHEMA);
const SERVANT_TRUE_NAME_OVERRIDE_VALIDATOR = Compile(SERVANT_TRUE_NAME_OVERRIDE_SCHEMA);
const SERVANT_BASE_PARAMS_OVERRIDE_VALIDATOR = Compile(SERVANT_BASE_PARAMS_OVERRIDE_SCHEMA);

// Compile 必须在独立常量上调用（satisfies 上下文会干扰泛型推导）。
const OVERRIDE_LOCKED_FACT_VARIANT_VALIDATORS = {
  "servant-class": SERVANT_CLASS_OVERRIDE_VALIDATOR,
  "servant-true-name": SERVANT_TRUE_NAME_OVERRIDE_VALIDATOR,
  "servant-base-params": SERVANT_BASE_PARAMS_OVERRIDE_VALIDATOR,
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
  const servantForm = actor.servantForm;
  if (servantForm === null) {
    throw new Error(`actor ${override.actorId} 没有 servantForm。`);
  }
  switch (override.kind) {
    case "servant-class":
      servantForm.identity.className = override.className;
      break;
    case "servant-true-name":
      servantForm.identity.trueName = {
        status: override.status ?? "revealed",
        display: override.display,
      };
      break;
    case "servant-base-params":
      servantForm.parameters.base = override.base;
      break;
  }
  commitState(draft);
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = {
    kind: override.kind,
    actorId: override.actorId,
    reason: override.reason,
  };
  writeStateToDetails(details);
  return textResult(`锁定事实已覆盖：${override.kind}。原因：${override.reason}`, details);
}
