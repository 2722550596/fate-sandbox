import assert from "node:assert/strict";
import test from "node:test";

import { beginSceneBeat } from "../../engine/core/scene";
import { getState, resetState } from "../../engine/core/state";
import { updateSceneTool } from "./update-scene";

void test("updateSceneTool ignores blank objectiveId when objectiveSummary is present", () => {
  resetState();
  beginSceneBeat({
    storyWindow: {
      currentArcId: "test-arc",
      currentBeatId: "test-beat",
      title: "目标选择测试",
      allowedActions: ["确认门外情况"],
      forbiddenEscalations: [],
      completionCriteria: ["确认门外是否安全"],
      nextBeatHints: [],
    },
    objectives: ["确认门外是否安全"],
    reason: "建立测试 beat",
  });

  const result = updateSceneTool(
    {
      kind: "resolve-objective",
      objectiveId: "",
      objectiveSummary: "确认门外是否安全",
      reason: "模型误传空 objectiveId，但提供了摘要",
    },
    undefined,
  );

  assert.match(result.content[0]?.text ?? "", /目标已解决/);
  assert.equal(getState().public.scene.objectives[0]?.status, "resolved");
});

void test("updateSceneTool explains missing objective selector after blank normalization", () => {
  resetState();
  beginSceneBeat({
    storyWindow: {
      currentArcId: "test-arc",
      currentBeatId: "test-beat",
      title: "目标选择测试",
      allowedActions: ["确认门外情况"],
      forbiddenEscalations: [],
      completionCriteria: ["确认门外是否安全"],
      nextBeatHints: [],
    },
    objectives: ["确认门外是否安全"],
    reason: "建立测试 beat",
  });

  assert.throws(
    () =>
      updateSceneTool(
        {
          kind: "resolve-objective",
          objectiveId: "",
          reason: "模型只传了空 objectiveId",
        },
        undefined,
      ),
    /必须提供 objectiveId 或 objectiveSummary/,
  );
});
