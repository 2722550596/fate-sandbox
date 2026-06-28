import type { HumanActorState } from "../state/state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState, PROTAGONIST_ACTOR_ID } from "../state/initial-state.ts";
import {
  configureActorSecrets,
  configureHiddenWorldFact,
  configureSequenceSecrets,
  getOffscreenEventsForDebug,
  privateResolve,
  revealSecret,
} from "./secrets.ts";

function setupActorSequence(draft: ReturnType<typeof createInitialState>): void {
  const actor = draft.public.actors[PROTAGONIST_ACTOR_ID];
  if (!actor || actor.kind !== "human") throw new TypeError("protagonist must be HumanActorState");
  actor.sequence = {
    currentSequence: "序列9-观众",
    rank: "seq-9",
    pathway: "seer",
    promotionSystem: "potion",
    tags: [],
    actingCues: [],
  };
}

function addAllyToState(draft: ReturnType<typeof createInitialState>, id: string): void {
  draft.public.actors[id] = {
    id,
    kind: "human",
    roles: [],
    sequence: null,
    identity: { publicIdentity: "盟友", background: "协助者", lockedFacts: [] },
    presentation: {
      canonicalName: "盟友",
      renderName: "盟友",
      apparentAge: "未知",
      outfit: { label: "日常装束", details: "" },
      demeanor: "友善",
    },
    condition: { afflictions: [] },
    inventory: { items: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "ally", summary: "盟友" },
  } satisfies HumanActorState;
}

// ---------------------------------------------------------------------------
// configureSequenceSecrets
// ---------------------------------------------------------------------------

void test("configureSequenceSecrets configures pathway secret for valid actor", () => {
  const draft = createInitialState();
  setupActorSequence(draft);

  const result = configureSequenceSecrets(draft, {
    kind: "configure-sequence-secrets",
    reason: "初始化角色秘密",
    actorId: PROTAGONIST_ACTOR_ID,
    pathwaySecret: { value: "观众", revealConditions: ["途径", "pathway"] },
  });

  assert.match(result.message, /序列 secrets 已配置/);
  const slot = draft.secrets.actorStates[PROTAGONIST_ACTOR_ID]?.secrets?.pathwaySecret;
  assert.ok(slot);
  assert.equal(slot?.value, "观众");
});

void test("configureSequenceSecrets configures sequence secret for valid actor", () => {
  const draft = createInitialState();
  setupActorSequence(draft);

  const result = configureSequenceSecrets(draft, {
    kind: "configure-sequence-secrets",
    reason: "初始化序列秘密",
    actorId: PROTAGONIST_ACTOR_ID,
    sequenceSecret: { value: "seq-9", revealConditions: ["序列"] },
  });

  assert.match(result.message, /序列 secrets 已配置/);
  assert.ok(draft.secrets.actorStates[PROTAGONIST_ACTOR_ID]?.secrets?.sequenceSecret);
});

void test("configureSequenceSecrets throws when no secret provided", () => {
  const draft = createInitialState();
  setupActorSequence(draft);

  assert.throws(
    () =>
      configureSequenceSecrets(draft, {
        kind: "configure-sequence-secrets",
        reason: "初始化",
        actorId: PROTAGONIST_ACTOR_ID,
      }),
    /必须提供 pathwaySecret 或 sequenceSecret/,
  );
});

void test("configureSequenceSecrets throws for nonexistent actor", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      configureSequenceSecrets(draft, {
        kind: "configure-sequence-secrets",
        reason: "初始化",
        actorId: "nonexistent",
        pathwaySecret: { value: "观众", revealConditions: ["途径"] },
      }),
    /actor 不存在/,
  );
});

void test("configureSequenceSecrets throws for actor without sequence", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      configureSequenceSecrets(draft, {
        kind: "configure-sequence-secrets",
        reason: "初始化",
        actorId: PROTAGONIST_ACTOR_ID,
        pathwaySecret: { value: "观众", revealConditions: ["途径"] },
      }),
    /actor 没有序列/,
  );
});

