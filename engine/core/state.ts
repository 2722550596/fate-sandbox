/**
 * 轻量状态引擎：in-memory 真相源 → session entry 持久化。
 *
 * This module owns all player state invariants. Callers may read snapshots and request
 * state transitions, but the mutable store never crosses this seam.
 */

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
  神秘暴露: number;
  社会暴露: number;
  敌方警觉: number;
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
  | "/危险度"
  | "/神秘暴露"
  | "/社会暴露"
  | "/敌方警觉";

export interface PatchOp {
  op: "replace";
  path: string;
  value: unknown;
}

// --- Constants ---

export const CURRENT_STATE_SCHEMA_VERSION = 2;

const SESSION_KEY = "fsn-state";
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
  "/神秘暴露",
  "/社会暴露",
  "/敌方警觉",
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

// --- Store ---

function getStore(): State {
  if (!globalThis.__fsn_state_store__) {
    globalThis.__fsn_state_store__ = createInitialState();
  }
  return globalThis.__fsn_state_store__;
}

function setStore(state: State): void {
  globalThis.__fsn_state_store__ = structuredClone(state);
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
    神秘暴露: 0,
    社会暴露: 0,
    敌方警觉: 0,
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
    case "/神秘暴露":
      state.神秘暴露 = assertPercent(op.value, "神秘暴露");
      break;
    case "/社会暴露":
      state.社会暴露 = assertPercent(op.value, "社会暴露");
      break;
    case "/敌方警觉":
      state.敌方警觉 = assertPercent(op.value, "敌方警觉");
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
    throw new Error(
      `非法${fieldName}值: ${percent}。${fieldName}必须在 ${MIN_PERCENT}-${MAX_PERCENT} 之间。`,
    );
  }
  return percent;
}

function assertDangerLevel(value: unknown): number {
  const dangerLevel = coerceInteger(value, "危险度");
  if (dangerLevel < MIN_DANGER_LEVEL || dangerLevel > MAX_DANGER_LEVEL) {
    throw new Error(
      `非法危险度值: ${dangerLevel}。危险度必须在 ${MIN_DANGER_LEVEL}-${MAX_DANGER_LEVEL} 之间。`,
    );
  }
  return dangerLevel;
}

function coerceInteger(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
  }
  throw new Error(
    `非法${fieldName}值: ${formatUnknown(value)}。${fieldName}必须是整数或整数字符串。`,
  );
}

// --- Runtime schema guard ---

function assertState(raw: unknown): State {
  if (!isRecord(raw)) {
    throw new Error("State hydration failed: state must be an object.");
  }

  const metadata = assertMetadata(raw["元数据"]);
  const state: State = {
    元数据: metadata,
    金钱: assertMoney(raw["金钱"]),
    当前位置: assertLocation(raw["当前位置"]),
    身体状态: assertBodyStatus(raw["身体状态"]),
    当前时间: assertIsoDateString(raw["当前时间"], "当前时间"),
    经过分钟: assertNonNegativeInteger(raw["经过分钟"], "经过分钟"),
    疲劳: assertPercent(raw["疲劳"], "疲劳"),
    魔力负担: assertPercent(raw["魔力负担"], "魔力负担"),
    危险度: assertDangerLevel(raw["危险度"]),
    神秘暴露: assertPercent(raw["神秘暴露"], "神秘暴露"),
    社会暴露: assertPercent(raw["社会暴露"], "社会暴露"),
    敌方警觉: assertPercent(raw["敌方警觉"], "敌方警觉"),
  };

  if (metadata.updatedAt < metadata.createdAt) {
    throw new Error("State hydration failed: updatedAt cannot be earlier than createdAt.");
  }

  return state;
}

function assertMetadata(raw: unknown): StateMetadata {
  if (!isRecord(raw)) {
    throw new Error("State hydration failed: metadata must be an object.");
  }

  const schemaVersion = raw["schemaVersion"];
  if (schemaVersion !== CURRENT_STATE_SCHEMA_VERSION) {
    throw new Error(
      `State schema version mismatch: got ${formatUnknown(schemaVersion)}, need ${CURRENT_STATE_SCHEMA_VERSION}`,
    );
  }

  const createdAt = assertIsoDateString(raw["createdAt"], "createdAt");
  const updatedAt = assertIsoDateString(raw["updatedAt"], "updatedAt");

  return { schemaVersion, createdAt, updatedAt };
}

function assertIsoDateString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`State hydration failed: ${fieldName} must be an ISO date string.`);
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`State hydration failed: ${fieldName} is not a valid ISO date string.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (value === undefined) {
    return "undefined";
  }
  return Object.prototype.toString.call(value);
}
