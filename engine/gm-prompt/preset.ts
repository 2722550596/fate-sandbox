import { readFileSync } from "node:fs";
import { join } from "node:path";

export type PromptSlot = "pre-history" | "pre-response" | "final-contract";
export type RuntimePromptSource = "state-brief";

export interface PromptPreset {
  version: 1;
  modules: PromptPresetModule[];
}

export interface PromptPresetModule {
  id: string;
  enabled: boolean;
  slot: PromptSlot;
  priority: number;
  header: string;
  source: PromptSource;
}

export type PromptSource =
  | { kind: "file"; path: string }
  | { kind: "runtime"; name: RuntimePromptSource };

const PROMPT_SLOTS: readonly string[] = ["pre-history", "pre-response", "final-contract"];
const RUNTIME_SOURCES: readonly string[] = ["state-brief"];

export function loadPromptPreset(projectRoot: string): PromptPreset {
  const path = join(projectRoot, "agents", "preset.json");
  const raw = readFileSync(path, "utf-8");
  return parsePromptPreset(JSON.parse(raw), path);
}

export function parsePromptPreset(raw: unknown, sourcePath: string): PromptPreset {
  if (!isRecord(raw)) {
    throw new Error(`Invalid prompt preset ${sourcePath}: root must be an object.`);
  }
  if (raw["version"] !== 1) {
    throw new Error(`Invalid prompt preset ${sourcePath}: version must be 1.`);
  }
  const rawModules = raw["modules"];
  if (!Array.isArray(rawModules)) {
    throw new Error(`Invalid prompt preset ${sourcePath}: modules must be an array.`);
  }
  const modules = rawModules.map((module, index) =>
    parsePromptPresetModule(module, sourcePath, index),
  );
  assertUniqueModuleIds(modules, sourcePath);
  return { version: 1, modules };
}

function parsePromptPresetModule(
  raw: unknown,
  sourcePath: string,
  index: number,
): PromptPresetModule {
  if (!isRecord(raw)) {
    throw new Error(`Invalid prompt preset ${sourcePath}: modules[${index}] must be an object.`);
  }
  return {
    id: readNonEmptyString(raw, "id", sourcePath, index),
    enabled: readBoolean(raw, "enabled", sourcePath, index),
    slot: readPromptSlot(raw, sourcePath, index),
    priority: readInteger(raw, "priority", sourcePath, index),
    header: readHeader(raw, sourcePath, index),
    source: readPromptSource(raw, sourcePath, index),
  };
}

function readNonEmptyString(
  raw: Record<string, unknown>,
  key: string,
  sourcePath: string,
  index: number,
): string {
  const value = raw[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Invalid prompt preset ${sourcePath}: modules[${index}].${key} must be a non-empty string.`,
    );
  }
  return value.trim();
}

function readBoolean(
  raw: Record<string, unknown>,
  key: string,
  sourcePath: string,
  index: number,
): boolean {
  const value = raw[key];
  if (typeof value !== "boolean") {
    throw new Error(
      `Invalid prompt preset ${sourcePath}: modules[${index}].${key} must be a boolean.`,
    );
  }
  return value;
}

function readInteger(
  raw: Record<string, unknown>,
  key: string,
  sourcePath: string,
  index: number,
): number {
  const value = raw[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(
      `Invalid prompt preset ${sourcePath}: modules[${index}].${key} must be an integer.`,
    );
  }
  return value;
}

function readPromptSlot(
  raw: Record<string, unknown>,
  sourcePath: string,
  index: number,
): PromptSlot {
  const slot = readNonEmptyString(raw, "slot", sourcePath, index);
  if (!isPromptSlot(slot)) {
    throw new Error(`Invalid prompt preset ${sourcePath}: modules[${index}].slot is unknown.`);
  }
  return slot;
}

function readHeader(raw: Record<string, unknown>, sourcePath: string, index: number): string {
  const header = readNonEmptyString(raw, "header", sourcePath, index);
  if (!/^[a-z][a-z0-9_-]*$/u.test(header)) {
    throw new Error(
      `Invalid prompt preset ${sourcePath}: modules[${index}].header must be a tag-safe id.`,
    );
  }
  return header;
}

function readPromptSource(
  raw: Record<string, unknown>,
  sourcePath: string,
  index: number,
): PromptSource {
  const source = readNonEmptyString(raw, "source", sourcePath, index);
  if (source.startsWith("runtime:")) {
    const name = source.slice("runtime:".length);
    if (!isRuntimePromptSource(name)) {
      throw new Error(
        `Invalid prompt preset ${sourcePath}: modules[${index}].source has unknown runtime source.`,
      );
    }
    return { kind: "runtime", name };
  }
  if (!source.startsWith("agents/") || !source.endsWith(".md") || source.includes("..")) {
    throw new Error(
      `Invalid prompt preset ${sourcePath}: modules[${index}].source must be agents/*.md or runtime:*.`,
    );
  }
  return { kind: "file", path: source };
}

function assertUniqueModuleIds(modules: PromptPresetModule[], sourcePath: string): void {
  const seen = new Set<string>();
  for (const module of modules) {
    if (seen.has(module.id)) {
      throw new Error(`Invalid prompt preset ${sourcePath}: duplicate module id ${module.id}.`);
    }
    seen.add(module.id);
  }
}

function isPromptSlot(value: string): value is PromptSlot {
  return PROMPT_SLOTS.includes(value);
}

function isRuntimePromptSource(value: string): value is RuntimePromptSource {
  return RUNTIME_SOURCES.includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
