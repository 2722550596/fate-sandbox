// ---------------------------------------------------------------------------
// 序列名 ↔ 途径/等级 双向查询
//
// 从 神之途径.json 构建，提供根据序列名查 pathway + rank，
// 以及根据 pathway 查所有序列的功能。
// ---------------------------------------------------------------------------

import type { SequenceRank } from "../../core/state/state-enum-schemas.ts";

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SEQUENCE_RANKS } from "../../core/state/state-enum-schemas.ts";
import { assertOneOfString } from "../../core/utils/string-enum.ts";

// ===========================================================================
// 配置加载
// ===========================================================================

const scriptUrl = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptUrl);
const CONFIG_PATH = join(scriptDir, "..", "..", "..", "data", "config", "神之途径.json");

type PathwayIndex = Record<string, Record<string, string>>;

/** 途径名 → { rank → 序列名 } */
const pathwayIndex: PathwayIndex = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

/** 序列名 → { pathway, rank } */
const sequenceIndex: Record<string, { pathway: string; rank: SequenceRank }> = {};

for (const [pathway, rankMap] of Object.entries(pathwayIndex)) {
  for (const [rank, seqName] of Object.entries(rankMap)) {
    sequenceIndex[seqName] = {
      pathway,
      rank: assertOneOfString(rank, SEQUENCE_RANKS, "rank"),
    };
  }
}

// ===========================================================================
// 展示常量
// ===========================================================================

/** 展示顺序（不含 ordinary——那是 NPC 用，不在途径数据里） */
const DISPLAY_RANK_ORDER: SequenceRank[] = [
  "seq-9",
  "seq-8",
  "seq-7",
  "seq-6",
  "seq-5",
  "seq-4",
  "seq-3",
  "seq-2",
  "seq-1",
  "seq-0",
  "old-one",
  "pillar",
] as const;

/** 等级 → 中文标签 */
export const SEQUENCE_RANK_LABELS: Record<string, string> = {
  "seq-0": "序列 0",
  "seq-1": "序列 1",
  "seq-2": "序列 2",
  "seq-3": "序列 3",
  "seq-4": "序列 4",
  "seq-5": "序列 5",
  "seq-6": "序列 6",
  "seq-7": "序列 7",
  "seq-8": "序列 8",
  "seq-9": "序列 9",
  pillar: "支柱",
  "old-one": "旧日",
};

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

/**
 * 按等级聚合：返回所有途径在该等级的序列名。
 * 如 getSequencesByRank("seq-9") 返回 { "占卜家": "占卜家", "学徒": "学徒", ... }
 * rank 不合法时返回 null。
 */
export function getSequencesByRank(rank: string): Record<string, string> | null {
  if (!(SEQUENCE_RANKS as readonly string[]).includes(rank)) return null;
  const result: Record<string, string> = {};
  for (const [pathway, rankMap] of Object.entries(pathwayIndex)) {
    const seqName = rankMap[rank];
    if (seqName !== undefined) {
      result[pathway] = seqName;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * 模糊搜索：关键词匹配途径名或序列名。
 * 返回匹配到的 { type: "pathway" | "sequence", match, pathway?, rank? } 列表，按相关性排序。
 */
export function searchSequences(keyword: string): SequenceSearchResult[] {
  const kw = keyword.trim();
  if (kw === "") return [];

  const results: SequenceSearchResult[] = [];
  const seen = new Set<string>();

  // 匹配途径名
  for (const pathway of Object.keys(pathwayIndex)) {
    if (pathway.includes(kw) && !seen.has(pathway)) {
      seen.add(pathway);
      results.push({ type: "pathway", match: pathway });
    }
  }

  // 匹配序列名
  for (const [seqName, info] of Object.entries(sequenceIndex)) {
    if (seqName.includes(kw) && !seen.has(seqName)) {
      seen.add(seqName);
      results.push({ type: "sequence", match: seqName, pathway: info.pathway, rank: info.rank });
    }
  }

  // 精准匹配优先于包含匹配
  results.sort((a, b) => {
    const aExact = a.match === kw ? 0 : 1;
    const bExact = b.match === kw ? 0 : 1;
    return aExact - bExact;
  });

  return results;
}

export type SequenceSearchResult =
  | { type: "pathway"; match: string }
  | { type: "sequence"; match: string; pathway: string; rank: SequenceRank };

/**
 * 按展示顺序格式化途径的完整序列列表文本。
 */
export function formatPathwayDetail(pathway: string): string {
  const seqs = getPathwaySequences(pathway);
  if (seqs === null) return `未找到途径「${pathway}」。`;

  const lines: string[] = [`# ${pathway}`, ""];
  if (seqs["seq-9"] && seqs["seq-9"] !== pathway) {
    lines.push(`（途径名：${seqs["seq-9"]}）`, "");
  }
  lines.push("## 序列等级");
  for (const rank of DISPLAY_RANK_ORDER) {
    const seqName = seqs[rank as string];
    if (seqName === undefined) continue;
    const label = SEQUENCE_RANK_LABELS[rank as string] ?? rank;
    lines.push(`- ${label}：${seqName}`);
  }
  return lines.join("\n");
}

/**
 * 格式化所有途径的简略列表文本。
 */
export function formatPathwayList(): string {
  const names = listPathways();
  const lines = names.map((name) => {
    const seqs = getPathwaySequences(name)!;
    const count = Object.keys(seqs).length;
    return `- ${name}（${count} 个序列等级）`;
  });
  return `## 途径列表（共 ${names.length} 个）\n${lines.join("\n")}`;
}

/**
 * 格式化按等级聚合文本。
 */
export function formatByRank(rank: string): string {
  const label = SEQUENCE_RANK_LABELS[rank];
  if (!label) return `未知等级「${rank}」。可用等级：seq-9 ~ seq-0、pillar、old-one。`;

  const grouped = getSequencesByRank(rank);
  if (grouped === null) return `没有途径包含等级「${label}」。`;

  const lines = [`# ${label} —— 各途径的序列名`, ""];
  for (const [pathway, seqName] of Object.entries(grouped)) {
    lines.push(`- ${pathway}：**${seqName}**`);
  }
  return lines.join("\n");
}
