// ---------------------------------------------------------------------------
// Stats 重新计算工具
//
// 核心函数 recalculateMaxStats：
//   base + buff/debuff 修正 → 更新 max
//   同时钳制 current ≤ max
//
// 移植自原始 AttributeCalculator.recalculateAllSixDimStats()
// ---------------------------------------------------------------------------

import type { CharacterStats, EquipmentSlots, StatusEffectState } from "./state.ts";

/** 受 buff/debuff 影响的六维属性名 */
const SIX_DIM_KEYS = [
  "vitality",
  "agility",
  "spirituality",
  "sanity",
  "humanity",
] as const;


/**
 * 根据 base 值和当前 status effects 重新计算 max（上限），
 * 并确保 current（当前值）不超过新的 max。
 *
 * 计算规则（逐维）：
 *   1. 收集所有 type=buff 或 type=debuff 且 affectedAttribute 为该维度的效果
 *   2. percentage 修正叠加：modifier += power (buff) 或 modifier -= power (debuff)
 *   3. fixed 修正叠加：modifier += power (buff) 或 modifier -= power (debuff)
 *   4. max = floor(base × (1 + percentageModifier) + fixedModifier)
 *   5. clamp: max ≥ 0
 *
 * luck 不受效果影响：max 始终等于 base，current 不变。
 *
 * @param stats 当前角色的 stats（会被原地修改）
 * @param statusEffects actor 身上的 statusEffects 列表
 */
export function recalculateMaxStats(
  stats: CharacterStats,
  statusEffects: readonly StatusEffectState[],
  equipment?: EquipmentSlots,
): void {
  for (const key of SIX_DIM_KEYS) {
    const baseValue = stats.base[key];
    let percentageModifier = 0;
    let fixedModifier = 0;

    for (const effect of statusEffects) {
      if (effect.affectedAttribute !== key) continue;
      if (effect.type !== "buff" && effect.type !== "debuff") continue;

      if (effect.valueType === "percentage") {
        percentageModifier += effect.type === "buff" ? effect.value / 100 : -(effect.value / 100);
      } else {
        fixedModifier += effect.type === "buff" ? effect.value : -effect.value;
      }
    }

    const newMax = Math.max(0, Math.floor(baseValue * (1 + percentageModifier) + fixedModifier));
    stats.max[key] = newMax;

    // 钳制 current
    if (stats.current[key] > newMax) {
      stats.current[key] = newMax;
    }
  }

  // luck 不受效果影响
  stats.max.luck = stats.base.luck;

  // 叠加装备加成
  if (equipment) {
    applyEquipmentModifiers(stats, equipment);
  }
}

/**
 * 将装备栏中所有已装备物品的 modifiers 叠加到 stats.max。
 */
function applyEquipmentModifiers(
  stats: CharacterStats,
  equipment: EquipmentSlots,
): void {
  const allSlots = [
    equipment.weapon,
    equipment.clothing,
    equipment.accessory,
    equipment.sealedArtifact,
  ];

  for (const slot of allSlots) {
    if (slot === null) continue;
    const mod = slot.modifiers;
    stats.max.vitality += mod.vitality;
    stats.max.agility += mod.agility;
    stats.max.spirituality += mod.spirituality;
    stats.max.sanity += mod.sanity;
    stats.max.humanity += mod.humanity;
    stats.max.luck += mod.luck;
  }

  // 钳制 current
  for (const key of ["vitality", "agility", "spirituality", "sanity", "humanity", "luck"] as const) {
    if (stats.current[key] > stats.max[key]) {
      stats.current[key] = stats.max[key];
    }
  }
}