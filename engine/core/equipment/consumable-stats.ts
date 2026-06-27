// ---------------------------------------------------------------------------
// 消耗品属性生成
//
// 根据消耗品类型（符咒/药品/子弹/卷轴/神性/其他）和效果（杀伤/恢复/增益），
// 计算消耗品的属性修正、伤害加成、消耗代价。
//
// 移植自 original.js 的 generateConsumableStats 和 calculateCorruptionBacklash
// ---------------------------------------------------------------------------

import { consumableConfig } from "../../config/index.ts";

// ===========================================================================
// 消耗品属性生成
// ===========================================================================

export interface ConsumableStatsResult {
  /** 受影响属性的变化量（key=英文属性名，如 vitality/spirituality） */
  statChanges: Record<string, number>;
  /** 伤害加成（杀伤型专属） */
  damageBonus?: number;
  /** 消耗的驱动属性（如 spirituality） */
  sourceAttribute: string;
  /** 消耗量 */
  sourceCost: number;
}

/**
 * 生成消耗品的属性数据。
 *
 * @param baseValue  消耗品序列等级对应的总基准值
 * @param type       消耗品类型：符咒/药品/子弹/卷轴/神性/其他
 * @param effect     效果：杀伤/恢复/增益
 * @param targetStat 作用属性（英文，如 vitality/agility 或 "all"）
 */
export function generateConsumableStats(
  baseValue: number,
  type: string,
  effect: string,
  targetStat?: string,
): ConsumableStatsResult {
  const safeType = String(type || "");
  const safeEffect = String(effect || "");

  // 类型识别
  let typeKey = "其他";
  if (typeof consumableConfig !== "undefined") {
    for (const key of Object.keys(consumableConfig)) {
      if (safeType.includes(key)) {
        typeKey = key;
        break;
      }
    }
  }

  const config = consumableConfig[typeKey] ?? {
    powerRatio: 1,
    costRatio: 0.5,
    defaultCost: "spirituality",
  };

  const randomFactor = () => 0.8 + Math.random() * 0.4;
  const rawPower = Math.round(baseValue * config.powerRatio * randomFactor());
  const rawCost = Math.round(baseValue * config.costRatio * randomFactor());

  const defaultCost = mapChineseAttrToEnglish(config.defaultCost);
  const statChanges: Record<string, number> = {};
  let damageBonus: number | undefined;

  // 辅助：累加属性（全属性处理）
  const addStat = (attrKey: string, value: number) => {
    if (attrKey === "all" || attrKey === "全属性") {
      const dims = ["vitality", "agility", "spirituality", "sanity", "humanity"];
      for (const dim of dims) {
        statChanges[dim] = (statChanges[dim] ?? 0) + Math.round(value / 3);
      }
      statChanges["luck"] = (statChanges["luck"] ?? 0) + Math.round(value / 3);
    } else {
      const engKey = mapChineseAttrToEnglish(attrKey);
      statChanges[engKey] = (statChanges[engKey] ?? 0) + value;
    }
  };

  // 副作用属性判断
  const safeTargetStat = targetStat ?? "";
  const healTarget = safeTargetStat !== "" ? safeTargetStat : "vitality";

  if (safeEffect.includes("杀伤") || safeEffect.includes("攻击")) {
    addStat(defaultCost, -rawCost);
    damageBonus = rawPower;
  } else if (safeEffect.includes("恢复") || safeEffect.includes("治疗")) {
    addStat(healTarget, rawPower);
    // 药三分毒
    const sideEffectAttr = safeType.includes("药品") ? "sanity" : "humanity";
    addStat(sideEffectAttr, -Math.ceil(rawCost * 0.5));
  } else if (safeEffect.includes("增益") || safeEffect.includes("强化")) {
    const buffTarget = safeTargetStat !== "" ? safeTargetStat : "agility";
    addStat(buffTarget, Math.round(rawPower * 0.6));
    addStat(defaultCost, -rawCost);
  } else {
    addStat("spirituality", -rawCost);
  }

  return {
    statChanges,
    damageBonus,
    sourceAttribute: defaultCost,
    sourceCost: rawCost,
  };
}

// ===========================================================================
// 失控反噬
// ===========================================================================

/**
 * 计算使用消耗品时的失控值增加。
 * 序列数字越小，位格越高。
 *
 * @param playerRankIndex 玩家序列等级索引（seq-9→9, seq-0→0, pillar→-2）
 * @param itemRankIndex   消耗品序列等级索引
 * @param itemType        消耗品类型（用于反噬倍率）
 * @returns 失控值增加量（0~50）
 */
export function calculateCorruptionBacklash(
  playerRankIndex: number,
  itemRankIndex: number,
  itemType: string,
): number {
  const rankDiff = playerRankIndex - itemRankIndex;
  // 未越级或仅越1级，无失控惩罚
  if (rankDiff < 2) return 0;

  // 根据消耗品类型找反噬倍率
  let typeKey = "其他";
  for (const key of Object.keys(consumableConfig)) {
    if (itemType.includes(key)) {
      typeKey = key;
      break;
    }
  }
  const config = consumableConfig[typeKey];

  const backlashMult = config?.backlashMult ?? 1.0;
  const increase = Math.ceil((rankDiff - 1) * 5 * backlashMult);
  return Math.min(increase, 50);
}

// ===========================================================================
// 中英文属性名映射
// ===========================================================================

const CN_TO_EN: Record<string, string> = {
  活力: "vitality",
  敏捷: "agility",
  灵性: "spirituality",
  理智: "sanity",
  人性: "humanity",
  运气: "luck",
  所有属性: "all",
  全属性: "all",
};

function mapChineseAttrToEnglish(name: string): string {
  return CN_TO_EN[name] ?? name;
}
