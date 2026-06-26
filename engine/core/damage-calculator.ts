import type { AttributeSnapshot } from "./attribute-calculator.ts";
import type { DamageType } from "./state-enum-schemas.ts";

import { calculateAttack, calculateDefense, getTargetAttribute } from "./attribute-calculator.ts";

export interface DamageParams {
  attackerStats: AttributeSnapshot;
  defenderStats: AttributeSnapshot;
  damageType: DamageType;
  skillPower: number;
  divinity: number;
  luck: number;
}

export interface DamageResult {
  damage: number;
  targetAttribute: "currentVitality" | "currentReason";
  formula: string;
}

/**
 * 计算伤害（含随机浮动 0.9~1.1）。
 * 使用 LOTM 原始 battle-engine 公式 + 神性修正。
 */
export function calculateDamage(params: DamageParams): DamageResult {
  const attack = calculateAttack(params.attackerStats, params.damageType);
  const defense = calculateDefense(params.defenderStats, params.damageType);
  const ratio = defense > 0 ? attack / defense : 1;
  const baseDamage = params.divinity * params.skillPower * ratio;
  const randomFactor = 0.9 + Math.random() * 0.2;
  const damage = Math.max(0, Math.floor(baseDamage * randomFactor));
  const targetAttr = getTargetAttribute(params.damageType);
  const attrKey = targetAttr === "currentReason" ? "currentReason" : "currentVitality";

  return {
    damage,
    targetAttribute: attrKey,
    formula: `攻击=${attack} 防御=${defense} 神性=${params.divinity} 倍率=${params.skillPower} 类型=${params.damageType} → 伤害=${damage}`,
  };
}

/**
 * 计算治疗量。
 */
export function calculateHealing(
  healerStats: AttributeSnapshot,
  healAmount: number,
  healType: "vitality" | "reason" = "vitality",
): { amount: number; attribute: string; oldValue: number; newValue: number } {
  const baseKey = healType;
  const maxValue: number = healerStats[baseKey] ?? 100;
  const attrLookup: Record<string, number> = {
    currentVitality: healerStats.currentVitality,
    currentReason: healerStats.currentReason,
  };
  const currentKey = `current${healType.charAt(0).toUpperCase() + healType.slice(1)}`;
  const oldValue: number = attrLookup[currentKey] ?? 0;
  const newValue = Math.min(maxValue, oldValue + healAmount);
  return { amount: newValue - oldValue, attribute: currentKey, oldValue, newValue };
}
