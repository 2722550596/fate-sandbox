import assert from "node:assert/strict";
import test from "node:test";

import { beginSceneBeat, transitionSceneBeat, updateScene } from "./scene.ts";
import { createInitialState } from "./state-store.ts";

void test("updateScene can correct current location without advancing time", () => {
  const draft = createInitialState();

  updateScene(draft, {
    kind: "set-location",
    location: {
      region: "冬木市",
      site: "新都",
      detail: "公园长椅旁",
      boundary: "normal",
    },
    reason: "续局声明当前位置为新都公园",
  });

  const state = draft;
  assert.equal(state.public.scene.location.detail, "公园长椅旁");
  assert.equal(state.public.clock.currentAt, "2004-01-30T07:00:00.000Z");
});

void test("updateScene creates objective ids after existing state ids", () => {
  const draft = createInitialState();

  updateScene(draft, { kind: "add-objective", summary: "第一目标", reason: "测试 id" });
  updateScene(draft, { kind: "add-objective", summary: "第二目标", reason: "测试 id" });

  const objectives = draft.public.scene.objectives;
  assert.equal(objectives[0]?.id, "objective-1");
  assert.equal(objectives[1]?.id, "objective-2");
});

void test("updateScene records story window boundaries", () => {
  const draft = createInitialState();

  updateScene(draft, {
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

  const storyWindow = draft.public.scene.storyWindow;
  assert.equal(storyWindow?.currentBeatId, "ryudou-scouting-wrapup");
  assert.deepEqual(storyWindow?.forbiddenEscalations, ["不得触发佐佐木小次郎正面战"]);
});

void test("beginSceneBeat creates window objectives threats and presence together", () => {
  const draft = createInitialState();

  const result = beginSceneBeat(draft, {
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

  const state = draft;
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

void test("beginSceneBeat rejects opening over an active beat", () => {
  const draft = createInitialState();

  beginSceneBeat(draft, {
    storyWindow: {
      currentArcId: "B1",
      currentBeatId: "active-beat",
      title: "当前 beat",
      allowedActions: ["观察"],
      forbiddenEscalations: [],
      completionCriteria: ["记录"],
      nextBeatHints: [],
    },
    objectives: ["记录"],
    reason: "设置当前 beat",
  });

  assert.throws(
    () =>
      beginSceneBeat(draft, {
        storyWindow: {
          currentArcId: "B1",
          currentBeatId: "second-beat",
          title: "第二个 beat",
          allowedActions: ["观察"],
          forbiddenEscalations: [],
          completionCriteria: ["记录"],
          nextBeatHints: [],
        },
        objectives: ["记录"],
        reason: "不能叠开 beat",
      }),
    /当前已有 active beat active-beat/,
  );

  assert.equal(draft.public.scene.storyWindow?.currentBeatId, "active-beat");
});

void test("updateScene set-story-window rejects replacing an active beat", () => {
  const draft = createInitialState();

  beginSceneBeat(draft, {
    storyWindow: {
      currentArcId: "B1",
      currentBeatId: "active-beat",
      title: "当前 beat",
      allowedActions: ["观察"],
      forbiddenEscalations: [],
      completionCriteria: ["记录"],
      nextBeatHints: [],
    },
    objectives: ["记录"],
    reason: "设置当前 beat",
  });

  assert.throws(
    () =>
      updateScene(draft, {
        kind: "set-story-window",
        storyWindow: {
          currentArcId: "B1",
          currentBeatId: "manual-second-beat",
          title: "手动第二 beat",
          allowedActions: ["观察"],
          forbiddenEscalations: [],
          completionCriteria: ["记录"],
          nextBeatHints: [],
        },
        reason: "不能手动覆盖 active beat",
      }),
    /当前已有 active beat active-beat/,
  );
});

void test("transitionSceneBeat can close current beat and open the next beat", () => {
  const draft = createInitialState();

  beginSceneBeat(draft, {
    storyWindow: {
      currentArcId: "B1",
      currentBeatId: "active-beat",
      title: "当前 beat",
      allowedActions: ["观察"],
      forbiddenEscalations: [],
      completionCriteria: ["记录"],
      nextBeatHints: [],
    },
    objectives: ["记录"],
    threats: [{ summary: "旧追兵压力", severity: "medium" }],
    reason: "设置当前 beat",
  });

  transitionSceneBeat(draft, {
    completedBeatId: "active-beat",
    resolveAllObjectives: true,
    nextBeat: {
      storyWindow: {
        currentArcId: "B1",
        currentBeatId: "next-beat",
        title: "下一个 beat",
        allowedActions: ["整理"],
        forbiddenEscalations: [],
        completionCriteria: ["整理完成"],
        nextBeatHints: [],
      },
      objectives: ["整理完成"],
      reason: "线性切换 beat",
    },
    reason: "完成当前 beat",
  });

  assert.equal(draft.public.scene.storyWindow?.currentBeatId, "next-beat");
  assert.deepEqual(draft.public.scene.threats, []);
});

void test("beginSceneBeat rejects beats without objectives", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      beginSceneBeat(draft, {
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
  const draft = createInitialState();
  const beat = beginSceneBeat(draft, {
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
      transitionSceneBeat(draft, {
        completedBeatId: "wrapup",
        resolvedObjectiveIds: [beat.objectiveIds[0] ?? "missing"],
        nextBeat: null,
        reason: "尝试提前结束",
      }),
    /仍有未解决目标/,
  );
});

void test("transitionSceneBeat can resolve all objectives", () => {
  const draft = createInitialState();
  beginSceneBeat(draft, {
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

  const result = transitionSceneBeat(draft, {
    completedBeatId: "wrapup",
    resolveAllObjectives: true,
    reason: "已完成全部目标",
  });

  const state = draft;
  assert.equal(state.public.scene.storyWindow, null);
  assert.equal(result.resolvedObjectiveIds.length, 2);
});

void test("transitionSceneBeat accepts partial objective summaries", () => {
  const draft = createInitialState();
  beginSceneBeat(draft, {
    storyWindow: {
      currentArcId: "B2",
      currentBeatId: "trace",
      title: "痕迹调查",
      allowedActions: ["检查排水沟"],
      forbiddenEscalations: ["不得深入核心"],
      completionCriteria: ["确认痕迹性质"],
      nextBeatHints: [],
    },
    objectives: ["沿魔力波动外围用構造把握检查地面、墙角和排水沟"],
    reason: "设置 beat",
  });

  const result = transitionSceneBeat(draft, {
    completedBeatId: "trace",
    resolvedObjectiveSummaries: ["检查地面、墙角和排水沟"],
    reason: "痕迹检查完成",
  });

  assert.equal(draft.public.scene.storyWindow, null);
  assert.equal(result.resolvedObjectiveIds.length, 1);
});

void test("transitionSceneBeat resolves all objectives by default when no selectors are provided", () => {
  const draft = createInitialState();
  beginSceneBeat(draft, {
    storyWindow: {
      currentArcId: "B2",
      currentBeatId: "night-scan",
      title: "夜间魔力分布观察",
      allowedActions: ["观察"],
      forbiddenEscalations: ["不得开战"],
      completionCriteria: ["观察完成", "局势确认"],
      nextBeatHints: [],
    },
    objectives: ["观察冬木市夜晚的魔力分布", "确认当前圣杯战争的基本局势"],
    reason: "设置 beat",
  });

  const result = transitionSceneBeat(draft, {
    completedBeatId: "night-scan",
    reason: "观察与确认都已完成",
  });

  const state = draft;
  assert.equal(state.public.scene.storyWindow, null);
  assert.equal(result.resolvedObjectiveIds.length, 2);
});

void test("updateScene resolves objectives by summary", () => {
  const draft = createInitialState();
  updateScene(draft, {
    kind: "add-objective",
    summary: "确认当前圣杯战争的基本局势",
    reason: "测试",
  });

  updateScene(draft, {
    kind: "resolve-objective",
    objectiveSummary: "圣杯战争的基本局势",
    reason: "已确认局势",
  });

  assert.equal(draft.public.scene.objectives[0]?.status, "resolved");
});

void test("updateScene explains missing resolve-objective selector", () => {
  const draft = createInitialState();
  updateScene(draft, {
    kind: "add-objective",
    summary: "确认当前圣杯战争的基本局势",
    reason: "测试",
  });

  assert.throws(
    () =>
      updateScene(draft, {
        kind: "resolve-objective",
        reason: "模型漏填 objectiveId",
      }),
    /必须提供 objectiveId 或 objectiveSummary/,
  );
});

void test("transitionSceneBeat clears completed window and can open next beat", () => {
  const draft = createInitialState();
  const beat = beginSceneBeat(draft, {
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

  const result = transitionSceneBeat(draft, {
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

  const state = draft;
  assert.equal(state.public.scene.storyWindow?.currentBeatId, "home-debrief");
  assert.equal(state.public.scene.objectives.length, 1);
  assert.equal(state.public.scene.objectives[0]?.summary, "整理情报");
  assert.equal(result.memoryPrompt, "如果侦察结果有长期影响，调用 record_memory。");
});

void test("updateScene clear-threat removes a threat by id", () => {
  const draft = createInitialState();

  updateScene(draft, {
    kind: "add-threat",
    summary: "黑水中抬升的庞然大物",
    severity: "high",
    reason: "群兽逼近",
  });
  const threatId = draft.public.scene.threats[0]?.id ?? "";
  assert.match(threatId, /^threat-\d+$/);

  const result = updateScene(draft, {
    kind: "clear-threat",
    threatId,
    reason: "庞然大物被击退",
  });

  assert.equal(draft.public.scene.threats.length, 0);
  assert.match(result.message, new RegExp(threatId));
});

void test("updateScene clear-threat removes a threat by summary (objectiveSummary-style fallback)", () => {
  const draft = createInitialState();

  updateScene(draft, {
    kind: "add-threat",
    summary: "黑水中抬升的庞然大物",
    severity: "high",
    reason: "群兽逼近",
  });

  updateScene(draft, {
    kind: "clear-threat",
    threatSummary: "黑水中抬升的庞然大物",
    reason: "庞然大物被击退",
  });

  assert.equal(draft.public.scene.threats.length, 0);
});

void test("updateScene clear-threat matches a threat by partial summary", () => {
  const draft = createInitialState();

  updateScene(draft, {
    kind: "add-threat",
    summary: "黑水中抬升的庞然大物",
    severity: "high",
    reason: "群兽逼近",
  });

  // 模型从 GM Brief 复制 summary 时偶有截断；substring 双向匹配兜住。
  updateScene(draft, {
    kind: "clear-threat",
    threatSummary: "庞然大物",
    reason: "击退",
  });

  assert.equal(draft.public.scene.threats.length, 0);
});

void test("updateScene clear-threat without selector throws an actionable error", () => {
  const draft = createInitialState();

  updateScene(draft, {
    kind: "add-threat",
    summary: "黑水中抬升的庞然大物",
    severity: "high",
    reason: "群兽逼近",
  });

  assert.throws(
    () => updateScene(draft, { kind: "clear-threat", reason: "缺少选择器" }),
    (error) => {
      const message = String(error);
      assert.match(message, /必须提供 threatId 或 threatSummary/);
      assert.match(message, /黑水中抬升的庞然大物/);
      return true;
    },
  );
});

void test("updateScene clear-threat by unknown summary lists available summaries", () => {
  const draft = createInitialState();

  updateScene(draft, {
    kind: "add-threat",
    summary: "黑水中抬升的庞然大物",
    severity: "high",
    reason: "群兽逼近",
  });

  assert.throws(
    () => updateScene(draft, { kind: "clear-threat", threatSummary: "不存在的威胁", reason: "x" }),
    (error) => {
      const message = String(error);
      assert.match(message, /威胁摘要不存在/);
      assert.match(message, /黑水中抬升的庞然大物/);
      return true;
    },
  );
});
