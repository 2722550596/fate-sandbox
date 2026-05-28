/**
 * 轻量状态引擎：in-memory 真相源 → session entry 持久化。
 *
 * This module owns all player state invariants. Callers may read snapshots and request
 * state transitions, but the mutable store never crosses this seam.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// --- Types ---

export interface State {
  元数据: StateMetadata;
  金钱: number;
  当前位置: string;
  身体状态: number;
  当前时间: string;
  经过分钟: number;
  疲劳: number;
  魔力负担: number;
  危险度: number;
}

export interface StateMetadata {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type StatePatchPath =
  | "/金钱"
  | "/当前位置"
  | "/身体状态"
  | "/当前时间"
  | "/经过分钟"
  | "/疲劳"
  | "/魔力负担"
  | "/危险度";

export interface PatchOp {
  op: "replace";
  path: string;
  value: unknown;
}

// --- Constants ---

export const CURRENT_STATE_SCHEMA_VERSION = 3;

const SESSION_KEY = "fsn-state";
const DEBUG_STATE_PATH = join("state", "state.json");
const INITIAL_MONEY = 50000;
const INITIAL_LOCATION = "冬木市·深山镇·穗群原学园";
const INITIAL_BODY_STATUS = 100;
const INITIAL_CURRENT_TIME = "2004-01-30T07:00:00.000Z";
const MIN_BODY_STATUS = 0;
const MAX_BODY_STATUS = 100;
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const MIN_DANGER_LEVEL = 0;
const MAX_DANGER_LEVEL = 5;
const ALLOWED_PATCH_PATHS: readonly StatePatchPath[] = [
  "/金钱",
  "/当前位置",
  "/身体状态",
  "/当前时间",
  "/经过分钟",
  "/疲劳",
  "/魔力负担",
  "/危险度",
];

// --- Global store (jiti/tsx multi-instance safe) ---

declare global {
  // eslint-disable-next-line no-var -- jiti/tsx may instantiate modules more than once; global store keeps one runtime state.
  var __fsn_state_store__: State | undefined;
}

// --- Public API ---

export function getState(): State {
  return cloneState();
}

export function cloneState(): State {
  return structuredClone(getStore());
}

export function patchState(ops: ReadonlyArray<PatchOp>): State {
  if (ops.length === 0) {
    return cloneState();
  }

  const next = cloneState();
  for (const op of ops) {
    applyValidatedPatchOp(next, op);
  }

  next.元数据.updatedAt = new Date().toISOString();
  setStore(next);
  return structuredClone(next);
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

export function toSessionEntry(state: State): Record<string, unknown> {
  return { v: CURRENT_STATE_SCHEMA_VERSION, turn: 0, state: structuredClone(state) };
}

export function sessionKey(): string {
  return SESSION_KEY;
}

export function writeStateToDetails(details: Record<string, unknown>): void {
  details[SESSION_KEY] = toSessionEntry(getStore());
}

export function allowedPatchPaths(): readonly StatePatchPath[] {
  return ALLOWED_PATCH_PATHS;
}

export function writeDebugStateFile(): string {
  writeStateDebugSnapshot(getStore());
  return DEBUG_STATE_PATH;
}

// --- Store ---

function getStore(): State {
  if (!globalThis.__fsn_state_store__) {
    globalThis.__fsn_state_store__ = createInitialState();
  }
  return globalThis.__fsn_state_store__;
}

function setStore(state: State): void {
  globalThis.__fsn_state_store__ = structuredClone(state);
  writeStateDebugSnapshot(state);
}

function writeStateDebugSnapshot(state: State): void {
  mkdirSync("state", { recursive: true });
  writeFileSync(DEBUG_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function createInitialState(): State {
  const now = new Date().toISOString();
  return {
    元数据: {
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    },
    金钱: INITIAL_MONEY,
    当前位置: INITIAL_LOCATION,
    身体状态: INITIAL_BODY_STATUS,
    当前时间: INITIAL_CURRENT_TIME,
    经过分钟: 0,
    疲劳: 0,
    魔力负担: 0,
    危险度: 1,
  };
}

// --- Patch validation ---

function applyValidatedPatchOp(state: State, op: PatchOp): void {
  switch (op.path) {
    case "/金钱":
      state.金钱 = assertMoney(op.value);
      break;
    case "/当前位置":
      state.当前位置 = assertLocation(op.value);
      break;
    case "/身体状态":
      state.身体状态 = assertBodyStatus(op.value);
      break;
    case "/当前时间":
      state.当前时间 = assertIsoDateString(op.value, "当前时间");
      break;
    case "/经过分钟":
      state.经过分钟 = assertNonNegativeInteger(op.value, "经过分钟");
      break;
    case "/疲劳":
      state.疲劳 = assertPercent(op.value, "疲劳");
      break;
    case "/魔力负担":
      state.魔力负担 = assertPercent(op.value, "魔力负担");
      break;
    case "/危险度":
      state.危险度 = assertDangerLevel(op.value);
      break;
    default:
      throw new Error(`禁止的路径: "${op.path}"。仅允许修改: ${ALLOWED_PATCH_PATHS.join(", ")}`);
  }
}

function assertMoney(value: unknown): number {
  const money = coerceInteger(value, "金钱");
  if (money < 0) {
    throw new Error(`非法金钱值: ${money}。金钱不能为负数。`);
  }
  return money;
}

function assertLocation(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`非法位置值: ${formatUnknown(value)}。当前位置必须是字符串。`);
  }
  const location = value.trim();
  if (location.length === 0) {
    throw new Error("非法位置值: 当前位置不能为空。");
  }
  return location;
}

function assertBodyStatus(value: unknown): number {
  const bodyStatus = coerceInteger(value, "身体状态");
  if (bodyStatus < MIN_BODY_STATUS || bodyStatus > MAX_BODY_STATUS) {
    throw new Error(
      `非法身体状态值: ${bodyStatus}。身体状态必须在 ${MIN_BODY_STATUS}-${MAX_BODY_STATUS} 之间。`,
    );
  }
  return bodyStatus;
}

function assertNonNegativeInteger(value: unknown, fieldName: string): number {
  const integer = coerceInteger(value, fieldName);
  if (integer < 0) {
    throw new Error(`非法${fieldName}值: ${integer}。${fieldName}不能为负数。`);
  }
  return integer;
}

function assertPercent(value: unknown, fieldName: string): number {
  const percent = coerceInteger(value, fieldName);
  if (percent < MIN_PERCENT || percent > MAX_PERCENT) {
    throw new Error(`非法${fieldName}值: ${percent}。${fieldName}必须在 0-100 之间。`);
  }
  return percent;
}

function assertDangerLevel(value: unknown): number {
  const level = coerceInteger(value, "危险度");
  if (level < MIN_DANGER_LEVEL || level > MAX_DANGER_LEVEL) {
    throw new Error(
      `非法危险度: ${level}。危险度必须在 ${MIN_DANGER_LEVEL}-${MAX_DANGER_LEVEL} 之间。`,
    );
  }
  return level;
}

function assertIsoDateString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(
      `非法${fieldName}: ${formatUnknown(value)}。${fieldName}必须是 ISO 时间字符串。`,
    );
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`非法${fieldName}: ${value}。${fieldName}必须能被 Date.parse 解析。`);
  }
  return new Date(timestamp).toISOString();
}

function coerceInteger(value: unknown, fieldName: string): number {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`非法${fieldName}值: ${value}。${fieldName}必须是整数。`);
    }
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!/^-?\d+$/.test(normalized)) {
      throw new Error(`非法${fieldName}值: ${value}。${fieldName}字符串必须是整数。`);
    }
    return Number(normalized);
  }
  throw new Error(`非法${fieldName}值: ${formatUnknown(value)}。${fieldName}必须是整数。`);
}

// --- Schema validation / migration ---

function assertState(raw: unknown): State {
  if (!isRecord(raw)) {
    throw new Error(`非法状态: ${formatUnknown(raw)}。状态必须是对象。`);
  }
  const stateRaw = isRecord(raw["state"]) ? raw["state"] : raw;
  if (!isRecord(stateRaw)) {
    throw new Error(`非法状态: ${formatUnknown(raw)}。state 必须是对象。`);
  }
  return assertStateV3(stateRaw);
}

function assertStateV3(raw: Record<string, unknown>): State {
  const metadata = assertMetadata(raw["元数据"]);
  return {
    元数据: {
      ...metadata,
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    },
    金钱: assertMoney(raw["金钱"]),
    当前位置: assertLocation(raw["当前位置"]),
    身体状态: assertBodyStatus(raw["身体状态"]),
    当前时间: assertIsoDateString(raw["当前时间"], "当前时间"),
    经过分钟: assertNonNegativeInteger(raw["经过分钟"], "经过分钟"),
    疲劳: assertPercent(raw["疲劳"], "疲劳"),
    魔力负担: assertPercent(raw["魔力负担"], "魔力负担"),
    危险度: assertDangerLevel(raw["危险度"]),
  };
}

function assertMetadata(raw: unknown): StateMetadata {
  if (!isRecord(raw)) {
    throw new Error(`非法元数据: ${formatUnknown(raw)}。元数据必须是对象。`);
  }
  return {
    schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    createdAt: assertIsoDateString(raw["createdAt"], "createdAt"),
    updatedAt: assertIsoDateString(raw["updatedAt"], "updatedAt"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return `无法序列化的值 (${String(error)})`;
  }
}
