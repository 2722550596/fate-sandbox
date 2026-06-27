import type { HumanActorState, State } from "./state.ts";

import { LOTM_EPOCH_ISO, nowIso } from "./date-time.ts";
import { generateSeed } from "../utils/seeded-rng.ts";
import { CURRENT_STATE_SCHEMA_VERSION } from "./state.ts";

export const PROTAGONIST_ACTOR_ID = "protagonist";

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
      hiddenWorldFacts: [],
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
      canonicalName: "你",
      renderName: "你",
      apparentAge: "未确认",
      outfit: { label: "日常服装", details: "开局尚未细化。" },
      demeanor: "由玩家行动定义。",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
  };
}