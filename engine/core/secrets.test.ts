import type { State } from "./state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { upsertActor } from "./actor.ts";
import { buildGmBrief, buildStatusMarkdown } from "./public-projection.ts";
import {
  configureActorSecrets,
  configureServantSecrets,
  privateResolve,
  revealSecret,
} from "./secrets.ts";
import { createInitialState } from "./state-store.ts";

const TRUE_NAME = "美狄亚";
const NP_NAME = "Rule Breaker";

void test("configureServantSecrets rejects payload without trueName or hiddenNoblePhantasms", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);

  assert.throws(
    () =>
      configureServantSecrets(draft, {
        kind: "configure-servant-secrets",
        actorId: "caster",
        reason: "测试空 secrets 配置",
      }),
    /必须提供 trueName 或 hiddenNoblePhantasms/,
  );
});

void test("configureServantSecrets rejects unknown actor and non-servant actor", () => {
  const draft = createInitialState();
  upsertTestNpc(draft, "sakura");

  assert.throws(
    () =>
      configureServantSecrets(draft, {
        kind: "configure-servant-secrets",
        actorId: "no-such-actor",
        trueName: { value: TRUE_NAME, revealConditions: ["科尔基斯"] },
        reason: "测试不存在的 actor",
      }),
    /actor 不存在: no-such-actor/,
  );
  assert.throws(
    () =>
      configureServantSecrets(draft, {
        kind: "configure-servant-secrets",
        actorId: "sakura",
        trueName: { value: TRUE_NAME, revealConditions: ["科尔基斯"] },
        reason: "测试非从者 actor",
      }),
    /actor 不是从者: sakura/,
  );
});

void test("configured secrets never leak into public projection", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);
  configureCasterSecrets(draft);

  const publicJson = JSON.stringify(draft.public);
  assert.equal(publicJson.includes(TRUE_NAME), false);
  assert.equal(publicJson.includes(NP_NAME), false);
  assert.equal(publicJson.includes("科尔基斯"), false);

  const brief = buildGmBrief(draft.public);
  assert.equal(brief.includes(TRUE_NAME), false);
  assert.equal(brief.includes(NP_NAME), false);

  const caster = draft.public.actors["caster"];
  assert.equal(caster?.servantForm?.identity.trueName.status, "hidden");
  assert.equal(caster?.servantForm?.identity.trueName.display, "Caster");

  const markdown = buildStatusMarkdown(draft.public);
  assert.equal(markdown.includes(TRUE_NAME), false);
  assert.equal(markdown.includes(NP_NAME), false);
});

void test("revealSecret denies a correct claim when evidence does not match reveal conditions", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);
  configureCasterSecrets(draft);

  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: "caster",
    claim: TRUE_NAME,
    evidence: "只是直觉，她看起来像神代的魔术师。",
  });

  assert.equal(result.outcome, "insufficient-evidence");
  assert.equal(result.playerSafeMessage.includes(TRUE_NAME), false);
  const caster = draft.public.actors["caster"];
  assert.equal(caster?.servantForm?.identity.trueName.status, "hidden");
  assert.equal(caster?.servantForm?.identity.trueName.display, "Caster");
});

void test("revealSecret marks foreshadowed when evidence matches but claim does not", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);
  configureCasterSecrets(draft);

  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: "caster",
    claim: "阿尔托莉雅",
    evidence: "她的魔术带有科尔基斯神殿的印记。",
  });

  assert.equal(result.outcome, "foreshadowed");
  assert.equal(result.playerSafeMessage.includes(TRUE_NAME), false);
  const slots = draft.secrets.actorSecrets["caster"];
  assert.equal(slots?.trueName?.revealState, "foreshadowed");
  assert.equal(draft.public.actors["caster"]?.servantForm?.identity.trueName.status, "hidden");
});

void test("observed reveal may satisfy a configured condition through the scene trigger", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);
  configureCasterSecrets(draft);

  const result = revealSecret(draft, {
    kind: "observed-reveal",
    actorId: "caster",
    trigger: "她引用了科尔基斯与金羊皮的逸话。",
    evidence: "玩家在场听见这句识别线索。",
  });

  assert.equal(result.outcome, "revealed");
  const caster = draft.public.actors["caster"];
  assert.equal(caster?.servantForm?.identity.trueName.status, "revealed");
  assert.equal(caster?.servantForm?.identity.trueName.display, TRUE_NAME);
});

