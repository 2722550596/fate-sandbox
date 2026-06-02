import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "./state";
import { commitTurn } from "./turn-commit";

void test("commitTurn applies multiple domain events in order", () => {
  resetState();

  const result = commitTurn({
    summary: "卫宫士郎步行回家并记录当前目标。",
    events: [
      {
        kind: "scene",
        event: {
          kind: "move-location",
          location: {
            region: "冬木市",
            site: "深山镇",
            detail: "卫宫邸",
            boundary: "normal",
          },
          elapsedMinutes: 30,
          reason: "步行回家",
        },
      },
      {
        kind: "scene",
        event: {
          kind: "add-objective",
          summary: "整理今晚的异常遭遇",
          reason: "回合收口",
        },
      },
    ],
  });

  const state = getState();
  assert.equal(state.public.scene.location.detail, "卫宫邸");
  assert.equal(state.public.scene.objectives[0]?.summary, "整理今晚的异常遭遇");
  assert.equal(result.results.length, 2);
  assert.match(result.message, /回合已提交/);
});

void test("commitTurn auto-closes a beat after resolving the last objective", () => {
  resetState();

  commitTurn({
    summary: "开启调查 beat。",
    events: [
      {
        kind: "scene-beat",
        event: {
          kind: "begin-beat",
          input: {
            storyWindow: {
              currentArcId: "B1",
              currentBeatId: "active-beat",
              title: "当前调查",
              allowedActions: ["调查"],
              forbiddenEscalations: [],
              completionCriteria: ["确认线索"],
              nextBeatHints: [],
            },
            objectives: ["确认线索"],
            reason: "开始调查",
          },
        },
      },
    ],
  });

  const result = commitTurn({
    summary: "解决最后目标。",
    events: [
      {
        kind: "scene",
        event: {
          kind: "resolve-objective",
          objectiveSummary: "确认线索",
          reason: "线索确认",
        },
      },
    ],
  });

  assert.deepEqual(getState().public.scene.objectives, []);
  assert.equal(getState().public.scene.storyWindow, null);
  assert.equal(result.results.length, 2);
  const autoClose = result.results[1];
  assert.equal(autoClose?.kind, "scene");
  assert.match(autoClose.result.message, /剧情窗口已清除/);
});

void test("commitTurn rejects empty commits", () => {
  resetState();

  assert.throws(
    () => commitTurn({ summary: "没有状态变化。", events: [] }),
    /至少需要一个领域事件/,
  );
});

void test("commitTurn rolls back earlier events when a later event fails", () => {
  resetState();

  assert.throws(
    () =>
      commitTurn({
        summary: "测试事务回滚。",
        events: [
          {
            kind: "economy",
            event: {
              kind: "spend-money",
              ownerActorId: "protagonist",
              amount: 1000,
              reason: "测试支出",
            },
          },
          {
            kind: "memory",
            event: {
              kind: "record-major-event",
              title: "柳洞寺确认情报",
              summary: "凛确认 Caster 正在柳洞寺。",
              consequences: ["Caster 位置已确认。"],
              claims: [],
            },
          },
        ],
      }),
    /必须提供 claims/,
  );

  const state = getState();
  assert.equal(state.public.economy.accessibleFunds[0]?.amount, 50000);
  assert.equal(state.public.memory.eventLog.length, 0);
});

void test("commitTurn auto-closes a story window with no active objectives", () => {
  resetState();

  const result = commitTurn({
    summary: "开启只有边界的剧情窗口。",
    events: [
      {
        kind: "scene",
        event: {
          kind: "set-story-window",
          storyWindow: {
            currentArcId: "B2",
            currentBeatId: "wrapup",
            title: "收尾",
            allowedActions: ["撤退"],
            forbiddenEscalations: ["不得开战"],
            completionCriteria: ["安全离开"],
            nextBeatHints: [],
          },
          reason: "锁定 beat",
        },
      },
    ],
  });

  assert.equal(getState().public.scene.storyWindow, null);
  assert.equal(result.results.length, 2);
});

