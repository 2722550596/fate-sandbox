import assert from "node:assert/strict";
import test from "node:test";

import { beginSceneBeat, transitionSceneBeat, updateScene } from "./scene";
import { getState, resetState } from "./state";

void test("updateScene moves location and advances clock", () => {
  resetState();

  updateScene({
    kind: "move-location",
    location: {
      region: "冬木市",
      site: "深山镇",
      detail: "卫宫邸",
      boundary: "normal",
    },
    elapsedMinutes: 30,
    reason: "步行回家",
  });

  const state = getState();
  assert.equal(state.public.scene.location.detail, "卫宫邸");
  assert.equal(state.public.clock.currentAt, "2004-01-30T07:30:00.000Z");
});

void test("updateScene creates objective ids after existing state ids", () => {
  resetState();

  updateScene({ kind: "add-objective", summary: "第一目标", reason: "测试 id" });
  updateScene({ kind: "add-objective", summary: "第二目标", reason: "测试 id" });

  const objectives = getState().public.scene.objectives;
  assert.equal(objectives[0]?.id, "objective-1");
  assert.equal(objectives[1]?.id, "objective-2");
});

void test("updateScene records story window boundaries", () => {
  resetState();

  updateScene({
    kind: "set-story-window",
    storyWindow: {
      currentArcId: "B2",
      currentBeatId: "ryudou-scouting-wrapup",
      title: "柳洞寺侦察收尾",
      allowedActions: ["完成北侧断崖结界确认", "发送撤退信号"],
      forbiddenEscalations: ["不得触发佐佐木小次郎正面战"],
      completionCriteria: ["四人安全撤回", "结界四重结构被记录"],
      nextBeatHints: ["回宅后整理战术问题"],
    },
    reason: "锁定侦察收尾 beat",
  });

  const storyWindow = getState().public.scene.storyWindow;
  assert.equal(storyWindow?.currentBeatId, "ryudou-scouting-wrapup");
  assert.deepEqual(storyWindow?.forbiddenEscalations, ["不得触发佐佐木小次郎正面战"]);
});

void test("beginSceneBeat creates window objectives threats and presence together", () => {
  resetState();

  const result = beginSceneBeat({
    storyWindow: {
      currentArcId: "B2",
      currentBeatId: "ryudou-scouting-wrapup",
      title: "柳洞寺侦察收尾",
      allowedActions: ["完成北侧断崖结界确认", "发送撤退信号"],
      forbiddenEscalations: ["不得触发佐佐木小次郎正面战"],
      completionCriteria: ["四人安全撤回", "结界四重结构被记录"],
      nextBeatHints: ["回宅后整理战术问题"],
    },
    objectives: ["确认北侧断崖结界", "发送撤退信号"],
    threats: [{ summary: "寺内巡逻接近", severity: "medium" }],
    presentActorIds: ["protagonist"],
    allyActorIds: ["protagonist"],
    situation: "investigation",
    reason: "锁定侦察收尾 beat",
  });

  const state = getState();
  assert.equal(state.public.scene.storyWindow?.currentBeatId, "ryudou-scouting-wrapup");
  assert.equal(state.public.scene.objectives.length, 2);
  assert.equal(state.public.scene.threats[0]?.summary, "寺内巡逻接近");
  assert.deepEqual(state.public.scene.presentActorIds, ["protagonist"]);
  assert.deepEqual(state.public.allyActorIds, ["protagonist"]);
  assert.equal(state.public.scene.situation, "investigation");
  assert.equal(result.objectiveIds.length, 2);
  assert.match(result.objectiveIds[0] ?? "", /^objective-\d+$/);
  assert.equal(result.threatIds.length, 1);
  assert.match(result.threatIds[0] ?? "", /^threat-\d+$/);
});

void test("beginSceneBeat rejects beats without objectives", () => {
  resetState();

  assert.throws(
    () =>
      beginSceneBeat({
        storyWindow: {
          currentArcId: "B2",
          currentBeatId: "empty",
          title: "空 beat",
          allowedActions: [],
          forbiddenEscalations: [],
          completionCriteria: [],
          nextBeatHints: [],
        },
        objectives: [],
        reason: "缺少目标",
      }),
    /1-5 个 Scene Objective/,
  );
});

void test("transitionSceneBeat refuses unresolved objectives", () => {
  resetState();
  const beat = beginSceneBeat({
    storyWindow: {
      currentArcId: "B2",
      currentBeatId: "wrapup",
      title: "收尾",
      allowedActions: ["撤退"],
      forbiddenEscalations: ["不得开战"],
      completionCriteria: ["安全离开"],
      nextBeatHints: [],
    },
    objectives: ["撤退", "确认无人追踪"],
    reason: "设置 beat",
  });

  assert.throws(
    () =>
      transitionSceneBeat({
        completedBeatId: "wrapup",
        resolvedObjectiveIds: [beat.objectiveIds[0] ?? "missing"],
        nextBeat: null,
        reason: "尝试提前结束",
      }),
    /仍有未解决目标/,
  );
});

void test("transitionSceneBeat clears completed window and can open next beat", () => {
  resetState();
  const beat = beginSceneBeat({
    storyWindow: {
      currentArcId: "B2",
      currentBeatId: "wrapup",
      title: "收尾",
      allowedActions: ["撤退"],
      forbiddenEscalations: ["不得开战"],
      completionCriteria: ["安全离开"],
      nextBeatHints: [],
    },
    objectives: ["撤退"],
    reason: "设置 beat",
  });

  const result = transitionSceneBeat({
    completedBeatId: "wrapup",
    resolvedObjectiveIds: beat.objectiveIds,
    nextBeat: {
      storyWindow: {
        currentArcId: "B2",
        currentBeatId: "home-debrief",
        title: "回宅复盘",
        allowedActions: ["整理情报"],
        forbiddenEscalations: ["不得跳到次日战斗"],
        completionCriteria: ["列出下一步问题"],
        nextBeatHints: [],
      },
      objectives: ["整理情报"],
      reason: "进入下一 beat",
    },
    memoryPrompt: "如果侦察结果有长期影响，调用 record_memory。",
    reason: "beat 完成",
  });

  const state = getState();
  assert.equal(state.public.scene.storyWindow?.currentBeatId, "home-debrief");
  assert.equal(state.public.scene.objectives.length, 1);
  assert.equal(state.public.scene.objectives[0]?.summary, "整理情报");
  assert.equal(result.memoryPrompt, "如果侦察结果有长期影响，调用 record_memory。");
});
