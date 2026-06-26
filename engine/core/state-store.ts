import type { HumanActorState, PublicGameState, State, StateExport } from "./state.ts";

import { mkdirSync, writeFileSync } from "node:fs";

import { formatHumanTime, LOTM_EPOCH_ISO, nowIso } from "./date-time.ts";
import { generateSeed } from "./seeded-rng.ts";
import { migrateRawGameState } from "./state-migration.ts";
import { parseStateSchema } from "./state-schema.ts";
import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";
import { formatUnknown, isRecord } from "./typebox-validation.ts";

const DEBUG_STATE_PATH = "state/state.json";

export const PROTAGONIST_ACTOR_ID = "protagonist";

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

export function migrateState(raw: unknown): State {
  return assertState(raw);
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

export function createInitialState(): State {
  const now = nowIso();
  const protagonist = createInitialProtagonist();
  return {
    meta: {
      schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      rngSeed: generateSeed(),
      rngCounter: 0,
    },
    public: {
      campaign: {
        title: "诡秘之主叙事",
        timeline: "tingen",
        openingMode: "selected",
        premise: "第五纪1349年，鲁恩王国廷根市，玩家角色的身份与卷入方式尚待开局确认。",
        activeRuleSetIds: [
          "lotm-worldview-filter",
          "lotm-judgment-combat",
          "lotm-economy",
          "lotm-sequence-promotion",
        ],
      },
      clock: {
        startedAt: LOTM_EPOCH_ISO,
        currentAt: LOTM_EPOCH_ISO,
        timezone: "UTC",
        lastLongRestAt: null,
      },
      scene: {
        location: {
          region: "鲁恩王国",
          site: "廷根",
          detail: "廷根大学·校门外",
          boundary: "normal",
          coordinates: { x: 55.36, y: 26.34 },
        },
        situation: "daily",
        storyWindow: null,
        presentActorIds: [PROTAGONIST_ACTOR_ID],
        objectives: [],
        threats: [],
        lastResolvedAt: LOTM_EPOCH_ISO,
      },
      actors: { [PROTAGONIST_ACTOR_ID]: protagonist },
      trackedItems: {},
      protagonistActorId: PROTAGONIST_ACTOR_ID,
      allyActorIds: [],
      economy: {
        currency: "penny",
        accessibleFunds: [
          {
            id: "purse-protagonist-cash",
            ownerActorId: PROTAGONIST_ACTOR_ID,
            label: "随身便士",
            amount: 24,
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
            text: "玩家角色身份尚未锁定；不得默认是非凡者、普通人或穿越者。",
            since: LOTM_EPOCH_ISO,
            sourceEventId: null,
          },
        ],
        eventLog: [],
        dailySummaries: [],
      },
      turnLog: [],
      obligations: [],
      hooks: [],
      relationshipSignals: [],
      actorImpressions: {},
    },
    secrets: {
      actorStates: {},
      campaignSecrets: [],
      secretEventLog: [],
      offscreenEventLog: [],
      factionClocks: [],
      scheduledEvents: [],
      relationshipSignals: [],
      backstageObligations: [],
      backstageReviewLog: [],
      backstagePressure: { consecutiveNoCostTurns: 0 },
      backstagePendingHarvests: [],
    },
  };
}

function createInitialProtagonist(): HumanActorState {
  return {
    id: PROTAGONIST_ACTOR_ID,
    kind: "human",
    roles: [],
    sequence: null,
    identity: {
      publicIdentity: "身份未定的玩家角色",
      background: "开局尚未确认。由初始化或后续记忆事件锁定，不得在叙事中漂移。",
      lockedFacts: [],
    },
    presentation: {
      internalName: "你",
      renderName: "你",
      apparentAge: "未确认",
      outfit: { label: "日常服装", details: "开局尚未细化。" },
      demeanor: "由玩家行动定义。",
    },
    condition: { statusEffects: [] },
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

function touchState(state: State): State {
  return { ...state, meta: { ...state.meta, updatedAt: nowIso() } };
}
