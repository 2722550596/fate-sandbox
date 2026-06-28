import assert from "node:assert/strict";
import test from "node:test";

import { configureActorSecrets } from "../../core/knowledge/secrets.ts";
import { replaceStateForDebug, resetState } from "../../core/state/state-store.ts";
import { privateResolveTool } from "./private-resolve.ts";

function noopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}

void test("privateResolveTool returns subtle-reaction for matching secret", () => {
  const state = resetState();
  configureActorSecrets(state, {
    kind: "configure-actor-secrets",
    reason: "初始化",
    actorId: "protagonist",
    privateMotives: [{ value: "寻找罗塞尔日记", revealConditions: ["日记"] }],
  });
  replaceStateForDebug(state);

  const result = privateResolveTool(
    {
      kind: "hidden-reaction",
      actorId: "protagonist",
      stimulus: "日记",
      publicContext: "角色提到了日记",
    },
    noopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /私密结算结果：subtle-reaction/);
  assert.match(result.content[0]?.text ?? "", /叙事约束/);
  assert.equal(result.details.outcome, "subtle-reaction");
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

  assert.match(result.content[0]?.text ?? "", /私密结算结果：no-special-effect/);
  assert.equal(result.details.outcome, "no-special-effect");
});
