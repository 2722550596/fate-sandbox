// ---------------------------------------------------------------------------
// LOTM 序列等级比较系统
//
// LOTM 的序列等级按层划分，层内差异小，层间差异巨大：
//   普通人(ordinary=0) → 低序列(seq-9/8=0.5/1) → 中序列(seq-7/6/5=4/4.5/5)
//   → 圣者(seq-4/3=8/8.5) → 天使(seq-2/1=12/12.5)
//   → 真神(seq-0=16) → 旧日(old-one=20) → 支柱(pillar=24)
//
// 层次阶跃倍率约为 6-8x（低→中差3，圣者→天使差3.5，旧日→支柱差4）。
// 等级差直接用 power value 的差计算，高值 = 强。
// ---------------------------------------------------------------------------

import type { SequenceRank } from "../state/state-enum-schemas.ts";

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
  index: number; // power value：高值=强，同层差≤0.5，跨层差≥3
  rank: SequenceRank;
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
// 序列等级 power value 映射
// ===========================================================================

const RANK_POWER: Record<SequenceRank, number> = {
  ordinary: 0,
  "seq-9": 0.5,
  "seq-8": 1,
  "seq-7": 4,
  "seq-6": 4.5,
  "seq-5": 5,
  "seq-4": 8,
  "seq-3": 8.5,
  "seq-2": 12,
  "seq-1": 12.5,
  "seq-0": 16,
  "old-one": 20,
  pillar: 24,
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
  const power = RANK_POWER[rank];
  if (power === undefined) {
    throw new Error(`未知序列等级: ${rank}`);
  }
  return { rank, index: power, baselineValue: power * 10 };
}

// ===========================================================================
// 辅助函数
// ===========================================================================

function comparisonBand(baselineTierDelta: number): LOTMRankComparisonBand {
  const absoluteDelta = Math.abs(baselineTierDelta);
  if (absoluteDelta >= 4) return "off-scale"; // 秒杀级差距，低位方必须逃跑
  if (absoluteDelta >= 2) return "overwhelming";
  if (absoluteDelta >= 1) return "advantage";
  if (absoluteDelta >= 0.5) return "edge";
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
    case "off-scale":
      return `规格外差距——低位方没有任何对抗余地，只能尝试逃跑/撤退/回避，否则瞬间被秒杀。`;
    case "overwhelming":
      return `${direction}形成序列层级压制；高位格者除非极端相性克制或主动保留，否则默认碾压。`;
    case "advantage":
      return `${direction}有序列等级优势；高位格者进入主动压制区间。`;
    case "edge":
      return `双方序列近同级；装备或环境因素带来微妙差异。`;
    case "same-tier":
      return `双方序列同级；结果应由技能、环境、准备与代价决定。`;
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
  return RANK_POWER[rank] ?? 0;
}

/**
 * 判断序列等级是否高于另一个。
 */
export function isLOTMRankHigher(a: SequenceRank, b: SequenceRank): boolean {
  return lotmRankValue(a) > lotmRankValue(b);
}

/**
 * 获取两个序列等级的差值（a 比 b 高多少级）。
 * 正值表示 a 更高（power value 更大）。
 */
export function lotmRankDelta(a: SequenceRank, b: SequenceRank): number {
  return lotmRankValue(a) - lotmRankValue(b);
}
