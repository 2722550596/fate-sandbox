import type { Static } from "typebox";

import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { PURSE_ACCESS_SCHEMA, stringEnumSchema } from "../state/state-enum-schemas.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "../utils/typebox-validation.ts";

/**
 * Economy 领域事件的工具边界 schema：单一事实来源。
 * EconomyEvent / MoneyGainSource 类型由此派生（economy.ts re-export 原名）。
 */
export const MONEY_GAIN_SOURCES = [
  "earned",
  "refund",
  "found",
  "gift",
  "withdrawal",
  "sale",
  "quest-reward",
] as const;
export const MONEY_GAIN_SOURCE_SCHEMA = stringEnumSchema(MONEY_GAIN_SOURCES);
export type MoneyGainSource = Static<typeof MONEY_GAIN_SOURCE_SCHEMA>;

export const ECONOMY_EVENT_KINDS = [
  "spend-money",
  "gain-money",
  "add-purse",
  "update-purse",
  "add-debt",
  "resolve-debt",
] as const;
const ECONOMY_EVENT_KIND_SCHEMA = stringEnumSchema(ECONOMY_EVENT_KINDS);

const NON_NEGATIVE_AMOUNT_SCHEMA = Type.Integer({ minimum: 0 });

export const SPEND_MONEY_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("spend-money"),
  purseId: Type.Optional(Type.String({ minLength: 1 })),
  ownerActorId: Type.Optional(Type.String({ minLength: 1 })),
  amount: NON_NEGATIVE_AMOUNT_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export const GAIN_MONEY_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("gain-money"),
  purseId: Type.Optional(Type.String({ minLength: 1 })),
  ownerActorId: Type.Optional(Type.String({ minLength: 1 })),
  amount: NON_NEGATIVE_AMOUNT_SCHEMA,
  source: MONEY_GAIN_SOURCE_SCHEMA,
  counterparty: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export const ADD_PURSE_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-purse"),
  ownerActorId: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
  amount: NON_NEGATIVE_AMOUNT_SCHEMA,
  access: PURSE_ACCESS_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export const UPDATE_PURSE_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("update-purse"),
  purseId: Type.String({ minLength: 1 }),
  label: Type.Optional(Type.String({ minLength: 1 })),
  access: Type.Optional(PURSE_ACCESS_SCHEMA),
  reason: Type.String({ minLength: 1 }),
});

export const ADD_DEBT_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-debt"),
  debtorActorId: Type.String({ minLength: 1 }),
  creditor: Type.String({ minLength: 1 }),
  amount: NON_NEGATIVE_AMOUNT_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export const RESOLVE_DEBT_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("resolve-debt"),
  debtId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export type EconomyEvent =
  | Static<typeof SPEND_MONEY_EVENT_SCHEMA>
  | Static<typeof GAIN_MONEY_EVENT_SCHEMA>
  | Static<typeof ADD_PURSE_EVENT_SCHEMA>
  | Static<typeof UPDATE_PURSE_EVENT_SCHEMA>
  | Static<typeof ADD_DEBT_EVENT_SCHEMA>
  | Static<typeof RESOLVE_DEBT_EVENT_SCHEMA>;

const ECONOMY_EVENT_KIND_VALIDATOR = Compile(ECONOMY_EVENT_KIND_SCHEMA);
const SPEND_MONEY_EVENT_VALIDATOR = Compile(SPEND_MONEY_EVENT_SCHEMA);
const GAIN_MONEY_EVENT_VALIDATOR = Compile(GAIN_MONEY_EVENT_SCHEMA);
const ADD_PURSE_EVENT_VALIDATOR = Compile(ADD_PURSE_EVENT_SCHEMA);
const UPDATE_PURSE_EVENT_VALIDATOR = Compile(UPDATE_PURSE_EVENT_SCHEMA);
const ADD_DEBT_EVENT_VALIDATOR = Compile(ADD_DEBT_EVENT_SCHEMA);
const RESOLVE_DEBT_EVENT_VALIDATOR = Compile(RESOLVE_DEBT_EVENT_SCHEMA);

// 注意：Compile 必须在独立常量上调用，不能内联在带 satisfies 的对象字面量里——
// 上下文类型会干扰泛型推导，把 Validator 退化成 unknown。
const ECONOMY_EVENT_VARIANT_VALIDATORS = {
  "spend-money": SPEND_MONEY_EVENT_VALIDATOR,
  "gain-money": GAIN_MONEY_EVENT_VALIDATOR,
  "add-purse": ADD_PURSE_EVENT_VALIDATOR,
  "update-purse": UPDATE_PURSE_EVENT_VALIDATOR,
  "add-debt": ADD_DEBT_EVENT_VALIDATOR,
  "resolve-debt": RESOLVE_DEBT_EVENT_VALIDATOR,
} satisfies Record<EconomyEvent["kind"], TypeBoxValidator<EconomyEvent>>;

export function parseEconomyEvent(value: unknown, fieldName: string): EconomyEvent {
  return parseTaggedTypeBoxUnion<EconomyEvent["kind"], EconomyEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    ECONOMY_EVENT_KIND_VALIDATOR,
    ECONOMY_EVENT_VARIANT_VALIDATORS,
  );
}
