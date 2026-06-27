import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { getPathwaySequences, listPathways } from "./sequence-lookup.ts";
import { parseFrontmatter } from "./frontmatter.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = join(__dirname, "..", "..", "data");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LookupKind = "角色" | "地点" | "组织" | "途径" | "物品" | "设定" | "经济" | "机制";

export interface LookupRequest {
  query: string;
  category?: LookupKind;
}

export interface LookupResult {
  text: string;
}

interface MdDocument {
  /** data/ 下的相对路径，如 characters/klein-moretti.md */
  relPath: string;
  title: string;
  kind: LookupKind;
  tags: string[];
  aliases: string[];
  body: string;
  /** 用于搜索的全文 */
  searchableText: string;
}

interface MatchedEntry {
  kind: LookupKind;
  key: string;
  text: string;
  score: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// 目录 → LookupKind 映射
// ---------------------------------------------------------------------------

const DIR_KIND_MAP: Record<string, LookupKind> = {
  characters: "角色",
  locations: "地点",
  organizations: "组织",
  items: "物品",
  lore: "设定",
  mechanics: "机制",
  abilities: "途径",
};

// ---------------------------------------------------------------------------
// 缓存
// ---------------------------------------------------------------------------

let cachedDocIndex: MdDocument[] | null = null;

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

export function lookupWorldData(request: LookupRequest): LookupResult {
  // 途径走 pathway 索引（易读格式化输出），不走 MD 文件扫描
  if (request.category === "途径") {
    return lookupPathway(request.query);
  }

  const query = normalizeQuery(request.query);
  const docs = getDocIndex();
  const matches = lookupAll(docs, query, request.category);

  if (matches.length > 0) {
    return { text: formatMatches(matches) };
  }

  return { text: `未找到 "${query}" 的相关信息。` };
}

// ---------------------------------------------------------------------------
// 文档索引构建
// ---------------------------------------------------------------------------

function getDocIndex(): MdDocument[] {
  if (cachedDocIndex === null) {
    cachedDocIndex = buildDocIndex();
  }
  return cachedDocIndex;
}

function buildDocIndex(): MdDocument[] {
  const docs: MdDocument[] = [];

  // 扫描子目录（每个目录对应一种 LookupKind）
  for (const dirName of Object.keys(DIR_KIND_MAP)) {
    const dirPath = join(DATA_ROOT, dirName);
    try {
      if (!statSync(dirPath).isDirectory()) continue;
    } catch {
      continue; // 目录还不存在
    }

    const kind: LookupKind = DIR_KIND_MAP[dirName] ?? "设定";
    const files = readdirSync(dirPath).filter((f) => extname(f).toLowerCase() === ".md");

    for (const file of files) {
      const filePath = join(dirPath, file);
      const doc = parseMdFile(filePath, kind);
      if (doc !== null) {
        docs.push(doc);
      }
    }
  }

  // 扫描 data/ 根目录的独立 .md 文件（如 economy.md, narrative.md）
  try {
    const rootFiles = readdirSync(DATA_ROOT).filter(
      (f) => extname(f).toLowerCase() === ".md" && f !== "NOTICE.md",
    );
    for (const file of rootFiles) {
      const filePath = join(DATA_ROOT, file);
      if (statSync(filePath).isFile()) {
        const name = file.replace(/\.md$/i, "");
        // 根据文件名推断 kind
        const kind = guessRootFileKind(name);
        const doc = parseMdFile(filePath, kind);
        if (doc !== null) {
          docs.push(doc);
        }
      }
    }
  } catch {
    // 根目录可能没有 md 文件
  }

  return docs;
}

function guessRootFileKind(filename: string): LookupKind {
  const map: Record<string, LookupKind> = {
    economy: "经济",
    narrative: "设定",
    theater: "设定",
    "system-rules": "机制",
    "world-lore": "设定",
  };
  return map[filename] ?? "设定";
}

// ---------------------------------------------------------------------------
// MD 文件解析
// ---------------------------------------------------------------------------

function parseMdFile(filePath: string, fallbackKind: LookupKind): MdDocument | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = parseFrontmatter(raw);

    const frontmatterAttrs = parsed?.attrs ?? {};
    const body = parsed?.body ?? raw;

    // 从 frontmatter 提取字段
    const title = safeStr(frontmatterAttrs["title"]) ?? filenameToTitle(filePath);
    const type = safeStr(frontmatterAttrs["type"]);
    const tags = safeStrArr(frontmatterAttrs["tags"]);
    const aliases = safeStrArr(frontmatterAttrs["aliases"]);

