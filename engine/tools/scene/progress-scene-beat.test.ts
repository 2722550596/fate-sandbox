import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../core/state/state-store.ts";
import { progressSceneBeatTool } from "./progress-scene-beat.ts";

void test("progressSceneBeatTool begins a beat from the GM-facing adapter", () => {
  resetState();

  const result = progressSceneBeatTool(
    {
      kind: "begin",
      title: "廷根市值夜者教堂外围侦察",
      objectives: ["观察教堂", "记录可疑活动"],
      purpose: "进入廷根市值夜者教堂外围侦察 beat。",
      time: { kind: "elapsed", elapsedMinutes: 1, reason: "进入侦察态势。" },
      threats: [{ summary: "教堂附近有序列途径气息", severity: "medium" }],
      presence: { presentActorIds: ["protagonist"] },
      situation: "investigation",
    },
    createNoopSessionManager(),
  );

  const state = getState();
  assert.match(result.content[0]?.text ?? "", /Scene Beat 已开始/);
  assert.equal(state.public.scene.storyWindow?.title, "廷根市值夜者教堂外围侦察");
  assert.deepEqual(
    state.public.scene.objectives.map((objective) => objective.summary),
    ["观察教堂", "记录可疑活动"],
  );
  assert.equal(state.public.scene.threats[0]?.summary, "教堂附近有序列途径气息");
});

void test("progressSceneBeatTool completes current beat and opens next beat", () => {
  resetState();
  progressSceneBeatTool(
    {
      kind: "begin",
      title: "占卜家途径线索收口",
      objectives: ["身份猜想成立", "途径线索成立"],
      purpose: "开启占卜线索收口 beat",
      time: { kind: "elapsed", elapsedMinutes: 1, reason: "开启 beat。" },
      beatId: "reveal-wrapup",
      actionPolicy: {
        allowedActions: ["整理线索"],
        forbiddenEscalations: ["不得暴露身份"],
        completionCriteria: ["身份猜想成立", "途径线索成立"],
      },
      presence: { presentActorIds: ["protagonist"] },
    },
    createNoopSessionManager(),
  );

  const result = progressSceneBeatTool(
    {
      kind: "complete",
      outcome: "占卜线索收口成立，双方进入短暂对峙。",
      time: { kind: "elapsed", elapsedMinutes: 1, reason: "收口当前 beat。" },
      memory: {
        title: "占卜线索收口成立",
        summary: "玩家通过现场线索确认占卜家途径，双方暂时停手观察。",
        claims: [
          {
            kind: "mundane",
            statement: "占卜家线索收口已经在现场完成。",
            certainty: "observed",
          },
        ],
      },
      nextBeat: {
        title: "收口后的对峙",
        objectives: ["观察值夜者动向", "决定是否撤离"],
        presence: { presentActorIds: ["protagonist"], allyActorIds: [] },
        situation: "social",
      },
    },
    createNoopSessionManager(),
  );

  const state = getState();
  assert.match(result.content[0]?.text ?? "", /Scene Beat 已切换/);
  assert.equal(state.public.scene.storyWindow?.title, "收口后的对峙");
  assert.equal(state.public.memory.eventLog[0]?.title, "占卜线索收口成立");
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
          objectives: ["确认非凡痕迹"],
          purpose: "移动到廷根市佐特兰街并开始调查。",
          time: {
            kind: "travel",
            location: {
              region: "鲁恩王国",
              site: "廷根市",
              detail: "佐特兰街",
              boundary: "normal",
            },
            elapsedMinutes: 0,
            reason: "移动到廷根市佐特兰街。",
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
