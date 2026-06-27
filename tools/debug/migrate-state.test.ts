import assert from "node:assert/strict";
import test from "node:test";

import { sessionKey } from "../../engine/core/state/state-persistence.ts";
import { resetState } from "../../engine/core/state/state-store.ts";
import { migrateStateTool } from "./migrate-state.ts";

void test("migrateStateTool apply=true persists state to session entries", () => {
  resetState();
  const appended: Array<{ customType: string; data: unknown }> = [];
  const sessionManager = {
    appendCustomEntry: (customType: string, data?: unknown) => {
      appended.push({ customType, data });
      return "entry-test";
    },
  };

  const result = migrateStateTool({ apply: true, reason: "测试持久化" }, sessionManager);

  assert.equal(appended.length, 1);
  assert.equal(appended[0]?.customType, sessionKey());
  // session 可写时 state 只走 custom entry，details 不再冗余携带全量 state。
  assert.equal(result.details?.[sessionKey()], undefined);
});

void test("migrateStateTool apply=true falls back to details without a session writer", () => {
  resetState();

  const result = migrateStateTool({ apply: true, reason: "测试回退" }, undefined);

  assert.ok(
    result.details?.[sessionKey()] !== undefined,
    "session 不可写时必须把 fsn-state 写进 tool result details，否则迁移结果没有任何落盘",
  );
});

void test("migrateStateTool without apply stays dry-run: no session writes", () => {
  resetState();
  const appended: unknown[] = [];
  const sessionManager = {
    appendCustomEntry: (customType: string, data?: unknown) => {
      appended.push({ customType, data });
      return "entry-test";
    },
  };

  const result = migrateStateTool({ reason: "测试 dry-run" }, sessionManager);

  assert.equal(appended.length, 0);
  assert.equal(result.details?.[sessionKey()], undefined);
});
