/**
 * Ability lookup engine — loads data/abilities/pathway_abilities.json
 * and provides formatted query for sequence abilities.
 *
 * Query modes:
 *   1. Sequence name: "秘偶大师" → find pathway + rank, show cumulative chain
 *   2. Pathway-rank:  "占卜家途径-序列5" → direct, show cumulative chain
 *
 * only=true → show only the target rank's abilities, no chain.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ===========================================================================
// Types
// ===========================================================================

interface AbilityEntry {
  name: string;
  description: string;
  type: string;
  sequenceName: string;
}

interface ParsedQuery {
  pathway: string;
  rank: string;
  only: boolean;
}

export interface AbilityLookupResult {
  text: string;
}

/** pathway → rank → abilities */
type PathwayIndex = Record<string, Record<string, AbilityEntry[]>>;
/** sequence name → { pathway, rank } */
type SeqNameIndex = Record<string, { pathway: string; rank: string }>;

// ===========================================================================
// Constants
// ===========================================================================

const RANK_ORDER: readonly string[] = [
  "序列9",
  "序列8",
  "序列7",
  "序列6",
  "序列5",
  "序列4",
  "序列3",
  "序列2",
  "序列1",
  "序列0",
  "支柱",
  "旧日",
];

const PATHWAY_RANK_RE = /^(.+?)途径-(序列\d+|支柱|旧日)$/;

// Data loading
// ===========================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const ABILITIES_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "data",
  "abilities",
  "pathway_abilities.json",
);
type RawData = Record<string, AbilityEntry[]>;

let cachedRaw: RawData | null = null;
let cachedPathwayIndex: PathwayIndex | null = null;
let cachedSeqNameIndex: SeqNameIndex | null = null;

function isRawData(value: unknown): value is RawData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadRaw(): RawData {
  if (cachedRaw === null) {
    const parsed = JSON.parse(readFileSync(ABILITIES_PATH, "utf-8"));
    if (!isRawData(parsed)) {
      throw new Error("ability-lookup: 解析 pathway_abilities.json 后类型不匹配，预期为对象");
    }
    cachedRaw = parsed;
  }
  return cachedRaw;
}

function buildIndexes(): {
  pathwayIndex: PathwayIndex;
  seqNameIndex: SeqNameIndex;
} {
  if (cachedPathwayIndex !== null && cachedSeqNameIndex !== null) {
    return { pathwayIndex: cachedPathwayIndex, seqNameIndex: cachedSeqNameIndex };
  }

  const raw = loadRaw();
  const pathIdx: PathwayIndex = {};
  const seqIdx: SeqNameIndex = {};

  for (const [key, entries] of Object.entries(raw)) {
    const match = key.match(PATHWAY_RANK_RE);
    if (match === null) continue;

    const pathway = match[1]!;
    const displayRank = match[2]!;

    let rankMap = pathIdx[pathway];
    if (rankMap === undefined) {
      rankMap = {};
      pathIdx[pathway] = rankMap;
    }
    rankMap[displayRank] = entries;

    for (const entry of entries) {
      if (seqIdx[entry.sequenceName] === undefined) {
        seqIdx[entry.sequenceName] = { pathway, rank: displayRank };
      }
    }
  }

  cachedPathwayIndex = pathIdx;
  cachedSeqNameIndex = seqIdx;
  return { pathwayIndex: pathIdx, seqNameIndex: seqIdx };
}

// ===========================================================================
// Query parsing
// ===========================================================================

/**
 * Parse a raw query string into a structured ability query.
 * Supports:
 *   - "占卜家途径-序列5"    (pathway-rank pattern)
 *   - "秘偶大师"           (sequence name, auto-resolved)
 *
 * Returns null when neither pattern matches.
 */
export function parseAbilityQuery(raw: string, only = false): ParsedQuery | null {
  const pathMatch = raw.match(PATHWAY_RANK_RE);
  if (pathMatch) {
    return { pathway: pathMatch[1]!, rank: pathMatch[2]!, only };
  }

  const { seqNameIndex } = buildIndexes();
  const found = seqNameIndex[raw];
  if (found) {
    return { pathway: found.pathway, rank: found.rank, only };
  }

  return null;
}

// ===========================================================================
// Rank ordering
// ===========================================================================

const ORDER_MAP: Record<string, number> = Object.fromEntries(RANK_ORDER.map((r, i) => [r, i]));

