import type { HumanActorState, PublicGameState, State, StateExport } from "./state.ts";

import { mkdirSync, writeFileSync } from "node:fs";

import { formatHumanTime, nowIso } from "./date-time.ts";
import { pruneExpiredParamModifiers } from "./servant.ts";
import { parseStateSchema } from "./state-schema.ts";
import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";
import { assertInteger, formatUnknown, isRecord } from "./typebox-validation.ts";

const DEBUG_STATE_PATH = "state/state.json";
const INITIAL_CURRENT_TIME = "2004-01-30T07:00:00.000Z";
const PROTAGONIST_ACTOR_ID = "protagonist";

/**
 * 模块级单例。状态在每个入口（context / tool_call / session_start / 面板命令）
 * 都会先从 session entries 重新 hydrate，因此即使模块被重复实例化，
 * 各实例也会从同一份 session 数据收敛，无需跨实例共享 globalThis。
 */
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

/**
 * Game State Store 的唯一提交入口。仅供 Domain Event Tool Runner 与
 * store 生命周期代码（session hydration、new game）调用；领域事件函数
 * 本身是 (draft, event) 形态的确定性函数，不得直接提交。
 */
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

export function migrateState(raw: unknown): State {
  return assertState(raw);
}

export function writeDebugStateFile(): string {
  writeStateDebugSnapshot(getStore());
  return DEBUG_STATE_PATH;
}

function getStore(): State {
  if (!store) {
    store = createInitialState();
  }
  return store;
}

function setStore(state: State): void {
  const normalizedState = pruneExpiredParamModifiers(structuredClone(state));
  store = normalizedState;
  writeStateDebugSnapshot(normalizedState);
}

/** 上次落盘的序列化快照；hydrate 在每个入口都会触发，内容不变时跳过同步磁盘写。 */
let lastWrittenSnapshot: string | undefined;

function writeStateDebugSnapshot(state: State): void {
  // node --test 子进程里的 commitState/resetState 不得覆写 state/state.json，
  // 否则跑一轮测试就会把调试快照砋成最后一个测试用例的近初始状态。
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

export function createInitialState(): State {
  const now = nowIso();
  const protagonist = createInitialProtagonist();
  return {
    meta: {
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    },
    public: {
      campaign: {
        title: "Fate 沙盒",
        timeline: "fsn",
        openingMode: "selected",
        premise: "2004 年冬木，玩家角色的身份与卷入方式尚待开局确认。",
        activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "jpy-2004-economy"],
      },
      clock: {
        startedAt: INITIAL_CURRENT_TIME,
        currentAt: INITIAL_CURRENT_TIME,
        timezone: "Asia/Tokyo",
        lastLongRestAt: null,
      },
      scene: {
        location: {
          region: "冬木市",
          site: "深山镇",
          detail: "穗群原学园·校门外",
          boundary: "normal",
        },
        situation: "daily",
        storyWindow: null,
        presentActorIds: [PROTAGONIST_ACTOR_ID],
        objectives: [],
        threats: [],
        lastResolvedAt: INITIAL_CURRENT_TIME,
      },
      actors: { [PROTAGONIST_ACTOR_ID]: protagonist },
      trackedItems: {},
      protagonistActorId: PROTAGONIST_ACTOR_ID,
      allyActorIds: [],
      economy: {
        currency: "JPY",
        accessibleFunds: [
          {
            id: "purse-protagonist-cash",
            ownerActorId: PROTAGONIST_ACTOR_ID,
            label: "随身现金",
            amount: 50000,
            access: "held",
          },
        ],
        debts: [],
      },
      memory: {
        pinnedFacts: [
          {
            id: "fact-opening-identity-unfixed",
            scope: "protagonist",
            subject: PROTAGONIST_ACTOR_ID,
            text: "玩家角色身份尚未锁定；不得默认是御主、普通人或从者。",
            since: INITIAL_CURRENT_TIME,
            sourceEventId: null,
          },
        ],
        eventLog: [],
        dailySummaries: [],
      },
      turnLog: [],
      obligations: [],
    },
    secrets: {
      actorSecrets: {},
      campaignSecrets: [],
      secretEventLog: [],
      offscreenEventLog: [],
      factionClocks: [],
      scheduledEvents: [],
    },
  };
}

