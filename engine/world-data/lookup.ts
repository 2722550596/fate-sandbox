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

interface ServantDataFile {
  servants: ServantEntry[];
}

interface ServantEntry {
  id: string;
  name: string;
  aliases: string[];
  className: string;
  trueName: string;
  parameters: Record<string, string>;
  noblePhantasms: Array<{ name: string; rank: string; kind: string; summary: string }>;
  notes: string[];
}

interface LocationDataFile {
  locations: LocationEntry[];
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
  servants: ServantEntry[];
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
    servants: readServantData(join(__dirname, "..", "..", "data", "servants.json")),
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
    角色: () => [...characterEntries(store.characters), ...servantEntries(store.servants)],
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

function servantEntries(servants: ServantEntry[]): LookupEntry[] {
  return servants.map((servant) => ({
    key: servant.name,
    text: formatServantEntry(servant),
    searchableText: [
      servant.id,
      servant.name,
      servant.className,
      servant.trueName,
      ...servant.aliases,
      ...servant.notes,
      ...Object.values(servant.parameters),
      ...servant.noblePhantasms.flatMap((noblePhantasm) => [
        noblePhantasm.name,
        noblePhantasm.rank,
        noblePhantasm.kind,
        noblePhantasm.summary,
      ]),
    ].join("\n"),
  }));
}

function formatServantEntry(servant: ServantEntry): string {
  return [
    `名称：${servant.name}`,
    `职阶：${servant.className}`,
    `真名：${servant.trueName}`,
    `别名：${servant.aliases.join("、")}`,
    `参数：${formatServantParameters(servant.parameters)}`,
    "宝具：",
    ...servant.noblePhantasms.map(formatNoblePhantasm),
    "备注：",
    ...servant.notes.map((note) => `- ${note}`),
  ].join("\n");
}

function formatServantParameters(parameters: Record<string, string>): string {
  const labels: Record<string, string> = {
    strength: "筋力",
    endurance: "耐久",
    agility: "敏捷",
    mana: "魔力",
    luck: "幸运",
    noblePhantasm: "宝具",
  };
  return Object.entries(labels)
    .map(([key, label]) => `${label} ${parameters[key] ?? "?"}`)
    .join(" / ");
}

function formatNoblePhantasm(noblePhantasm: ServantEntry["noblePhantasms"][number]): string {
  return `- ${noblePhantasm.name}（${noblePhantasm.rank}，${noblePhantasm.kind}）：${noblePhantasm.summary}`;
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
    .map(normalizeSearchText)
    .filter((term) => term.length > 0);
}

function countContainedTerms(text: string, terms: readonly string[]): number {
  return terms.filter((term) => text.includes(term)).length;
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

function readServantData(path: string): ServantEntry[] {
  const raw = readJson(path);
  const file = assertServantDataFile(raw, path);
  return file.servants;
}

function readLocationData(path: string): LocationEntry[] {
  const raw = readJson(path);
  const file = assertLocationDataFile(raw, path);
  return file.locations;
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

function assertServantDataFile(value: unknown, label: string): ServantDataFile {
  if (!isRecord(value)) {
    throw new Error(`Invalid servant data ${label}: root must be an object.`);
  }
  const servantsRaw = value["servants"];
  if (!Array.isArray(servantsRaw)) {
    throw new Error(`Invalid servant data ${label}: servants must be an array.`);
  }
  return {
    servants: servantsRaw.map((entry, index) =>
      assertServantEntry(entry, `${label}.servants[${index}]`),
    ),
  };
}

function assertServantEntry(value: unknown, label: string): ServantEntry {
  if (!isRecord(value)) {
    throw new Error(`Invalid servant data ${label}: entry must be an object.`);
  }
  return {
    id: assertStringValue(value["id"], `${label}.id`),
    name: assertStringValue(value["name"], `${label}.name`),
    aliases: assertStringArray(value["aliases"], `${label}.aliases`),
    className: assertStringValue(value["className"], `${label}.className`),
    trueName: assertStringValue(value["trueName"], `${label}.trueName`),
    parameters: assertStringRecord(value["parameters"], `${label}.parameters`),
    noblePhantasms: assertNoblePhantasmEntries(value["noblePhantasms"], `${label}.noblePhantasms`),
    notes: assertStringArray(value["notes"], `${label}.notes`),
  };
}

function assertNoblePhantasmEntries(
  value: unknown,
  label: string,
): Array<{ name: string; rank: string; kind: string; summary: string }> {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid servant data ${label}: noblePhantasms must be an array.`);
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid servant data ${label}[${index}]: entry must be an object.`);
    }
    return {
      name: assertStringValue(entry["name"], `${label}[${index}].name`),
      rank: assertStringValue(entry["rank"], `${label}[${index}].rank`),
      kind: assertStringValue(entry["kind"], `${label}[${index}].kind`),
      summary: assertStringValue(entry["summary"], `${label}[${index}].summary`),
    };
  });
}

function assertLocationDataFile(value: unknown, label: string): LocationDataFile {
  if (!isRecord(value)) {
    throw new Error(`Invalid location data ${label}: root must be an object.`);
  }
  const locationsRaw = value["locations"];
  if (!Array.isArray(locationsRaw)) {
    throw new Error(`Invalid location data ${label}: locations must be an array.`);
  }
  return {
    locations: locationsRaw.map((entry, index) =>
      assertLocationEntry(entry, `${label}.locations[${index}]`),
    ),
  };
}

function assertLocationEntry(value: unknown, label: string): LocationEntry {
  if (!isRecord(value)) {
    throw new Error(`Invalid location data ${label}: entry must be an object.`);
  }
  return {
    id: assertStringValue(value["id"], `${label}.id`),
    name: assertStringValue(value["name"], `${label}.name`),
    category: assertStringValue(value["category"], `${label}.category`),
    summary: assertStringValue(value["summary"], `${label}.summary`),
    stateLocation: assertStringRecord(value["stateLocation"], `${label}.stateLocation`),
    notes: assertStringArray(value["notes"], `${label}.notes`),
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

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid data ${label}: value must be an array.`);
  }
  return value.map((entry, index) => assertStringValue(entry, `${label}[${index}]`));
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
