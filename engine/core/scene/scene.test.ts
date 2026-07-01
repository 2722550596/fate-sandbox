import type { StoryWindowState } from "../state/state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import { updateScene, beginSceneBeat, transitionSceneBeat } from "./scene.ts";

function storyWindow(
  beatId = "beat-1",
  overrides: Partial<StoryWindowState> = {},
): StoryWindowState {
  return {
    currentArcId: "arc-1",
    currentBeatId: beatId,
    title: "测试 Beat",
    allowedActions: [],
    forbiddenEscalations: [],
    completionCriteria: [],
    nextBeatHints: [],
    ...overrides,
  };
}

function withActiveBeat(draft: ReturnType<typeof createInitialState>): void {
  beginSceneBeat(draft, {
    reason: "测试",
    storyWindow: storyWindow(),
    objectives: ["完成调查"],
    threats: [{ summary: "敌人袭击", severity: "medium" }],
  });
}

// ---------------------------------------------------------------------------
// set-location
// ---------------------------------------------------------------------------

void test("updateScene set-location updates scene location", () => {
  const draft = createInitialState();
  withActiveBeat(draft);

  const result = updateScene(draft, {
    kind: "set-location",
    reason: "移动",
    location: { region: "贝克兰德", site: "下城区", detail: "码头", boundary: "normal" },
  });

  assert.equal(draft.public.scene.location.region, "贝克兰德");
  assert.equal(draft.public.scene.location.site, "下城区");
  assert.match(result.message, /地点已修正/);
});

void test("updateScene set-location rejects empty reason", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      updateScene(draft, {
        kind: "set-location",
        reason: "",
        location: { region: "贝克兰德", site: "桥区", detail: "街角", boundary: "normal" },
      }),
    /reason/,
  );
});

// ---------------------------------------------------------------------------
// set-situation
// ---------------------------------------------------------------------------
void test("updateScene set-situation updates scene situation", () => {
  const draft = createInitialState();
  withActiveBeat(draft);

  const result = updateScene(draft, {
    kind: "set-situation",
    reason: "局势变化",
    situation: "combat",
  });

  assert.equal(draft.public.scene.situation, "combat");
  assert.match(result.message, /态势已更新/);
});

// ---------------------------------------------------------------------------
// beginSceneBeat
// ---------------------------------------------------------------------------

void test("beginSceneBeat sets story window and creates objectives", () => {
  const draft = createInitialState();

  const result = beginSceneBeat(draft, {
    reason: "开始剧情",
    storyWindow: storyWindow("beat-1", {
      title: "初次见面",
      allowedActions: ["交谈", "观察"],
      completionCriteria: ["获取信息"],
    }),
    objectives: ["与NPC交谈", "收集线索"],
    threats: [{ summary: "暗中监视者", severity: "low" }],
  });

  assert.match(result.message, /Scene Beat 已开始/);
  assert.equal(result.objectiveIds.length, 2);
  assert.equal(result.threatIds.length, 1);
  assert.ok(draft.public.scene.storyWindow);
  assert.equal(draft.public.scene.objectives.length, 2);
  assert.equal(draft.public.scene.threats.length, 1);
});

void test("beginSceneBeat rejects duplicate active beat", () => {
  const draft = createInitialState();
  withActiveBeat(draft);

  assert.throws(
    () =>
      beginSceneBeat(draft, {
        reason: "重复开始",
        storyWindow: storyWindow("beat-2", { title: "重复" }),
        objectives: ["测试"],
      }),
    /无法开始新的 Scene Beat/,
  );
});

void test("beginSceneBeat rejects zero objectives", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      beginSceneBeat(draft, {
        reason: "无目标",
        storyWindow: storyWindow(),
        objectives: [],
      }),
    /数量超出限制/,
  );
});

void test("beginSceneBeat rejects too many objectives", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      beginSceneBeat(draft, {
        reason: "过多目标",
        storyWindow: storyWindow(),
        objectives: Array.from({ length: 6 }, (_, i) => `目标${i + 1}`),
      }),
    /数量超出限制/,
  );
});

// ---------------------------------------------------------------------------
// add-objective (requires active beat)
// ---------------------------------------------------------------------------

void test("updateScene add-objective adds objective during active beat", () => {
  const draft = createInitialState();
  withActiveBeat(draft);

  const result = updateScene(draft, {
    kind: "add-objective",
    reason: "新情况",
    summary: "调查暗巷",
  });

  assert.match(result.message, /目标已加入/);
  assert.equal(draft.public.scene.objectives.length, 2);
});

void test("updateScene add-objective rejects without active beat", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      updateScene(draft, {
        kind: "add-objective",
        reason: "新情况",
        summary: "调查暗巷",
      }),
    /无法执行 add-objective/,
  );
});

// ---------------------------------------------------------------------------
// resolve-objective (requires active beat)
// ---------------------------------------------------------------------------

void test("updateScene resolve-objective resolves by id", () => {
  const draft = createInitialState();
  beginSceneBeat(draft, {
    reason: "测试",
    storyWindow: storyWindow(),
    objectives: ["目标A", "目标B"],
  });
  const targetId = draft.public.scene.objectives[0]?.id;

  const result = updateScene(draft, {
    kind: "resolve-objective",
    reason: "完成",
    objectiveId: targetId,
  });

  assert.match(result.message, /目标已解决/);
  assert.equal(draft.public.scene.objectives[0]?.status, "resolved");
});

