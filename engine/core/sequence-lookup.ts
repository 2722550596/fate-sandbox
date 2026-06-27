// ---------------------------------------------------------------------------
// 序列名 ↔ 途径/等级 双向查询
//
// 从 神之途径.json 构建，提供根据序列名查 pathway + rank，
// 以及根据 pathway 查所有序列的功能。
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { SequenceRank } from "../state/state-enum-schemas.ts";

// ===========================================================================
// 配置加载
// ===========================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, "..", "..", "data", "config", "神之途径.json");

type PathwayIndex = Record<string, Record<string, string>>;

/** 途径名 → { rank → 序列名 } */
const pathwayIndex: PathwayIndex = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

/** 序列名 → { pathway, rank } */
const sequenceIndex: Record<string, { pathway: string; rank: SequenceRank }> = {};

for (const [pathway, rankMap] of Object.entries(pathwayIndex)) {
  for (const [rank, seqName] of Object.entries(rankMap)) {
    sequenceIndex[seqName] = { pathway, rank: rank as SequenceRank };
  }
}

// ===========================================================================
// 公共 API
// ===========================================================================

/**
 * 根据序列名（如"占卜家""小丑"）查询 pathway 和 SequenceRank。
 * 找不到返回 null。
 */
export function getPathwayAndRank(
  sequenceName: string,
): { pathway: string; rank: SequenceRank } | null {
  return sequenceIndex[sequenceName] ?? null;
}

/**
 * 根据途径名（如"占卜家""观众"）查询该途径所有序列等级映射。
 * 返回 { rank → 序列名 }，如 { "seq-9": "占卜家", "seq-8": "小丑", ... }
 * 找不到返回 null。
 */
export function getPathwaySequences(pathway: string): Record<string, string> | null {
  return pathwayIndex[pathway] ?? null;
}

/**
 * 获取所有途径名列表。
 */
export function listPathways(): string[] {
  return Object.keys(pathwayIndex);
}

/**
 * 获取所有序列名列表。
 */
export function listAllSequenceNames(): string[] {
  return Object.keys(sequenceIndex);
}