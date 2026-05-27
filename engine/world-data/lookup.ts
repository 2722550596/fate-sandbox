import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type LookupKind = "角色" | "地点" | "设定" | "时间线";

export interface LookupRequest {
  查询: string;
  类型?: string;
}

export interface LookupResult {
  text: string;
}

interface CharacterEntry {
  类型: string;
  原文: string;
  时期?: string;
}

interface WorldData {
  地点: Record<string, string>;
  核心设定: Record<string, string>;
  规则: Record<string, string>;
}

interface WorldDataStore {
  characters: Record<string, CharacterEntry>;
  world: WorldData;
  timelines: Record<string, string>;
}

interface LookupEntry {
  key: string;
  text: string;
  searchableText: string;
}

interface MatchedEntry {
  key: string;
  text: string;
  score: number;
  reason: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_CHARACTER_RESULTS = 3;
const MAX_FUZZY_RESULTS = 5;
const CHARACTER_PREVIEW_LENGTH = 600;
const MIN_FUZZY_SCORE = 52;

let cachedStore: WorldDataStore | null = null;

export function lookupWorldData(request: LookupRequest): LookupResult {
  const query = normalizeQuery(request.查询);
  const kinds = resolveKinds(request.类型);
  const store = getWorldDataStore();

  for (const kind of kinds) {
    const matches = lookupByKind(store, kind, query);
    if (matches.length > 0) {
      return { text: formatMatches(kind, matches) };
    }
  }

  return {
    text: `未找到 "${query}" 的相关信息。可用查询类型: 角色/从者/地点/设定/时间线。`,
  };
}

function getWorldDataStore(): WorldDataStore {
  if (cachedStore === null) {
    cachedStore = loadWorldDataStore();
  }
  return cachedStore;
}

function loadWorldDataStore(): WorldDataStore {
  return {
    characters: readJsonRecord(
      join(__dirname, "..", "..", "data", "characters.json"),
      assertCharacterEntry,
    ),
    world: readWorldData(join(__dirname, "..", "..", "data", "world.json")),
    timelines: readJsonRecord(
      join(__dirname, "..", "..", "data", "timelines.json"),
      assertStringValue,
    ),
  };
}

function lookupByKind(store: WorldDataStore, kind: LookupKind, query: string): MatchedEntry[] {
  const handlers: Record<LookupKind, () => LookupEntry[]> = {
    角色: () => characterEntries(store.characters),
    地点: () => recordEntries(store.world.地点),
    设定: () => [...recordEntries(store.world.核心设定), ...recordEntries(store.world.规则)],
    时间线: () => recordEntries(store.timelines),
  };
  return fuzzyMatchEntries(handlers[kind](), query);
}

function characterEntries(characters: Record<string, CharacterEntry>): LookupEntry[] {
  return Object.entries(characters).map(([key, character]) => ({
    key,
    text: character.原文,
    searchableText: [key, character.类型, character.时期 ?? "", character.原文].join("\n"),
  }));
}

function recordEntries(record: Record<string, string>): LookupEntry[] {
  return Object.entries(record).map(([key, value]) => ({
    key,
    text: value,
    searchableText: [key, value].join("\n"),
  }));
}

function fuzzyMatchEntries(entries: LookupEntry[], query: string): MatchedEntry[] {
  const normalizedQuery = normalizeSearchText(query);
  return entries
    .map((entry) => scoreEntry(entry, normalizedQuery))
    .filter((match) => match.score >= MIN_FUZZY_SCORE)
    .toSorted(compareMatches)
    .slice(0, MAX_FUZZY_RESULTS);
}

function scoreEntry(entry: LookupEntry, normalizedQuery: string): MatchedEntry {
  const normalizedKey = normalizeSearchText(entry.key);
  const normalizedSearchableText = normalizeSearchText(entry.searchableText);

  if (normalizedKey === normalizedQuery) {
    return { key: entry.key, text: entry.text, score: 100, reason: "精确匹配" };
  }
  if (normalizedKey.includes(normalizedQuery)) {
    return { key: entry.key, text: entry.text, score: 92, reason: "名称包含关键词" };
  }
  if (normalizedSearchableText.includes(normalizedQuery)) {
    return { key: entry.key, text: entry.text, score: 78, reason: "正文包含关键词" };
  }

  const keySimilarity = similarity(normalizedKey, normalizedQuery);
  const fuzzyScore = Math.round(keySimilarity * 100);
  return { key: entry.key, text: entry.text, score: fuzzyScore, reason: "名称模糊匹配" };
}

function compareMatches(left: MatchedEntry, right: MatchedEntry): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  return left.key.localeCompare(right.key, "zh-Hans-CN");
}

