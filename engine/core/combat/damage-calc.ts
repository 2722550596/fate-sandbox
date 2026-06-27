// ---------------------------------------------------------------------------
// 伤害计算
// 核心公式：
//   D = floor(max(0, Ω × P × (A/D) × R × (1 + M)))
//
// 其中：
//   Ω = divinity（神性）
//   P = skillPower（技能倍率，经序列映射解析）
//   A = computeAttack(...)
//   D = computeDefense(...)
//   R = random(0.9, 1.1)
//   M = attackerMod + defenderMod + tagMod
// ---------------------------------------------------------------------------

import type { DamageType } from "../state-enum-schemas.ts";
import type {
  CombatantSnapshot,
  DamageCalcResult,
  EffectInstance,
  SkillDef,
  TagDamageRelations,
  TagHealingRelations,
} from "./models.ts";

import { getDivinityValue } from "../../config/index.ts";
import { computeAttack, computeDefense } from "./attribute-calc.ts";
import { resolvePowerMap, sequenceRankToIndex } from "./sequence-utils.ts";

/**
 * 主伤害计算入口。
 *
 * @param attacker - 攻击方快照
 * @param defender - 防御方快照
 * @param skill - 技能定义
 * @param tagDamageRelations - 标签克制关系（可选）
 * @returns 伤害计算结果
 */
export function calcDamage(
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
  skill: SkillDef,
  tagDamageRelations?: TagDamageRelations,
): DamageCalcResult {
  const damageType = skill.damageType;

  // 自定义伤害计算器
  if (skill.customDamageCalculator) {
    return runCustomCalculator(attacker, defender, skill);
  }

  // 攻防计算
  const atk = computeAttack(attacker.stats, attacker.effects, damageType);
  const def = computeDefense(defender.stats, defender.effects, damageType);

  // 核心公式
  const atkDefRatio = def <= 0 ? atk : atk / def; // 防御=0时特判
  const divinity =
    attacker.divinity || getDivinityValue(sequenceRankToIndex(attacker.sequenceRank));
  const skillPower = resolvePowerMap(
    typeof skill.power === "object" ? skill.power : undefined,
    attacker.sequenceRank,
    typeof skill.power === "number" ? skill.power : 1.0,
  );

  const baseDamage = divinity * skillPower * atkDefRatio;

  // 随机浮动 ±10%
  const randomFactor = 0.9 + Math.random() * 0.2;
  let damage = baseDamage * randomFactor;

  // 伤害修正系数
  const attackerMod = calcDamageModifier(
    attacker.effects,
    "damageDealtIncrease",
    "damageDealtDecrease",
  );
  const defenderMod = calcDamageModifier(
    defender.effects,
    "damageTakenIncrease",
    "damageTakenDecrease",
  );
  const tagMod = calcTagDamageModifier(attacker, defender, skill, tagDamageRelations);

  const totalModifier = attackerMod + defenderMod + tagMod;
  damage = damage * (1 + totalModifier);

  const finalDamage = Math.max(0, Math.floor(damage));

  // 目标属性
  const targetAttribute = getTargetAttribute(damageType);

  const formula = `${damageType}伤害: 攻击=${atk}, 防御=${def}, 神性=${divinity}, 倍率=${skillPower} → ${finalDamage}`;

  return { damage: finalDamage, targetAttribute, formula };
}

// ===========================================================================
// 自定义伤害计算器
// ===========================================================================

function runCustomCalculator(
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
  skill: SkillDef,
): DamageCalcResult {
  const power = typeof skill.power === "number" ? skill.power : 1.0;
  const atk = computeAttack(attacker.stats, attacker.effects, "physical");

  let damage: number;
  switch (skill.customDamageCalculator) {
    case "fixedDamage":
      damage = power;
      break;
    case "percentDamage":
      damage = Math.max(1, Math.floor(defender.stats.vitality * power));
      break;
    case "trueDamage":
      damage = Math.max(1, Math.floor(atk * power));
      break;
    default:
      damage = 0;
  }

  return {
    damage: Math.max(0, damage),
    targetAttribute: "vitality",
    formula: `自定义(${skill.customDamageCalculator}): ${damage}`,
  };
}

// ===========================================================================
// 伤害修正系数
// ===========================================================================

/**
 * 计算伤害修正系数。
 * 只处理 valueType === "percentage" 的效果。
 */
function calcDamageModifier(
  effects: EffectInstance[],
  increaseStat: string,
  decreaseStat: string,
): number {
  let modifier = 0;

  for (const effect of effects) {
    if (effect.valueType !== "percentage") continue;

    if (effect.stat === increaseStat) {
      // 无论 buff/debuff，增加修正都是正方向
      modifier += effect.power / 100;
    }
    if (effect.stat === decreaseStat) {
      // 减少修正都是负方向
      modifier -= effect.power / 100;
    }
  }

  return modifier;
}

// ===========================================================================
// 标签克制
// ===========================================================================

function calcTagDamageModifier(
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
  _skill: SkillDef,
  relations?: TagDamageRelations,
): number {
  if (!relations || Object.keys(relations).length === 0) return 0;

  const attackerTags = attacker.tags.map((t) => t.name);
  const defenderTags = defender.tags.map((t) => t.name);

  let totalModifier = 0;
  for (const atkTag of attackerTags) {
    for (const defTag of defenderTags) {
      const mod = relations[atkTag]?.[defTag];
      if (mod !== undefined) {
        totalModifier += mod;
      }
    }
  }

  // 防爆封顶 -75% ~ +150%
  return clamp(totalModifier, -0.75, 1.5);
}

/**
 * 计算标签治疗修正。
 */
export function calcTagHealingModifier(
  _healer: CombatantSnapshot,
  _target: CombatantSnapshot,
  _relations?: TagHealingRelations,
): number {
  // 简化版：后续可以扩展
  return 0;
}

// ===========================================================================
// 工具函数
// ===========================================================================

/** 伤害类型 → 目标属性 */
export function getTargetAttribute(damageType: DamageType): "vitality" | "sanity" {
  return damageType === "mental" ? "sanity" : "vitality";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