function rankIdx(rank: string): number {
  const idx = ORDER_MAP[rank];
  if (idx === undefined) throw new Error(`unknown rank: ${rank}`);
  return idx;
}

// ===========================================================================
// Formatting — single rank
// ===========================================================================

function formatSingle(
  pathway: string,
  rank: string,
  rankMap: Record<string, AbilityEntry[]>,
): string {
  const entries = rankMap[rank];
  if (entries === undefined || entries.length === 0) {
    return `【${pathway}途径 · ${rank}】无能力数据。`;
  }

  const seqName = entries[0]!.sequenceName;
  const lines: string[] = [`╔══ ${pathway}途径 — ${rank}：${seqName} ══╗\n`];

  for (const entry of entries) {
    lines.push(`【${entry.type}】${entry.name}`);
    lines.push(entry.description);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

// ===========================================================================
// Formatting — cumulative chain
// ===========================================================================

function formatCumulative(
  pathway: string,
  targetRank: string,
  targetIdx: number,
  rankMap: Record<string, AbilityEntry[]>,
): string {
  const targetName = rankMap[targetRank]?.[0]?.sequenceName ?? targetRank;
  const sep = "─".repeat(42);

  const lines: string[] = [
    `╔══ ${pathway}途径 — 能力链总览（目标${targetRank}：${targetName}） ══╗`,
    `║  下列能力自序列9起逐级累积，高序列对低序列能力有全面增强效果  ║`,
    `╚${sep}╝`,
    "",
  ];

  for (let i = 0; i <= targetIdx; i++) {
    const rank = RANK_ORDER[i]!;
    const entries = rankMap[rank];
    if (entries === undefined || entries.length === 0) continue;

    const seqName = entries[0]!.sequenceName;
    lines.push(`┌─ ${pathway}途径 · ${rank}：${seqName}`);

    if (i < targetIdx) {
      lines.push(`│  此序列及以下所有能力在晋升后获得全面增强`);
    }
    lines.push("│");

    for (const entry of entries) {
      const text = entry.description.replace(/\n/g, "\n│  ");
      lines.push(`│  【${entry.type}】${entry.name}`);
      lines.push(`│  ${text}`);
      lines.push("│");
    }

    lines.push("");
  }

  lines.push(sep);
  lines.push(
    `温馨提示：${targetName}（${targetRank}）拥有${pathway}途径序列9至${targetRank}的全部能力，`,
  );
  lines.push(`   且所有低序列能力均已获得全面增强（威力、精度、范围等均随序列提升而增长）。`);

  return lines.join("\n");
}

// ===========================================================================
// Query execution
// ===========================================================================

export function lookupAbility(query: ParsedQuery): AbilityLookupResult {
  const { pathwayIndex } = buildIndexes();
  const rankMap = pathwayIndex[query.pathway];
  if (rankMap === undefined) {
    return { text: `未找到途径「${query.pathway}」的能力数据。` };
  }

  const targetIdx = rankIdx(query.rank);

  if (query.only) {
    return { text: formatSingle(query.pathway, query.rank, rankMap) };
  }

  return { text: formatCumulative(query.pathway, query.rank, targetIdx, rankMap) };
}

/**
 * Parse and query in one call. Convenience for the lookup tool.
 */
export function lookupAbilities(raw: string, only = false): AbilityLookupResult {
  const parsed = parseAbilityQuery(raw, only);
  if (parsed === null) {
    return {
      text: [
        `无法解析能力查询："${raw}"。`,
        "",
        "支持的格式：",
        '  - 序列名：  "秘偶大师"、"占卜家"（唯一，自动识别）',
        '  - 途径-序列："占卜家途径-序列5"（含 序列0～9／支柱／旧日）',
        "  - 追加 only=true 只显示该序列能力，不展示累积链。",
      ].join("\n"),
    };
  }
  return lookupAbility(parsed);
}

/** All indexed pathway names for discovery. */
export function listAbilityPathways(): string[] {
  const { pathwayIndex } = buildIndexes();
  return Object.keys(pathwayIndex).toSorted();
}

/** All indexed sequence names for discovery. */
export function listAbilitySequenceNames(): string[] {
  const { seqNameIndex } = buildIndexes();
  return Object.keys(seqNameIndex).toSorted();
}

export type { ParsedQuery as AbilityParsedQuery };
