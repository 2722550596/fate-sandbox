import type { CompactionEntry, SessionEntry } from "@earendil-works/pi-coding-agent";

import type { State } from "./state.ts";

import { getState } from "./state-store.ts";
import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";
import { hydrateState, resetState } from "./state-store.ts";
import { isRecord } from "../utils/typebox-validation.ts";

const SESSION_KEY = "domain-state";

export function sessionKey(): string {
  return SESSION_KEY;
}

export function toSessionEntry(state: State): Record<string, unknown> {
  return { v: CURRENT_STATE_SCHEMA_VERSION, turn: 0, state: structuredClone(state) };
}

export function writeStateToDetails(details: Record<string, unknown>): void {
  details[SESSION_KEY] = toSessionEntry(getState());
}

export function persistCurrentState(sessionManager: unknown): boolean {
  const writer = asStateSessionWriter(sessionManager);
  if (writer === undefined) {
    return false;
  }
  writer.appendCustomEntry(sessionKey(), toSessionEntry(getState()));
  return true;
}

/**
 * 提交后的唯一持久化出口：优先写 session custom entry；仅当 sessionManager
 * 不可用时才退回把全量 state 写进 tool result details，保证至少一份落盘。
 * 两份全写会让每轮 session 体积翻倍；hydration 侧继续同时认两种来源，兼容旧档。
 */
export function persistStateAfterCommit(
  sessionManager: unknown,
  details: Record<string, unknown>,
): void {
  if (!persistCurrentState(sessionManager)) {
    writeStateToDetails(details);
  }
}

export function hydrateStateFromSessionEntries(entries: readonly SessionEntry[]): boolean {
  for (let index = entries.length - 1; index >= 0; index--) {
    const rawState = extractState(entries[index]);
    if (rawState !== undefined) {
      hydrateState(rawState);
      return true;
    }
  }
  return false;
}

export function syncStateFromSessionEntries(entries: readonly SessionEntry[]): boolean {
  const hydrated = hydrateStateFromSessionEntries(entries);
  if (!hydrated) {
    resetState();
  }
  return hydrated;
}

export function hydrateStateFromSessionManager(sessionManager: unknown): boolean {
  const branch = getSessionBranch(sessionManager);
  if (branch === undefined) {
    return false;
  }
  return hydrateStateFromSessionEntries(branch);
}

export function syncStateFromSessionManager(sessionManager: unknown): boolean {
  const branch = getSessionBranch(sessionManager);
  if (branch === undefined) {
    return false;
  }
  return syncStateFromSessionEntries(branch);
}

interface StateSessionWriter {
  appendCustomEntry(customType: string, data?: unknown): string;
}

function asStateSessionWriter(value: unknown): StateSessionWriter | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const appendCustomEntry = value["appendCustomEntry"];
  if (typeof appendCustomEntry !== "function") {
    return undefined;
  }
  return {
    appendCustomEntry: (customType: string, data?: unknown) => {
      const result: unknown = appendCustomEntry.call(value, customType, data);
      if (typeof result !== "string") {
        throw new Error("appendCustomEntry returned a non-string entry id.");
      }
      return result;
    },
  };
}

function getSessionBranch(sessionManager: unknown): readonly SessionEntry[] | undefined {
  if (!isRecord(sessionManager)) {
    return undefined;
  }
  const getBranch = sessionManager["getBranch"];
  if (typeof getBranch !== "function") {
    return undefined;
  }
  const branch: unknown = getBranch.call(sessionManager);
  if (!Array.isArray(branch)) {
    throw new Error("sessionManager.getBranch returned a non-array value.");
  }
  return branch as readonly SessionEntry[];
}

function extractState(entry: SessionEntry | undefined): unknown {
  if (entry === undefined) {
    return undefined;
  }
  if (entry.type === "custom" && entry.customType === sessionKey()) {
    return extractStateFromSessionData(entry.data);
  }
  if (entry.type === "compaction") {
    return extractStateFromCompaction(entry);
  }
  if (entry.type === "message" && entry.message.role === "toolResult") {
    return extractStateFromSessionData(entry.message.details?.[sessionKey()]);
  }
  return undefined;
}

function extractStateFromCompaction(entry: CompactionEntry): unknown {
  return extractStateFromSessionData(entry.details);
}

function extractStateFromSessionData(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return undefined;
  }
  const directState = raw["state"];
  if (directState !== undefined) {
    return directState;
  }
  return extractStateFromSessionData(raw[sessionKey()]);
}