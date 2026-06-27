// ---------------------------------------------------------------------------
// LOTM 序列等级比较系统
//
// LOTM 的序列等级是线性的：
//   pillar(-2) > old-one(-1) > seq-0(0) > seq-1(1) > ... > seq-9(9) > ordinary(10)
//
// 没有 Fate 的 +/++/+++ 或 - 修饰。
// 等级差直接用索引差计算。
// ---------------------------------------------------------------------------

import type { SequenceRank } from "./state/state-enum-schemas.ts";

// ===========================================================================
// 类型定义
// ===========================================================================

export type LOTMRankComparisonBand =
  | "same-tier" // 同级
  | "edge" // 半级差（装备补正）
  | "advantage" // 一级优势
  | "overwhelming" // 两级以上压制
  | "off-scale"; // 规格外（理论上LOTM没有，保留兼容）

export interface LOTMRankSide {
  rank: SequenceRank;
  index: number; // 数字索引：pillar=-2, ordinary=10
  baselineValue: number; // 基准值 = 根据索引映射的值
}

export interface LOTMRankComparison {
  left: LOTMRankSide;
  right: LOTMRankSide;
  baselineTierDelta: number; // 左 - 右
  band: LOTMRankComparisonBand;
  narrative: string;
}

// ===========================================================================
// 序列等级索引映射
// ===========================================================================

const RANK_ORDER: Record<SequenceRank, number> = {
  pillar: -2,
  "old-one": -1,
  "seq-0": 0,
  "seq-1": 1,
  "seq-2": 2,
  "seq-3": 3,
  "seq-4": 4,
  "seq-5": 5,
  "seq-6": 6,
  "seq-7": 7,
  "seq-8": 8,
  "seq-9": 9,
  ordinary: 10,
};

// ===========================================================================
// 核心比较函数
// ===========================================================================

export function compareLOTMRanks(left: SequenceRank, right: SequenceRank): LOTMRankComparison {
  const leftSide = lotmRankSide(left);
  const rightSide = lotmRankSide(right);

  const baselineTierDelta = leftSide.index - rightSide.index;
  const band = comparisonBand(baselineTierDelta);

  return {
    left: leftSide,
    right: rightSide,
    baselineTierDelta,
    band,
    narrative: comparisonNarrative(band, baselineTierDelta, leftSide, rightSide),
  };
}

export function lotmRankSide(rank: SequenceRank): LOTMRankSide {
  const index = RANK_ORDER[rank];
  if (index === undefined) {
    throw new Error(`未知序列等级: ${rank}`);
  }
  // 基准值 = (10 - index) * 10 倒序，使高序列值更大
  // pillar(-2) = 120, old-one(-1) = 110, seq-0(0) = 100, ..., ordinary(10) = 0
  const baselineValue = (10 - index) * 10;
  return { rank, index, baselineValue };
}

// ===========================================================================
// 辅助函数
// ===========================================================================

function comparisonBand(baselineTierDelta: number): LOTMRankComparisonBand {
  const absoluteDelta = Math.abs(baselineTierDelta);
  if (absoluteDelta >= 2) return "overwhelming";
  if (absoluteDelta >= 1) return "advantage";
  if (absoluteDelta >= 0.5) return "edge"; // 装备补正导致的半级差
  return "same-tier";
}

function comparisonNarrative(
  band: LOTMRankComparisonBand,
  baselineTierDelta: number,
  _left: LOTMRankSide,
  _right: LOTMRankSide,
): string {
  const direction = baselineTierDelta >= 0 ? "左侧" : "右侧";
  switch (band) {
    case "overwhelming":
      return `${direction}形成两级以上序列压制；高位格者除非相性克制、代价巨大或主动保留，否则默认碾压。`;
    case "advantage":
      return `${direction}有一个序列等级优势；高位格者进入主动压制区间。`;
    case "edge":
      return `双方序列同级；装备或环境因素带来半级差异。`;
    case "same-tier":
      return `双方序列同级；结果应由技能、环境、准备与代价决定。`;
    case "off-scale":
      return `规格外等级，不在常规序列标尺上。`;
    default:
      return `未知等级差区间：${String(band)}`;
  }
}

// ===========================================================================
// 等级差异的数值映射（用于战斗之外的场合，如影响检定 DC）
// ===========================================================================

/**
 * 获取序列等级的数值，用于非战斗场合的简单比较。
 * 数值越大表示序列越高（越强）。
 */
export function lotmRankValue(rank: SequenceRank): number {
  return RANK_ORDER[rank] ?? 10;
}

/**
 * 判断序列等级是否高于另一个。
 */
export function isLOTMRankHigher(a: SequenceRank, b: SequenceRank): boolean {
  return lotmRankValue(a) < lotmRankValue(b);
}

/**
 * 获取两个序列等级的差值（a 比 b 高多少级）。
 * 正值表示 a 更高（序列索引更小）。
 */
export function lotmRankDelta(a: SequenceRank, b: SequenceRank): number {
  return lotmRankValue(b) - lotmRankValue(a);
}
