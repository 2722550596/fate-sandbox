import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { lookupAbilities, parseAbilityQuery } from "./ability-lookup.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { getPathwaySequences, listPathways } from "./sequence-lookup.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = join(__dirname, "..", "..", "data");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LookupKind = "角色" | "地点" | "组织" | "途径" | "物品" | "设定" | "经济" | "机制";

/** English/alias → LookupKind resolution for lenient category matching */
const CATEGORY_ALIASES: Record<string, LookupKind> = {
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
};

export interface LookupRequest {
  query: string;
  category?: string;
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
  // 序列名/途径-序列 → 走能力查询
  const abilityQuery = parseAbilityQuery(request.query);
  if (abilityQuery !== null) {
    return lookupAbilities(request.query);
  }

  // 途径走 pathway 索引（易读格式化输出），不走 MD 文件扫描
  const resolvedCategory = resolveCategory(request.category);
  if (resolvedCategory === "途径") {
    return lookupPathway(request.query);
  }

  const query = normalizeQuery(request.query);
  const docs = getDocIndex();
  const matches = lookupAll(docs, query, resolvedCategory);

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
const MIN_FUZZY_SCORE = 40;
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
    const SEQ_ORDER = [
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
    ];
    const SEQ_LABEL: Record<string, string> = {
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
  // Lenient category: always search all docs, but boost matches in the right category
  return fuzzyMatchEntries(docs, query, category)
    .toSorted(compareMatches)
    .slice(0, MAX_FUZZY_RESULTS);
}

function fuzzyMatchEntries(
  docs: MdDocument[],
  query: string,
  category?: LookupKind,
): MatchedEntry[] {
  const normalizedQuery = normalizeSearchText(query);
  const queryTerms = splitQueryTerms(query);

  return docs
    .map((doc) => scoreDoc(doc, normalizedQuery, queryTerms, category))
    .filter((match) => match.score >= MIN_FUZZY_SCORE);
}

function scoreDoc(
  doc: MdDocument,
  normalizedQuery: string,
  queryTerms: readonly string[],
  category?: LookupKind,
): MatchedEntry {
  const normalizedTitle = normalizeSearchText(doc.title);
  const normalizedAliases = doc.aliases.map(normalizeSearchText);
  const normalizedTags = doc.tags.map(normalizeSearchText);
  const normalizedBody = normalizeSearchText(doc.searchableText);

  // Category bonus: exact match → +15, mismatch → no penalty, wrong category → -10
  let categoryBonus = 0;
  if (category !== undefined) {
    if (doc.kind === category) {
      categoryBonus = 15;
    } else {
      categoryBonus = -10;
    }
  }

  // 精确匹配标题
  if (normalizedTitle === normalizedQuery) {
    return makeMatch(
      doc,
      100 + categoryBonus,
      categoryBonus > 0 ? "精确匹配（分类优先）" : "精确匹配",
    );
  }

  // 别名精确匹配
  for (const alias of normalizedAliases) {
    if (alias === normalizedQuery) {
      return makeMatch(
        doc,
        98 + categoryBonus,
        categoryBonus > 0 ? "别名精确匹配（分类优先）" : "别名精确匹配",
      );
    }
  }

  // 标题包含查询
  if (normalizedTitle.includes(normalizedQuery)) {
    return makeMatch(doc, 92 + categoryBonus, "标题包含查询");
  }

  // 别名包含查询
  for (const alias of normalizedAliases) {
    if (alias.includes(normalizedQuery)) {
      return makeMatch(doc, 88 + categoryBonus, "别名包含查询");
    }
  }

  // 标签匹配
  for (const tag of normalizedTags) {
    if (tag.includes(normalizedQuery)) {
      return makeMatch(doc, 85 + categoryBonus, "标签匹配");
    }
  }

  // 正文包含查询（完整查询串）
  if (normalizedBody.includes(normalizedQuery)) {
    return makeMatch(doc, 78 + categoryBonus, "正文包含查询");
  }

  // 单个查询词正文匹配（逐词匹配原文）
  if (queryTerms.length >= 1) {
    const normalizedTerms = queryTerms.map(normalizeSearchText);
    const titleTermHits = countContainedTerms(normalizedTitle, normalizedTerms);
    const aliasTermHits = countContainedTerms(normalizedAliases.join(" "), normalizedTerms);
    const bodyTermHits = countContainedTerms(normalizedBody, normalizedTerms);

    // 名称包含全部关键词
    if (titleTermHits === normalizedTerms.length) {
      return makeMatch(doc, 90 + categoryBonus, "标题包含全部关键词");
    }
    if (aliasTermHits === normalizedTerms.length) {
      return makeMatch(doc, 86 + categoryBonus, "别名包含全部关键词");
    }

    // 正文包含全部关键词
    if (bodyTermHits === normalizedTerms.length) {
      return makeMatch(doc, 82 + categoryBonus, "正文包含全部关键词");
    }

    // 正文包含部分关键词
    if (bodyTermHits > 0) {
      const partialScore = Math.round(46 + (bodyTermHits / normalizedTerms.length) * 30);
      return makeMatch(doc, partialScore + categoryBonus, "正文包含部分关键词");
    }
  }

  // 正文/别名模糊匹配（bigram similarity）
  const aliasSim =
    normalizedAliases.length > 0
      ? Math.max(...normalizedAliases.map((a) => similarity(a, normalizedQuery)))
      : 0;
  const bodySim = similarity(normalizedBody.slice(0, 300), normalizedQuery);
  const bestFuzzy = Math.max(aliasSim, bodySim);

  if (bestFuzzy >= 0.35) {
    const fuzzyScore = Math.round(bestFuzzy * 100);
    const reason = aliasSim >= bodySim ? "别名模糊匹配" : "正文模糊匹配";
    return makeMatch(doc, fuzzyScore + categoryBonus, reason);
  }

  // 标题模糊匹配
  const titleSimilarity = similarity(normalizedTitle, normalizedQuery);
  const fuzzyScore = Math.round(titleSimilarity * 100);
  return makeMatch(doc, fuzzyScore + categoryBonus, "标题模糊匹配");
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

/** Resolve a category string (Chinese or English alias) to a LookupKind, or undefined if unrecognized */
function resolveCategory(category: string | undefined): LookupKind | undefined {
  if (category === undefined) return undefined;
  const trimmed = category.trim();
  if (trimmed.length === 0) return undefined;
  // Direct LookupKind match
  const KIND_VALUES: readonly LookupKind[] = [
    "角色",
    "地点",
    "组织",
    "途径",
    "物品",
    "设定",
    "经济",
    "机制",
  ];
  for (const kind of KIND_VALUES) {
    if (trimmed === kind) return kind;
  }
  // Alias resolution
  return CATEGORY_ALIASES[trimmed.toLowerCase()];
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
