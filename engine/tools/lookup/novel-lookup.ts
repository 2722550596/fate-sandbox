/**
 * lookup_novel — 查询《诡秘之主》原著章节内容。
 *
 * 数据文件：data/novel/{volume_prefix}_{volume_name}/{file_number}_{chapter_title}.md
 *
 * 查询方式：
 *   1. 不传参 → 列出所有卷
 *   2. volume only → 列出该卷所有章节
 *   3. volume + chapter(s) → 批量读（单章/范围/逗号分隔）
 *   4. query → 跨卷搜索章节标题
 *   5. list: true → 只列章节清单，不返回正文
 */

import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";

import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

// ===========================================================================
// Types
// ===========================================================================

interface ChapterIndex {
  /** 卷文件夹序号，如 "001" */
  volumeSeq: string;
  /** 卷显示名，如 "第一部·小丑" */
  volumeLabel: string;
  /** 文件数字序号，如 1 */
  fileNumber: number;
  /** 原始文件名（含扩展名） */
  fileName: string;
  /** 完整路径 */
  filePath: string;
  /** 中文章节号，如 "第一章" */
  chapterLabel: string;
  /** 章节标题，如 "绯红" */
  chapterTitle: string;
}

interface VolumeMeta {
  volumeSeq: string;
  volumeLabel: string;
  chapterCount: number;
  chapters: ChapterIndex[];
}

// ===========================================================================
// Constants
// ===========================================================================

const MAX_CHARS_DEFAULT = 2_000;
const MAX_CHAPTERS_DEFAULT = 10;
const MAX_SEARCH_RESULTS = 20;

// ===========================================================================
// Data loading
// ===========================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const NOVEL_ROOT = join(__dirname, "..", "..", "..", "data", "novel");

let cachedVolumes: VolumeMeta[] | null = null;

/**
 * Parse a vol directory name like "001_第一部_小丑" → { seq: "001", label: "第一部·小丑" }
 */
function parseVolumeDir(dirName: string): { seq: string; label: string } | null {
  const match = dirName.match(/^(\d{3})_(.+)$/);
  if (match === null) return null;
  const label = match[2]!.replace(/_/g, "·");
  return { seq: match[1]!, label };
}

/**
 * Parse a chapter filename like "063_第六十三章_ 解梦.md"
 * → { num: 63, chapterLabel: "第六十三章", title: "解梦" }
 */
function parseChapterFile(fileName: string): {
  num: number;
  chapterLabel: string;
  title: string;
} | null {
  if (extname(fileName).toLowerCase() !== ".md") return null;

  const match = fileName.match(/^(\d{3})_(第[^_]+)_(.+)\.md$/);
  if (match === null) return null;

  const num = parseInt(match[1]!, 10);
  const chapterLabel = match[2]!;
  const title = match[3]!.trim();
  return { num, chapterLabel, title };
}

function buildIndex(): VolumeMeta[] {
  if (cachedVolumes !== null) return cachedVolumes;

  const dirNames = readdirSync(NOVEL_ROOT).toSorted();
  const volumes: VolumeMeta[] = [];

  for (const dirName of dirNames) {
    const parsed = parseVolumeDir(dirName);
    if (parsed === null) continue;

    const dirPath = join(NOVEL_ROOT, dirName);
    let fileNames: string[];
    try {
      fileNames = readdirSync(dirPath)
        .filter((f) => extname(f).toLowerCase() === ".md")
        .toSorted();
    } catch {
      continue;
    }

    const chapters: ChapterIndex[] = [];

    for (const fileName of fileNames) {
      const ch = parseChapterFile(fileName);
      if (ch === null) continue;

      chapters.push({
        volumeSeq: parsed.seq,
        volumeLabel: parsed.label,
        fileNumber: ch.num,
        fileName,
        filePath: join(dirPath, fileName),
        chapterLabel: ch.chapterLabel,
        chapterTitle: ch.title,
      });
    }

    volumes.push({
      volumeSeq: parsed.seq,
      volumeLabel: parsed.label,
      chapterCount: chapters.length,
      chapters,
    });
  }

  cachedVolumes = volumes;
  return volumes;
}

