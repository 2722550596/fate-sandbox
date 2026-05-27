/**
 * 轻量状态引擎：in-memory 真相源 → session entry 持久化 → state/state.json debug export
 *
 * State 字段：
 *   金钱     — number (日元)
 *   当前位置 — string (如 "冬木市·深山镇·卫宫邸")
 *   身体状态 — number 0-100 (100=健康, 0=死亡)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// --- Types ---

export interface State {
  元数据: StateMetadata;
  金钱: number;
  当前位置: string;
  身体状态: number;
}

export interface StateMetadata {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

// --- Constants ---

export const CURRENT_STATE_SCHEMA_VERSION = 1;

export const INITIAL_STATE: State = {
  元数据: {
    schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  金钱: 50000,
  当前位置: "冬木市·深山镇·穗群原学园",
  身体状态: 100,
};

// --- Global store (jiti/tsx multi-instance safe) ---

declare global {
  // eslint-disable-next-line no-var
  var __fsn_state_store__: State | undefined;
}

function getStore(): State {
  if (!globalThis.__fsn_state_store__) {
    globalThis.__fsn_state_store__ = structuredClone(INITIAL_STATE);
  }
  return globalThis.__fsn_state_store__;
}

// --- Public API ---

export function getState(): State {
  return getStore();
}

export function cloneState(): State {
  return structuredClone(getStore());
}

export function patchState(ops: ReadonlyArray<PatchOp>): State {
  const state = getStore();
  for (const op of ops) {
    applyPatchOp(state, op);
  }
  state.元数据.updatedAt = new Date().toISOString();
  return state;
}

export function resetState(): State {
  const fresh = structuredClone(INITIAL_STATE);
  globalThis.__fsn_state_store__ = fresh;
  return fresh;
}

export function hydrateState(raw: State): void {
  if (raw.元数据?.schemaVersion !== CURRENT_STATE_SCHEMA_VERSION) {
    throw new Error(
      `State schema version mismatch: got ${raw.元数据?.schemaVersion}, need ${CURRENT_STATE_SCHEMA_VERSION}`,
    );
  }
  globalThis.__fsn_state_store__ = raw;
}

// --- Session-backed persistence ---

const SESSION_KEY = "fsn-state";

export function toSessionEntry(state: State): Record<string, unknown> {
  return { v: CURRENT_STATE_SCHEMA_VERSION, turn: 0, state };
}

export function sessionKey(): string {
  return SESSION_KEY;
}

// --- JSON Patch ---

export interface PatchOp {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

/** Allowed top-level paths (Chinese keys) */
const VALID_ROOTS = new Set(["/金钱", "/当前位置", "/身体状态"]);

function applyPatchOp(state: State, op: PatchOp): void {
  // Validate root path
  const root = op.path.split("/").filter(Boolean)[0];
  const rootPath = root !== undefined ? `/${root}` : "/";
  if (!VALID_ROOTS.has(rootPath)) {
    throw new Error(`禁止的路径: "${op.path}"。仅允许修改: ${[...VALID_ROOTS].join(", ")}`);
  }

  const segments = op.path.split("/").filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let target: any = state;

  // Navigate to parent
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    if (!(seg in target)) {
      if (op.op === "add") {
        target[seg] = {};
      } else {
        throw new Error(`路径不存在: ${op.path} (在 "${seg}" 处断裂)`);
      }
    }
    target = target[seg];
  }

  const lastKey = segments[segments.length - 1]!;

  switch (op.op) {
    case "add":
    case "replace":
      target[lastKey] = op.value;
      break;
    case "remove":
      delete target[lastKey];
      break;
  }
}

// --- Extension hook helpers ---

/**
 * Write state snapshot to toolResult.details for session persistence.
 * Called after every mutating tool execution.
 */
export function writeStateToDetails(details: Record<string, unknown>): void {
  const state = getStore();
  details[SESSION_KEY] = toSessionEntry(state);
}

/**
 * Debug export to state/state.json.
 */
export function debugExportState(_pi: ExtensionAPI): void {
  // No-op: debug export handled by extension hooks
}
