/**
 * lookup — RAG 增强版世界数据查询工具。
 *
 * 扫描 data/ 下所有含 frontmatter 的 .md 文件（排除 config/archives/novel），
 * 构建语义索引，支持向量搜索 + 重排序的两阶段检索。
 *
 * 环境变量（.env）：
 *   SILICONFLOW_BASE_URL — API 地址（默认 https://api.siliconflow.cn/v1）
 *   SILICONFLOW_API_KEY  — API 密钥
 *   EMBEDDING_MODEL      — 嵌入模型名
 *   RERANKER_MODEL       — 重排序模型名
 */

import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";

import { loadEnv, requireEnv } from "../../core/utils/env-loader.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";
import { parseFrontmatter } from "./frontmatter.ts";

// ===========================================================================
// Types
// ===========================================================================

interface Chunk {
  id: string;
  filePath: string;
  title: string;
  type: string;
  tags: string[];
  sectionHeading: string;
  text: string;
}

interface IndexEntry {
  chunk: Chunk;
  embedding: number[];
}

/** 与 data/ 下目录名对应的 type 分类 */
const DIR_KIND_MAP: Record<string, string> = {
  characters: "角色",
  locations: "地点",
  organizations: "组织",
  items: "物品",
  lore: "设定",
  world: "设定",
  mechanics: "机制",
  economy: "经济",
  abilities: "途径",
  pathways: "途径",
  instructions: "设定",
};

/** 排除的目录 */
const EXCLUDED_DIRS = new Set(["config", "archives", "novel", "NOTICE.md"]);

// ===========================================================================
// Constants & config
// ===========================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = join(__dirname, "..", "..", "..", "data");
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const CACHE_DIR = join(PROJECT_ROOT, ".rag-cache");
const INDEX_CACHE_PATH = join(CACHE_DIR, "chunk-index.json");

const EMBEDDING_BATCH_SIZE = 50;
const TOP_K_VECTOR = 30;
const TOP_K_RERANK = 10;
const CHUNK_MAX_LENGTH = 1_500;

// ===========================================================================
// Env loading
// ===========================================================================

loadEnv();

const API_BASE = process.env["SILICONFLOW_BASE_URL"] ?? "https://api.siliconflow.cn/v1";
const API_KEY = requireEnv("SILICONFLOW_API_KEY");
const EMBEDDING_MODEL = process.env["EMBEDDING_MODEL"] ?? "Qwen/Qwen3-Embedding-0.6B";
const RERANKER_MODEL = process.env["RERANKER_MODEL"] ?? "Qwen/Qwen3-Reranker-0.6B";

// ===========================================================================
// Chunking
// ===========================================================================

/**
 * 拆分正文为语义块：
 * - 按 `## `（二级标题）分割
 * - 无二级标题时，整篇作为一块
 * - 每块包含前面的 frontmatter metadata 作为上下文
 */
