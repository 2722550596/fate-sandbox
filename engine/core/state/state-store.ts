import type { PublicGameState, State, StateExport } from "./state.ts";

import { mkdirSync, writeFileSync } from "node:fs";

import { formatHumanTime, nowIso } from "./date-time.ts";
import { createInitialState } from "./initial-state.ts";
import { parseStateSchema } from "./state-schema.ts";
import { migrateRawGameState } from "./state-migration.ts";
import { formatUnknown, isRecord } from "../utils/typebox-validation.ts";

const DEBUG_STATE_PATH = "state/state.json";

let store: State | undefined;

export function getState(): State {
  return cloneState();
}

export function getPublicState(): PublicGameState {
  return structuredClone(getStore().public);
}

export function cloneState(): State {
  return structuredClone(getStore());
}

export function exportState(): StateExport {
  return toStateExport(getStore());
}

export function patchState(ops: ReadonlyArray<unknown>): State {
  if (ops.length > 0) {
    throw new Error(
      "patch_state 已降级为 debug-only 且不再接受裸 JSON Patch；请使用领域 update 工具。",
    );
  }
  return cloneState();
}

export function replaceStateForDebug(state: State): State {
  const validated = assertState(state);
  setStore(touchState(validated));
  return cloneState();
}

export function commitState(next: State): State {
  setStore(touchState(assertState(next)));
  return cloneState();
}

export function resetState(): State {
  const fresh = createInitialState();
  setStore(fresh);
  return structuredClone(fresh);
}

export function hydrateState(raw: unknown): void {
  const state = assertState(raw);
  setStore(state);
}

function getStore(): State {
  if (!store) {
    store = createInitialState();
  }
  return store;
}

function setStore(state: State): void {
  store = state;
  writeStateDebugSnapshot(state);
}

let lastWrittenSnapshot: string | undefined;

function writeStateDebugSnapshot(state: State): void {
  if (process.env["NODE_TEST_CONTEXT"] !== undefined) {
    return;
  }
  const payload = `${JSON.stringify(toStateExport(state), null, 2)}\n`;
  if (payload === lastWrittenSnapshot) {
    return;
  }
  mkdirSync("state", { recursive: true });
  writeFileSync(DEBUG_STATE_PATH, payload, "utf-8");
  lastWrittenSnapshot = payload;
}

function toStateExport(state: State): StateExport {
  const snapshot = structuredClone(state);
  const humanTime = formatHumanTime(
    snapshot.public.clock.currentAt,
    snapshot.public.clock.timezone,
  );
  return {
    ...snapshot,
    public: {
      ...snapshot.public,
      clock: {
        ...snapshot.public.clock,
        displayTime: humanTime.display,
        date: humanTime.date,
        weekday: humanTime.weekday,
        time: humanTime.time,
      },
    },
  };
}
function assertState(raw: unknown): State {
  if (!isRecord(raw)) {
    throw new Error(`非法状态: ${formatUnknown(raw)}。状态必须是对象。`);
  }
  const stateRaw = isRecord(raw["state"]) ? raw["state"] : raw;
  if (!isRecord(stateRaw)) {
    throw new Error(`非法状态: ${formatUnknown(raw)}。state 必须是对象。`);
  }
  return parseStateSchema(migrateRawGameState(stateRaw));
}

function touchState(state: State): State {
  return { ...state, meta: { ...state.meta, updatedAt: nowIso() } };
}