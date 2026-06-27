// ---------------------------------------------------------------------------
// 途径索引 — 整合 data/pathways/ 目录结构与 config 元数据
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { getSequenceWeights } from "./index.ts";

// ===========================================================================
// 路径解析
// ===========================================================================

const __filename = fileURLToPath(import.meta.url); // eslint-disable-line no-underscore-dangle
const __dirname = dirname(__filename); // eslint-disable-line no-underscore-dangle
const PATHWAYS_DIR = join(__dirname, "..", "..", "data", "pathways");

// ===========================================================================
// 类型定义
// ===========================================================================

/** 序列能力数据：对应 seq-?.json 或 pillar.json */
export interface SequenceAbilityEntry {
  name: string;
  /** 能力描述 */
  description?: string;
  /** 攻击伤害类型 */
  damageType?: string;
  /** 冷却时间（回合） */
  cooldown?: number;
  /** 消耗 */
  cost?: { type: string; amount: number };
  /** 目标类型 */
  targetType?: string;
  /** 是否是治疗 */
  isHeal?: boolean;
  /** 效果列表 */
  effects?: Array<{
    name: string;
    type: string;
    stat?: string;
    valueType?: string;
    power: number | Record<string, number>;
    duration?: number;
  }>;
  /** 条件参数 */
  conditionalParams?: Array<{ condition: string; params: Record<string, unknown> }>;
  /** 自定义伤害计算器 */
  customDamageCalculator?: string;
  [key: string]: unknown;
}

/** 单个途径的完整索引 */
export interface PathwayIndex {
  /** 途径中文名 */
  name: string;
  /** data/pathways/ 下的目录名 */
  directory: string;
  /** 途径六维权重（从序列权重配置来） */
  baselineStats: [number, number, number, number, number, number] | null;
  /** 所有序列能力的文件路径 */
  abilityFiles: string[];
  /** 序列能力数据（按文件加载） */
  abilities: { sequence: string; file: string; data: SequenceAbilityEntry[] }[];
}

/** 全部途径索引 */
export type PathwayIndexMap = Record<string, PathwayIndex>;

// ===========================================================================
// 构建索引
// ===========================================================================

let cachedIndex: PathwayIndexMap | null = null;

/**
 * 扫描 data/pathways/ 目录，构建途径索引。
 */
function buildPathwayIndex(): PathwayIndexMap {
  const entries = readdirSync(PATHWAYS_DIR, { withFileTypes: true });
  const index: PathwayIndexMap = {};

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    const dirPath = join(PATHWAYS_DIR, dirName);

    const files = readdirSync(dirPath).filter((f) => f.endsWith(".json"));
    // 按序列等级排序：pillar, seq-0 → seq-9
    files.sort((a, b) => {
      const rankA = parseSequenceFileRank(a);
      const rankB = parseSequenceFileRank(b);
      return rankA - rankB;
    });

    const abilities: PathwayIndex["abilities"] = [];
    for (const file of files) {
      const filePath = join(dirPath, file);
      const data = JSON.parse(readFileSync(filePath, "utf-8")) as SequenceAbilityEntry[]; // oxlint-disable-line typescript/no-unsafe-type-assertion
      const seq = file.replace(".json", "");
      abilities.push({ sequence: seq, file: filePath, data });
    }

    index[dirName] = {
      name: dirName,
      directory: dirName,
      baselineStats: getSequenceWeights(dirName) ?? null,
      abilityFiles: files.map((f) => join(dirPath, f)),
      abilities,
    };
  }

  return index;
}

/**
 * 获取途径索引（带缓存）。
 */
export function getPathwayIndex(): PathwayIndexMap {
  if (cachedIndex === null) {
    cachedIndex = buildPathwayIndex();
  }
  return cachedIndex;
}

/**
 * 根据途径名获取索引。
 */
export function getPathway(name: string): PathwayIndex | undefined {
  return getPathwayIndex()[name];
}

/**
 * 获取所有途径名列表。
 */
export function listPathways(): string[] {
  return Object.keys(getPathwayIndex());
}

/**
 * 获取某个途径某个序列等级的能力数据。
 */
export function getPathwayAbilities(
  pathwayName: string,
  sequence: string,
): SequenceAbilityEntry[] | null {
  const pathway = getPathway(pathwayName);
  if (!pathway) return null;
  const entry = pathway.abilities.find((a) => a.sequence === sequence);
  return entry?.data ?? null;
}

// ===========================================================================
// 工具函数
// ===========================================================================

/**
 * 将序列文件名转为排序数字，用于能力文件排序。
 * pillar → -3, seq-0 → 0, seq-9 → 9
 */
function parseSequenceFileRank(filename: string): number {
  const name = filename.replace(".json", "");
  if (name === "pillar") return -3;
  if (name === "old-one") return -2;
  if (name.startsWith("seq-")) {
    const num = Number.parseInt(name.slice(4), 10);
    return Number.isNaN(num) ? 999 : num;
  }
  return 999;
}

// ===========================================================================
// 刷新缓存（用于热重载）
// ===========================================================================

export function invalidateCache(): void {
  cachedIndex = null;
}

// ===========================================================================
// 便捷访问：直接给出能力文件路径
// ===========================================================================

/**
 * 获取某个途径、某个序列的能力 JSON 文件路径。
 * 如果文件不存在返回 undefined。
 */
export function getPathwayAbilityFilePath(
  pathwayName: string,
  sequence: string,
): string | undefined {
  const index = getPathway(pathwayName);
  if (!index) return undefined;
  const filePath = join(PATHWAYS_DIR, pathwayName, `${sequence}.json`);
  return existsSync(filePath) ? filePath : undefined;
}

/**
 * 获取某个途径的 lore Markdown 文件路径。
 */
export function getPathwayLoreFilePath(pathwayName: string): string | undefined {
  const filePath = join(PATHWAYS_DIR, `${pathwayName}.md`);
  return existsSync(filePath) ? filePath : undefined;
}