void test("commitTurn can move into a scene beat", () => {
  resetState();

  const result = commitTurn({
    summary: "前往柳洞寺外围并开启侦察。",
    events: [
      {
        kind: "scene-beat",
        event: {
          kind: "move-location",
          input: {
            storyWindow: {
              currentArcId: "B1",
              currentBeatId: "scout",
              title: "柳洞寺外围侦察",
              allowedActions: ["观察", "撤退"],
              forbiddenEscalations: ["不得交战"],
              completionCriteria: ["观察完成", "安全撤回"],
              nextBeatHints: [],
            },
            objectives: ["观察结界", "安全撤回"],
            location: {
              region: "冬木市",
              site: "円藏山",
              detail: "柳洞寺外围·山道",
              boundary: "normal",
            },
            elapsedMinutes: 25,
            situation: "investigation",
            reason: "从穗群原学园前往柳洞寺外围侦察",
          },
        },
      },
    ],
  });

  const state = getState();
  assert.equal(state.public.clock.currentAt, "2004-01-30T07:25:00.000Z");
  assert.equal(state.public.scene.location.detail, "柳洞寺外围·山道");
  assert.equal(state.public.scene.storyWindow?.currentBeatId, "scout");
  assert.equal(result.results.length, 1);
});

void test("commitTurn applies canonical nested domain events", () => {
  resetState();

  const result = commitTurn({
    summary: "移动到新都并采购基础物资。",
    events: [
      {
        kind: "scene",
        event: {
          kind: "move-location",
          location: {
            region: "冬木市",
            site: "新都",
            detail: "商业街",
            boundary: "normal",
          },
          elapsedMinutes: 40,
          reason: "移动到新都",
        },
      },
      {
        kind: "economy",
        event: {
          kind: "spend-money",
          purseId: "purse-protagonist-cash",
          amount: 3800,
          reason: "采购基础物资",
        },
      },
    ],
  });

  const state = getState();
  assert.equal(state.public.scene.location.detail, "商业街");
  assert.equal(state.public.economy.accessibleFunds[0]?.amount, 46200);
  assert.equal(result.results.length, 2);
});

void test("commitTurn accepts canonical scene beat events", () => {
  resetState();

  const result = commitTurn({
    summary: "进入新都调查 beat。",
    events: [
      {
        kind: "scene-beat",
        event: {
          kind: "move-location",
          input: {
            storyWindow: {
              currentArcId: "B1",
              currentBeatId: "shinto-investigation",
              title: "新都魔力痕迹调查",
              allowedActions: ["调查"],
              forbiddenEscalations: ["不得交战"],
              completionCriteria: ["确认一处痕迹"],
              nextBeatHints: [],
            },
            objectives: ["确认一处痕迹"],
            location: {
              region: "冬木市",
              site: "新都",
              detail: "商业街北侧小路",
              boundary: "normal",
            },
            elapsedMinutes: 25,
            reason: "进入新都调查 beat",
          },
        },
      },
    ],
  });

  const state = getState();
  assert.equal(state.public.scene.storyWindow?.currentBeatId, "shinto-investigation");
  assert.equal(state.public.scene.location.detail, "商业街北侧小路");
  assert.equal(result.results.length, 1);
});

void test("commitTurn accepts scene presence events", () => {
  resetState();

  const result = commitTurn({
    summary: "凛暂时离场，樱留在厨房。",
    events: [
      {
        kind: "scene-presence",
        event: {
          presentActorIds: ["protagonist"],
          allyActorIds: [],
          reason: "凛暂时离场",
        },
      },
    ],
  });

  const state = getState();
  assert.deepEqual(state.public.scene.presentActorIds, ["protagonist"]);
  assert.deepEqual(state.public.allyActorIds, []);
  assert.equal(result.results[0]?.kind, "scene-presence");
});

void test("commitTurn transitions beat and applies canonical movement", () => {
  resetState();

  commitTurn({
    summary: "开启夜间观测 beat。",
    events: [
      {
        kind: "scene-beat",
        event: {
          kind: "begin-beat",
          input: {
            storyWindow: {
              currentArcId: "B1",
              currentBeatId: "night-scan",
              title: "夜间魔力分布观察",
              allowedActions: ["观察", "确认局势"],
              forbiddenEscalations: ["不得开战"],
              completionCriteria: ["观察完成", "局势确认"],
              nextBeatHints: [],
            },
            objectives: ["观察冬木市夜晚的魔力分布", "确认当前圣杯战争的基本局势"],
            reason: "开始观测",
          },
        },
      },
    ],
  });

  const result = commitTurn({
    summary: "观测完成后移动到新都。",
    events: [
      {
        kind: "scene-beat",
        event: {
          kind: "transition-beat",
          input: {
            completedBeatId: "night-scan",
            resolveAllObjectives: true,
            reason: "观测目标已完成",
          },
        },
      },
      {
        kind: "scene",
        event: {
          kind: "move-location",
          location: {
            region: "冬木市",
            site: "新都",
            detail: "商业街",
            boundary: "normal",
          },
          elapsedMinutes: 45,
          reason: "移动到新都",
        },
      },
    ],
  });

  const state = getState();
  assert.equal(state.public.scene.storyWindow, null);
  assert.equal(state.public.scene.location.detail, "商业街");
  assert.equal(result.results.length, 2);
});

