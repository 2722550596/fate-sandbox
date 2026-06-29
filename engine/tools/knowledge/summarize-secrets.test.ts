import assert from "node:assert/strict";
import test from "node:test";

import { configureSecret } from "../../core/knowledge/secrets.ts";
import { createInitialState } from "../../core/state/initial-state.ts";
import { buildSecretsSummary } from "./summarize-secrets.ts";
void test("summarize_secrets: empty state shows no secrets placeholder", () => {
  const draft = createInitialState();
  const output = buildSecretsSummary(draft);
  assert(output.includes("（无 actor 秘密）"));
  assert(output.includes("（无世界隐藏事实）"));
});

void test("summarize_secrets: shows configured beyonder secrets", () => {
  const draft = createInitialState();
  configureSecret(draft, {
    kind: "actor-beyonder",
    actorId: "protagonist",
    secrets: [
      { value: "穿越者身份", revealConditions: ["转运仪式", "福生玄黄"] },
      { value: "掌握源堡", revealConditions: ["灰雾之上"] },
    ],
    reason: "test",
  });

  const output = buildSecretsSummary(draft);
  assert(output.includes("【protagonist（主角）】"));
  assert(output.includes("非凡秘密（2项）"));
  assert(output.includes("穿越者身份"));
  assert(output.includes("掌握源堡"));
  assert(output.includes("线索: 转运仪式、福生玄黄"));
  assert(output.includes("线索: 灰雾之上"));
});

void test("summarize_secrets: shows world facts", () => {
  const draft = createInitialState();
  configureSecret(draft, {
    kind: "world-fact",
    text: "廷根存在非凡黑市",
    revealConditions: ["老烟斗", "非凡交易"],
    relatedActorIds: ["老尼尔"],
    reason: "test",
  });

  const output = buildSecretsSummary(draft);
  assert(output.includes("【世界隐藏事实】"));
  assert(output.includes("廷根存在非凡黑市"));
  assert(output.includes("关联: 老尼尔"));
  assert(output.includes("线索: 老烟斗、非凡交易"));
});

void test("summarize_secrets: revealed secrets show without clue words", () => {
  const draft = createInitialState();
  configureSecret(draft, {
    kind: "world-fact",
    text: "末日预言",
    revealConditions: ["毁灭", "尽头"],
    relatedActorIds: [],
    reason: "test",
  });

  // 模拟揭示
  draft.secrets.hiddenWorldFacts[0]!.revealState = "revealed";

  const output = buildSecretsSummary(draft);
  assert(output.includes("末日预言"));
  // 已揭示的秘密不应显示线索词
  assert(!output.includes("尽头"));
});

void test("summarize_secrets: shows foreshadowed secrets with clue words", () => {
  const draft = createInitialState();
  configureSecret(draft, {
    kind: "actor-private",
    actorId: "protagonist",
    secrets: [{ value: "暗中调查教会的秘密", revealConditions: ["举报信", "跟踪"] }],
    reason: "test",
  });

  // 模拟预感
  draft.secrets.actorStates["protagonist"]!.secrets!.privateMotives[0]!.revealState =
    "foreshadowed";

  const output = buildSecretsSummary(draft);
  assert(output.includes("线索: 举报信、跟踪"));
});

void test("summarize_secrets: events log shows recent reveals", () => {
  const draft = createInitialState();
  draft.secrets.secretEventLog.push({
    id: "e1",
    time: "1349-06-01T10:00:00Z",
    summary: "梅丽莎的秘密被揭示",
    relatedActorIds: ["梅丽莎"],
  });

  const output = buildSecretsSummary(draft);
  assert(output.includes("【揭示事件日志】"));
  assert(output.includes("梅丽莎的秘密被揭示"));
});
