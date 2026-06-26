import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../../engine/core/state-store.ts";
import { sessionKey } from "../../engine/core/state-persistence.ts";
import { initializeNewGameTool } from "./initialize-new-game.ts";

void test("initializeNewGameTool initializes human protagonist and persists details", () => {
  resetState();
  const sessionManager = createMockSessionManager();

  const result = initializeNewGameTool(
    {
      kind: "human-protagonist",
      campaign: { presetId: "tingen-1349" },
      protagonist: {
        internalName: "你",
        publicIdentity: "不了解非凡世界的本地学生",
        background: "普通日常被异常打断。",
        apparentAge: "高中生",
        outfit: { label: "日常服装", details: "便于行动的普通衣物。" },
        demeanor: "谨慎而困惑。",
        ordinaryItems: ["手机", "学生证"],
      },
      presence: { presentActorIds: ["protagonist"] },
      reason: "tool-level 初始化普通人 protagonist",
    },
    sessionManager,
  );

  assert.match(textOf(result), /新游戏 state 已初始化/);
  assert.equal(sessionManager.entries.length, 1);
  // session 可写时 state 只走 custom entry，details 不再冗余携带全量 state。
  assert.equal(result.details[sessionKey()], undefined);
  assert.deepEqual(getStateDetail(sessionManager).public.scene.presentActorIds, ["protagonist"]);
  assert.equal(getStateDetail(sessionManager).public.actors.protagonist?.identity.publicIdentity, "不了解魔术的本地学生");
});

interface MockSessionManager {
  entries: unknown[];
  appendCustomEntry(customType: string, data?: unknown): string;
}

function createMockSessionManager(): MockSessionManager {
  return {
    entries: [],
    appendCustomEntry(customType: string, data?: unknown): string {
      const entryId = `entry-${this.entries.length + 1}`;
      this.entries.push({ customType, data, id: entryId });
      return entryId;
    },
  };
}

function getStateDetail(sessionManager: MockSessionManager): {
  public: {
    scene: { presentActorIds: string[] };
    actors: {
      protagonist?: {
        identity: { publicIdentity: string };
        sequence: null;
      };
    };
  };
  secrets: { actorStates: { protagonist?: { secrets?: unknown } } };
} {
  const entry = sessionManager.entries[sessionManager.entries.length - 1];
  const data =
    typeof entry === "object" && entry !== null && "data" in entry ? entry.data : undefined;
  if (!isStateEntry(data)) {
    throw new Error("initialize_new_game session entries missing persisted state entry");
  }
  return data.state;
}

function isStateEntry(value: unknown): value is {
  state: {
    public: {
      scene: { presentActorIds: string[] };
      actors: {
        protagonist?: {
          identity: { publicIdentity: string };
          sequence: null;
        };
      };
    };
    secrets: { actorStates: { protagonist?: { secrets?: unknown } } };
  };
} {
  return typeof value === "object" && value !== null && "state" in value;
}

function textOf(result: { content: Array<{ text: string }> }): string {
  return result.content.map((part) => part.text).join("\n");
}