function formatMatches(kind: LookupKind, matches: MatchedEntry[]): string {
  if (kind !== "角色") {
    return matches.map(formatMatch).join("\n\n");
  }

  const visible = matches.slice(0, MAX_CHARACTER_RESULTS).map((match) => {
    const preview = truncate(match.text, CHARACTER_PREVIEW_LENGTH);
    return `### ${match.key}（${match.reason}）\n${preview}`;
  });
  const hint =
    matches.length > MAX_CHARACTER_RESULTS
      ? `\n\n（另有 ${matches.length - MAX_CHARACTER_RESULTS} 条匹配结果，请缩小查询范围）`
      : "";
  return visible.join("\n\n---\n\n") + hint;
}

function formatMatch(match: MatchedEntry): string {
  return `### ${match.key}（${match.reason}）\n${match.text}`;
}

function resolveKinds(rawKind: string | undefined): LookupKind[] {
  if (rawKind === undefined || rawKind.trim().length === 0) {
    return ["角色", "地点", "设定", "时间线"];
  }

  const kind = rawKind.trim();
  switch (kind) {
    case "角色":
    case "人物":
    case "从者":
    case "英灵":
      return ["角色"];
    case "地点":
    case "位置":
      return ["地点"];
    case "设定":
    case "规则":
    case "概念":
      return ["设定"];
    case "时间线":
    case "历史":
      return ["时间线"];
    default:
      throw new Error(`无效查询类型: ${kind}。可选: 角色/从者/地点/设定/时间线。`);
  }
}

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
    .replace(/[\s·・.＿_\-—:：()（）[\]【】{}]/g, "");
}

function similarity(left: string, right: string): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const distance = levenshteinDistance(left, right);
  const maxLength = Math.max(left.length, right.length);
  return 1 - distance / maxLength;
}

function levenshteinDistance(left: string, right: string): number {
  const leftChars = Array.from(left);
  const rightChars = Array.from(right);
  let previous = Array.from({ length: rightChars.length + 1 }, (_value, index) => index);

  for (const [leftIndex, leftChar] of leftChars.entries()) {
    const current = [leftIndex + 1];
    for (const [rightIndex, rightChar] of rightChars.entries()) {
      const currentCost = current[rightIndex];
      const nextPreviousCost = previous[rightIndex + 1];
      const previousCost = previous[rightIndex];
      if (
        currentCost === undefined ||
        nextPreviousCost === undefined ||
        previousCost === undefined
      ) {
        throw new Error("levenshteinDistance: distance matrix is malformed.");
      }
      const insertion = currentCost + 1;
      const deletion = nextPreviousCost + 1;
      const substitution = previousCost + (leftChar === rightChar ? 0 : 1);
      current.push(Math.min(insertion, deletion, substitution));
    }
    previous = current;
  }

  const distance = previous[rightChars.length];
  if (distance === undefined) {
    throw new Error("levenshteinDistance: distance row is empty.");
  }
  return distance;
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

function readWorldData(path: string): WorldData {
  const raw = readJson(path);
  if (!isRecord(raw)) {
    throw new Error(`Invalid world data ${path}: root must be an object.`);
  }
  return {
    地点: assertStringRecord(raw["地点"], `${path}.地点`),
    核心设定: assertStringRecord(raw["核心设定"], `${path}.核心设定`),
    规则: assertStringRecord(raw["规则"], `${path}.规则`),
  };
}

function readJsonRecord<T>(
  path: string,
  assertValue: (value: unknown, label: string) => T,
): Record<string, T> {
  const raw = readJson(path);
  if (!isRecord(raw)) {
    throw new Error(`Invalid JSON data ${path}: root must be an object.`);
  }

  const entries = Object.entries(raw).map(([key, value]) => [
    key,
    assertValue(value, `${path}.${key}`),
  ]);
  return Object.fromEntries(entries);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function assertCharacterEntry(value: unknown, label: string): CharacterEntry {
  if (!isRecord(value)) {
    throw new Error(`Invalid character data ${label}: entry must be an object.`);
  }
  return {
    类型: assertStringValue(value["类型"], `${label}.类型`),
    原文: assertStringValue(value["原文"], `${label}.原文`),
    时期: assertOptionalString(value["时期"], `${label}.时期`),
  };
}

function assertStringRecord(value: unknown, label: string): Record<string, string> {
  if (!isRecord(value)) {
    throw new Error(`Invalid world data ${label}: value must be an object.`);
  }

  const entries = Object.entries(value).map(([key, entryValue]) => [
    key,
    assertStringValue(entryValue, `${label}.${key}`),
  ]);
  return Object.fromEntries(entries);
}

function assertStringValue(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid data ${label}: value must be a string.`);
  }
  return value;
}

function assertOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid data ${label}: value must be a string when present.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