// ===========================================================================
// Volume matching
// ===========================================================================

/**
 * Match by volume seq ("001"), label fragment ("第一部" / "小丑" / "无面人"),
 * or the combination.
 */
function matchVolumes(volumes: VolumeMeta[], raw: string): VolumeMeta[] {
  const q = raw.trim();

  // Exact seq match
  const bySeq = volumes.find((v) => v.volumeSeq === q);
  if (bySeq !== undefined) return [bySeq];

  // Label contains query
  const results = volumes.filter(
    (v) => v.volumeLabel.includes(q) || v.volumeLabel.replace(/[··]/g, "").includes(q),
  );
  if (results.length > 0) return results;

  // Fuzzy on any part of label
  const fuzzy = volumes.filter((v) => {
    const normalized = v.volumeLabel.normalize("NFKC").replace(/[\s··_]/g, "");
    const queryNorm = q.normalize("NFKC").replace(/[\s··_]/g, "");
    return normalized.includes(queryNorm);
  });
  return fuzzy;
}

// ===========================================================================
// Chapter range parsing
// ===========================================================================

/**
 * Parse chapter specification: "5" (single), "1-20" (range), "1,3,5" (list).
 * Returns array of 0-based fileNumber values, or null if invalid.
 */
function parseChapterSpec(spec: string): number[] | null {
  const trimmed = spec.trim();

  // Range: "1-20"
  const rangeMatch = trimmed.match(/^(\d{1,3})\s*[-—～]\s*(\d{1,3})$/);
  if (rangeMatch !== null) {
    const start = parseInt(rangeMatch[1]!, 10);
    const end = parseInt(rangeMatch[2]!, 10);
    if (Number.isNaN(start) || Number.isNaN(end) || start < 1 || end < start) return null;
    const result: number[] = [];
    for (let i = start; i <= end; i++) result.push(i);
    return result;
  }

  // Comma-separated: "1,3,5"
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",");
    const nums: number[] = [];
    for (const part of parts) {
      const n = parseInt(part.trim(), 10);
      if (Number.isNaN(n) || n < 1) return null;
      nums.push(n);
    }
    return nums;
  }

  // Single: "5"
  const single = parseInt(trimmed, 10);
  if (Number.isNaN(single) || single < 1) return null;
  return [single];
}

// ===========================================================================
// Content reading with truncation
// ===========================================================================

function readChapterContent(chapter: ChapterIndex, maxChars: number): string {
  try {
    const content = readFileSync(chapter.filePath, "utf-8");

    // Strip markdown heading (already in the metadata)
    const body = content.replace(/^#\s+第.+$/m, "").trim();

    if (body.length <= maxChars) {
      return body;
    }

    // Smart truncation: cut at the last sentence end before maxChars
    const truncated = body.slice(0, maxChars);
    const lastPeriod = Math.max(
      truncated.lastIndexOf("。"),
      truncated.lastIndexOf("！"),
      truncated.lastIndexOf("？"),
      truncated.lastIndexOf("\n"),
    );
    const cutPoint = lastPeriod > maxChars * 0.6 ? lastPeriod + 1 : maxChars;
    return body.slice(0, cutPoint) + "\n\n……（以下内容已截断，共 " + body.length + " 字符）";
  } catch {
    return "（读取失败）";
  }
}

// ===========================================================================
// Format helpers
// ===========================================================================

function formatChapterHeader(chapter: ChapterIndex): string {
  return `【${chapter.volumeLabel}·${chapter.chapterLabel} ${chapter.chapterTitle}】`;
}

function chapterSummary(chapter: ChapterIndex): string {
  return `  ${chapter.chapterLabel.padEnd(8)} ${chapter.chapterTitle}`;
}

// ===========================================================================
// Public query API
// ===========================================================================

export interface NovelQuery {
  /** 卷名：数字序号 "001"、中文 "第一部"、"小丑"、"无面人" 等 */
  volume?: string;
  /** 章节号：单章 "5"，范围 "1-20"，逗号分隔 "1,3,5" */
  chapter?: string;
  /** 关键词搜索（搜索标题和正文） */
  query?: string;
  /** 是否搜索正文（默认为 true）。设为 false 则只搜索标题 */
  fulltext?: boolean;
  /** 只返回清单，不返回正文（默认 false） */
  list?: boolean;
  /** 批量读取时每章最大字符数（默认 2000） */
  maxChars?: number;
  /** 批量读取时最多返回章节数（默认 10） */
  limit?: number;
  /** 分页偏移（默认 0） */
  offset?: number;
}

/** 从正文中提取关键词周围的上下文摘录（~40 字前 + ~60 字后） */
function extractSnippet(content: string, keyword: string): string {
  const idx = content.normalize("NFKC").indexOf(keyword.normalize("NFKC"));
  if (idx === -1) return "";

  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + keyword.length + 60);

  let snippet = content.slice(start, end);
  if (start > 0) snippet = "……" + snippet;
  if (end < content.length) snippet = snippet + "……";

  return snippet;
}

