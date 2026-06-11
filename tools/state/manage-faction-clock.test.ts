import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../engine/core/state-store.ts";
import { manageFactionClockTool } from "./manage-faction-clock.ts";

function noopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}

void test("manage_faction_clock full lifecycle through the tool surface", () => {
  resetState();
  const sm = noopSessionManager();

  const created = manageFactionClockTool(
    { kind: "upsert-clock", factionId: "matou", label: "圣杯容器准备", size: 4, visibility: "hidden" },
    sm,
  );
  assert.match(created.content[0]?.text ?? "", /0\/4/);
  const clockId = getState().secrets.factionClocks[0]?.id ?? "";

  const advanced = manageFactionClockTool(
    { kind: "advance-clock", clockId, ticks: 4, reason: "仪式完成最后一步" },
    sm,
  );
  assert.match(advanced.content[0]?.text ?? "", /已填满/);

  const reset = manageFactionClockTool(
    { kind: "reset-clock", clockId, outcomeSummary: "影开始夜间捕食，街区出现昏迷者。" },
    sm,
  );
  assert.match(reset.content[0]?.text ?? "", /已归零/);
  assert.equal(getState().secrets.factionClocks[0]?.filled, 0);

  assert.throws(
    () => manageFactionClockTool({ kind: "advance-clock", clockId: "不存在", ticks: 1, reason: "x" }, sm),
    /faction clock 不存在/,
  );

  assert.throws(() => manageFactionClockTool({ kind: "unknown" }, sm), /不支持的 kind/);
});
