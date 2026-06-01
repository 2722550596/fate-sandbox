import type { SessionEntry } from "@earendil-works/pi-coding-agent";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hydrateStateFromSessionEntries } from "../../engine/core/session-hydration";
import { cloneState, resetState, sessionKey, toSessionEntry } from "../../engine/core/state";
import { upsertActorTool } from "./upsert-actor";
import { setScenePresenceTool } from "./set-scene-presence";
import { updateActorConditionTool } from "./update-actor-condition";
import { updateEconomyTool } from "./update-economy";
import { updateSceneTool } from "./update-scene";

describe("Fate state tool-level smoke flow", () => {
  it("persists state details that can hydrate a later session", () => {
    resetState();
    const sessionManager = createMockSessionManager();

    const moveResult = updateSceneTool(
      {
        kind: "move-location",
        location: {
          region: "冬木市",
          site: "新都",
          detail: "駅前商店街",
          boundary: "normal",
        },
        elapsedMinutes: 30,
        reason: "smoke test moves to a known public location",
      },
      sessionManager,
    );
    assert.match(textOf(moveResult), /地点已更新/);

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
          displayName: "远坂凛",
          publicIdentity: "穗群原学园学生，当前与士郎同行调查的魔术师。",
        },
        reason: "tool smoke test ensures a known NPC skeleton",
      },
      sessionManager,
    );

    assert.match(textOf(result), /public npc skeleton 已写入：tohsaka-rin/);
    const state = cloneState();
    assert.equal(state.public.actors["tohsaka-rin"]?.presentation.displayName, "远坂凛");
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
          displayName: "Caster",
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

  it("ignores old incompatible session entries until a valid Fate state appears", () => {
    resetState();
    const validEntry = createCustomEntry("valid", toSessionEntry(cloneState()));
    const oldEntry = createCustomEntry("old", { state: { money: 50000, location: "旧状态栏" } });

    assert.equal(hydrateStateFromSessionEntries([oldEntry, validEntry]), true);
    assert.equal(cloneState().public.protagonistActorId, "protagonist");
  });
});

interface MockSessionManager {
  entries: MockSessionEntry[];
  appendCustomEntry(customType: string, data?: unknown): string;
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