    // 如果 frontmatter 指定了 type，用它覆盖 kind
    const kind = typeToKind(type) ?? fallbackKind;

    // 构建全文搜索文本
    const relPath = relative(DATA_ROOT, filePath);
    const searchableText = [title, ...tags, ...aliases, body].join("\n");

    return { relPath, title, kind, tags, aliases, body, searchableText };
  } catch {
    return null;
  }
}

function filenameToTitle(filePath: string): string {
  const name = filePath.split(sep).pop()?.replace(/\.md$/i, "") ?? "";
  // 把 kebab-case 转成空格分隔
  return name.replace(/[-_]/g, " ");
}

function typeToKind(type: string | undefined): LookupKind | undefined {
  const map: Record<string, LookupKind> = {
    character: "角色",
    location: "地点",
    organization: "组织",
    pathway: "途径",
    item: "物品",
    lore: "设定",
    mechanic: "机制",
    economy: "经济",
  };
  return type !== undefined ? map[type] : undefined;
}

// ---------------------------------------------------------------------------
// 搜索
// ---------------------------------------------------------------------------

const MAX_FUZZY_RESULTS = 5;
const MIN_FUZZY_SCORE = 52;
const BODY_PREVIEW_LENGTH = 600;

/** 途径查询：通过 sequence-lookup.ts 返回途径序列结构 */
function lookupPathway(query: string): LookupResult {
  const normalized = query.trim();
  // 列出所有途径
  if (normalized === "" || normalized === "列表" || normalized === "all") {
    const names = listPathways();
    const lines = names.map((name) => {
      const seqs = getPathwaySequences(name);
      const seqCount = seqs !== null ? Object.keys(seqs).length : 0;
      return `- ${name}（${seqCount} 个序列等级）`;
    });
    return { text: `## 途径列表（共 ${names.length} 个）\n${lines.join("\n")}` };
  }

  // 精确匹配途径名
  const seqs = getPathwaySequences(normalized);
  if (seqs !== null) {
    const lines: string[] = [];
    const SEQ_ORDER = ["seq-9","seq-8","seq-7","seq-6","seq-5","seq-4","seq-3","seq-2","seq-1","seq-0","old-one","pillar"];
    const SEQ_LABEL: Record<string,string> = {
      "seq-0":"序列 0","seq-1":"序列 1","seq-2":"序列 2","seq-3":"序列 3",
      "seq-4":"序列 4","seq-5":"序列 5","seq-6":"序列 6","seq-7":"序列 7",
      "seq-8":"序列 8","seq-9":"序列 9","pillar":"支柱","old-one":"旧日",
    };
    lines.push(`# ${normalized}`);
    lines.push("");
    lines.push("## 序列等级");
    for (const rank of SEQ_ORDER) {
      const seqName = seqs[rank];
      if (seqName === undefined) continue;
      const label = SEQ_LABEL[rank] ?? rank;
      lines.push(`- ${label}：${seqName}`);
    }
    return { text: lines.join("\n") };
  }

  // 模糊匹配
  const allPaths = listPathways();
  const matches = allPaths.filter((n) => n.includes(normalized));
  if (matches.length > 0) {
    return {
      text: `未找到精确匹配「${normalized}」，相近途径：${matches.join("、")}。请用准确名称查询。`,
    };
  }

  return { text: `未找到途径「${normalized}」。可用「途径/列表」查看全部。` };
}


function lookupAll(docs: MdDocument[], query: string, category?: LookupKind): MatchedEntry[] {
  let candidates = docs;
  if (category !== undefined) {
    candidates = docs.filter((d) => d.kind === category);
  }

  return fuzzyMatchEntries(candidates, query).toSorted(compareMatches).slice(0, MAX_FUZZY_RESULTS);
}

function fuzzyMatchEntries(docs: MdDocument[], query: string): MatchedEntry[] {
  const normalizedQuery = normalizeSearchText(query);
  const queryTerms = splitQueryTerms(query);

  return docs
    .map((doc) => scoreDoc(doc, normalizedQuery, queryTerms))
    .filter((match) => match.score >= MIN_FUZZY_SCORE);
}

