// ---------------------------------------------------------------------------
// 装备属性生成器
//
// 移植自 original.js 的 generateItemStats。
// 根据装备类型、序列名、特质，为装备生成六维属性加成。
//
// 核心流程：
//   装备 baseValue（序列总值）→ 正负总额 → 按权重分配到六维
// ---------------------------------------------------------------------------

import type { StatsValues } from "../state/state.ts";

import { itemConfig, traitDB, sequenceWeights } from "../../config/index.ts";

// ===========================================================================
// 输入/输出
// ===========================================================================

export interface GenerateItemStatsInput {
  /** 装备 baseValue（来自该装备的序列等级对应的总值，如序列基准.json["9"]=300） */
  baseValue: number;
  /** 装备类型：武器 / 衣物 / 饰品 / 封印物 */
  itemType: string;
  /** 装备名称（可选，用于类型自动识别兜底） */
  itemName?: string;
  /** 序列名（可选，若提供则用该序列的权重覆盖装备默认 pW） */
  sequenceName?: string;
  /** 特质名（可选） */
  trait?: string;
  /** 随机种子 [0, 1)（可选，不传使用 Math.random） */
  randomValue?: number;
}

/** 装备生成的六维属性加成（可直接叠加到 actor.stats.max） */
export type ItemStatModifiers = StatsValues;

// ===========================================================================
// 主入口
// ===========================================================================

export function generateItemStats(input: GenerateItemStatsInput): ItemStatModifiers {
  const { baseValue, itemType, itemName = "", sequenceName, trait = "", randomValue } = input;

  // 1. 类型识别
  const typeKey = resolveItemType(itemType, itemName);
  const config = itemConfig[typeKey] ?? itemConfig["封印物"]!;
  const isSealed = typeKey === "封印物";

  const rand = makeRng(randomValue);

  // 2. 提取特质与权重
  const activeTrait = traitDB[trait] ?? traitDB["空"]!;
  // 有序列名时用序列权重覆盖装备默认 pW
  const baseWeights =
    sequenceName && sequenceWeights[sequenceName]
      ? [...sequenceWeights[sequenceName]]
      : [...config.pW];

  // 3. 正负总额
  const pBase = baseValue * rand.range(config.p[0], config.p[1]);
  const nBase = pBase * rand.range(config.n[0], config.n[1]);
  const pSum = pBase * activeTrait.p_boost;
  const nSum = nBase * activeTrait.n_boost;

  // 4. 构建权重矩阵
  const pWeights = baseWeights.map((w, i) => {
    let finalW = w * (1 + activeTrait.M[i]!) + activeTrait.A[i]!;
    finalW = Math.max(0.1, finalW);
    return finalW * rand.range(0.8, 1.2);
  });

  const nWeights = buildNegativeWeights(activeTrait.n_bias, rand);

  // 5. 执行分配
  const pStats = allocatePool(pSum, pWeights, !isSealed);
  const nStats = allocatePool(nSum, nWeights, !isSealed);

  // 6. 返回六维加成（顺序：vitality, agility, spirituality, sanity, humanity, luck）
  return {
    vitality: Math.round(pStats[0]! - nStats[0]!),
    agility: Math.round(pStats[1]! - nStats[1]!),
    spirituality: Math.round(pStats[2]! - nStats[2]!),
    sanity: Math.round(pStats[3]! - nStats[3]!),
    humanity: Math.round(pStats[4]! - nStats[4]!),
    luck: Math.round(pStats[5]! - nStats[5]!),
  };
}

// ===========================================================================
// 辅助
// ===========================================================================

/** 根据类型和名称确定装备类别 */
function resolveItemType(itemType: string, itemName: string): string {
  const typeStr = (itemType + itemName).toLowerCase();
  if (
    typeStr.includes("武器") ||
    typeStr.includes("剑") ||
    typeStr.includes("枪") ||
    typeStr.includes("刀")
  ) {
    return "武器";
  }
  if (typeStr.includes("衣") || typeStr.includes("甲") || typeStr.includes("袍")) {
    return "衣物";
  }
  if (typeStr.includes("饰品") || typeStr.includes("环") || typeStr.includes("链")) {
    return "饰品";
  }
  return "封印物";
}

/** 构建负面分配权重 */
function buildNegativeWeights(nBias: number[], rand: ReturnType<typeof makeRng>): number[] {
  const weights = [0, 0, 0, 0, 0, 0];
  if (nBias.length > 0) {
    for (const idx of nBias) {
      weights[idx] = rand.range(5, 10);
    }
    for (let i = 0; i < 6; i++) {
      if (weights[i] === 0) weights[i] = rand.range(0.1, 1);
    }
  } else {
    const penaltyCount = Math.floor(rand.value() * 3) + 1;
    const indices = [0, 1, 2, 3, 4, 5].sort(() => rand.value() - 0.5).slice(0, penaltyCount);
    for (const idx of indices) {
      weights[idx] = rand.range(2, 5);
    }
  }
  return weights;
}

/**
 * 精确分配引擎。
 * 按权重将 totalPool 分配到 6 个槽位。
 * 每项不超过总池的 50%，溢出重新分配。
 */
function allocatePool(totalPool: number, weights: number[], applyCap: boolean): number[] {
  const result = [0, 0, 0, 0, 0, 0];
  let remaining = totalPool;
  const active = new Set([0, 1, 2, 3, 4, 5]);
  const maxCap = totalPool * 0.5;

  if (weights.reduce((a, b) => a + b, 0) === 0) return result;

  let guard = 0;
  while (remaining > 0.5 && active.size > 0 && guard < 20) {
    guard++;
    let sumW = 0;
    for (const i of active) sumW += weights[i]!;
    if (sumW <= 0) break;

    const tempAlloc: Record<number, number> = {};
    const overCap: number[] = [];

    for (const i of active) {
      const w = weights[i]!;
      const r = result[i]!;
      let alloc = (w / sumW) * remaining;
      if (applyCap && r + alloc > maxCap) {
        tempAlloc[i] = maxCap - r;
        overCap.push(i);
      } else {
        tempAlloc[i] = alloc;
      }
    }

    let distributed = 0;
    for (const i of active) {
      const ta = tempAlloc[i]!;
      result[i]! += ta;
      distributed += ta;
    }

    remaining -= distributed;
    for (const i of overCap) active.delete(i);
  }

  return result;
}

// ===========================================================================
// 简易 RNG（种子可选）
// ===========================================================================

function makeRng(seed?: number) {
  let state = seed ?? Math.random();
  const next = (): number => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  return {
    value: next,
    range: (min: number, max: number): number => min + next() * (max - min),
  };
}