void test("configureSequenceSecrets merges reveal conditions on reconfiguration", () => {
  const draft = createInitialState();
  setupActorSequence(draft);

  configureSequenceSecrets(draft, {
    kind: "configure-sequence-secrets",
    reason: "首次配置",
    actorId: PROTAGONIST_ACTOR_ID,
    pathwaySecret: { value: "观众", revealConditions: ["途径"] },
  });

  configureSequenceSecrets(draft, {
    kind: "configure-sequence-secrets",
    reason: "补充条件",
    actorId: PROTAGONIST_ACTOR_ID,
    pathwaySecret: { value: "观众", revealConditions: ["非凡"] },
  });

  const slot = draft.secrets.actorStates[PROTAGONIST_ACTOR_ID]?.secrets?.pathwaySecret;
  assert.ok(slot);
  assert.deepEqual(slot.revealConditions, ["途径", "非凡"]);
  assert.equal(slot.id, "protagonist-pathway");
});

// ---------------------------------------------------------------------------
// configureActorSecrets
// ---------------------------------------------------------------------------

void test("configureActorSecrets configures private motives", () => {
  const draft = createInitialState();

  const result = configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    reason: "初始化",
    actorId: PROTAGONIST_ACTOR_ID,
    privateMotives: [{ value: "寻找罗塞尔日记", revealConditions: ["日记"] }],
  });

  assert.match(result.message, /actor secrets 已配置/);
  const slot = draft.secrets.actorStates[PROTAGONIST_ACTOR_ID]?.secrets?.privateMotives;
  assert.equal(slot?.length, 1);
  assert.equal(slot?.[0]?.value, "寻找罗塞尔日记");
  assert.deepEqual(slot?.[0]?.revealConditions, ["日记"]);
});

void test("configureActorSecrets configures unrevealed affiliations", () => {
  const draft = createInitialState();

  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    reason: "初始化",
    actorId: PROTAGONIST_ACTOR_ID,
    unrevealedAffiliations: [{ value: "塔罗会", revealConditions: ["塔罗会"] }],
  });

  const slot = draft.secrets.actorStates[PROTAGONIST_ACTOR_ID]?.secrets?.unrevealedAffiliations;
  assert.equal(slot?.length, 1);
  assert.equal(slot?.[0]?.value, "塔罗会");
});

void test("configureActorSecrets requires at least one secret type", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      configureActorSecrets(draft, {
        kind: "configure-actor-secrets",
        reason: "初始化",
        actorId: PROTAGONIST_ACTOR_ID,
      }),
    /必须提供 privateMotives 或 unrevealedAffiliations/,
  );
});

void test("configureActorSecrets throws for nonexistent actor", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      configureActorSecrets(draft, {
        kind: "configure-actor-secrets",
        reason: "初始化",
        actorId: "nonexistent",
        privateMotives: [{ value: "test", revealConditions: ["test"] }],
      }),
    /actor 不存在/,
  );
});

// ---------------------------------------------------------------------------
// configureHiddenWorldFact
// ---------------------------------------------------------------------------

void test("configureHiddenWorldFact adds new hidden world fact", () => {
  const draft = createInitialState();

  const result = configureHiddenWorldFact(draft, {
    reason: "设定世界观",
    text: "真实造物主早已陨落",
    revealConditions: ["真实造物主", "陨落"],
    relatedActorIds: [],
  });

  assert.match(result.message, /世界事实已记录/);
  assert.equal(draft.secrets.hiddenWorldFacts.length, 1);
  assert.equal(draft.secrets.hiddenWorldFacts[0]?.text, "真实造物主早已陨落");
  assert.equal(draft.secrets.hiddenWorldFacts[0]?.revealState, "hidden");
});

