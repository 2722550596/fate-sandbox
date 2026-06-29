import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { SequenceSearchResult } from "./sequence-lookup.ts";

import { Type } from "typebox";

import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult } from "../runtime/tool-result.ts";
import {
  getPathwayAndRank,
  getPathwaySequences,
  formatPathwayDetail,
  formatPathwayList,
  formatByRank,
  searchSequences,
  SEQUENCE_RANK_LABELS,
} from "./sequence-lookup.ts";

export const lookupSequenceToolDefinition: DomainToolDefinition = {
  name: "lookup_sequence",
  description:
    "查询序列与途径的对应关系。输入途径名查晋升路线，输入序列名反查所属途径和等级，输入" +
    "「seq-9」~「seq-0」「pillar」「old-one」按等级聚合各途径的序列名，输入关键词模糊搜索，" +
    "输入空/「列表」/「all」列出所有途径。\n\n" +
    "使用边界：GM 需要快速查某个途径完整的序列名称、反查序列名属于哪条途径、或对比各途径同一等级的序列。\n" +
    "禁区：代替 lookup（世界设定查询）或 lookup_ability（非凡能力查询）。",
  parameters: Type.Object({
    query: Type.String({
      description:
        "查询内容：途径名（如「占卜家」）→晋升路线；序列名（如「小丑」）→反查；" +
        "「seq-9」/「序列9」→按等级聚合；关键词→模糊搜索途径和序列名；空/「列表」/「all」→途径列表",
    }),
  }),
  execute: async (_toolCallId, params) => {
    const raw = isRecord(params) ? params : {};
    const query = typeof raw["query"] === "string" ? raw["query"].trim() : "";

    // ── 空查询 → 途径列表 ──
    if (query === "" || query === "列表" || query === "all") {
      return textResult(formatPathwayList());
    }

    // ── 1️⃣ 途径名精准匹配（优先于序列名，避免「占卜家」被 seq-9 同名列截胡） ──
    const exactPathway = getPathwaySequences(query);
    if (exactPathway !== null) {
      return textResult(formatPathwayDetail(query));
    }

    // ── 2️⃣ 等级聚合查询：seq-9 / 序列9 / 支柱 / 旧日 ──
    const rankKey = normalizeRankInput(query);
    if (rankKey !== null) {
      return textResult(formatByRank(rankKey));
    }

    // ── 3️⃣ 序列名精准反查 ──
    const seqInfo = getPathwayAndRank(query);
    if (seqInfo !== null) {
      const label = SEQUENCE_RANK_LABELS[seqInfo.rank] ?? seqInfo.rank;
      return textResult(`「${query}」属于 **${seqInfo.pathway}** 途径（${label}）。`);
    }

    // ── 4️⃣ 模糊搜索途径名和序列名 ──
    const fuzzyResults = searchSequences(query);
    if (fuzzyResults.length > 0) {
      return textResult(formatFuzzyResults(query, fuzzyResults));
    }

    // ── 5️⃣ 无结果 ──
    return textResult(
      `未找到「${query}」。可用「列表」查看所有途径，或用「seq-9」「序列9」查看某等级的聚合。`,
    );
  },
};

/** 等级别名 → rank key */
const LABEL_TO_RANK: Record<string, string> = {
  支柱: "pillar",
  旧日: "old-one",
};

/**
 * 将用户输入的等级表述统一转为 rank key。
 * 支持 "序列9" / "seq-9" / "序列0" / "支柱" / "旧日" 等格式。
 */
function normalizeRankInput(input: string): string | null {
  const trimmed = input.trim();

  // 直接是 rank key（seq-9 ~ seq-0, pillar, old-one）
  if (trimmed in SEQUENCE_RANK_LABELS) return trimmed;

  // "序列N" → "seq-N"
  const seqMatch = trimmed.match(/^序列(\d)$/);
  if (seqMatch) {
    const rank = `seq-${seqMatch[1]}` as const;
    if (rank in SEQUENCE_RANK_LABELS) return rank;
  }

  // 中文别名 → key
  if (trimmed in LABEL_TO_RANK) return LABEL_TO_RANK[trimmed] ?? null;

  return null;
}

/**
 * 格式化模糊搜索结果。
 */
function formatFuzzyResults(query: string, results: SequenceSearchResult[]): string {
  const pathwayHits = results.filter((r) => r.type === "pathway");
  const sequenceHits = results.filter((r) => r.type === "sequence");

  const lines: string[] = [`未找到精准匹配「${query}」，以下为相近结果：`, ""];

  if (pathwayHits.length > 0) {
    lines.push("**途径**");
    for (const hit of pathwayHits) {
      lines.push(`- ${hit.match}`);
    }
    lines.push("");
  }

  if (sequenceHits.length > 0) {
    lines.push("**序列**");
    for (const hit of sequenceHits) {
      const label = SEQUENCE_RANK_LABELS[hit.rank] ?? hit.rank;
      lines.push(`- ${hit.match}（${hit.pathway} · ${label}）`);
    }
    lines.push("");
  }

  lines.push("可用精确途径名查看完整序列，或用「seq-N」查看各途径同一等级的序列名。");
  return lines.join("\n");
}
