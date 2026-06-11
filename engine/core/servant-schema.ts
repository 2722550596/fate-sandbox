import type { Static } from "typebox";

import type { TypeBoxValidator } from "./typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  CONTRACT_STATUS_SCHEMA,
  FATE_PARAM_KEY_SCHEMA,
  MANA_SUPPLY_SCHEMA,
  stringEnumSchema,
} from "./state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "./typebox-validation.ts";

/**
 * Servant 领域事件（update_servant_form 工具）边界 schema：单一事实来源。
 * ServantFormEvent 类型由此派生（servant.ts re-export 原名）。
 *
 * modifier.id / defect.id 保持 Optional：缺省时由引擎 createId 生成。
 * expiresAt 的 ISO 格式由引擎 assertState 校验（报错带字段路径）。
 */
export const SERVANT_FORM_EVENT_KINDS = [
  "spend-mana",
  "restore-mana",
  "damage-spiritual-core",
  "add-param-modifier",
  "change-contract",
  "add-permanent-defect",
] as const;
const SERVANT_FORM_EVENT_KIND_SCHEMA = stringEnumSchema(SERVANT_FORM_EVENT_KINDS);

export const PARAM_MODIFIER_INPUT_SCHEMA = Type.Object({
  id: Type.Optional(Type.String()),
  source: Type.String({ minLength: 1 }),
  affectedParams: Type.Array(FATE_PARAM_KEY_SCHEMA),
  summary: Type.String({ minLength: 1 }),
  expiresAt: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
});

export const PERMANENT_DEFECT_INPUT_SCHEMA = Type.Object({
  id: Type.Optional(Type.String()),
  source: Type.String({ minLength: 1 }),
  text: Type.String({ minLength: 1 }),
  mechanicalEffect: Type.String({ minLength: 1 }),
});

export const SERVANT_CONTRACT_STATE_SCHEMA = Type.Object({
  masterActorId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  masterName: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  status: CONTRACT_STATUS_SCHEMA,
  manaSupply: MANA_SUPPLY_SCHEMA,
});

const SPEND_MANA_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("spend-mana"),
  actorId: Type.String({ minLength: 1 }),
  amount: Type.Integer({ minimum: 0 }),
  reason: Type.String({ minLength: 1 }),
});

const RESTORE_MANA_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("restore-mana"),
  actorId: Type.String({ minLength: 1 }),
  amount: Type.Integer({ minimum: 0 }),
  reason: Type.String({ minLength: 1 }),
});

const DAMAGE_SPIRITUAL_CORE_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("damage-spiritual-core"),
  actorId: Type.String({ minLength: 1 }),
  amount: Type.Integer({ minimum: 0 }),
  reason: Type.String({ minLength: 1 }),
});

const ADD_PARAM_MODIFIER_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-param-modifier"),
  actorId: Type.String({ minLength: 1 }),
  modifier: PARAM_MODIFIER_INPUT_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const CHANGE_CONTRACT_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("change-contract"),
  actorId: Type.String({ minLength: 1 }),
  contract: SERVANT_CONTRACT_STATE_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const ADD_PERMANENT_DEFECT_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-permanent-defect"),
  actorId: Type.String({ minLength: 1 }),
  defect: PERMANENT_DEFECT_INPUT_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export type ServantFormEvent =
  | Static<typeof SPEND_MANA_EVENT_SCHEMA>
  | Static<typeof RESTORE_MANA_EVENT_SCHEMA>
  | Static<typeof DAMAGE_SPIRITUAL_CORE_EVENT_SCHEMA>
  | Static<typeof ADD_PARAM_MODIFIER_EVENT_SCHEMA>
  | Static<typeof CHANGE_CONTRACT_EVENT_SCHEMA>
  | Static<typeof ADD_PERMANENT_DEFECT_EVENT_SCHEMA>;

const SERVANT_FORM_EVENT_KIND_VALIDATOR = Compile(SERVANT_FORM_EVENT_KIND_SCHEMA);
const SPEND_MANA_EVENT_VALIDATOR = Compile(SPEND_MANA_EVENT_SCHEMA);
const RESTORE_MANA_EVENT_VALIDATOR = Compile(RESTORE_MANA_EVENT_SCHEMA);
const DAMAGE_SPIRITUAL_CORE_EVENT_VALIDATOR = Compile(DAMAGE_SPIRITUAL_CORE_EVENT_SCHEMA);
const ADD_PARAM_MODIFIER_EVENT_VALIDATOR = Compile(ADD_PARAM_MODIFIER_EVENT_SCHEMA);
const CHANGE_CONTRACT_EVENT_VALIDATOR = Compile(CHANGE_CONTRACT_EVENT_SCHEMA);
const ADD_PERMANENT_DEFECT_EVENT_VALIDATOR = Compile(ADD_PERMANENT_DEFECT_EVENT_SCHEMA);

// Compile 必须在独立常量上调用（satisfies 上下文会干扰泛型推导）。
const SERVANT_FORM_EVENT_VARIANT_VALIDATORS = {
  "spend-mana": SPEND_MANA_EVENT_VALIDATOR,
  "restore-mana": RESTORE_MANA_EVENT_VALIDATOR,
  "damage-spiritual-core": DAMAGE_SPIRITUAL_CORE_EVENT_VALIDATOR,
  "add-param-modifier": ADD_PARAM_MODIFIER_EVENT_VALIDATOR,
  "change-contract": CHANGE_CONTRACT_EVENT_VALIDATOR,
  "add-permanent-defect": ADD_PERMANENT_DEFECT_EVENT_VALIDATOR,
} satisfies Record<ServantFormEvent["kind"], TypeBoxValidator<ServantFormEvent>>;

export function parseServantFormEvent(value: unknown, fieldName: string): ServantFormEvent {
  return parseTaggedTypeBoxUnion<ServantFormEvent["kind"], ServantFormEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    SERVANT_FORM_EVENT_KIND_VALIDATOR,
    SERVANT_FORM_EVENT_VARIANT_VALIDATORS,
  );
}