void test("commitTurn transitions into canonical next beat", () => {
  resetState();

  commitTurn({
    summary: "开启揭示 beat。",
    events: [
      {
        kind: "scene-beat",
        event: {
          kind: "begin-beat",
          input: {
            storyWindow: {
              currentArcId: "B5",
              currentBeatId: "reveal-wrapup",
              title: "真名与宝具揭示收口",
              allowedActions: ["整理线索"],
              forbiddenEscalations: ["不得继续追击"],
              completionCriteria: ["真名揭示成立", "宝具揭示成立"],
              nextBeatHints: [],
            },
            objectives: ["真名揭示成立", "宝具揭示成立"],
            reason: "设置揭示收口 beat",
          },
        },
      },
    ],
  });

  const result = commitTurn({
    summary: "揭示成立并进入后续观察 beat。",
    events: [
      {
        kind: "scene-beat",
        event: {
          kind: "transition-beat",
          input: {
            completedBeatId: "reveal-wrapup",
            resolveAllObjectives: true,
            reason: "揭示成立并进入后续观察 beat",
            nextBeat: {
              storyWindow: {
                currentArcId: "B5",
                currentBeatId: "after-reveal-watch",
                title: "揭示后的短暂停顿",
                allowedActions: ["观察反应"],
                forbiddenEscalations: ["不得跳过玩家回应"],
                completionCriteria: ["确认下一步行动"],
                nextBeatHints: [],
              },
              objectives: ["确认下一步行动"],
              reason: "进入揭示后的短暂停顿",
            },
          },
        },
      },
    ],
  });

  const state = getState();
  assert.equal(state.public.scene.storyWindow?.currentBeatId, "after-reveal-watch");
  assert.equal(result.results.length, 1);
});

void test("commitTurn can transition scene beat by objective summaries", () => {
  resetState();

  commitTurn({
    summary: "开启侦察 beat。",
    events: [
      {
        kind: "scene-beat",
        event: {
          kind: "begin-beat",
          input: {
            storyWindow: {
              currentArcId: "B1",
              currentBeatId: "scout",
              title: "侦察",
              allowedActions: ["观察", "撤退"],
              forbiddenEscalations: ["不得交战"],
              completionCriteria: ["观察完成", "安全撤回"],
              nextBeatHints: [],
            },
            objectives: ["观察结界", "安全撤回"],
            reason: "开始侦察",
          },
        },
      },
    ],
  });

  const result = commitTurn({
    summary: "撤回并记录发现。",
    events: [
      {
        kind: "scene",
        event: {
          kind: "move-location",
          location: {
            region: "冬木市",
            site: "深山镇",
            detail: "卫宫宅",
            boundary: "normal",
          },
          elapsedMinutes: 35,
          reason: "安全撤回",
        },
      },
      {
        kind: "scene-beat",
        event: {
          kind: "transition-beat",
          input: {
            completedBeatId: "scout",
            resolvedObjectiveIds: [],
            resolvedObjectiveSummaries: ["观察结界", "安全撤回"],
            nextBeat: null,
            reason: "侦察完成",
          },
        },
      },
      {
        kind: "memory",
        event: {
          kind: "record-major-event",
          title: "柳洞寺外围侦察",
          summary: "从外围确认柳洞寺存在多层结界，山门是唯一入口。",
          consequences: ["后续接近柳洞寺必须避开山门正面突破"],
          claims: [
            {
              kind: "world-fact",
              statement: "士郎与同行者在柳洞寺外围观察到结界与山门路径。",
              certainty: "observed",
              evidence: "士郎与同行者在柳洞寺外围完成侦察。",
            },
          ],
        },
      },
    ],
  });

  const state = getState();
  assert.equal(state.public.scene.storyWindow, null);
  assert.equal(state.public.scene.location.detail, "卫宫宅");
  assert.equal(state.public.memory.eventLog[0]?.title, "柳洞寺外围侦察");
  assert.equal(result.results.length, 3);
});
