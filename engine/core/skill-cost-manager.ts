/**
 * 技能消耗类型。
 */
export type CostType =
  | "currentVitality"
  | "currentAgility"
  | "currentSpirituality"
  | "currentReason"
  | "currentHumanity";

/**
 * 技能消耗定义。
 */
export interface SkillCost {
  type: CostType;
  amount: number;
}

const ATTRIBUTE_DISPLAY: Record<CostType, string> = {
  currentVitality: "活力",
  currentAgility: "敏捷",
  currentSpirituality: "灵性",
  currentReason: "理智",
  currentHumanity: "人性",
};

/**
 * 检查施法者是否能承担技能消耗。
 */
export function canAfford(
  currentValues: Record<string, number>,
  cost: SkillCost | undefined | null,
): { canAfford: boolean; message: string } {
  if (!cost) {
    return { canAfford: true, message: "无消耗" };
  }
  const current = currentValues[cost.type] ?? 0;
  if (current < cost.amount) {
    const display = ATTRIBUTE_DISPLAY[cost.type] ?? cost.type;
    return {
      canAfford: false,
      message: `${display}不足，需要${cost.amount}，当前${current}`,
    };
  }
  return { canAfford: true, message: "资源充足" };
}

/**
 * 扣除技能消耗并返回变更。
 */
export function deductCost(
  currentValues: Record<string, number>,
  cost: SkillCost | undefined | null,
): { success: boolean; message: string; changes: Record<string, number> } {
  if (!cost) {
    return { success: true, message: "无消耗", changes: {} };
  }
  const check = canAfford(currentValues, cost);
  if (!check.canAfford) {
    return { success: false, message: check.message, changes: {} };
  }
  const oldValue = currentValues[cost.type] ?? 0;
  const newValue = Math.max(0, oldValue - cost.amount);
  const display = ATTRIBUTE_DISPLAY[cost.type] ?? cost.type;
  return {
    success: true,
    message: `消耗${cost.amount}点${display}`,
    changes: { [cost.type]: newValue },
  };
}
