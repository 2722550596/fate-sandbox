import type { State } from "./state.ts";

import { getState } from "./state-store.ts";
import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";
import { isRecord } from "../utils/typebox-validation.ts";

const SESSION_KEY = "fsn-state";

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