void test("revealSecret does not re-reveal an already revealed slot", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);
  configureCasterSecrets(draft);

  const first = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: "caster",
    claim: TRUE_NAME,
    evidence: "她引用了科尔基斯与金羊皮的逸话。",
  });
  assert.equal(first.outcome, "revealed");

  const second = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: "caster",
    claim: TRUE_NAME,
    evidence: "她引用了科尔基斯与金羊皮的逸话。",
  });
  assert.equal(second.outcome, "insufficient-evidence");
});

void test("revealSecret records a player-safe memory entry on success", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);
  configureCasterSecrets(draft);
  const eventCountBefore = draft.public.memory.eventLog.length;

  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: "caster",
    claim: TRUE_NAME,
    evidence: "她引用了科尔基斯与金羊皮的逸话。",
  });

  assert.equal(result.outcome, "revealed");
  const eventLog = draft.public.memory.eventLog;
  assert.equal(eventLog.length, eventCountBefore + 1);
  const entry = eventLog.at(-1);
  assert.equal(entry?.title, "隐藏事实揭示");
  assert.equal(JSON.stringify(entry).includes(TRUE_NAME), false);
});

void test("revealSecret throws for unknown actor and stays safe without configured secrets", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);

  assert.throws(
    () =>
      revealSecret(draft, {
        kind: "claim-reveal",
        actorId: "no-such-actor",
        claim: TRUE_NAME,
        evidence: "测试证据。",
      }),
    /actor 不存在: no-such-actor/,
  );

  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: "caster",
    claim: TRUE_NAME,
    evidence: "测试证据。",
  });
  assert.equal(result.outcome, "insufficient-evidence");
});

void test("hidden-reaction without relevant secret reports no special effect", () => {
  const draft = createInitialState();
  upsertTestNpc(draft, "sakura");
  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    actorId: "sakura",
    privateMotives: [{ value: "提及慎二会触发细微紧张。", revealConditions: ["慎二"] }],
    reason: "测试无关刺激",
  });
  const offscreenCountBefore = draft.secrets.offscreenEventLog.length;

  const result = privateResolve(draft, {
    kind: "hidden-reaction",
    actorId: "sakura",
    stimulus: "弓道部的训练日程",
    publicContext: "士郎闲聊训练安排。",
  });

  assert.equal(result.outcome, "no-special-effect");
  assert.equal(draft.secrets.offscreenEventLog.length, offscreenCountBefore);
  assert.equal(
    result.narrativeConstraints.some((constraint) => constraint.includes("不要暗示不存在的秘密")),
    true,
  );
});

void test("hidden-reaction with relevant secret logs a secret-visibility offscreen event", () => {
  const draft = createInitialState();
  upsertTestNpc(draft, "sakura");
  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    actorId: "sakura",
    privateMotives: [{ value: "提及慎二会触发细微紧张。", revealConditions: ["慎二"] }],
    reason: "测试隐藏反应记录",
  });

  const result = privateResolve(draft, {
    kind: "hidden-reaction",
    actorId: "sakura",
    stimulus: "慎二",
    publicContext: "士郎提到慎二。",
  });

  assert.equal(result.outcome, "subtle-reaction");
  const offscreenEntry = draft.secrets.offscreenEventLog.at(-1);
  assert.equal(offscreenEntry?.visibility, "secret");
  assert.equal(
    result.narrativeConstraints.some((constraint) => constraint.includes("不得泄露隐藏真相")),
    true,
  );
});

void test("secret-compatibility requires both actors to hold secrets", () => {
  const draft = createInitialState();
  upsertTestNpc(draft, "sakura");
  upsertTestNpc(draft, "shinji");
  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    actorId: "sakura",
    privateMotives: [{ value: "间桐家的魔术刻印继承。", revealConditions: ["间桐"] }],
    reason: "测试相性",
  });

  const oneSided = privateResolve(draft, {
    kind: "secret-compatibility",
    actorId: "sakura",
    targetActorId: "shinji",
    interaction: "兄妹间的日常对话。",
  });
  assert.equal(oneSided.outcome, "no-special-effect");

  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    actorId: "shinji",
    privateMotives: [{ value: "对家族继承权的嫉妒。", revealConditions: ["继承"] }],
    reason: "测试相性",
  });
  const bothSides = privateResolve(draft, {
    kind: "secret-compatibility",
    actorId: "sakura",
    targetActorId: "shinji",
    interaction: "兄妹间的日常对话。",
  });
  assert.equal(bothSides.outcome, "strong-reaction");

  assert.throws(
    () =>
      privateResolve(draft, {
        kind: "secret-compatibility",
        actorId: "sakura",
        targetActorId: "no-such-actor",
        interaction: "测试目标缺失。",
      }),
    /target actor 不存在: no-such-actor/,
  );
});