void test("configureHiddenWorldFact merges reveal conditions for existing fact", () => {
  const draft = createInitialState();

  configureHiddenWorldFact(draft, {
    reason: "首次设定",
    text: "真实造物主早已陨落",
    revealConditions: ["真实造物主"],
    relatedActorIds: [],
  });

  configureHiddenWorldFact(draft, {
    reason: "补充条件",
    text: "真实造物主早已陨落",
    revealConditions: ["陨落"],
    relatedActorIds: [],
  });

  assert.equal(draft.secrets.hiddenWorldFacts.length, 1);
  assert.deepEqual(draft.secrets.hiddenWorldFacts[0]?.revealConditions, ["真实造物主", "陨落"]);
});

// ---------------------------------------------------------------------------
// revealSecret
// ---------------------------------------------------------------------------

void test("revealSecret reveals pathway secret via claim-reveal", () => {
  const draft = createInitialState();
  setupActorSequence(draft);

  configureSequenceSecrets(draft, {
    kind: "configure-sequence-secrets",
    reason: "初始化",
    actorId: PROTAGONIST_ACTOR_ID,
    pathwaySecret: { value: "观众", revealConditions: ["途径", "观众途径"] },
  });

  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: PROTAGONIST_ACTOR_ID,
    claim: "对方的途径是观众",
    evidence: "他通过观察确认了观众途径的特征",
  });

  assert.equal(result.outcome, "revealed");
  assert.match(result.playerSafeMessage, /途径秘密已经揭示/);
  assert.equal(
    draft.secrets.actorStates[PROTAGONIST_ACTOR_ID]?.secrets?.pathwaySecret?.revealState,
    "revealed",
  );
});

void test("revealSecret reveals sequence secret via observed-reveal", () => {
  const draft = createInitialState();
  setupActorSequence(draft);

  configureSequenceSecrets(draft, {
    kind: "configure-sequence-secrets",
    reason: "初始化",
    actorId: PROTAGONIST_ACTOR_ID,
    sequenceSecret: { value: "序列9", revealConditions: ["序列9", "观众途径序列9"] },
  });

  const result = revealSecret(draft, {
    kind: "observed-reveal",
    actorId: PROTAGONIST_ACTOR_ID,
    trigger: "对手施展了序列9的能力",
    evidence: "目睹了观众途径序列9的非凡能力展示",
  });

  assert.equal(result.outcome, "revealed");
  assert.match(result.playerSafeMessage, /序列秘密已经揭示/);
  assert.equal(
    draft.secrets.actorStates[PROTAGONIST_ACTOR_ID]?.secrets?.sequenceSecret?.revealState,
    "revealed",
  );
});

void test("revealSecret returns foreshadowed with partial evidence", () => {
  const draft = createInitialState();
  setupActorSequence(draft);

  configureSequenceSecrets(draft, {
    kind: "configure-sequence-secrets",
    reason: "初始化",
    actorId: PROTAGONIST_ACTOR_ID,
    pathwaySecret: { value: "观众", revealConditions: ["途径", "观众途径"] },
  });

  // Claim doesn't match slot value; evidence matches a reveal condition
  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: PROTAGONIST_ACTOR_ID,
    claim: "他的能力看起来很高级",
    evidence: "观察到的现象符合观众途径的特征",
  });

  assert.equal(result.outcome, "foreshadowed");
  assert.match(result.playerSafeMessage, /线索成立，但尚不足以完全揭示/);
});

void test("revealSecret returns insufficient-evidence with no match", () => {
  const draft = createInitialState();
  setupActorSequence(draft);

  configureSequenceSecrets(draft, {
    kind: "configure-sequence-secrets",
    reason: "初始化",
    actorId: PROTAGONIST_ACTOR_ID,
    pathwaySecret: { value: "观众", revealConditions: ["途径", "观众途径"] },
  });

  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: PROTAGONIST_ACTOR_ID,
    claim: "不相关的事情",
    evidence: "完全无关的描述",
  });

  assert.equal(result.outcome, "insufficient-evidence");
});

void test("revealSecret throws for nonexistent actor", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      revealSecret(draft, {
        kind: "claim-reveal",
        actorId: "nonexistent",
        claim: "任何内容",
        evidence: "任何证据",
      }),
    /actor 不存在/,
  );
});

