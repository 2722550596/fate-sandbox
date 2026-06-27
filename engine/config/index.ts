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

/** 能力体系映射：序列名称 → 战斗体系 */
export interface AbilitySystemMapping {
  [sequenceName: string]: string;
}

/** 能力体系配置中的单个体系 */
export interface AbilitySystemEntry {
  [stat: string]: number;
}

/** 能力体系配置 */
export interface AbilitySystemConfig {
  systems: Record<string, AbilitySystemEntry>;
  aliases: Record<string, string>;
  defaultSystem: string;
}

/** 神性：序列范围 → 神性倍率 */
export interface DivinityEntry {
  min: number;
  max: number;
  val: number;
}

/** 途径矩阵：途径名 → 六维基础值数组 [活力, 敏捷, 灵性, 理智, 人性, 运气] */
export type PathwayMatrix = Record<string, [number, number, number, number, number, number]>;

/** 标签克制关系 */
export type TagRelations = Record<string, Record<string, number>>;

/** 序列基准：序列索引或名称 → 基础值 */
export type SequenceBaseline = Record<string, number>;

// ===========================================================================
// 配置导出（英文名）
// ===========================================================================

/** 序列基准值：序列等级 → 基础属性总值 */
export const sequenceBaseline = loadConfig<SequenceBaseline>("序列基准.json");

/** 神性倍率：序列范围 → Ω 值 */
export const divinity = loadConfig<DivinityEntry[]>("神性.json");

/** 标签伤害修正：攻方标签 → 守方标签 → 修正系数 */
export const tagDamageModifiers = loadConfig<TagRelations>("标签伤害修正.json");

/** 标签治疗修正：施疗方标签 → 受疗方标签 → 修正系数 */
export const tagHealingModifiers = loadConfig<TagRelations>("标签治疗修正.json");

/** 能力体系映射：序列名称 → 战斗体系 */
export const abilitySystemMapping = loadConfig<AbilitySystemMapping>("能力体系映射.json");

/** 能力体系配置：战斗体系 → 六维权重 */
export const abilitySystemConfig = loadConfig<AbilitySystemConfig>("能力体系配置.json");

/** 途径矩阵：途径名 → 六维基础值 */
export const pathwayMatrix = loadConfig<PathwayMatrix>("途径矩阵.json");

/** 天赋加成 */
export const talentBonuses = loadConfig<Record<string, unknown>>("天赋加成.json");

/** 标签映射 */
export const tagMapping = loadConfig<Record<string, string[]>>("标签映射.json");

/** 消耗品配置 */
export const consumables = loadConfig<Record<string, unknown>>("消耗品配置.json");

// ===========================================================================
// 辅助函数
// ===========================================================================

/** 根据序列索引查找神性倍率（Ω） */
export function getDivinityValue(sequenceRankIndex: number): number {
  for (const entry of divinity) {
    if (sequenceRankIndex >= entry.min && sequenceRankIndex <= entry.max) {
      return entry.val;
    }
  }
  return 1.0;
}

/** 根据序列名称获取对应的能力体系 */
export function getAbilitySystem(sequenceName: string): string {
  return abilitySystemMapping[sequenceName] ?? abilitySystemConfig.defaultSystem;
}

/** 获取某个能力体系的六维权重 */
export function getSystemWeights(systemName: string): AbilitySystemEntry {
  return (
    abilitySystemConfig.systems[systemName] ??
    abilitySystemConfig.systems[abilitySystemConfig.defaultSystem] ??
    {}
  );
}

/** 根据途径名获取六维基础值 */
export function getPathwayBaseline(
  pathwayName: string,
): [number, number, number, number, number, number] | null {
  return pathwayMatrix[pathwayName] ?? null;
}
