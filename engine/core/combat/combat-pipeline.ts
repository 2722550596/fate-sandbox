// ---------------------------------------------------------------------------
// 战斗执行管线
//
// 一次技能攻击的完整流程：
//   canAffordCost → evaluateConditionalParams → resolvePower
//   → calcDamage (or healing) → applySkillEffects → 返回结果
//
// 纯函数式：所有输入通过参数传入，所有输出通过返回值返回。
// 不修改输入对象（返回新的副本或计算结果）。
// ---------------------------------------------------------------------------

import type {
  CombatActionResult,
  CombatActionInput,
  CombatantSnapshot,
  EffectInstance,
  SkillDef,
} from "./models.ts";

import { evaluateConditionalParams } from "./condition-eval.ts";
import { canAffordCost, deductCost } from "./cost-manager.ts";
import { calcDamage, calcTagHealingModifier } from "./damage-calc.ts";
import { applySkillEffects } from "./effect-manager.ts";
import { resolvePowerMap } from "./sequence-utils.ts";

/**
 * 执行一次完整的技能攻击。
 *
 * @param input - 战斗输入（攻方、防方、技能、标签克制关系、随机种子）
 * @returns 攻击结果
 */
export function executeCombatAction(input: CombatActionInput): CombatActionResult {
  const { attacker, defender, skill, tagDamageRelations } = input;

  // 1. 检查消耗
  const costCheck = canAffordCost(attacker, skill);
  if (!costCheck.canAfford) {
    return {
      canAfford: false,
      costMessage: costCheck.message,
      damage: 0,
      targetAttribute: "vitality",
      appliedEffects: [],
      formula: "",
      details: `消耗不足：${costCheck.message}`,
    };
  }

  // 2. 评估条件参数，合并到技能
  const conditionalOverride = evaluateConditionalParams(
    skill,
    attacker,
    defender,
    input.randomValue,
  );
  const effectiveSkill = applyOverride(skill, conditionalOverride);

  // 3. 扣除消耗（返回新 stats）
  const costDeduction = deductCost(attacker, effectiveSkill);
  const updatedAttacker: CombatantSnapshot = {
    ...attacker,
    stats: costDeduction.newStats,
  };

  // 4. 判断是否治疗
  if (effectiveSkill.isHeal) {
    return executeHeal(
      updatedAttacker,
      defender,
      effectiveSkill,
      tagDamageRelations,
      costDeduction.message,
    );
  }

  // 5. 计算伤害
  const damageResult = calcDamage(updatedAttacker, defender, effectiveSkill, tagDamageRelations);

  // 6. 应用技能效果到目标
  const { effects: newDefenderEffects, logs: effectLogs } = applySkillEffects(
    defender,
    effectiveSkill,
    updatedAttacker,
  );

  const uniqueEffects = dedupeEffects(newDefenderEffects);

  const details = [damageResult.formula, costDeduction.message, ...effectLogs].join(" | ");

  return {
    canAfford: true,
    costMessage: costDeduction.message,
    damage: damageResult.damage,
    targetAttribute: damageResult.targetAttribute,
    appliedEffects: uniqueEffects,
    formula: damageResult.formula,
    details,
  };
}

// ===========================================================================
// 治疗分支
// ===========================================================================

function executeHeal(
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
  skill: SkillDef,
  tagDamageRelations: Record<string, Record<string, number>> | undefined,
  costMessage: string,
): CombatActionResult {
  const healAmt = resolvePowerMap(
    typeof skill.healAmt === "object" ? skill.healAmt : undefined,
    attacker.sequenceRank,
    typeof skill.healAmt === "number" ? skill.healAmt : 0,
  );

  const maxValue = defender.stats.vitality;
  const currentValue = defender.stats.vitality;

  let rawHeal: number;
  if (skill.healValueType === "fixed") {
    rawHeal = healAmt;
  } else {
    rawHeal = Math.floor(maxValue * healAmt);
  }

  const tagMod = calcTagHealingModifier(attacker, defender, tagDamageRelations);
  rawHeal = Math.max(0, Math.floor(rawHeal * (1 + tagMod)));

  const actualHeal = Math.min(rawHeal, maxValue - currentValue);

  const { effects: newEffects } = applySkillEffects(defender, skill, attacker);
  const uniqueEffects = dedupeEffects(newEffects);

  const formula = `治疗: 基础=${rawHeal}, 实际=${actualHeal}（${defender.name} 活力 ${currentValue} → ${currentValue + actualHeal}）`;

  return {
    canAfford: true,
    costMessage,
    damage: -actualHeal,
    targetAttribute: "vitality",
    appliedEffects: uniqueEffects,
    formula,
    details: `${formula} | ${costMessage}`,
  };
}

// ===========================================================================
// 条件参数合并
// ===========================================================================

function applyOverride(skill: SkillDef, override: Partial<SkillDef>): SkillDef {
  if (Object.keys(override).length === 0) return skill;

  return {
    ...skill,
    ...override,
    effects: override.effects ?? skill.effects,
    conditionalParams: [],
  };
}

// ===========================================================================
// 工具
// ===========================================================================

/** 按 name 去重（保留第一次出现的） */
function dedupeEffects(effects: EffectInstance[]): EffectInstance[] {
  const seen = new Set<string>();
  return effects.filter((e) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });
}
