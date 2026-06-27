// ---------------------------------------------------------------------------
// 技能消耗管理
// ---------------------------------------------------------------------------

import type { CombatantSnapshot, CostDef, CostType, SkillDef } from "./models.ts";

/** 消耗类型→六维属性字段名映射 */
const COST_TO_ATTRIBUTE: Record<CostType, keyof CombatantSnapshot["stats"]> = {
  currentVitality: "vitality",
  currentAgility: "agility",
  currentSpirit: "spirituality",
  currentSanity: "sanity",
  currentHumanity: "humanity",
};

/**
 * 检查施法者是否有足够资源释放技能。
 */
export function canAffordCost(
  caster: CombatantSnapshot,
  skill: SkillDef,
): { canAfford: boolean; message: string } {
  if (!skill.cost) {
    return { canAfford: true, message: "无消耗" };
  }
  return canAfford(caster, skill.cost);
}

function canAfford(
  caster: CombatantSnapshot,
  cost: CostDef,
): { canAfford: boolean; message: string } {
  const currentValue = getCurrentAttribute(caster, cost.type);
  if (currentValue < cost.amount) {
    return {
      canAfford: false,
      message: `${costName(cost.type)}不足：当前 ${currentValue}，需要 ${cost.amount}`,
    };
  }
  return { canAfford: true, message: "资源充足" };
}

/**
 * 扣除消耗，返回扣减后的值。
 * 函数式风格：不修改 caster，返回新值。
 */
export function deductCost(
  caster: CombatantSnapshot,
  skill: SkillDef,
): { newStats: CombatantSnapshot["stats"]; success: boolean; message: string } {
  if (!skill.cost) {
    return { newStats: { ...caster.stats }, success: true, message: "无消耗" };
  }

  const attr = COST_TO_ATTRIBUTE[skill.cost.type];
  if (!attr) {
    return {
      newStats: { ...caster.stats },
      success: false,
      message: `未知消耗类型: ${skill.cost.type}`,
    };
  }

  const currentValue = caster.stats[attr];
  const newValue = Math.max(0, currentValue - skill.cost.amount);

  return {
    newStats: { ...caster.stats, [attr]: newValue },
    success: true,
    message: `${costName(skill.cost.type)}: ${currentValue} → ${newValue}`,
  };
}

function getCurrentAttribute(caster: CombatantSnapshot, costType: CostType): number {
  const attr = COST_TO_ATTRIBUTE[costType];
  if (!attr) return 0;
  return caster.stats[attr] ?? 0;
}

function costName(type: CostType): string {
  const names: Record<CostType, string> = {
    currentVitality: "活力",
    currentAgility: "敏捷",
    currentSpirit: "灵性",
    currentSanity: "理智",
    currentHumanity: "人性",
  };
  return names[type] ?? type;
}