function scoreDoc(
  doc: MdDocument,
  normalizedQuery: string,
  queryTerms: readonly string[],
): MatchedEntry {
  const normalizedTitle = normalizeSearchText(doc.title);
  const normalizedAliases = doc.aliases.map(normalizeSearchText);
  const normalizedTags = doc.tags.map(normalizeSearchText);
  const normalizedBody = normalizeSearchText(doc.searchableText);

  // 精确匹配标题
  if (normalizedTitle === normalizedQuery) {
    return makeMatch(doc, 100, "精确匹配");
  }

  // 别名精确匹配
  for (const alias of normalizedAliases) {
    if (alias === normalizedQuery) {
      return makeMatch(doc, 98, "别名精确匹配");
    }
  }

  // 标题包含关键词
  if (normalizedTitle.includes(normalizedQuery)) {
    return makeMatch(doc, 92, "标题包含关键词");
  }

  // 别名包含关键词
  for (const alias of normalizedAliases) {
    if (alias.includes(normalizedQuery)) {
      return makeMatch(doc, 88, "别名包含关键词");
    }
  }

  // 标签匹配
  for (const tag of normalizedTags) {
    if (tag.includes(normalizedQuery)) {
      return makeMatch(doc, 85, "标签匹配");
    }
  }

  // 正文包含关键词
  if (normalizedBody.includes(normalizedQuery)) {
    return makeMatch(doc, 78, "正文包含关键词");
  }

  // 多关键词部分匹配
  if (queryTerms.length > 1) {
    const keyTermHits = countContainedTerms(normalizedTitle, queryTerms);
    const aliasTermHits = countContainedTerms(normalizedAliases.join(" "), queryTerms);
    const allTermHits = countContainedTerms(normalizedBody, queryTerms);

    if (keyTermHits === queryTerms.length || aliasTermHits === queryTerms.length) {
      return makeMatch(doc, 88, "名称包含全部关键词");
    }
    if (allTermHits === queryTerms.length) {
      return makeMatch(doc, 84, "正文包含全部关键词");
    }
    if (allTermHits > 0) {
      const partialScore = Math.round(48 + (allTermHits / queryTerms.length) * 28);
      return makeMatch(doc, partialScore, "正文包含部分关键词");
    }
  }

  // 模糊匹配
  const titleSimilarity = similarity(normalizedTitle, normalizedQuery);
  const fuzzyScore = Math.round(titleSimilarity * 100);
  return makeMatch(doc, fuzzyScore, "模糊匹配");
}

function makeMatch(doc: MdDocument, score: number, reason: string): MatchedEntry {
  return {
    kind: doc.kind,
    key: doc.title,
    text:
      doc.body.length > BODY_PREVIEW_LENGTH
        ? doc.body.slice(0, BODY_PREVIEW_LENGTH).replace(/\s+\S*$/, "") + "…"
        : doc.body,
    score,
    reason,
  };
}

function compareMatches(left: MatchedEntry, right: MatchedEntry): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  return left.key.localeCompare(right.key, "zh-Hans-CN");
}

// ---------------------------------------------------------------------------
// 格式化
// ---------------------------------------------------------------------------

function formatMatches(matches: MatchedEntry[]): string {
  return matches.map(formatMatch).join("\n\n---\n\n");
}

function formatMatch(match: MatchedEntry): string {
  return `### [${match.kind}] ${match.key}（${match.reason}）\n${match.text}`;
}

// ---------------------------------------------------------------------------
// 文本工具
// ---------------------------------------------------------------------------

function normalizeQuery(query: string): string {
  const normalized = query.trim();
  if (normalized.length === 0) {
    throw new Error("查询不能为空。");
  }
  return normalized;
}

function normalizeSearchText(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s·・.＿_\-—:：()（）[\]【】{}#*~`>`|]/g, "");
}

function splitQueryTerms(query: string): string[] {
  return query
    .split(/[\s,，、/／|｜]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

function countContainedTerms(text: string, queryTerms: readonly string[]): number {
  return queryTerms.filter((term) => text.includes(term)).length;
}

function similarity(text: string, query: string): number {
  const pairs1 = getBigrams(text);
  const pairs2 = getBigrams(query);
  const union = new Set([...pairs1, ...pairs2]);
  const intersection = pairs1.filter((pair) => pairs2.includes(pair));
  return union.size === 0 ? 0 : intersection.length / union.size;
}

function getBigrams(text: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < text.length - 1; i += 1) {
    bigrams.push(text.slice(i, i + 2));
  }
  return bigrams;
}

// ---------------------------------------------------------------------------
// 安全取值工具
// ---------------------------------------------------------------------------

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
