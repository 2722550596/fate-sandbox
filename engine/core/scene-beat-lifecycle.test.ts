import type { State } from "./state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { progressSceneBeat } from "./scene-beat-lifecycle.ts";
import { createInitialState } from "./state-store.ts";

void test("progressSceneBeat begins a Scene Beat through the lifecycle seam", () => {
  const draft = createInitialState();

  const result = progressSceneBeat(draft, {
    kind: "begin",
    title: "柳洞寺外围侦察",
    objectives: ["观察结界", "安全撤回"],
    purpose: "进入柳洞寺外围侦察 beat。",
    time: { kind: "elapsed", elapsedMinutes: 1, reason: "进入侦察态势。" },
    threats: [{ summary: "山门附近有从者级别气息", severity: "medium" }],
    presence: { presentActorIds: ["protagonist"] },
    situation: "investigation",
  });

  const state = draft;
  assert.equal(result.kind, "begin");
  assert.equal(state.public.scene.storyWindow?.title, "柳洞寺外围侦察");
  assert.equal(state.public.scene.storyWindow.currentArcId, "main");
  assert.match(state.public.scene.storyWindow.currentBeatId, /^beat-/u);
  assert.deepEqual(
    state.public.scene.objectives.map((objective) => objective.summary),
    ["观察结界", "安全撤回"],
  );
  assert.equal(state.public.scene.threats[0]?.summary, "山门附近有从者级别气息");
  assert.deepEqual(state.public.scene.presentActorIds, ["protagonist"]);
  assert.equal(state.public.scene.situation, "investigation");
});

void test("progressSceneBeat can travel and begin in one lifecycle step", () => {
  const draft = createInitialState();

  progressSceneBeat(draft, {
    kind: "begin",
    title: "新都商业街调查",
    objectives: ["确认魔力痕迹"],
    purpose: "移动到新都商业街并开始调查。",
    time: {
      kind: "travel",
      location: {
        region: "冬木市",
        site: "新都",
        detail: "商业街",
        boundary: "normal",
      },
      elapsedMinutes: 40,
      reason: "移动到新都商业街。",
    },
  });

  const state = draft;
  assert.equal(state.public.clock.currentAt, "2004-01-30T07:40:00.000Z");
  assert.equal(state.public.scene.location.detail, "商业街");
  assert.equal(state.public.scene.storyWindow?.title, "新都商业街调查");
});

void test("progressSceneBeat completes current beat and opens next beat", () => {
  const draft = createInitialState();
  openCurrentBeat(draft);

  const result = progressSceneBeat(draft, {
    kind: "complete",
    outcome: "真名与宝具揭示成立，现场进入短暂停顿。",
    time: { kind: "elapsed", elapsedMinutes: 1, reason: "收口当前 beat。" },
    memory: {
      title: "真名与宝具揭示成立",
      summary: "玩家通过现场线索确认揭示成立，双方暂时停手观察。",
      claims: [
        {
          kind: "mundane",
          statement: "真名与宝具揭示这一幕已经在现场发生。",
          certainty: "observed",
        },
      ],
    },
    nextBeat: {
      title: "揭示后的短暂停顿",
      objectives: ["观察对方反应", "决定是否撤离"],
      presence: { presentActorIds: ["protagonist"], allyActorIds: [] },
      situation: "social",
    },
  });

  const state = draft;
  assert.equal(result.kind, "complete");
  assert.equal(state.public.scene.storyWindow?.title, "揭示后的短暂停顿");
  assert.equal(state.public.scene.storyWindow.currentArcId, "main");
  assert.equal(state.public.scene.storyWindow.currentBeatId, "reveal-wrapup-next");
  assert.deepEqual(
    state.public.scene.objectives.map((objective) => objective.summary),
    ["观察对方反应", "决定是否撤离"],
  );
  assert.equal(state.public.memory.eventLog[0]?.title, "真名与宝具揭示成立");
  assert.deepEqual(state.public.scene.presentActorIds, ["protagonist"]);
  assert.equal(state.public.scene.situation, "social");
});

void test("progressSceneBeat rejects complete without an active Scene Beat", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      progressSceneBeat(draft, {
        kind: "complete",
        outcome: "没有当前 beat 却尝试收口。",
        time: { kind: "elapsed", elapsedMinutes: 1, reason: "即时行动也推进一个最小时间单位。" },
      }),
    /复杂新场景请用 progress_scene_beat begin/,
  );
});

function openCurrentBeat(draft: State): void {
  progressSceneBeat(draft, {
    kind: "begin",
    title: "真名与宝具揭示收口",
    objectives: ["真名揭示成立", "宝具揭示成立"],
    purpose: "开启揭示收口 beat",
    time: { kind: "elapsed", elapsedMinutes: 1, reason: "开启 beat。" },
    beatId: "reveal-wrapup",
    actionPolicy: {
      allowedActions: ["整理线索"],
      forbiddenEscalations: ["不得继续追击"],
      completionCriteria: ["真名揭示成立", "宝具揭示成立"],
    },
    presence: { presentActorIds: ["protagonist"] },
  });
}
