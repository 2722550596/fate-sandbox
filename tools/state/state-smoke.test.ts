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

describe("Fate state tool-level smoke flow", () => {
  it("persists state details that can hydrate a later session", () => {
    resetState();
    const sessionManager = createMockSessionManager();

    const moveResult = commitTurnTool(
      {
        time: {
          kind: "travel",
          location: {
            region: "冬木市",
            site: "新都",
            detail: "駅前商店街",
            boundary: "normal",
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
        amount: 1200,
        reason: "smoke test buys food during the move",
      },
      sessionManager,
    );
    assert.match(textOf(spendResult), /资金已支出/);

    const woundResult = updateActorConditionTool(
      {
        kind: "add-wound",
        actorId: "protagonist",
        severity: "minor",
        text: "左手手背擦伤。",
        source: "smoke test scripted scrape",
        recoverable: true,
      },
      sessionManager,
    );
    assert.match(textOf(woundResult), /伤势已记录/);

    const beforeHydration = cloneState();
    resetState();

    assert.equal(hydrateStateFromSessionEntries(sessionManager.entries), true);
    const hydrated = cloneState();

    assert.equal(hydrated.public.scene.location.site, "新都");
    assert.equal(hydrated.public.scene.location.detail, "駅前商店街");
    assert.equal(hydrated.public.economy.accessibleFunds[0]?.amount, 48800);
    assert.equal(hydrated.public.actors.protagonist?.condition.wounds[0]?.severity, "minor");
    assert.deepEqual(hydrated.public, beforeHydration.public);
  });

  it("accepts minimal NPC skeletons through upsert_actor tool", () => {
    resetState();
    const sessionManager = createMockSessionManager();

    const result = upsertActorTool(
      {
        kind: "ensure-public-npc",
        npc: {
          actorId: "tohsaka-rin",
          internalName: "远坂凛",
          publicIdentity: "穗群原学园学生，当前与士郎同行调查的魔术师。",
        },
        reason: "tool smoke test ensures a known NPC skeleton",
      },
      sessionManager,
    );

    assert.match(textOf(result), /public npc skeleton 已写入：tohsaka-rin/);
    const state = cloneState();
    assert.equal(state.public.actors["tohsaka-rin"]?.presentation.internalName, "远坂凛");
    assert.equal(state.public.scene.presentActorIds.includes("tohsaka-rin"), false);
    assert.equal(sessionManager.entries.length, 1);
  });

  it("accepts runtime servant setup through upsert_actor tool", () => {
    resetState();
    const sessionManager = createMockSessionManager();

    const result = upsertActorTool(
      {
        kind: "upsert-servant",
        servant: {
          id: "caster",
          internalName: "Caster",
          publicIdentity: "柳洞寺驻留的从者",
          apparentAge: "不明",
          outfit: { label: "深紫色长袍与兜帽", details: "遮住面容" },
          demeanor: "谨慎、孤高",
          className: "Caster",
          trueNameDisplay: "Caster",
          trueNameStatus: "hidden",
          parameters: {
            strength: "E",
            endurance: "D",
            agility: "C",
            mana: "A+",
            luck: "B",
            noblePhantasm: "C",
          },
          classSkills: [{ name: "阵地作成", rank: "A", summary: "建造工房级别的魔术阵地" }],
          personalSkills: [{ name: "高速神言", rank: "A", summary: "无需咏唱发动大魔术" }],
          noblePhantasms: [],
          spiritualCore: 100,
          mana: 90,
          spiritualCondition: "完好",
          masterActorId: null,
          masterName: "葛木宗一郎",
          contractStatus: "masterless",
          manaSupply: "sufficient",
          currentOrder: "守卫柳洞寺山门",
        },
        reason: "tool smoke test servant setup",
      },
      sessionManager,
    );

    assert.match(textOf(result), /从者已写入：caster/);
    const presenceResult = setScenePresenceTool(
      { presentActorIds: ["protagonist", "caster"], allyActorIds: [], reason: "Caster enters scene" },
      sessionManager,
    );
    assert.match(textOf(presenceResult), /场景在场 actor 已更新/);
    const state = cloneState();
    assert.equal(state.public.actors["caster"]?.servantForm?.identity.className, "Caster");
    assert.deepEqual(state.public.scene.presentActorIds, ["protagonist", "caster"]);
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
                region: "斯诺菲尔德",
                site: "旧分支",
                detail: "不该被 branch_summary 恢复",
                boundary: "normal",
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
    assert.equal(state.public.scene.location.region, "冬木市");
    assert.equal(state.public.scene.location.site, "深山镇");
  });

  it("resets in-memory state when the current branch has no Fate state", () => {
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
                region: "斯诺菲尔德",
                site: "歌剧院",
                detail: "回滚前旧地点",
                boundary: "normal",
              },
              reason: "制造需要被回滚清除的状态",
            },
          },
        ],
      },
      createMockSessionManager(),
    );

    assert.equal(syncStateFromSessionEntries([]), false);
    assert.equal(cloneState().public.scene.location.region, "冬木市");
    assert.equal(cloneState().public.scene.location.site, "深山镇");
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
                region: "斯诺菲尔德",
                site: "歌剧院",
                detail: "回滚前旧地点",
                boundary: "normal",
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
                region: "冬木市",
                site: "冬木教会",
                detail: "礼拜堂",
                boundary: "normal",
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
                region: "斯诺菲尔德",
                site: "住宅区",
                detail: "错误残留内存",
                boundary: "normal",
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

    assert.match(textOf(result), /冬木市 · 冬木教会 · 礼拜堂/);
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
    timestamp: "2004-01-30T07:00:00.000Z",
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
    timestamp: "2004-01-30T07:00:00.000Z",
    customType,
    data,
  };
}

function textOf(result: { content: Array<{ text: string }> }): string {
  return result.content.map((part) => part.text).join("\n");
}
