import type { SessionEntry } from "@earendil-works/pi-coding-agent";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hydrateStateFromSessionEntries } from "../../engine/core/session-hydration";
import { cloneState, resetState, sessionKey, toSessionEntry } from "../../engine/core/state";
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
