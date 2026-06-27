// ---------------------------------------------------------------------------
// 配置系统入口 — 从 data/config/ 读取所有 JSON 配置，导出带英文名的类型
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ===========================================================================
// 路径解析
// ===========================================================================

const __filename = fileURLToPath(import.meta.url); // eslint-disable-line no-underscore-dangle
const __dirname = dirname(__filename); // eslint-disable-line no-underscore-dangle
const CONFIG_DIR = join(__dirname, "..", "..", "data", "config");

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function loadConfig<T>(filename: string): T {
  const path = join(CONFIG_DIR, filename);
  if (!existsSync(path)) {
    throw new Error(`配置不存在: ${filename} (${path})`);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as T; // oxlint-disable-line typescript/no-unsafe-type-assertion
}

// ===========================================================================
// 类型定义
// ===========================================================================

/** 神性：序列索引 → 神性倍率（写法同序列基准.json） */
export type DivinityConfig = Record<string, number>;

/** 标签克制关系 */
export type TagRelations = Record<string, Record<string, number>>;

/** 序列基准：序列索引或名称 → 基础值 */
export type SequenceBaseline = Record<string, number>;

/** 序列权重：序列名 → 六维权重 [活力, 敏捷, 灵性, 理智, 人性, 运气] */
export type SequenceWeights = Record<string, [number, number, number, number, number, number]>;

/** 序列标签映射：序列名 → 标签定义 */
export interface SequenceTagDef {
  tags: string[];
  duration: number;
}

export type SequenceTagsMapping = Record<string, SequenceTagDef>;

/** 装备类型配置 */
export interface ItemTypeConfig {
  p: [number, number];
  n: [number, number];
  pW: [number, number, number, number, number, number];
}

/** 特质定义 */
export interface TraitDef {
  M: number[];
  A: number[];
  n_bias: number[];
  p_boost: number;
  n_boost: number;
}

/** 消耗品类型配置 */
export interface ConsumableTypeConfig {
  powerRatio: number;
  costRatio: number;
  backlashMult: number;
  defaultCost: string;
}

// ===========================================================================
// 配置导出（英文名）
// ===========================================================================

/** 序列基准值：序列等级 → 基础属性总值 */
export const sequenceBaseline = loadConfig<SequenceBaseline>("序列基准.json");

/** 神性倍率：序列索引 → Ω 值 */
export const divinity = loadConfig<DivinityConfig>("神性.json");

/** 标签伤害修正：攻方标签 → 守方标签 → 修正系数 */
export const tagDamageModifiers = loadConfig<TagRelations>("标签伤害修正.json");

/** 标签治疗修正：施疗方标签 → 受疗方标签 → 修正系数 */
export const tagHealingModifiers = loadConfig<TagRelations>("标签治疗修正.json");

/** 序列权重：序列名 → 六维权重（已展开为每个序列名直接对应权重数组） */
export const sequenceWeights = loadConfig<SequenceWeights>("序列权重.json");

/** 序列标签映射：序列名 → 该序列的标签列表 */
export const sequenceTagsMapping = loadConfig<SequenceTagsMapping>("标签映射.json");

/** 装备类型参数：武器/衣物/饰品/封印物 */
export const itemConfig = loadConfig<Record<string, ItemTypeConfig>>("物品参数.json");

/** 特质图鉴 */
export const traitDB = loadConfig<Record<string, TraitDef>>("特质图鉴.json");

/** 消耗品配置 */
export const consumableConfig = loadConfig<Record<string, ConsumableTypeConfig>>("消耗品配置.json");

// ===========================================================================
// 辅助函数
// ===========================================================================

/** 根据序列索引查找神性倍率（Ω），找不到返回 1.0 */
export function getDivinityValue(sequenceRankIndex: number): number {
  return divinity[String(sequenceRankIndex)] ?? 1.0;
}

/**
 * 获取某个序列的六维权重数组。
 * 权重数组顺序：[活力, 敏捷, 灵性, 理智, 人性, 运气]
 * 权重为 0~1 的小数，总和为 1。
 * 找不到时返回 null。
 */
export function getSequenceWeights(
  sequenceName: string,
): [number, number, number, number, number, number] | null {
  return sequenceWeights[sequenceName] ?? null;
}