function chunkBody(body: string): string[] {
  const lines = body.split("\n");
  const sectionBoundaries: Array<{ heading: string; startLine: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("## ")) {
      sectionBoundaries.push({ heading: line.replace(/^## +/, "").trim(), startLine: i });
    }
  }

  if (sectionBoundaries.length === 0) {
    // No sections — whole body as one chunk
    const cleaned = lines
      .map((l) => l.replace(/^#+ /, "").trim())
      .filter(Boolean)
      .join("\n");
    if (cleaned.length < 50) return []; // too short
    return [cleaned.slice(0, CHUNK_MAX_LENGTH)];
  }

  const chunks: string[] = [];
  for (let i = 0; i < sectionBoundaries.length; i++) {
    const { heading, startLine } = sectionBoundaries[i]!;
    const endLine =
      i + 1 < sectionBoundaries.length ? sectionBoundaries[i + 1]!.startLine : lines.length;

    const sectionLines = lines.slice(startLine + 1, endLine);
    const sectionText = sectionLines
      .map((l) => l.replace(/^#{1,6} /, "").trim())
      .filter(Boolean)
      .join("\n");

    if (sectionText.length < 30) continue; // skip empty sections

    const combined = `【${heading}】\n${sectionText}`;
    chunks.push(combined.slice(0, CHUNK_MAX_LENGTH));
  }

  return chunks;
}

function walkMdFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...walkMdFiles(fullPath));
      } else if (extname(entry).toLowerCase() === ".md") {
        results.push(fullPath);
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results;
}

export function buildChunks(): Chunk[] {
  return doBuildChunks();
}

function doBuildChunks(): Chunk[] {
  const files = walkMdFiles(DATA_ROOT);
  const chunks: Chunk[] = [];
  let idCounter = 0;

  for (const filePath of files) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const parsed = parseFrontmatter(raw);
      if (parsed === null) continue;

      const attrs = parsed.attrs;
      const title = safeStr(attrs["title"]) ?? filenameToTitle(filePath);
      const type = safeStr(attrs["type"]) ?? guessType(filePath);
      const tags = safeStrArr(attrs["tags"]);

      const bodySections = chunkBody(parsed.body);

      for (const sectionText of bodySections) {
        // Extract section heading from the wrapped text
        const headingMatch = sectionText.match(/^【(.+?)】/);
        const sectionHeading = headingMatch?.[1] ?? "";
        const textWithoutHeading = sectionText.replace(/^【.+?】\n?/, "").trim();

        chunks.push({
          id: `chunk-${idCounter++}`,
          filePath,
          title,
          type,
          tags,
          sectionHeading,
          text: textWithoutHeading,
        });
      }
    } catch {
      // skip unparseable files
    }
  }

  return chunks;
}

// ===========================================================================
// Embedding API
// ===========================================================================

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

function isEmbeddingResponse(value: unknown): value is EmbeddingResponse {
  if (typeof value !== "object" || value === null) return false;
  return "data" in value && Array.isArray((value as Record<string, unknown>)["data"]);
}

export async function embedTexts(texts: string[], model: string): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await fetch(`${API_BASE}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: batch,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`Embedding API 错误 (${response.status}): ${errText.slice(0, 500)}`);
    }

    const rawJson: unknown = await response.json();
    if (!isEmbeddingResponse(rawJson)) {
      throw new Error(`Embedding API 返回格式异常`);
    }
    const json = rawJson;
    // Ensure results align with input order
    const sorted = (json.data ?? []).toSorted((a, b) => a.index - b.index);
    for (const entry of sorted) {
      results.push(entry.embedding);
    }
  }

  return results;
}

// ===========================================================================
// Index build & cache
// ===========================================================================

function parseCachedIndex(raw: string): IndexEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const first = parsed[0];
  if (typeof first !== "object" || first === null) return null;
  if (!("chunk" in first) || !("embedding" in first)) return null;
  // validated: shape checked above (isArray + chunk/embedding)
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return parsed as IndexEntry[];
}

function getCachedIndex(): IndexEntry[] | null {
  try {
    if (!existsSync(CACHE_DIR)) return null;
    const raw = readFileSync(INDEX_CACHE_PATH, "utf-8");
    return parseCachedIndex(raw);
  } catch {
    return null;
  }
}

export function saveCachedIndex(entries: IndexEntry[]): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(INDEX_CACHE_PATH, JSON.stringify(entries), "utf-8");
  } catch {
    // non-fatal
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ===========================================================================
// Rerank API
// ===========================================================================

interface RerankResponse {
  results: Array<{ index: number; relevance_score: number }>;
}

function isRerankResponse(value: unknown): value is RerankResponse {
  if (typeof value !== "object" || value === null) return false;
  return "results" in value && Array.isArray((value as Record<string, unknown>)["results"]);
}

async function rerank(
  query: string,
  documents: string[],
  model: string,
): Promise<Array<{ index: number; score: number }>> {
  const response = await fetch(`${API_BASE}/rerank`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model,
      query,
      documents,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown");
    // Rerank 失败时降级返回原始顺序
    console.error(`Rerank API 错误 (${response.status}): ${errText.slice(0, 200)}`);
    return documents.map((_, index) => ({ index, score: 0 }));
  }

  const rawJson: unknown = await response.json();
  if (!isRerankResponse(rawJson)) {
    console.error(`Rerank API 返回格式异常，降级为原始顺序`);
    return documents.map((_, index) => ({ index, score: 0 }));
  }
  const json = rawJson;
  return (json.results ?? []).map((r) => ({ index: r.index, score: r.relevance_score }));
}

// ===========================================================================
// Index singleton
// ===========================================================================

let cachedIndex: IndexEntry[] | null = null;

async function getIndex(): Promise<IndexEntry[]> {
  if (cachedIndex !== null) return cachedIndex;

  // Try loading from cache
  const cached = getCachedIndex();
  if (cached !== null) {
    cachedIndex = cached;
    return cached;
  }

  // Build from scratch
  const chunks = buildChunks();
  const texts = chunks.map((c) => formatChunkForIndex(c));

  console.error(`[lookup-rag] 正在嵌入 ${texts.length} 个文本块（模型: ${EMBEDDING_MODEL}）…`);
  const embeddings = await embedTexts(texts, EMBEDDING_MODEL);

  const entries: IndexEntry[] = chunks.map((chunk, i) => ({
    chunk,
    embedding: embeddings[i] ?? [],
  }));

  saveCachedIndex(entries);
  cachedIndex = entries;

  console.error(`[lookup-rag] 索引构建完成，共 ${entries.length} 条`);
  return entries;
}

function formatChunkForIndex(chunk: Chunk): string {
  const parts: string[] = [];
  if (chunk.title) parts.push(`标题: ${chunk.title}`);
  if (chunk.type) parts.push(`类型: ${chunk.type}`);
  if (chunk.sectionHeading) parts.push(chunk.sectionHeading);
  if (chunk.tags.length > 0) parts.push(`标签: ${chunk.tags.join("、")}`);
  if (chunk.text) parts.push(chunk.text);
  return parts.join("\n");
}

// ===========================================================================
// Search
// ===========================================================================

async function search(query: string, index: IndexEntry[]): Promise<Chunk[]> {
  // 1. Vector search
  const [queryEmbedding] = await embedTexts([query], EMBEDDING_MODEL);
  if (queryEmbedding === undefined) return [];

  const scored = index
    .map((entry) => ({
      entry,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }))
    .toSorted((a, b) => b.score - a.score)
    .slice(0, TOP_K_VECTOR);

  // 2. Rerank
  const docs = scored.map((s) => formatChunkForIndex(s.entry.chunk));
  const reranked = await rerank(query, docs, RERANKER_MODEL);

  // Combine scores: weighted average of vector similarity + rerank score
  for (const r of reranked) {
    const target = scored[r.index];
    if (target !== undefined) {
      // Bias toward reranker when it fires (> 0), fall back to vector when it doesn't
      target.score = r.score > 0 ? r.score : target.score * 0.6;
    }
  }

  return scored
    .toSorted((a, b) => b.score - a.score)
    .slice(0, TOP_K_RERANK)
    .map((s) => s.entry.chunk);
}

// ===========================================================================
// Formatting
// ===========================================================================

function formatResults(query: string, chunks: Chunk[]): string {
  if (chunks.length === 0) {
    return `未找到与「${query}」相关的信息。`;
  }

  const lines: string[] = [`🔍 搜索「${query}」，找到 ${chunks.length} 条相关结果：`, ""];

  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i]!;
    const relPath = relative(DATA_ROOT, ch.filePath);

    lines.push(`━━━ 结果 ${i + 1} ━━━`);
    lines.push(`  来源: ${relPath}`);
    lines.push(`  标题: ${ch.title}`);
    lines.push(`  类型: ${ch.type}`);
    if (ch.tags.length > 0) lines.push(`  标签: ${ch.tags.join("、")}`);
    if (ch.sectionHeading) lines.push(`  章节: ${ch.sectionHeading}`);
    lines.push("");

    lines.push(ch.text);
    lines.push("");
  }

  return lines.join("\n");
}

// ===========================================================================
// Category filtering
// ===========================================================================

const CATEGORY_ALIASES: Record<string, string> = {
  character: "角色",
  characters: "角色",
  npc: "角色",
  角色: "角色",
  location: "地点",
  locations: "地点",
  place: "地点",
  地点: "地点",
  organization: "组织",
  organizations: "组织",
  org: "组织",
  faction: "组织",
  组织: "组织",
  pathway: "途径",
  pathways: "途径",
  途径: "途径",
  sequence: "途径",
  item: "物品",
  items: "物品",
  物品: "物品",
  artifact: "物品",
  lore: "设定",
  setting: "设定",
  设定: "设定",
  worldbuilding: "设定",
  economy: "经济",
  经济: "经济",
  mechanic: "机制",
  mechanics: "机制",
  mechanism: "机制",
  机制: "机制",
  rule: "机制",
  rules: "机制",
  ability: "途径",
  abilities: "途径",
};

/** 将用户传入的 category 字符串解析为标准分类名 */
function resolveCategory(category: string | undefined): string | undefined {
  if (category === undefined) return undefined;
  const trimmed = category.trim();
  if (trimmed.length === 0) return undefined;
  return CATEGORY_ALIASES[trimmed] ?? CATEGORY_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

// ===========================================================================
// Public API
// ===========================================================================

export interface RAGLookupRequest {
  query: string;
  category?: string;
}

export interface RAGLookupResult {
  text: string;
}

export async function lookupByRAG(request: RAGLookupRequest): Promise<RAGLookupResult> {
  try {
    const index = await getIndex();
    const category = resolveCategory(request.category);
    let chunks = await search(request.query, index);

    // Optionally filter by category
    if (category !== undefined && chunks.length > 0) {
      const filtered = chunks.filter((c) => {
        const typeLower = c.type.normalize("NFKC");
        const catLower = category.normalize("NFKC");
        return typeLower.includes(catLower) || catLower.includes(typeLower);
      });

      // Only apply filter if it doesn't wipe everything
      if (filtered.length > 0) {
        chunks = filtered;
      }
    }

    return { text: formatResults(request.query, chunks) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      text:
        `⚠️ RAG 查询出错：${message}\n\n` +
        `请检查：\n` +
        `  1. .env 文件中 SILICONFLOW_API_KEY 是否正确\n` +
        `  2. 网络是否能访问 ${API_BASE}\n` +
        `  3. 模型 ${EMBEDDING_MODEL} / ${RERANKER_MODEL} 是否可用`,
    };
  }
}

// ===========================================================================
// Tool definition
// ===========================================================================

export async function lookupTool(params: unknown): Promise<ToolResult> {
  const record = isRecord(params) ? params : {};

  const rawQuery = record["query"];
  const rawCategory = record["category"];

  const query = typeof rawQuery === "string" && rawQuery.length > 0 ? rawQuery : undefined;
  const category =
    typeof rawCategory === "string" && rawCategory.length > 0 ? rawCategory : undefined;

  if (query === undefined) {
    // No query — show tool usage guide
    const helpText =
      `lookup — 语义搜索非凡世界数据\n\n` +
      `通过向量嵌入 + 重排序（RAG）检索 data/ 下的结构化设定文档。\n\n` +
      `参数：\n` +
      `  query（必填）— 搜索关键词或自然语言描述\n` +
      `  category（可选）— 分类过滤：角色/地点/组织/途径/物品/设定/经济/机制\n\n` +
      `示例：\n` +
      `  lookup({ query: "克莱恩莫雷蒂" })\n` +
      `  lookup({ query: "廷根市"，category: "location" })\n` +
      `  lookup({ query: "封印物"，category: "物品" })`;
    return textResult(helpText);
  }

  const result = await lookupByRAG({ query, category });
  return textResult(result.text);
}

export const lookupToolDefinition: DomainToolDefinition = {
  name: "lookup",
  description:
    "语义搜索非凡世界数据——角色、地点、组织、物品、途径、机制等。\n\n" +
    "通过向量嵌入 + 重排序（RAG）两阶段检索，支持自然语言描述。\n" +
    "数据来源为 data/ 目录下所有含 frontmatter 的 markdown 文件。\n\n" +
    "参数：\n" +
    '  query（必填）— 搜索关键词或自然语言问题（如 "序列2有什么能力"、"阿蒙的弱点"）\n' +
    `  limit（可选，默认 10）— 返回结果数，最大 ${TOP_K_VECTOR}\n\n` +
    "使用边界：查询世界观设定、角色档案、地点描述、物品信息、组织资料等。\n" +
    "返回结果源自 data/ 下的结构化文档，每项附来源路径以便追溯。\n" +
    "禁区：不要凭记忆编造 canon。查询失败时以工具返回为准。",
  parameters: Type.Object({
    query: Type.String({
      description: `搜索关键词或自然语言问题。支持中文自然语言描述（如 "序列2非凡者的扮演守则"）。`,
    }),
    limit: Type.Optional(
      Type.Number({
        description:
          `返回结果数，默认 10，最大 ${TOP_K_VECTOR}。不传则使用默认值。`,
      }),
    ),
  }),
  execute: async (_toolCallId, params) => lookupTool(params),
};

// ===========================================================================
// Utility helpers
// ===========================================================================

function safeStr(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

function safeStrArr(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.length > 0);
  }
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function filenameToTitle(filePath: string): string {
  const name = filePath.split("/").pop()?.replace(/\.md$/i, "") ?? "";
  return name.replace(/[-_]/g, " ").trim();
}

function guessType(filePath: string): string {
  const rel = relative(DATA_ROOT, filePath);
  const topDir = rel.split("/")[0];
  return DIR_KIND_MAP[topDir ?? ""] ?? "设定";
}