void test("configureActorSecrets validates payload and dedupes motives by value", () => {
  const draft = createInitialState();
  upsertTestNpc(draft, "sakura");

  assert.throws(
    () =>
      configureActorSecrets(draft, {
        kind: "configure-actor-secrets",
        actorId: "sakura",
        reason: "测试空配置",
      }),
    /必须提供 privateMotives 或 unrevealedAffiliations/,
  );
  assert.throws(
    () =>
      configureActorSecrets(draft, {
        kind: "configure-actor-secrets",
        actorId: "no-such-actor",
        privateMotives: [{ value: "测试动机。", revealConditions: ["测试"] }],
        reason: "测试不存在的 actor",
      }),
    /actor 不存在: no-such-actor/,
  );

  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    actorId: "sakura",
    privateMotives: [{ value: "间桐家的魔术刻印继承。", revealConditions: ["间桐"] }],
    reason: "测试首次写入",
  });
  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    actorId: "sakura",
    privateMotives: [{ value: "间桐家的魔术刻印继承。", revealConditions: ["刻印", "间桐"] }],
    reason: "测试重复写入合并",
  });

  const slots = draft.secrets.actorSecrets["sakura"];
  assert.equal(slots?.privateMotives.length, 1);
  assert.deepEqual(slots?.privateMotives[0]?.revealConditions, ["间桐", "刻印"]);
});

function configureCasterSecrets(draft: State): void {
  configureServantSecrets(draft, {
    kind: "configure-servant-secrets",
    actorId: "caster",
    trueName: { value: TRUE_NAME, revealConditions: ["科尔基斯", "金羊皮"] },
    hiddenNoblePhantasms: [
      {
        value: {
          name: NP_NAME,
          rank: "C",
          kind: "对魔术宝具",
          status: "hidden",
          summary: "短剑形宝具，可强制解除魔力契约。",
        },
        revealConditions: ["契约解除", "短剑"],
      },
    ],
    reason: "测试 secrets 初始化",
  });
}

function upsertTestCaster(draft: State): void {
  upsertActor(draft, {
    kind: "upsert-servant",
    servant: {
      id: "caster",
      displayName: "Caster",
      publicIdentity: "柳洞寺驻留的从者",
      apparentAge: "不明",
      outfit: { label: "深紫色长袍与兜帽", details: "遮住面容" },
      demeanor: "谨慎、孤高",
      className: "Caster",
      trueNameDisplay: "Caster",
      trueNameStatus: "hidden",
      parameters: {
        strength: "E",
        endurance: "D",
        agility: "C",
        mana: "A+",
        luck: "B",
        noblePhantasm: "C",
      },
      classSkills: [{ name: "阵地作成", rank: "A", summary: "建造工房级别的魔术阵地" }],
      personalSkills: [{ name: "高速神言", rank: "A", summary: "无需咏唱发动大魔术" }],
      noblePhantasms: [],
      spiritualCore: 100,
      mana: 90,
      spiritualCondition: "完好",
      masterActorId: null,
      masterName: null,
      contractStatus: "masterless",
      manaSupply: "sufficient",
      currentOrder: "守卫柳洞寺山门",
    },
    reason: "测试从者入场",
  });
}

function upsertTestNpc(draft: State, id: string): void {
  upsertActor(draft, {
    kind: "upsert-public-npc",
    npc: {
      id,
      kind: "human",
      displayName: `测试NPC-${id}`,
      publicIdentity: "穗群原学园学生。",
      apparentAge: "十六岁左右",
      outfit: { label: "学园制服", details: "冬季制服。" },
      demeanor: "普通学生。",
      publicRoles: [{ kind: "social", label: "穗群原学园学生" }],
      relationshipToProtagonist: { stance: "neutral", summary: "同校学生。" },
      ordinaryItems: [],
    },
    reason: "测试 NPC 入场",
  });
}
