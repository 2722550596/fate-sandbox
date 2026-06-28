import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../core/state/state-store.ts";
import { progressSceneBeatTool } from "./progress-scene-beat.ts";

void test("progressSceneBeatTool begins a beat from the GM-facing adapter", () => {
  resetState();

  const result = progressSceneBeatTool(
    {
      kind: "begin",
      title: "柳洞寺外围侦察",
      objectives: ["观察结界", "安全撤回"],
      purpose: "进入柳洞寺外围侦察 beat。",
      time: { kind: "elapsed", elapsedMinutes: 1, reason: "进入侦察态势。" },
      threats: [{ summary: "山门附近有从者级别气息", severity: "medium" }],
      presence: { presentActorIds: ["protagonist"] },
      situation: "investigation",
    },
    createNoopSessionManager(),
  );

  const state = getState();
  assert.match(result.content[0]?.text ?? "", /Scene Beat 已开始/);
  assert.equal(state.public.scene.storyWindow?.title, "柳洞寺外围侦察");
  assert.deepEqual(
    state.public.scene.objectives.map((objective) => objective.summary),
    ["观察结界", "安全撤回"],
  );
  assert.equal(state.public.scene.threats[0]?.summary, "山门附近有从者级别气息");
});

void test("progressSceneBeatTool completes current beat and opens next beat", () => {
  resetState();
  progressSceneBeatTool(
    {
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
    },
    createNoopSessionManager(),
  );

  const result = progressSceneBeatTool(
    {
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
    },
    createNoopSessionManager(),
  );

  const state = getState();
  assert.match(result.content[0]?.text ?? "", /Scene Beat 已切换/);
  assert.equal(state.public.scene.storyWindow?.title, "揭示后的短暂停顿");
  assert.equal(state.public.memory.eventLog[0]?.title, "真名与宝具揭示成立");
  assert.equal(state.public.scene.situation, "social");
});

void test("progressSceneBeatTool rejects non-positive travel elapsedMinutes", () => {
  resetState();

  assert.throws(
    () =>
      progressSceneBeatTool(
        {
          kind: "begin",
          title: "非法移动 beat",
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
            elapsedMinutes: 0,
            reason: "移动到新都商业街。",
          },
        },
        createNoopSessionManager(),
      ),
    /大于 0 的整数/,
  );
});

function createNoopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}
