import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isRecord } from "../core/typebox-validation.ts";

interface CharacterNameEntry {
  canonicalName: string;
  aliases: string[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
let cachedEntries: CharacterNameEntry[] | null = null;

export function resolveCanonicalCharacterName(displayName: string): string | undefined {
  const normalized = normalizeName(displayName);
  if (normalized.length < 4) {
    return undefined;
  }
  const prefixMatches = characterNameEntries().filter((entry) =>
    entry.aliases.some((alias) => normalized.startsWith(normalizeName(alias))),
  );
  if (prefixMatches.length > 0 && sameCanonicalName(prefixMatches)) {
    return prefixMatches[0]?.canonicalName;
  }
  const exactMatches = characterNameEntries().filter(
    (entry) =>
      normalizeName(entry.canonicalName) === normalized ||
      entry.aliases.some((alias) => normalizeName(alias) === normalized),
  );
  if (exactMatches.length === 0 || !sameCanonicalName(exactMatches)) {
    return undefined;
  }
  return exactMatches[0]?.canonicalName;
}

function sameCanonicalName(entries: readonly CharacterNameEntry[]): boolean {
  const first = entries[0];
  return (
    first !== undefined && entries.every((entry) => entry.canonicalName === first.canonicalName)
  );
}

function characterNameEntries(): CharacterNameEntry[] {
  if (cachedEntries === null) {
    cachedEntries = loadCharacterNameEntries();
  }
  return cachedEntries;
}

function loadCharacterNameEntries(): CharacterNameEntry[] {
  const raw = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "data", "characters.json"), "utf-8"),
  ) as unknown;
  if (!isRecord(raw)) {
    throw new Error("characters.json root must be an object.");
  }
  return Object.entries(raw)
    .map(([key, value]) => parseCharacterNameEntry(key, value))
    .filter((entry) => entry !== undefined);
}

function parseCharacterNameEntry(key: string, value: unknown): CharacterNameEntry | undefined {
  if (!isRecord(value) || typeof value["原文"] !== "string") {
    return undefined;
  }
  const source = value["原文"];
  const canonicalName = extractLineValue(source, "名字") ?? key;
  const aliases =
    extractLineValue(source, "别名")
      ?.split(";")
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0) ?? [];
  return { canonicalName, aliases };
}

function extractLineValue(source: string, label: string): string | undefined {
  for (const line of source.split("\n")) {
    const prefix = `${label}:`;
    if (line.startsWith(prefix)) {
      const value = line.slice(prefix.length).trim();
      return value.length > 0 ? value : undefined;
    }
  }
  return undefined;
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s・·._-]+/gu, "");
}