export interface NovelLookupResult {
  text: string;
}

export function lookupNovel(query: NovelQuery): NovelLookupResult {
  const volumes = buildIndex();

  const maxChars = query.maxChars ?? MAX_CHARS_DEFAULT;
  const limit = query.limit ?? MAX_CHAPTERS_DEFAULT;
  const offset = query.offset ?? 0;

  // ========== Mode 1: keyword search across all chapters ==========
  // ========== Mode 1: keyword search across all chapters ==========
  if (query.query !== undefined && query.volume === undefined) {
    const q = query.query.trim();
    const normalizedQ = q.normalize("NFKC");
    const titleMatches: ChapterIndex[] = [];
    const contentMatches: Array<{ chapter: ChapterIndex; snippet: string }> = [];

    for (const vol of volumes) {
      for (const ch of vol.chapters) {
        if (ch.chapterTitle.normalize("NFKC").includes(normalizedQ)) {
          titleMatches.push(ch);
        } else if (query.fulltext !== false) {
          // 内容搜索
          try {
            const content = readFileSync(ch.filePath, "utf-8");
            if (content.normalize("NFKC").includes(normalizedQ)) {
              const snippet = extractSnippet(content, normalizedQ);
              contentMatches.push({ chapter: ch, snippet });
            }
          } catch {
            // 跳过无法读取的文件
          }
        }
      }
    }

    const totalMatches = titleMatches.length + contentMatches.length;
    if (totalMatches === 0) {
      return { text: `未在章节标题和正文中匹配到「${q}」。` };
    }

    const lines: string[] = [
      `🔍 搜索「${q}」，标题匹配 ${titleMatches.length} 条，正文匹配 ${contentMatches.length} 条：`,
      "",
    ];

    // 标题匹配：显示章节标题 + 正文（list 模式下仅标题）
    const titleSliced = titleMatches.slice(offset, offset + Math.min(limit, MAX_SEARCH_RESULTS));
    for (const ch of titleSliced) {
      lines.push(formatChapterHeader(ch));
      if (query.list !== true) {
        lines.push(readChapterContent(ch, maxChars));
        lines.push("");
      }
    }

    // 正文匹配：显示章节标题 + 上下文摘录
    const contentOffset = Math.max(0, offset - titleMatches.length);
    const contentSliced = contentMatches.slice(
      contentOffset,
      contentOffset + Math.min(limit, MAX_SEARCH_RESULTS),
    );
    for (const { chapter: ch, snippet } of contentSliced) {
      lines.push(formatChapterHeader(ch));
      if (query.list !== true) {
        lines.push(snippet);
        lines.push("");
      }
    }

    const displayedCount = titleSliced.length + contentSliced.length;
    if (totalMatches > displayedCount) {
      lines.push(`……还有 ${totalMatches - displayedCount} 条未显示（使用 limit/offset 翻页）。`);
    }

    return { text: lines.join("\n").trimEnd() };
  }

  // ========== Mode 2: no params — list all volumes ==========
  if (query.volume === undefined) {
    const totalChapters = volumes.reduce((s, v) => s + v.chapterCount, 0);
    const lines: string[] = [
      "📖 《诡秘之主》原著章节索引",
      `共 ${volumes.length} 卷，${totalChapters} 章`,
      "",
    ];
    for (const vol of volumes) {
      lines.push(`  🔹 卷 ${vol.volumeSeq}：${vol.volumeLabel}（${vol.chapterCount} 章）`);
    }
    lines.push("");
    lines.push("查询方式：");
    lines.push(`  lookup_novel({ volume: "小丑" })              → 列出该卷所有章节`);
    lines.push(`  lookup_novel({ volume: "第一部", chapter: "1-5" })  → 批量读 1～5 章`);
    lines.push(`  lookup_novel({ volume: "001", chapter: "63" })      → 读单章`);
    lines.push(`  lookup_novel({ query: "阿兹克" })             → 标题关键词搜索`);
    lines.push(`  lookup_novel({ query: "晋升", list: true })   → 只搜索标题，不返回正文`);
    return { text: lines.join("\n") };
  }

  // ========== Mode 3: resolve volume ==========
  const matchedVols = matchVolumes(volumes, query.volume);
  if (matchedVols.length === 0) {
    const allLabels = volumes.map((v) => `  - ${v.volumeSeq} → ${v.volumeLabel}`).join("\n");
    return {
      text: [`未找到卷「${query.volume}」。`, "可用卷：", allLabels].join("\n"),
    };
  }

  if (matchedVols.length > 1) {
    const labels = matchedVols.map((v) => `${v.volumeSeq}·${v.volumeLabel}`).join("、");
    return {
      text: `卷名「${query.volume}」匹配到多卷：${labels}。请用卷序号（如"002"）或完整卷名精确指定。`,
    };
  }

  const vol = matchedVols[0]!;

  // ========== Mode 4: volume only — list chapters ==========
  if (query.chapter === undefined && query.query === undefined) {
    const lines: string[] = [
      `📖 卷 ${vol.volumeSeq}：${vol.volumeLabel}（共 ${vol.chapterCount} 章）`,
      "",
    ];

    const sliced = vol.chapters.slice(offset, offset + limit);
    for (const ch of sliced) {
      lines.push(chapterSummary(ch));
    }

    if (vol.chapters.length > offset + sliced.length) {
      lines.push(`……共 ${vol.chapterCount} 章，显示 ${offset + 1}～${offset + sliced.length}`);
      lines.push(`使用 offset=${offset + limit} 翻页`);
    }

    return { text: lines.join("\n") };
  }

  // ========== Mode 5: volume + keyword search ==========
  if (query.chapter === undefined && query.query !== undefined) {
    const q = query.query.trim();
    const normalizedQ = q.normalize("NFKC");
    const titleMatches: ChapterIndex[] = [];
    const contentMatches: Array<{ chapter: ChapterIndex; snippet: string }> = [];

    for (const ch of vol.chapters) {
      if (ch.chapterTitle.normalize("NFKC").includes(normalizedQ)) {
        titleMatches.push(ch);
      } else if (query.fulltext !== false) {
        try {
          const content = readFileSync(ch.filePath, "utf-8");
          if (content.normalize("NFKC").includes(normalizedQ)) {
            const snippet = extractSnippet(content, normalizedQ);
            contentMatches.push({ chapter: ch, snippet });
          }
        } catch {
          // 跳过无法读取的文件
        }
      }
    }

    const totalMatches = titleMatches.length + contentMatches.length;
    if (totalMatches === 0) {
      return { text: `在【${vol.volumeLabel}】中未找到含「${q}」的章节。` };
    }

    const lines: string[] = [
      `🔍 在【${vol.volumeLabel}】中搜索「${q}」，标题匹配 ${titleMatches.length} 条，正文匹配 ${contentMatches.length} 条：`,
      "",
    ];

    // 标题匹配：显示全文
    const titleSliced = titleMatches.slice(offset, offset + limit);
    for (const ch of titleSliced) {
      lines.push(formatChapterHeader(ch));
      if (query.list !== true) {
        lines.push(readChapterContent(ch, maxChars));
        lines.push("");
      }
    }

    // 正文匹配：显示摘录
    const contentOffset = Math.max(0, offset - titleMatches.length);
    const contentSliced = contentMatches.slice(contentOffset, contentOffset + limit);
    for (const { chapter: ch, snippet } of contentSliced) {
      lines.push(formatChapterHeader(ch));
      if (query.list !== true) {
        lines.push(snippet);
        lines.push("");
      }
    }

    const displayedCount = titleSliced.length + contentSliced.length;
    if (totalMatches > displayedCount) {
      lines.push(`……还有 ${totalMatches - displayedCount} 条未显示（使用 limit/offset 翻页）。`);
    }

    return { text: lines.join("\n").trimEnd() };
  }

  // ========== Mode 6: volume + chapter(s) — batch read ==========
  const chSpec = query.chapter;
  if (chSpec === undefined) {
    return { text: `请指定章节号。` };
  }
  const chapterNums = parseChapterSpec(chSpec);
  if (chapterNums === null) {
    return {
      text: `无法解析章节号「${chSpec}」。支持格式：单章 "5"、范围 "1-20"、列表 "1,3,5"。`,
    };
  }

  // Build fileNumber → ChapterIndex map for this volume
  const chapterMap = new Map<number, ChapterIndex>();
  for (const ch of vol.chapters) {
    chapterMap.set(ch.fileNumber, ch);
  }

  // Find matching chapters (in order requested)
  const matched: Array<{ chapter: ChapterIndex; num: number }> = [];
  for (const num of chapterNums) {
    const ch = chapterMap.get(num);
    if (ch !== undefined) {
      matched.push({ chapter: ch, num });
    }
  }

  if (matched.length === 0) {
    return {
      text: `【${vol.volumeLabel}】中未找到章节号为 ${chSpec} 的内容。该卷共 ${vol.chapterCount} 章。`,
    };
  }

  const sliced = matched.slice(offset, offset + limit);

  // If list-only, return summary
  if (query.list === true) {
    const lines: string[] = [`📖 【${vol.volumeLabel}】章节列表（${chSpec}）：`, ""];
    for (const { chapter: ch } of sliced) {
      lines.push(`  ${ch.chapterLabel} ${ch.chapterTitle}（第 ${ch.fileNumber} 章）`);
    }
    return { text: lines.join("\n") };
  }

  // Full content
  const lines: string[] = [
    `📖 【${vol.volumeLabel}】批量读取（${chSpec}）：`,
    `（每章最多 ${maxChars} 字符，共 ${matched.length} 章，显示 ${sliced.length} 章）`,
    "",
  ];

  for (const { chapter: ch } of sliced) {
    lines.push(`━━━ ${formatChapterHeader(ch)} ━━━`);
    lines.push("");
    lines.push(readChapterContent(ch, maxChars));
    lines.push("");
  }

  if (matched.length > offset + sliced.length) {
    lines.push(
      `……还有 ${matched.length - (offset + sliced.length)} 章未显示，使用 offset=${offset + limit} 翻页。`,
    );
  }

  // If only parts of the range were found, note missing
  if (sliced.length < Math.min(chapterNums.length, limit)) {
    const foundNums = new Set(sliced.map((s) => s.num));
    const missing = chapterNums.filter((n) => !foundNums.has(n));
    if (missing.length > 0) {
      lines.push(`\n⚠️ 以下章节号在该卷中不存在：${missing.join(", ")}。`);
    }
  }

  return { text: lines.join("\n").trimEnd() };
}

