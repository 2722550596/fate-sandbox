import assert from "node:assert/strict";
import test from "node:test";

import { configureSecret } from "../../core/knowledge/secrets.ts";
import { replaceStateForDebug, resetState } from "../../core/state/state-store.ts";
import { privateResolveTool } from "./private-resolve.ts";

function noopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}

function setupStateWithSecret(): void {
  const state = resetState();
  configureSecret(state, {
    kind: "actor-private",
    reason: "初始化",
    actorId: "protagonist",
    secrets: [{ value: "隐藏身份", revealConditions: ["暴露"] }],
  });
  replaceStateForDebug(state);
}

void test("privateResolveTool returns subtle-reaction for matching secret", () => {
  setupStateWithSecret();

  const result = privateResolveTool(
    {
      kind: "hidden-reaction",
      actorId: "protagonist",
      stimulus: "隐藏身份",
      publicContext: "对方直接问身份",
    },
    noopSessionManager(),
  );

  const raw = JSON.stringify(result);
  assert.match(raw, /subtle-reaction/);
});

void test("privateResolveTool returns no-special-effect without relevant secret", () => {
  resetState();

  const result = privateResolveTool(
    {
      kind: "hidden-reaction",
      actorId: "protagonist",
      stimulus: "无关话题",
      publicContext: "闲聊",
    },
    noopSessionManager(),
  );

  const raw = JSON.stringify(result);
  assert.match(raw, /no-special-effect/);
});
