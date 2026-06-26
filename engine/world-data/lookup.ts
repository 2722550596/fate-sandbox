import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isRecord } from "../core/typebox-validation.ts";

export type LookupKind = "角色" | "地点" | "设定" | "时间线";

export interface LookupRequest {
  query: string;
  category?: string;
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

interface LocationEntry {
  id: string;
  name: string;
  category: string;
  summary: string;
  stateLocation: Record<string, string>;
  notes: string[];
}

interface WorldDataStore {
  characters: Record<string, CharacterEntry>;
  world: WorldData;
  timelines: Record<string, string>;
  locations: LocationEntry[];
}

interface LookupEntry {
  key: string;
  text: string;
  searchableText: string;
}

interface MatchedEntry {
  kind: LookupKind;
  key: string;
  text: string;
  score: number;
  reason: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_FUZZY_RESULTS = 5;
const CHARACTER_PREVIEW_LENGTH = 600;
const MIN_FUZZY_SCORE = 52;

let cachedStore: WorldDataStore | null = null;

export function lookupWorldData(request: LookupRequest): LookupResult {
  const query = normalizeQuery(request.query);
  const store = getWorldDataStore();
  const matches = lookupAllKinds(store, query);

  if (matches.length > 0) {
    return { text: formatMatches(matches) };
  }

  return {
    text: `未找到 "${query}" 的相关信息。`,
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
    locations: readLocationData(join(__dirname, "..", "..", "data", "locations.json")),
  };
}

function lookupAllKinds(store: WorldDataStore, query: string): MatchedEntry[] {
  const kinds: LookupKind[] = ["角色", "地点", "设定", "时间线"];
  return kinds
    .flatMap((kind) => lookupByKind(store, kind, query))
    .toSorted(compareMatches)
    .slice(0, MAX_FUZZY_RESULTS);
}

function lookupByKind(store: WorldDataStore, kind: LookupKind, query: string): MatchedEntry[] {
  const handlers: Record<LookupKind, () => LookupEntry[]> = {
    角色: () => [...characterEntries(store.characters)],
    地点: () => [...recordEntries(store.world.地点), ...locationEntries(store.locations)],
    设定: () => [...recordEntries(store.world.核心设定), ...recordEntries(store.world.规则)],
    时间线: () => recordEntries(store.timelines),
  };
  return fuzzyMatchEntries(handlers[kind](), kind, query);
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

function locationEntries(locations: LocationEntry[]): LookupEntry[] {
  return locations.map((location) => ({
    key: location.name,
    text: JSON.stringify(location, null, 2),
    searchableText: [
      location.id,
      location.name,
      location.category,
      location.summary,
      ...Object.values(location.stateLocation),
      ...location.notes,
    ].join("\n"),
  }));
}

function fuzzyMatchEntries(
  entries: LookupEntry[],
  kind: LookupKind,
  query: string,
): MatchedEntry[] {
  const normalizedQuery = normalizeSearchText(query);
  const queryTerms = splitQueryTerms(query);
  return entries
    .map((entry) => scoreEntry(entry, kind, normalizedQuery, queryTerms))
    .filter((match) => match.score >= MIN_FUZZY_SCORE)
    .toSorted(compareMatches)
    .slice(0, MAX_FUZZY_RESULTS);
}

function scoreEntry(
  entry: LookupEntry,
  kind: LookupKind,
  normalizedQuery: string,
  queryTerms: readonly string[],
): MatchedEntry {
  const normalizedKey = normalizeSearchText(entry.key);
  const normalizedSearchableText = normalizeSearchText(entry.searchableText);

  if (normalizedKey === normalizedQuery) {
    return { kind, key: entry.key, text: entry.text, score: 100, reason: "精确匹配" };
  }
  if (normalizedKey.includes(normalizedQuery)) {
    return { kind, key: entry.key, text: entry.text, score: 92, reason: "名称包含关键词" };
  }
  if (normalizedSearchableText.includes(normalizedQuery)) {
    return { kind, key: entry.key, text: entry.text, score: 78, reason: "正文包含关键词" };
  }
  if (queryTerms.length > 1) {
    const keyTermHits = countContainedTerms(normalizedKey, queryTerms);
    const textTermHits = countContainedTerms(normalizedSearchableText, queryTerms);
    if (keyTermHits === queryTerms.length) {
      return { kind, key: entry.key, text: entry.text, score: 88, reason: "名称包含全部关键词" };
    }
    if (textTermHits === queryTerms.length) {
      return { kind, key: entry.key, text: entry.text, score: 84, reason: "正文包含全部关键词" };
    }
    if (textTermHits > 0) {
      const partialScore = Math.round(48 + (textTermHits / queryTerms.length) * 28);
      return {
        kind,
        key: entry.key,
        text: entry.text,
        score: partialScore,
        reason: "正文包含部分关键词",
      };
    }
  }

  const keySimilarity = similarity(normalizedKey, normalizedQuery);
  const fuzzyScore = Math.round(keySimilarity * 100);
  return { kind, key: entry.key, text: entry.text, score: fuzzyScore, reason: "名称模糊匹配" };
}

function compareMatches(left: MatchedEntry, right: MatchedEntry): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  return left.key.localeCompare(right.key, "zh-Hans-CN");
}

function formatMatches(matches: MatchedEntry[]): string {
  return matches.map(formatMatch).join("\n\n---\n\n");
}

function formatMatch(match: MatchedEntry): string {
  const text = match.kind === "角色" ? truncate(match.text, CHARACTER_PREVIEW_LENGTH) : match.text;
  return `### [${match.kind}] ${match.key}（${match.reason}）\n${text}`;
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

function splitQueryTerms(query: string): string[] {
  return query
    .split(/[\s,，、/／|｜]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

function countContainedTerms(key: string, queryTerms: readonly string[]): number {
  return queryTerms.filter((term) => key.includes(term)).length;
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

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\S*$/, "") + "…";
}

function readJsonRecord<T>(
  path: string,
  assertValue: (value: unknown, label: string) => T,
): Record<string, T> {
  const raw = readFileSync(path, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`Invalid JSON data in ${path}: root must be an object.`);
  }
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(parsed)) {
    result[key] = assertValue(value, `${path}.${key}`);
  }
  return result;
}

function readWorldData(path: string): WorldData {
  const raw = readFileSync(path, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`Invalid world data in ${path}: root must be an object.`);
  }
  const 地点 = ensureRecord(parsed["地点"], `${path}.地点`);
  const 核心设定 = ensureRecord(parsed["核心设定"], `${path}.核心设定`);
  const 规则 = ensureRecord(parsed["规则"], `${path}.规则`);
  return { 地点, 核心设定, 规则 };
}

function readLocationData(path: string): LocationEntry[] {
  const raw = readFileSync(path, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  const locations = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed["locations"])
      ? parsed["locations"]
      : [];
  return locations.map((entry: unknown, index: number) =>
    assertLocationEntry(entry, `${path}[${index}]`),
  );
}

function assertStringValue(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid string value at ${label}: expected string.`);
  }
  return value;
}

function assertCharacterEntry(value: unknown, label: string): CharacterEntry {
  if (!isRecord(value)) {
    throw new Error(`Invalid character entry at ${label}: must be an object.`);
  }
  const 类型 = assertStringField(value["类型"], label, "类型");
  const 原文 = assertStringField(value["原文"], label, "原文");
  return {
    类型,
    原文,
    时期: value["时期"] !== undefined ? assertStringField(value["时期"], label, "时期") : undefined,
  };
}

function assertLocationEntry(value: unknown, label: string): LocationEntry {
  if (!isRecord(value)) {
    throw new Error(`Invalid location entry at ${label}: must be an object.`);
  }
  return {
    id: assertStringField(value["id"], label, "id"),
    name: assertStringField(value["name"], label, "name"),
    category: assertStringField(value["category"], label, "category"),
    summary: assertStringField(value["summary"], label, "summary"),
    stateLocation: ensureRecord(value["stateLocation"], `${label}.stateLocation`),
    notes: Array.isArray(value["notes"]) ? value["notes"].map((n: unknown) => String(n)) : [],
  };
}

function assertStringField(value: unknown, label: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${field} at ${label}: must be a non-empty string.`);
  }
  return value.trim();
}

function ensureRecord(value: unknown, label: string): Record<string, string> {
  if (!isRecord(value)) {
    throw new Error(`Invalid record at ${label}: must be an object.`);
  }
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = String(val);
  }
  return result;
}
