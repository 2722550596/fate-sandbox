import type { Static } from "typebox";

import type { CombatExchangeInput } from "./combat-exchange.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { FATE_PARAM_KEY_SCHEMA, stringEnumSchema } from "./state-enum-schemas.ts";
import { parseTypeBoxValue, trimStringsDeep } from "./typebox-validation.ts";

/**
 * resolve_combat_exchange 工具边界 schema：单一事实来源。
 * 枚举类型由此派生（combat-exchange.ts re-export 原名）。
 *
 * swing 保持 Optional 且无默认值：缺省时由工具层随机掷骰
 * （rollCombatSwing），引擎内部再兜底 neutral。
 */
export const COMBAT_TACTICS = [
  "direct-attack",
  "defense",
  "escape",
  "protect",
  "probe",
  "break-restraint",
  "noble-phantasm",
  "support",
] as const;
export const COMBAT_TACTIC_SCHEMA = stringEnumSchema(COMBAT_TACTICS);
export type CombatExchangeTactic = Static<typeof COMBAT_TACTIC_SCHEMA>;

export const COMBAT_RISK_TOLERANCES = ["low", "medium", "high", "desperate"] as const;
export const COMBAT_RISK_TOLERANCE_SCHEMA = stringEnumSchema(COMBAT_RISK_TOLERANCES);
export type CombatRiskTolerance = Static<typeof COMBAT_RISK_TOLERANCE_SCHEMA>;

export const COMBAT_SWINGS = ["bad-break", "pressure", "neutral", "opening", "turnabout"] as const;
export const COMBAT_SWING_SCHEMA = stringEnumSchema(COMBAT_SWINGS);
export type CombatSwing = Static<typeof COMBAT_SWING_SCHEMA>;

export const COMBAT_EXCHANGE_INPUT_SCHEMA = Type.Object({
  actorId: Type.String({ minLength: 1 }),
  opponentId: Type.String({ minLength: 1 }),
  intent: Type.String({ minLength: 1 }),
  tactic: COMBAT_TACTIC_SCHEMA,
  actorParameter: FATE_PARAM_KEY_SCHEMA,
  opponentParameter: FATE_PARAM_KEY_SCHEMA,
  actorNoblePhantasmName: Type.Optional(Type.String({ minLength: 1 })),
  opponentNoblePhantasmName: Type.Optional(Type.String({ minLength: 1 })),
  targetObjective: Type.Optional(Type.String({ minLength: 1 })),
  committedResources: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  knownAdvantages: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  knownDisadvantages: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  riskTolerance: COMBAT_RISK_TOLERANCE_SCHEMA,
  swing: Type.Optional(COMBAT_SWING_SCHEMA),
});

const COMBAT_EXCHANGE_INPUT_VALIDATOR = Compile(COMBAT_EXCHANGE_INPUT_SCHEMA);

/** "none"/"无" 等占位写法不算有效战场因素——领域归一化，不是校验。 */
const EMPTY_FACTOR_MARKERS = new Set(["none", "无", "n/a", "null"]);

export function parseCombatExchangeInput(value: unknown, fieldName: string): CombatExchangeInput {
  const parsed = parseTypeBoxValue(
    trimStringsDeep(value),
    fieldName,
    COMBAT_EXCHANGE_INPUT_VALIDATOR,
  );
  return {
    ...parsed,
    committedResources: meaningfulFactors(parsed.committedResources),
    knownAdvantages: meaningfulFactors(parsed.knownAdvantages),
    knownDisadvantages: meaningfulFactors(parsed.knownDisadvantages),
  };
}

function meaningfulFactors(factors: readonly string[] | undefined): string[] {
  if (factors === undefined) {
    return [];
  }
  return factors.filter((factor) => !EMPTY_FACTOR_MARKERS.has(factor.toLowerCase()));
}