void test("revealSecret reveals hidden world fact", () => {
  const draft = createInitialState();
  setupActorSequence(draft);

  // Must have actor secret slots configured first, otherwise revealSecret
  // returns insufficient-evidence before checking hidden world facts
  configureSequenceSecrets(draft, {
    kind: "configure-sequence-secrets",
    reason: "初始化",
    actorId: PROTAGONIST_ACTOR_ID,
    pathwaySecret: { value: "观众", revealConditions: ["途径"] },
  });

  configureHiddenWorldFact(draft, {
    reason: "世界观设定",
    text: "真实造物主早已陨落",
    revealConditions: ["真实造物主", "早已陨落"],
    relatedActorIds: [PROTAGONIST_ACTOR_ID],
  });

  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: PROTAGONIST_ACTOR_ID,
    claim: "真实造物主",
    evidence: "古老文献记载了真实造物主早已陨落的事实",
  });

  assert.equal(result.outcome, "revealed");
  assert.match(result.playerSafeMessage, /世界隐藏事实已经揭示/);
  assert.equal(draft.secrets.hiddenWorldFacts[0]?.revealState, "revealed");
});

// ---------------------------------------------------------------------------
// privateResolve
// ---------------------------------------------------------------------------

void test("privateResolve hidden-reaction detects relevant secret", () => {
  const draft = createInitialState();

  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    reason: "初始化",
    actorId: PROTAGONIST_ACTOR_ID,
    privateMotives: [{ value: "寻找罗塞尔日记", revealConditions: ["日记"] }],
  });

  const result = privateResolve(draft, {
    kind: "hidden-reaction",
    actorId: PROTAGONIST_ACTOR_ID,
    stimulus: "日记",
    publicContext: "角色提到了日记",
  });

  assert.equal(result.outcome, "subtle-reaction");
  assert.deepEqual(result.narrativeConstraints, ["可以描写可见的细微反应，但不得泄露隐藏真相。"]);
});

void test("privateResolve hidden-reaction returns no-special-effect without relevant secret", () => {
  const draft = createInitialState();

  const result = privateResolve(draft, {
    kind: "hidden-reaction",
    actorId: PROTAGONIST_ACTOR_ID,
    stimulus: "无关话题",
    publicContext: "闲聊",
  });

  assert.equal(result.outcome, "no-special-effect");
  assert.deepEqual(result.narrativeConstraints, ["没有特殊隐藏反应；不要暗示不存在的秘密。"]);
});

void test("privateResolve secret-compatibility detects both actors have secrets", () => {
  const draft = createInitialState();

  // Add ally actor to state before configuring secrets
  addAllyToState(draft, "ally-1");

  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    reason: "初始化主角",
    actorId: PROTAGONIST_ACTOR_ID,
    privateMotives: [{ value: "寻找罗塞尔日记", revealConditions: ["日记"] }],
  });
  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    reason: "初始化盟友",
    actorId: "ally-1",
    privateMotives: [{ value: "隐藏身份", revealConditions: ["身份"] }],
  });

  const result = privateResolve(draft, {
    kind: "secret-compatibility",
    actorId: PROTAGONIST_ACTOR_ID,
    targetActorId: "ally-1",
    interaction: "交换情报",
  });

  assert.equal(result.outcome, "strong-reaction");
});

void test("privateResolve secret-compatibility returns no-special-effect without secrets", () => {
  const draft = createInitialState();

  addAllyToState(draft, "ally-1");

  const result = privateResolve(draft, {
    kind: "secret-compatibility",
    actorId: PROTAGONIST_ACTOR_ID,
    targetActorId: "ally-1",
    interaction: "交换情报",
  });

  assert.equal(result.outcome, "no-special-effect");
});

// ---------------------------------------------------------------------------
// getOffscreenEventsForDebug
// ---------------------------------------------------------------------------

void test("getOffscreenEventsForDebug returns offscreen event log", () => {
  const draft = createInitialState();

  const events = getOffscreenEventsForDebug(draft);

  assert.equal(events.length, 0);
  assert.equal(events, draft.secrets.offscreenEventLog);
});
