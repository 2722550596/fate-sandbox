import assert from "node:assert/strict";
import test from "node:test";

import { commitState, resetState } from "../../core/state/state-store.ts";
import { getStatusTool } from "./get-status.ts";

void test("getStatusTool returns GM brief text", () => {
  resetState();
  const result = getStatusTool(undefined);

  assert.match(result.content[0]?.text ?? "", /\[当前 GM 简报\]/);
  assert.match(result.content[0]?.text ?? "", /时间/);
  assert.match(result.content[0]?.text ?? "", /地点/);
});

void test("getStatusTool rejects repeated read of same revision", () => {
  resetState();

  // First read succeeds
  getStatusTool(undefined);

  // Second read with same state should fail
  assert.throws(() => getStatusTool(undefined), /get_status 已读取当前状态/);
});

void test("getStatusTool allows re-read after state changes", () => {
  resetState();

  // First read
  getStatusTool(undefined);

  // Change state (e.g. commitState with fresh state)
  const fresh = resetState();
  commitState(fresh);

  // Second read should succeed since revision changed
  const result = getStatusTool(undefined);
  assert.match(result.content[0]?.text ?? "", /\[当前 GM 简报\]/);
});
