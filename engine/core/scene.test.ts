import assert from "node:assert/strict";
import test from "node:test";

import { updateScene } from "./scene";
import { getState, resetState } from "./state";

void test("updateScene moves location and advances clock", () => {
  resetState();

  updateScene({
    kind: "move-location",
    location: {
      region: "冬木市",
      site: "深山镇",
      detail: "卫宫邸",
      boundary: "normal",
    },
    elapsedMinutes: 30,
    reason: "步行回家",
  });

  const state = getState();
  assert.equal(state.public.scene.location.detail, "卫宫邸");
  assert.equal(state.public.clock.currentAt, "2004-01-30T07:30:00.000Z");
});

void test("updateScene records active objectives", () => {
  resetState();

  updateScene({ kind: "add-objective", summary: "确认校内结界", reason: "调查推进" });

  assert.equal(getState().public.scene.objectives[0]?.summary, "确认校内结界");
});
