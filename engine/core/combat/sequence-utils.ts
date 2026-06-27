// ---------------------------------------------------------------------------
// 序列等级工具
// ---------------------------------------------------------------------------

import type { SequenceRank } from "../state-enum-schemas.ts";
import type { PowerMap } from "./models.ts";

import { sequenceBaseline } from "../../config/index.ts";

/**
 * 将 SequenceRank 字符串转为数字索引，用于查 power 映射表。
 *
 * 映射：
 *   "pillar" → -2
 *   "old-one" → -1
 *   "seq-0" → 0
 *   "seq-1" → 1
 *   ...
 *   "seq-9" → 9
 *   "ordinary" → 10
 */
export function sequenceRankToIndex(rank: SequenceRank): number {
  switch (rank) {
    case "pillar":
      return -2;
    case "old-one":
      return -1;
    case "seq-0":
      return 0;
    case "seq-1":
      return 1;
    case "seq-2":
      return 2;
    case "seq-3":
      return 3;
    case "seq-4":
      return 4;
    case "seq-5":
      return 5;
    case "seq-6":
      return 6;
    case "seq-7":
      return 7;
    case "seq-8":
      return 8;
    case "seq-9":
      return 9;
    default:
      return 10;
  }
}

/**
 * 从 power 映射表中按序列等级取值。
 *
 * 解析链：
 *   1. 精确匹配序列等级
 *   2. 兜底 "default"
 *   3. 兜底 "9"（最低序列）
 *   4. 返回 fallback
 */
export function resolvePowerMap(
  map: PowerMap | undefined,
  sequenceRank: SequenceRank,
  fallback: number = 1.0,
): number {
  if (map === undefined) return fallback;

  const index = sequenceRankToIndex(sequenceRank);
  const key = String(index);

  if (map[key] !== undefined) return map[key];
  if (map["default"] !== undefined) return map["default"];
  if (map["9"] !== undefined) return map["9"];

  return fallback;
}

/**
 * 获取序列基准总值（用于非技能场景的基础对抗判定）。
 */
export function getSequenceBaseValue(rank: SequenceRank): number {
  const key = rank.replace("seq-", "");
  const value = sequenceBaseline[key] ?? sequenceBaseline[rank] ?? sequenceBaseline["普通"];
  return value ?? 300;
}
