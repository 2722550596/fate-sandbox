import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../engine/core/state-store.ts";
import { commitTurnTool } from "./commit-turn.ts";
import { recordOffscreenEventTool } from "./record-offscreen-event.ts";
import { resolveBackstageLineTool } from "./resolve-backstage-line.ts";

const BIG_TIME = { kind: "elapsed", elapsedMinutes: 45, reason: "守夜数小时。" };
const MIN_TIME = { kind: "elapsed", elapsedMinutes: 1, reason: "推进一个最小时间单位。" };

function noopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}

function landOffscreen(): void {
  const now = getState().public.clock.currentAt;
  recordOffscreenEventTool(
    {
      lineId: "lancer-church",
      actorIds: ["lancer"],
      timeRange: { start: now, end: now },
      visibility: "secret",
      summary: "Lancer 侦察东门。",
      consequences: ["东门被监视。"],
      futureHooks: ["可能的陷阱。"],
      createdFrom: "parallel-line-subagent",
      pressureType: "servant-autonomy",
    },
    noopSessionManager(),
  );
}

void test("a >=30min commit_turn raises a backstage obligation and blocks the next canonical turn", () => {
  resetState();
  commitTurnTool({ summary: "守夜。", time: BIG_TIME, events: [] }, noopSessionManager());
  assert.equal(getState().secrets.backstageObligations.length, 1);
  assert.equal(getState().secrets.backstageObligations[0]?.trigger, "time-advance");
  assert.throws(
    () => commitTurnTool({ summary: "继续。", time: MIN_TIME, events: [] }, noopSessionManager()),
    /未清账的后台世界推进义务/,
  );
});

void test("record_offscreen_event discharges the obligation and unblocks the next turn", () => {
  resetState();
  commitTurnTool({ summary: "守夜。", time: BIG_TIME, events: [] }, noopSessionManager());
  landOffscreen();
  assert.equal(getState().secrets.backstageObligations.length, 0);
  assert.equal(getState().secrets.backstageReviewLog.length, 1);
  assert.equal(getState().secrets.backstageReviewLog[0]?.outcome, "landed");
  const result = commitTurnTool(
    { summary: "继续。", time: MIN_TIME, events: [] },
    noopSessionManager(),
  );
  assert.match(result.content[0]?.text ?? "", /回合已提交/);
});

void test("resolve_backstage_line discharges with a reviewed no-change", () => {
  resetState();
  commitTurnTool({ summary: "守夜。", time: BIG_TIME, events: [] }, noopSessionManager());
  resolveBackstageLineTool(
    { outcome: "no-change", reasonCode: "advanced-recently", note: "刚推进过，无新进展。" },
    noopSessionManager(),
  );
  assert.equal(getState().secrets.backstageObligations.length, 0);
  assert.equal(getState().secrets.backstageReviewLog[0]?.outcome, "no-change");
  assert.doesNotThrow(() =>
    commitTurnTool({ summary: "继续。", time: MIN_TIME, events: [] }, noopSessionManager()),
  );
});

void test("resolve_backstage_line throws when there is no open obligation", () => {
  resetState();
  assert.throws(
    () =>
      resolveBackstageLineTool(
        { outcome: "no-change", reasonCode: "advanced-recently", note: "x。" },
        noopSessionManager(),
      ),
    /没有未清账/,
  );
});

void test("two consecutive no-cost commits raise a no-cost-streak obligation", () => {
  resetState();
  commitTurnTool({ summary: "无代价一。", time: MIN_TIME, events: [] }, noopSessionManager());
  commitTurnTool({ summary: "无代价二。", time: MIN_TIME, events: [] }, noopSessionManager());
  assert.equal(getState().secrets.backstageObligations.length, 1);
  assert.equal(getState().secrets.backstageObligations[0]?.trigger, "no-cost-streak");
});
