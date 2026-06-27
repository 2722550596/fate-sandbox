// ---------------------------------------------------------------------------
// 攻击力/防御力计算
// 公式：base = specific × 0.4 + maxStat × 0.6
//       最终 = floor(max(0, base × (1 + percentage修正) + fixed修正))
// ---------------------------------------------------------------------------

import type { DamageType } from "../state/state-enum-schemas.ts";
import type { EffectInstance, SixDimStats } from "./models.ts";

/**
 * 计算攻击力。
 * 使用**当前值**做基础计算，不受 effects 影响。
 * effects 的 buff/debuff 通过 applyBuffDebuff 叠加修正。
 */
export function computeAttack(
  stats: SixDimStats,
  effects: EffectInstance[],
  damageType: DamageType,
): number {
  const specific = getSpecificAttribute(stats, damageType);
  const maxStat = Math.max(
    stats.vitality,
    stats.agility,
    stats.spirituality,
    stats.sanity,
    stats.humanity,
    stats.luck,
  );
  const base = Math.floor(specific * 0.4 + maxStat * 0.6);
  return applyBuffDebuff(effects, "attack", base);
}

/**
 * 计算防御力。结构与 computeAttack 一致。
 */
export function computeDefense(
  stats: SixDimStats,
  effects: EffectInstance[],
  damageType: DamageType,
): number {
  const specific = getSpecificAttribute(stats, damageType);
  const maxStat = Math.max(
    stats.vitality,
    stats.agility,
    stats.spirituality,
    stats.sanity,
    stats.humanity,
    stats.luck,
  );
  const base = Math.floor(specific * 0.4 + maxStat * 0.6);
  return applyBuffDebuff(effects, "defense", base);
}

/** 根据伤害类型选择「专精属性」 */
function getSpecificAttribute(stats: SixDimStats, damageType: DamageType): number {
  switch (damageType) {
    case "physical":
      return (stats.vitality + stats.agility) / 2;
    case "mystical":
      return stats.spirituality;
    case "mental":
      return (stats.sanity + stats.humanity) / 2;
    case "mixed":
      return stats.luck;
    default:
      return (stats.vitality + stats.agility) / 2;
  }
}

/**
 * 对基础值施加 buff/debuff 修正。
 *
 * 流程：base → 百分比修正叠加 → 固定值修正叠加 → floor → clamp ≥ 0
 */
export function applyBuffDebuff(
  effects: EffectInstance[],
  statName: string,
  baseValue: number,
): number {
  let percentageTotal = 0;
  let fixedTotal = 0;

  for (const effect of effects) {
    if (effect.stat !== statName) continue;

    if (effect.valueType === "percentage") {
      const sign = effect.type === "buff" ? 1 : -1;
      percentageTotal += sign * (effect.power / 100);
    } else if (effect.valueType === "fixed") {
      const sign = effect.type === "buff" ? 1 : -1;
      fixedTotal += sign * effect.power;
    }
  }

  return Math.max(0, Math.floor(baseValue * (1 + percentageTotal) + fixedTotal));
}

/**
 * 从战斗单位快照中提取六维属性当前值，用于攻防计算。
 */
export function statsToSnapshot(stats: SixDimStats): SixDimStats {
  return { ...stats };
}
