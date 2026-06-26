import type { BranchSummaryEntry, SessionEntry } from "@earendil-works/pi-coding-agent";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hydrateStateFromSessionEntries,
  syncStateFromSessionEntries,
  syncStateFromSessionManager,
} from "../../engine/core/session-hydration.ts";
import { cloneState, resetState } from "../../engine/core/state-store.ts";
import { sessionKey } from "../../engine/core/state-persistence.ts";
import { commitTurnTool } from "./commit-turn.ts";
import { getStatusTool } from "./get-status.ts";
import { upsertActorTool } from "./upsert-actor.ts";
import { setScenePresenceTool } from "./set-scene-presence.ts";
import { updateActorConditionTool } from "./update-actor-condition.ts";
import { updateEconomyTool } from "./update-economy.ts";

describe("LOTM state tool-level smoke flow", () => {
  it("persists state details that can hydrate a later session", () => {
    resetState();
    const sessionManager = createMockSessionManager();

    const moveResult = commitTurnTool(
      {
        time: {
          kind: "travel",
          location: {
            region: "鲁恩王国",
            site: "廷根",
            detail: "霍尔广场",
            boundary: "normal",
            coordinates: null,
          },
          elapsedMinutes: 30,
          reason: "smoke test moves to a known public location",
        },
        events: [],
      },
      sessionManager,
    );
    assert.match(textOf(moveResult), /回合已提交/);

    const spendResult = updateEconomyTool(
      {
        kind: "spend-money",
        purseId: "purse-protagonist-cash",
        amount: 5,
        reason: "smoke test buys bread during the move",
      },
      sessionManager,
    );
    assert.match(textOf(spendResult), /资金已支出/);

    const woundResult = updateActorConditionTool(
      {
        kind: "add-status-effect",
        actorId: "protagonist",
        name: "擦伤",
        type: "debuff",
        affectedAttribute: "agility",
        value: 5,
        duration: 1,
        source: "smoke test scripted scrape",
        valueType: "percentage",
      },
      sessionManager,
    );
    assert.match(textOf(woundResult), /伤势已记录/);

    const beforeHydration = cloneState();
    resetState();

    assert.equal(hydrateStateFromSessionEntries(sessionManager.entries), true);
    const hydrated = cloneState();

    assert.equal(hydrated.public.scene.location.site, "廷根");
    assert.equal(hydrated.public.scene.location.detail, "霍尔广场");
    assert.equal(hydrated.public.economy.accessibleFunds[0]?.amount, 19);
    assert.equal(hydrated.public.actors.protagonist?.condition.statusEffects[0]?.name, "擦伤");
    assert.deepEqual(hydrated.public, beforeHydration.public);
  });

  it("accepts minimal NPC skeletons through upsert_actor tool", () => {
    resetState();
    const sessionManager = createMockSessionManager();

    const result = upsertActorTool(
      {
        kind: "ensure-public-npc",
        npc: {
          actorId: "kohl-staff",
          internalName: "科霍尔",
          publicIdentity: "廷根大学图书馆管理员。",
        },
        reason: "tool smoke test ensures a known NPC skeleton",
      },
      sessionManager,
    );

    assert.match(textOf(result), /public npc skeleton 已写入：kohl-staff/);
    const state = cloneState();
    assert.equal(state.public.actors["kohl-staff"]?.presentation.internalName, "科霍尔");
    assert.equal(state.public.scene.presentActorIds.includes("kohl-staff"), false);
    assert.equal(sessionManager.entries.length, 1);
  });

  it("accepts runtime sequence setup through upsert_actor tool", () => {
    resetState();
    const sessionManager = createMockSessionManager();

    const result = upsertActorTool(
      {
        kind: "upsert-sequence",
        sequence: {
          actorId: "mysterious_beyonder",
          currentSequence: "序列7-魔术师",
          rank: "seq-7",
          pathway: "seer",
          promotionSystem: "potion",
          divinity: 3,
          digestionProgress: 40,
          lossOfControlProgress: 10,
        },
        reason: "tool smoke test sequence setup",
      },
      sessionManager,
    );

    assert.match(textOf(result), /序列已更新：mysterious_beyonder/);
    const presenceResult = setScenePresenceTool(
      { presentActorIds: ["protagonist", "mysterious_beyonder"], allyActorIds: [], reason: "beyonder enters scene" },
      sessionManager,
    );
    assert.match(textOf(presenceResult), /场景在场 actor 已更新/);
    const state = cloneState();
    assert.equal(state.public.actors["mysterious_beyonder"]?.sequence?.currentSequence, "序列7-魔术师");
    assert.deepEqual(state.public.scene.presentActorIds, ["protagonist", "mysterious_beyonder"]);
    assert.equal(sessionManager.entries.length, 2);
  });

  it("ignores branch_summary details when hydrating after tree navigation", () => {
    resetState();
    commitTurnTool(
      {
        time: { kind: "elapsed", elapsedMinutes: 1, reason: "地点修正推进一个最小时间单位" },
        events: [
          {
            kind: "scene",
            event: {
              kind: "set-location",
              location: {
                region: "鲁恩王国",
                site: "廷根",
                detail: "不该被 branch_summary 恢复",
                boundary: "normal",
                coordinates: null,
              },
              reason: "生成旧分支 state",
            },
          },
        ],
      },
      createMockSessionManager(),
    );
    const oldBranchState = cloneState();
    resetState();
    const targetEntry = createCustomEntry("target-state", sessionEntryFromCurrentState());
    const staleSummary = createBranchSummaryEntry("summary", {
      [sessionKey()]: sessionEntryFromState(oldBranchState),
    });

    assert.equal(hydrateStateFromSessionEntries([targetEntry, staleSummary]), true);
    const state = cloneState();
    assert.equal(state.public.scene.location.region, "鲁恩王国");
    assert.equal(state.public.scene.location.site, "廷根");
  });

  it("resets in-memory state when the current branch has no LOTM state", () => {
    resetState();
    commitTurnTool(
      {
        time: { kind: "elapsed", elapsedMinutes: 1, reason: "地点修正推进一个最小时间单位" },
        events: [
          {
            kind: "scene",
            event: {
              kind: "set-location",
              location: {
                region: "鲁恩王国",
                site: "廷根",
                detail: "回滚前旧地点",
                boundary: "normal",
                coordinates: null,
              },
              reason: "制造需要被回滚清除的状态",
            },
          },
        ],
      },
      createMockSessionManager(),
    );

    assert.equal(syncStateFromSessionEntries([]), false);
    assert.equal(cloneState().public.scene.location.region, "鲁恩王国");
    assert.equal(cloneState().public.scene.location.site, "廷根");
  });

  it("get_status rehydrates from the active session branch before reading state", () => {
    resetState();
    const sessionManager = createMockSessionManager();
    commitTurnTool(
      {
        time: { kind: "elapsed", elapsedMinutes: 1, reason: "地点修正推进一个最小时间单位" },
        events: [
          {
            kind: "scene",
            event: {
              kind: "set-location",
              location: {
                region: "鲁恩王国",
                site: "廷根",
                detail: "回滚前旧地点",
                boundary: "normal",
                coordinates: null,
              },
              reason: "制造旧内存状态",
            },
          },
        ],
      },
      createMockSessionManager(),
    );
    resetState();
    commitTurnTool(
      {
        time: { kind: "elapsed", elapsedMinutes: 1, reason: "地点修正推进一个最小时间单位" },
        events: [
          {
            kind: "scene",
            event: {
              kind: "set-location",
              location: {
                region: "鲁恩王国",
                site: "廷根",
                detail: "廷根大学",
                boundary: "normal",
                coordinates: null,
              },
              reason: "写入当前 branch 应恢复的状态",
            },
          },
        ],
      },
      sessionManager,
    );
    commitTurnTool(
      {
        time: { kind: "elapsed", elapsedMinutes: 1, reason: "地点修正推进一个最小时间单位" },
        events: [
          {
            kind: "scene",
            event: {
              kind: "set-location",
              location: {
                region: "鲁恩王国",
                site: "廷根",
                detail: "错误残留内存",
                boundary: "normal",
                coordinates: null,
              },
              reason: "再次污染全局内存",
            },
          },
        ],
      },
      createMockSessionManager(),
    );

    assert.equal(syncStateFromSessionManager(sessionManager), true);
    const result = getStatusTool(sessionManager);

    assert.match(textOf(result), /鲁恩王国 · 廷根 · 廷根大学/);
    assert.doesNotMatch(textOf(result), /错误残留内存/);
  });
});