// ===========================================================================
// Tool definition
// ===========================================================================

export function lookupNovelTool(params: unknown): ToolResult {
  const record = isRecord(params) ? params : {};

  const rawVolume = record["volume"];
  const rawChapter = record["chapter"];
  const rawQuery = record["query"];
  const rawList = record["list"];
  const rawMaxChars = record["maxChars"];
  const rawLimit = record["limit"];
  const rawOffset = record["offset"];

  const volume = typeof rawVolume === "string" && rawVolume.length > 0 ? rawVolume : undefined;
  const chapter = typeof rawChapter === "string" && rawChapter.length > 0 ? rawChapter : undefined;
  const query = typeof rawQuery === "string" && rawQuery.length > 0 ? rawQuery : undefined;
  const list = rawList === true;
  const maxChars = typeof rawMaxChars === "number" && rawMaxChars > 0 ? rawMaxChars : undefined;
  const limit = typeof rawLimit === "number" && rawLimit > 0 ? rawLimit : undefined;
  const offset = typeof rawOffset === "number" && rawOffset >= 0 ? rawOffset : undefined;

  const result = lookupNovel({ volume, chapter, query, list, maxChars, limit, offset });
  return textResult(result.text);
}

export const lookupNovelToolDefinition: DomainToolDefinition = {
  name: "lookup_novel",
  description:
    `查询《诡秘之主》原著章节内容。支持批量读取、关键词搜索、按卷浏览。\n\n` +
    `参数说明：\n` +
    `  - 不传任何参数 → 列出所有卷\n` +
    `  - volume（字符串）→ 卷名，支持卷序号 "001"、"第一部"、"小丑"、"无面人" 等\n` +
    `  - chapter（字符串）→ 章节号，单章 "5"、范围 "1-20"、逗号列表 "1,3,5"\n` +
    `  - query（字符串）→ 搜索关键词，搜索标题和正文（默认全文搜索）\n` +
    `  - fulltext（布尔值）→ 是否搜索正文，默认 true。设为 false 则只搜索标题\n` +
    `  - list（布尔值）→ 只返回清单不返回正文，默认 false\n` +
    `  - maxChars（数字）→ 每章最多返回字符数，默认 2000\n` +
    `  - limit（数字）→ 最多返回章节数，默认 10\n` +
    `  - offset（数字）→ 分页偏移，默认 0\n\n` +
    `使用边界：查阅原著设定、角色台词、事件经过、能力描述等原始出处。\n` +
    `禁区：不要凭记忆编造原著内容，一切以本工具返回数据为准。`,
  parameters: Type.Object({
    volume: Type.Optional(
      Type.String({
        description: `卷名：数字序号 "001"、"002"，或中文章节名 "第一部"、"小丑"、"无面人" 等。`,
      }),
    ),
    chapter: Type.Optional(
      Type.String({
        description: `章节号：单章 "5"（读第5章）、范围 "1-20"（读1～20章）、"1,3,5"（读指定章节）。`,
      }),
    ),
    query: Type.Optional(
      Type.String({
        description: `搜索关键词。默认在章节标题和正文中全文搜索；设置 fulltext=false 则只搜索标题。`,
      }),
    ),
    fulltext: Type.Optional(
      Type.Boolean({
        description: "是否搜索正文，默认为 true。设为 false 则只搜索标题。",
      }),
    ),
    list: Type.Optional(
      Type.Boolean({
        description: "设为 true 时只返回章节清单，不读取正文内容。",
      }),
    ),
    maxChars: Type.Optional(
      Type.Number({
        description: "批量读取时每章最多返回字符数，超长自动截断。默认 2000。",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: "批量读取时最多返回章节数。默认 10。",
      }),
    ),
    offset: Type.Optional(
      Type.Number({
        description: "分页偏移量，用于翻页。默认 0。",
      }),
    ),
  }),
  execute: async (_toolCallId, params) => lookupNovelTool(params),
};