void test("updateScene resolve-objective resolves by summary", () => {
  const draft = createInitialState();
  beginSceneBeat(draft, {
    reason: "测试",
    storyWindow: storyWindow(),
    objectives: ["目标A", "目标B"],
  });

  const result = updateScene(draft, {
    kind: "resolve-objective",
    reason: "完成",
    objectiveSummary: "目标A",
  });

  assert.match(result.message, /目标已解决/);
});

void test("updateScene resolve-objective rejects last objective via commit_turn", () => {
  const draft = createInitialState();
  withActiveBeat(draft);

  assert.throws(
    () =>
      updateScene(draft, {
        kind: "resolve-objective",
        reason: "完成",
        objectiveSummary: "完成调查",
      }),
    /最后一个未解决目标/,
  );
});

void test("updateScene resolve-objective throws if summary not found", () => {
  const draft = createInitialState();
  withActiveBeat(draft);

  assert.throws(
    () =>
      updateScene(draft, {
        kind: "resolve-objective",
        reason: "完成",
        objectiveSummary: "不存在的目标",
      }),
    /目标摘要不存在/,
  );
});

// ---------------------------------------------------------------------------
// add-threat (requires active beat)
// ---------------------------------------------------------------------------

void test("updateScene add-threat adds threat during active beat", () => {
  const draft = createInitialState();
  withActiveBeat(draft);

  const result = updateScene(draft, {
    kind: "add-threat",
    reason: "新威胁",
    summary: "埋伏",
    severity: "high",
  });

  assert.match(result.message, /威胁已加入/);
  assert.equal(draft.public.scene.threats.length, 2);
});

void test("updateScene add-threat rejects without active beat", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      updateScene(draft, {
        kind: "add-threat",
        reason: "威胁",
        summary: "伏击",
        severity: "medium",
      }),
    /无法执行 add-threat/,
  );
});

// ---------------------------------------------------------------------------
// clear-threat (requires active beat)
// ---------------------------------------------------------------------------

void test("updateScene clear-threat removes threat by id", () => {
  const draft = createInitialState();
  beginSceneBeat(draft, {
    reason: "测试",
    storyWindow: storyWindow(),
    objectives: ["调查"],
    threats: [
      { summary: "跟踪者", severity: "low" },
      { summary: "陷阱", severity: "medium" },
    ],
  });
  const threatId = draft.public.scene.threats[0]?.id;

  const result = updateScene(draft, {
    kind: "clear-threat",
    reason: "摆脱跟踪",
    threatId,
  });

  assert.match(result.message, /威胁已清除/);
  assert.equal(draft.public.scene.threats.length, 1);
});

void test("updateScene clear-threat removes threat by summary", () => {
  const draft = createInitialState();
  beginSceneBeat(draft, {
    reason: "测试",
    storyWindow: storyWindow(),
    objectives: ["调查"],
    threats: [
      { summary: "跟踪者", severity: "low" },
      { summary: "陷阱", severity: "medium" },
    ],
  });

  const result = updateScene(draft, {
    kind: "clear-threat",
    reason: "解除陷阱",
    threatSummary: "陷阱",
  });

  assert.match(result.message, /威胁已清除/);
  assert.equal(draft.public.scene.threats.length, 1);
});

void test("updateScene clear-threat rejects without active beat", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      updateScene(draft, {
        kind: "clear-threat",
        reason: "清除",
        threatSummary: "某威胁",
      }),
    /无法执行 clear-threat/,
  );
});

// ---------------------------------------------------------------------------
// transitionSceneBeat
// ---------------------------------------------------------------------------

void test("transitionSceneBeat completes beat and resolves objectives", () => {
  const draft = createInitialState();
  withActiveBeat(draft);

  const result = transitionSceneBeat(draft, {
    reason: "完成剧情",
    completedBeatId: "beat-1",
    resolveAllObjectives: true,
  });

  assert.match(result.message, /Scene Beat 已完成/);
  assert.equal(draft.public.scene.storyWindow, null);
  assert.equal(draft.public.scene.objectives.length, 0);
});

void test("transitionSceneBeat rejects wrong beat id", () => {
  const draft = createInitialState();
  withActiveBeat(draft);

  assert.throws(
    () =>
      transitionSceneBeat(draft, {
        reason: "完成",
        completedBeatId: "wrong-beat",
        resolveAllObjectives: true,
      }),
    /当前 beat 是 beat-1/,
  );
});

void test("transitionSceneBeat rejects without active beat", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      transitionSceneBeat(draft, {
        reason: "完成",
        completedBeatId: "beat-1",
        resolveAllObjectives: true,
      }),
    /无法 transition beat/,
  );
});

void test("transitionSceneBeat rejects unresolved objectives", () => {
  const draft = createInitialState();
  beginSceneBeat(draft, {
    reason: "测试",
    storyWindow: storyWindow(),
    objectives: ["目标A", "目标B"],
  });

  assert.throws(
    () =>
      transitionSceneBeat(draft, {
        reason: "完成",
        completedBeatId: "beat-1",
        resolveAllObjectives: false,
      }),
    /仍有未解决目标/,
  );
});