function createInitialProtagonist(): HumanActorState {
  return {
    id: PROTAGONIST_ACTOR_ID,
    kind: "human",
    roles: [],
    magecraft: null,
    servantForm: null,
    identity: {
      publicIdentity: "身份未定的玩家角色",
      background: "开局尚未确认。由初始化或后续记忆事件锁定，不得在叙事中漂移。",
      lockedFacts: [],
    },
    presentation: {
      displayName: "你",
      apparentAge: "未确认",
      outfit: { label: "日常服装", details: "开局尚未细化。" },
      demeanor: "由玩家行动定义。",
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
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

function migrateRawGameState(raw: Record<string, unknown>): Record<string, unknown> {
  let current = structuredClone(raw);
  while (true) {
    const version = readRawSchemaVersion(current);
    if (version === CURRENT_STATE_SCHEMA_VERSION) {
      return current;
    }
    current = migrateOneSchemaVersion(current, version);
  }
}

function migrateOneSchemaVersion(
  raw: Record<string, unknown>,
  version: number,
): Record<string, unknown> {
  switch (version) {
    case 1:
      return migrateGameStateV1ToV2(raw);
    case 2:
      return migrateGameStateV2ToV3(raw);
    case 3:
      return migrateGameStateV3ToV4(raw);
    case 4:
      return migrateGameStateV4ToV5(raw);
    default:
      throw new Error(
        `不支持的 state schemaVersion: ${version}。当前支持逐步迁移到 ${CURRENT_STATE_SCHEMA_VERSION}。`,
      );
  }
}

function readRawSchemaVersion(raw: Record<string, unknown>): number {
  const meta = assertRecordForMigration(raw["meta"], "meta");
  return assertInteger(meta["schemaVersion"], "meta.schemaVersion");
}

function migrateGameStateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(raw);
  const meta = assertRecordForMigration(next["meta"], "meta");
  meta["schemaVersion"] = 2;
  const publicState = assertRecordForMigration(next["public"], "public");
  publicState["turnLog"] = [];
  return next;
}

function migrateGameStateV2ToV3(raw: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(raw);
  const meta = assertRecordForMigration(next["meta"], "meta");
  meta["schemaVersion"] = 3;
  const publicState = assertRecordForMigration(next["public"], "public");
  const rawTurnLog = Array.isArray(publicState["turnLog"]) ? publicState["turnLog"] : [];
  publicState["turnLog"] = rawTurnLog.filter(hasAdvancingTurnTime);
  return next;
}

function migrateGameStateV3ToV4(raw: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(raw);
  const meta = assertRecordForMigration(next["meta"], "meta");
  meta["schemaVersion"] = 4;
  const publicState = assertRecordForMigration(next["public"], "public");
  publicState["obligations"] = [];
  return next;
}

function migrateGameStateV4ToV5(raw: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(raw);
  const meta = assertRecordForMigration(next["meta"], "meta");
  meta["schemaVersion"] = CURRENT_STATE_SCHEMA_VERSION;
  const secrets = assertRecordForMigration(next["secrets"], "secrets");
  secrets["factionClocks"] = [];
  secrets["scheduledEvents"] = [];
  return next;
}

function hasAdvancingTurnTime(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const time = value["time"];
  if (!isRecord(time)) {
    return false;
  }
  return time["kind"] === "elapsed" || time["kind"] === "travel";
}

function assertRecordForMigration(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`非法 ${fieldName}: ${formatUnknown(value)}。迁移需要对象。`);
  }
  return value;
}

function touchState(state: State): State {
  return { ...state, meta: { ...state.meta, updatedAt: nowIso() } };
}
