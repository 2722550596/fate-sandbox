import assert from "node:assert/strict";
import test from "node:test";

import { getState, replaceStateForDebug, resetState } from "../../core/state/state-store.ts";
import { clearBackstageLockTool } from "./clear-backstage-lock.ts";

function noopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}

void test("clearBackstageLockTool clears all pending when no runId given", () => {
  const state = resetState();
  state.secrets.backstagePendingHarvests = [
    { runId: "bl-tingen-001", lineId: "tingen-night-1", spawnedAt: "1349-01-01T08:00:00.000Z" },
  ];
  state.secrets.backstageObligations = [
    {
      id: "obl-1",
      trigger: "time-advance",
      summary: "测试义务",
      createdAt: "1349-01-01T08:00:00.000Z",
    },
  ];
  state.secrets.backstagePressure.consecutiveNoCostTurns = 3;
  replaceStateForDebug(state);

  const result = clearBackstageLockTool({}, noopSessionManager());

  const updated = getState();
  assert.equal(updated.secrets.backstagePendingHarvests.length, 0);
  assert.equal(updated.secrets.backstageObligations.length, 0);
  assert.equal(updated.secrets.backstagePressure.consecutiveNoCostTurns, 0);
  assert.match(result.content[0]?.text ?? "", /已清理 backstage 锁/);
});

void test("clearBackstageLockTool clears specific runId only", () => {
  const state = resetState();
  state.secrets.backstagePendingHarvests = [
    { runId: "bl-tingen-001", lineId: "tingen-night-1", spawnedAt: "1349-01-01T08:00:00.000Z" },
    { runId: "bl-tingen-002", lineId: "tingen-night-2", spawnedAt: "1349-01-01T08:30:00.000Z" },
  ];
  state.secrets.backstageObligations = [
    {
      id: "obl-1",
      trigger: "time-advance",
      summary: "测试",
      createdAt: "1349-01-01T08:00:00.000Z",
    },
  ];
  replaceStateForDebug(state);

  const result = clearBackstageLockTool({ runId: "bl-tingen-001" }, noopSessionManager());

  const updated = getState();
  assert.equal(updated.secrets.backstagePendingHarvests.length, 1);
  assert.equal(updated.secrets.backstagePendingHarvests[0]?.runId, "bl-tingen-002");
  assert.equal(updated.secrets.backstageObligations.length, 0);
  assert.match(result.content[0]?.text ?? "", /pending-run:bl-tingen-001/);
});

void test("clearBackstageLockTool returns clean message when nothing to clear", () => {
  resetState();

  const result = clearBackstageLockTool({}, noopSessionManager());

  assert.match(result.content[0]?.text ?? "", /没有需要清理/);
});
