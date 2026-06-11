import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../engine/core/state-store.ts";
import { sessionKey } from "../../engine/core/state-persistence.ts";
import { initializeNewGameTool } from "./initialize-new-game.ts";

void test("initializeNewGameTool initializes human protagonist and persists details", () => {
  resetState();
  const sessionManager = createMockSessionManager();

  const result = initializeNewGameTool(
    {
      kind: "human-protagonist",
      campaign: { presetId: "fsn_2004_fuyuki" },
      protagonist: {
        displayName: "你",
        publicIdentity: "不了解魔术的本地学生",
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
  assert.equal(result.details[sessionKey()] !== undefined, true);
  assert.deepEqual(getStateDetail(result).public.scene.presentActorIds, ["protagonist"]);
  assert.equal(getStateDetail(result).public.actors.protagonist?.identity.publicIdentity, "不了解魔术的本地学生");
});

void test("initializeNewGameTool initializes servant protagonist hidden true name", () => {
  resetState();
  const result = initializeNewGameTool(
    {
      kind: "servant-protagonist",
      campaign: { presetId: "fsf_2008_snowfield" },
      protagonist: {
        displayName: "Saber",
        publicIdentity: "刚现界且真名未公开的 Saber",
        apparentAge: "青年",
        outfit: { label: "战斗礼装", details: "灵基投影出的轻甲。" },
        demeanor: "警戒而克制。",
        className: "Saber",
        trueNameDisplay: "Saber",
        trueNameStatus: "hidden",
      },
      hiddenTrueName: {
        value: "隐藏真名",
        revealConditions: ["剧情内提出可验证证据"],
      },
      reason: "tool-level 初始化玩家从者并隐藏真名",
    },
    createMockSessionManager(),
  );

  const state = getStateDetail(result);
  assert.equal(state.public.actors.protagonist?.servantForm?.identity.trueName.status, "hidden");
  assert.equal(state.secrets.actorSecrets.protagonist !== undefined, true);
});

void test("initializeNewGameTool rejects public revealed servant protagonist true name", () => {
  resetState();

  assert.throws(
    () =>
      initializeNewGameTool(
        {
          kind: "servant-protagonist",
          campaign: { presetId: "fsf_2008_snowfield" },
          protagonist: {
            displayName: "Saber",
            publicIdentity: "真名不该公开的 Saber",
            apparentAge: "青年",
            outfit: { label: "战斗礼装", details: "灵基投影出的轻甲。" },
            demeanor: "警戒而克制。",
            className: "Saber",
            trueNameDisplay: "两仪式",
            trueNameStatus: "revealed",
          },
          reason: "tool-level 测试拒绝开局公开真名",
        },
        createMockSessionManager(),
      ),
    /protagonist.trueNameStatus/,
  );
});

void test("initializeNewGameTool coerces scalar reveal conditions into an array", () => {
  resetState();

  initializeNewGameTool(
    {
      kind: "servant-protagonist",
      campaign: { presetId: "fsf_2008_snowfield" },
      protagonist: {
        displayName: "Saber",
        publicIdentity: "刚现界且真名未公开的 Saber",
        apparentAge: "青年",
        outfit: { label: "战斗礼装", details: "灵基投影出的轻甲。" },
        demeanor: "警戒而克制。",
        className: "Saber",
        trueNameDisplay: "Saber",
        trueNameStatus: "hidden",
      },
      // TypeBox Convert 的系统性宽容：标量字符串自动包装为单元素数组。
      hiddenTrueName: { value: "隐藏真名", revealConditions: "剧情内证据" },
      reason: "tool-level 测试标量 revealConditions coercion",
    },
    createMockSessionManager(),
  );

  const trueName = getState().secrets.actorSecrets["protagonist"]?.trueName;
  assert.equal(trueName?.value, "隐藏真名");
  assert.deepEqual(trueName?.revealConditions, ["剧情内证据"]);
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

function getStateDetail(result: ReturnType<typeof initializeNewGameTool>): {
  public: {
    scene: { presentActorIds: string[] };
    actors: {
      protagonist?: {
        identity: { publicIdentity: string };
        servantForm: { identity: { trueName: { status: string } } } | null;
      };
    };
  };
  secrets: { actorSecrets: { protagonist?: unknown } };
} {
  const detail = result.details[sessionKey()];
  if (!isStateEntry(detail)) {
    throw new Error("initialize_new_game result details missing persisted state entry");
  }
  return detail.state;
}

function isStateEntry(value: unknown): value is {
  state: {
    public: {
      scene: { presentActorIds: string[] };
      actors: {
        protagonist?: {
          identity: { publicIdentity: string };
          servantForm: { identity: { trueName: { status: string } } } | null;
        };
      };
    };
    secrets: { actorSecrets: { protagonist?: unknown } };
  };
} {
  return typeof value === "object" && value !== null && "state" in value;
}

function textOf(result: { content: Array<{ text: string }> }): string {
  return result.content.map((part) => part.text).join("\n");
}
