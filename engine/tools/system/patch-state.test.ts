import assert from "node:assert/strict";
import test from "node:test";

import { getState, resetState } from "../../core/state/state-store.ts";
import { patchStateTool } from "./patch-state.ts";

void test("patchStateTool throws when given non-empty ops", () => {
  resetState();

  assert.throws(
    () => patchStateTool({ ops: [{ op: "replace", path: "/money", value: 999 }] }, undefined),
    /已降级.*debug-only/,
  );
});

void test("patchStateTool does not modify state when throwing", () => {
  resetState();
  const before = getState();

  try {
    patchStateTool({ ops: [{ op: "replace", path: "/money", value: 999 }] }, undefined);
  } catch {
    // expected
  }

  const after = getState();
  assert.deepEqual(before, after);
});
