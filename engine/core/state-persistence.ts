import type { State } from "./state.ts";

import { getState } from "./state-store.ts";
import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";
import { isRecord } from "./typebox-validation.ts";

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

export function persistCurrentState(sessionManager: unknown): void {
  const writer = asStateSessionWriter(sessionManager);
  if (writer === undefined) {
    return;
  }
  writer.appendCustomEntry(sessionKey(), toSessionEntry(getState()));
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
