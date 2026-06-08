import type { CompactionEntry, SessionEntry } from "@earendil-works/pi-coding-agent";

import { hydrateState, resetState, sessionKey } from "./state";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