interface MockSessionManager {
  entries: MockSessionEntry[];
  appendCustomEntry(customType: string, data?: unknown): string;
  getBranch(): readonly MockSessionEntry[];
}

type MockSessionEntry = SessionEntry;

function createMockSessionManager(): MockSessionManager {
  return {
    entries: [],
    appendCustomEntry(customType: string, data?: unknown): string {
      const entryId = `entry-${this.entries.length + 1}`;
      const entry = createCustomEntry(entryId, data, customType);
      this.entries.push(entry);
      return entryId;
    },
    getBranch(): readonly MockSessionEntry[] {
      return this.entries;
    },
  };
}

function sessionEntryFromCurrentState(): ReturnType<typeof sessionEntryFromState> {
  return sessionEntryFromState(cloneState());
}

function sessionEntryFromState(state: ReturnType<typeof cloneState>): { v: number; turn: number; state: unknown } {
  return { v: 1, turn: 0, state };
}

function createBranchSummaryEntry(id: string, details: unknown): BranchSummaryEntry {
  return {
    type: "branch_summary",
    id,
    parentId: null,
    timestamp: "1349-01-01T07:00:00.000Z",
    fromId: "old-leaf",
    summary: "旧分支摘要",
    details,
  };
}

function createCustomEntry(
  id: string,
  data: unknown,
  customType: string = sessionKey(),
): SessionEntry {
  return {
    type: "custom",
    id,
    parentId: null,
    timestamp: "1349-01-01T07:00:00.000Z",
    customType,
    data,
  };
}

function textOf(result: { content: Array<{ text: string }> }): string {
  return result.content.map((part) => part.text).join("\n");
}