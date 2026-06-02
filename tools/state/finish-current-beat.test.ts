import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../engine/core/state";
import { commitTurnTool } from "./commit-turn";
import { finishCurrentBeatTool } from "./finish-current-beat";

void test("finishCurrentBeatTool resolves current beat and opens the next beat", () => {
  resetState();
  openCurrentBeat();

  const result = finishCurrentBeatTool(
    {
      outcome: "真名与宝具揭示成立，现场进入短暂停顿。",
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
        presentActorIds: ["protagonist"],
        allyActorIds: [],
        situation: "social",
      },
    },
    createNoopSessionManager(),
  );

  const state = getState();
  assert.match(result.content[0]?.text ?? "", /回合已提交/);
  assert.equal(state.public.scene.storyWindow?.title, "揭示后的短暂停顿");
  assert.equal(state.public.scene.storyWindow.currentArcId, "B5");
  assert.deepEqual(
    state.public.scene.objectives.map((objective) => objective.summary),
    ["观察对方反应", "决定是否撤离"],
  );
  assert.equal(state.public.memory.eventLog[0]?.title, "真名与宝具揭示成立");
  assert.deepEqual(state.public.scene.presentActorIds, ["protagonist"]);
  assert.equal(state.public.scene.situation, "social");
});

void test("finishCurrentBeatTool rejects calls without an active story window", () => {
  resetState();

  assert.throws(
    () =>
      finishCurrentBeatTool(
        {
          outcome: "没有当前 beat 却尝试收口。",
          nextBeat: null,
        },
        createNoopSessionManager(),
      ),
    /当前存在 storyWindow/,
  );
});

function openCurrentBeat(): void {
  commitTurnTool(
    {
      summary: "开启揭示收口 beat。",
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
              presentActorIds: ["protagonist"],
              reason: "开启揭示收口 beat",
            },
          },
        },
      ],
    },
    createNoopSessionManager(),
  );
}

function createNoopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}
