import assert from "node:assert/strict";
import test from "node:test";

import { setScenePresence, upsertActor } from "./actor";
import { buildGmBrief } from "./gm-brief";
import {
  configureActorSecrets,
  configureServantSecrets,
  privateResolve,
  revealSecret,
} from "./secrets";
import { getPublicState, getState, resetState } from "./state";

void test("upsertActor adds an entered NPC from safe public projection", () => {
  resetState();

  const result = upsertActor({
    kind: "upsert-public-npc",
    npc: {
      id: "tohsaka-rin",
      kind: "human",
      displayName: "远坂凛",
      publicIdentity: "穗群原学园二年A班学生，校内知名优等生。",
      apparentAge: "十七岁左右",
      outfit: { label: "穗群原学园制服", details: "红色外套与黑色长袜。" },
      demeanor: "优等生式的从容。",
      publicRoles: [{ kind: "social", label: "穗群原学园学生" }],
      relationshipToProtagonist: { stance: "friendly", summary: "同校学生。" },
      ordinaryItems: [],
    },
    reason: "NPC enters scene during smoke test",
  });

  const publicState = getPublicState();
  const actor = publicState.actors["tohsaka-rin"];
  assert.equal(result.message, "public npc 已写入：tohsaka-rin。");
  assert.equal(actor?.presentation.displayName, "远坂凛");
  assert.equal(actor?.magecraft, null);
  assert.deepEqual(actor?.abilities, []);
  assert.deepEqual(actor?.identity.lockedFacts, []);
  assert.equal(publicState.scene.presentActorIds.includes("tohsaka-rin"), false);
});

void test("ensurePublicNpc creates a minimal public skeleton", () => {
  resetState();

  const result = upsertActor({
    kind: "ensure-public-npc",
    npc: {
      actorId: "tohsaka-rin",
      displayName: "远坂凛",
      publicIdentity: "穗群原学园学生，当前与士郎同行调查的魔术师。",
    },
    reason: "确保同行 NPC 可被 scene presence 引用",
  });

  const publicState = getPublicState();
  const actor = publicState.actors["tohsaka-rin"];
  assert.equal(result.message, "public npc skeleton 已写入：tohsaka-rin。");
  assert.equal(actor?.presentation.displayName, "远坂凛");
  assert.equal(actor?.presentation.apparentAge, "玩家可见年龄未确认");
  assert.deepEqual(actor?.inventory.ordinaryItems, []);
  assert.equal(actor?.relationshipToProtagonist.stance, "neutral");
  assert.equal(publicState.scene.presentActorIds.includes("tohsaka-rin"), false);
});

void test("ensurePublicNpc does not overwrite an existing actor", () => {
  resetState();

  upsertActor({
    kind: "upsert-public-npc",
    npc: {
      id: "tohsaka-rin",
      kind: "human",
      displayName: "远坂凛",
      publicIdentity: "穗群原学园二年A班学生，校内知名优等生。",
      apparentAge: "十七岁左右",
      outfit: { label: "穗群原学园制服", details: "红色外套与黑色长袜。" },
      demeanor: "优等生式的从容。",
      publicRoles: [{ kind: "social", label: "穗群原学园学生" }],
      relationshipToProtagonist: { stance: "friendly", summary: "同校学生。" },
      ordinaryItems: ["红色发带"],
    },
    reason: "NPC enters scene during smoke test",
  });

  const result = upsertActor({
    kind: "ensure-public-npc",
    npc: {
      actorId: "tohsaka-rin",
      displayName: "远坂",
      publicIdentity: "不完整 skeleton 不应覆盖既有 actor。",
    },
    reason: "重复确保 actor 存在",
  });

  const actor = getPublicState().actors["tohsaka-rin"];
  assert.equal(result.message, "actor 已存在：tohsaka-rin。");
  assert.equal(actor?.presentation.displayName, "远坂凛");
  assert.equal(actor?.presentation.outfit.label, "穗群原学园制服");
  assert.deepEqual(actor?.inventory.ordinaryItems, ["红色发带"]);
});

void test("upsertActor rejects non-protagonist setup", () => {
  resetState();

  assert.throws(
    () =>
      upsertActor({
        kind: "setup-protagonist",
        actor: {
          id: "tohsaka-rin",
          kind: "human",
          roles: [{ kind: "social", label: "穗群原学园学生" }],
          magecraft: null,
          servantForm: null,
          identity: { publicIdentity: "远坂凛", background: "测试", lockedFacts: [] },
          presentation: {
            displayName: "远坂凛",
            apparentAge: "17岁",
            outfit: { label: "制服", details: "测试" },
            demeanor: "测试",
          },
          condition: { wounds: [], afflictions: [], permanentEffects: [] },
          inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
          abilities: [],
          relationshipToProtagonist: { stance: "neutral", summary: "测试" },
        },
        reason: "测试",
      }),
    /setup-protagonist 只能写入 actor.id=protagonist/,
  );
});

void test("upsertActor can replace protagonist setup skeleton", () => {
  resetState();

  upsertActor({
    kind: "setup-protagonist",
    actor: {
      id: "protagonist",
      kind: "human",
      roles: [{ kind: "social", label: "穗群原学园学生" }],
      magecraft: {
        circuits: { count: "27", quality: "E", od: 40, status: "normal", traits: [] },
        disciplines: [
          { name: "强化", rank: "E", notes: "可强化物体结构。" },
          { name: "投影", rank: "E-", notes: "基础投影，稳定性低。" },
        ],
        affiliation: null,
      },
      servantForm: null,
      identity: {
        publicIdentity: "卫宫士郎",
        background: "穗群原学园二年级学生，独居于深山镇卫宫邸。",
        lockedFacts: [{ id: "setup-identity", text: "卫宫士郎" }],
      },
      presentation: {
        displayName: "卫宫士郎",
        apparentAge: "17岁",
        outfit: { label: "穗群原学园制服", details: "冬季制服。" },
        demeanor: "固执且容易主动帮忙。",
      },
      condition: { wounds: [], afflictions: [], permanentEffects: [] },
      inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
      abilities: [
        { id: "reinforcement", label: "强化魔术", summary: "强化物体结构。" },
        { id: "projection", label: "投影魔术", summary: "基础投影。" },
      ],
      relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
    },
    reason: "setup confirmed protagonist identity",
  });

  const publicState = getPublicState();
  assert.equal(publicState.actors.protagonist?.identity.publicIdentity, "卫宫士郎");
  assert.match(buildGmBrief(publicState), /玩家角色：卫宫士郎 \/ human \/ 卫宫士郎/);
});

void test("configureServantSecrets creates mergeable slots for runtime servants", () => {
  resetState();
  upsertTestCaster();

  configureServantSecrets({
    kind: "configure-servant-secrets",
    actorId: "caster",
    trueName: {
      value: "美狄亚",
      revealConditions: ["科尔基斯", "金羊皮"],
    },
    hiddenNoblePhantasms: [
      {
        value: {
          name: "Rule Breaker",
          rank: "C",
          kind: "对魔术宝具",
          status: "hidden",
          summary: "短剑形宝具，可强制解除魔力契约。",
        },
        revealConditions: ["契约解除", "短剑"],
      },
    ],
    reason: "测试从者 secrets 初始化",
  });
  configureServantSecrets({
    kind: "configure-servant-secrets",
    actorId: "caster",
    hiddenNoblePhantasms: [
      {
        value: {
          name: "Rule Breaker",
          rank: "C",
          kind: "对魔术宝具",
          status: "hidden",
          summary: "短剑形宝具，可强制解除魔力契约。",
        },
        revealConditions: ["背叛魔女"],
      },
    ],
    reason: "测试追加宝具揭示条件",
  });

  const casterSecrets = getState().secrets.actorSecrets["caster"];
  assert.equal(casterSecrets?.trueName?.value, "美狄亚");
  assert.deepEqual(casterSecrets?.trueName?.revealConditions, ["科尔基斯", "金羊皮"]);
  assert.equal(casterSecrets?.hiddenNoblePhantasms.length, 1);
  assert.deepEqual(casterSecrets?.hiddenNoblePhantasms[0]?.revealConditions, [
    "契约解除",
    "短剑",
    "背叛魔女",
  ]);
});

void test("configured servant secrets can be revealed by evidence", () => {
  resetState();
  upsertTestCaster();
  configureServantSecrets({
    kind: "configure-servant-secrets",
    actorId: "caster",
    trueName: {
      value: "美狄亚",
      revealConditions: ["科尔基斯", "金羊皮"],
    },
    reason: "测试真名揭示槽位",
  });

  const result = revealSecret({
    kind: "claim-reveal",
    actorId: "caster",
    claim: "美狄亚",
    evidence: "她的神代魔术与科尔基斯传承、金羊皮逸话一致。",
  });

  const caster = getState().public.actors["caster"];
  assert.equal(result.outcome, "revealed");
  assert.equal(caster?.servantForm?.identity.trueName.status, "revealed");
  assert.equal(caster?.servantForm?.identity.trueName.display, "美狄亚");
});

function upsertTestCaster(): void {
  upsertActor({
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
      masterName: "葛木宗一郎",
      contractStatus: "masterless",
      manaSupply: "sufficient",
      currentOrder: "守卫柳洞寺山门",
    },
    reason: "测试从者入场",
  });
}

void test("upsert-servant writes servant form with full parameter block", () => {
  resetState();

  upsertActor({
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
      noblePhantasms: [
        {
          name: "Rule Breaker",
          rank: "C",
          kind: "对魔术宝具",
          status: "hidden",
          summary: "短剑形宝具，可强制解除魔力契约",
        },
      ],
      spiritualCore: 100,
      mana: 90,
      spiritualCondition: "完好",
      masterActorId: null,
      masterName: "葛木宗一郎",
      contractStatus: "masterless",
      manaSupply: "sufficient",
      currentOrder: "守卫柳洞寺山门",
    },
    reason: "测试从者入场",
  });

  const state = getState();
  const caster = state.public.actors["caster"];
  assert.notEqual(caster, undefined);
  assert.equal(caster?.kind, "spirit");
  assert.notEqual(caster?.servantForm, null);
  assert.equal(caster?.servantForm?.identity.className, "Caster");
  assert.equal(caster?.servantForm?.identity.trueName.status, "hidden");
  assert.equal(caster?.servantForm?.parameters.base.strength, "E");
  assert.equal(caster?.servantForm?.parameters.base.mana, "A+");
  assert.equal(caster?.servantForm?.skills.classSkills[0]?.name, "阵地作成");
  assert.equal(caster?.servantForm?.noblePhantasms[0]?.name, "Rule Breaker");
  assert.equal(caster?.servantForm?.noblePhantasms[0]?.status, "hidden");
  assert.equal(caster?.servantForm?.contract.status, "masterless");
  assert.equal(caster?.servantForm?.contract.masterName, "葛木宗一郎");
  assert.equal(caster?.magecraft, null);
});

void test("setScenePresence updates current scene independently from actor registry", () => {
  resetState();
  upsertTestCaster();

  const result = setScenePresence({
    presentActorIds: ["protagonist", "caster"],
    allyActorIds: ["caster"],
    reason: "Caster enters the scene as temporary ally",
  });

  const publicState = getPublicState();
  assert.equal(result.message, "场景在场 actor 已更新。");
  assert.deepEqual(publicState.scene.presentActorIds, ["protagonist", "caster"]);
  assert.deepEqual(publicState.allyActorIds, ["caster"]);
});

void test("setScenePresence rejects unknown actors", () => {
  resetState();

  assert.throws(
    () =>
      setScenePresence({
        presentActorIds: ["protagonist", "caster"],
        allyActorIds: [],
        reason: "unknown actor should fail",
      }),
    /presentActorIds 包含不存在的 actor: caster/,
  );
});

void test("configureActorSecrets enables hidden reactions for non-servant NPCs", () => {
  resetState();
  upsertActor({
    kind: "upsert-public-npc",
    npc: {
      id: "sakura",
      kind: "human",
      displayName: "间桐樱",
      publicIdentity: "穗群原学园一年生；卫宫士郎弓道部的后辈。",
      apparentAge: "15岁",
      outfit: { label: "冬季便服", details: "浅色毛衣与长裙。" },
      demeanor: "温柔体贴，但偶尔会在家族话题前沉默。",
      publicRoles: [{ kind: "social", label: "穗群原学园一年生" }],
      relationshipToProtagonist: { stance: "friendly", summary: "常来卫宫宅帮忙的后辈。" },
      ordinaryItems: ["卫宫宅备用钥匙"],
    },
    reason: "测试非从者 NPC hidden reaction",
  });

  configureActorSecrets({
    kind: "configure-actor-secrets",
    actorId: "sakura",
    privateMotives: [
      {
        value: "提及慎二会触发樱的细微紧张，但不得公开间桐家内幕。",
        revealConditions: ["慎二", "哥哥", "间桐"],
      },
    ],
    reason: "测试 Sakura 私密反应槽位",
  });

  const result = privateResolve({
    kind: "hidden-reaction",
    actorId: "sakura",
    stimulus: "慎二",
    publicContext: "士郎询问弓道部训练时提到慎二。",
  });

  assert.equal(result.outcome, "subtle-reaction");
});

void test("configureServantSecrets accepts multi-plus Fate ranks", () => {
  resetState();
  upsertTestCaster();

  configureServantSecrets({
    kind: "configure-servant-secrets",
    actorId: "caster",
    hiddenNoblePhantasms: [
      {
        value: {
          name: "测试宝具",
          rank: "A++",
          kind: "对界宝具",
          status: "hidden",
          summary: "测试多加号 rank。",
        },
        revealConditions: ["测试宝具"],
      },
    ],
    reason: "测试多加号 rank",
  });

  assert.equal(
    getState().secrets.actorSecrets["caster"]?.hiddenNoblePhantasms[0]?.value.rank,
    "A++",
  );
});

void test("configureServantSecrets accepts non-noble-phantasm sword techniques", () => {
  resetState();
  upsertActor({
    kind: "upsert-servant",
    servant: {
      id: "assassin",
      displayName: "Assassin",
      publicIdentity: "柳洞寺山门守卫",
      apparentAge: "青年",
      outfit: { label: "淡紫色和服", details: "腰间佩有超长日本刀。" },
      demeanor: "从容、古风",
      className: "Assassin",
      trueNameDisplay: "Assassin",
      trueNameStatus: "hidden",
      parameters: {
        strength: "C-",
        endurance: "E",
        agility: "A+",
        mana: "E",
        luck: "A",
        noblePhantasm: "E",
      },
      classSkills: [],
      personalSkills: [{ name: "燕返", rank: "none", summary: "宝具级剑技但非真正宝具。" }],
      noblePhantasms: [],
      spiritualCore: 100,
      mana: 70,
      spiritualCondition: "受山门束缚但灵基稳定",
      masterActorId: null,
      masterName: "Caster",
      contractStatus: "stable",
      manaSupply: "sufficient",
      currentOrder: "守卫柳洞寺山门",
    },
    reason: "测试非宝具剑技隐藏槽位",
  });

  configureServantSecrets({
    kind: "configure-servant-secrets",
    actorId: "assassin",
    hiddenNoblePhantasms: [
      {
        value: {
          name: "燕返",
          rank: "none",
          kind: "非宝具剑技",
          status: "hidden",
          summary: "宝具级剑技，但不是正式宝具。",
        },
        revealConditions: ["三道斩击", "燕返"],
      },
    ],
    reason: "记录 Assassin 隐藏剑技线索",
  });

  assert.equal(
    getState().secrets.actorSecrets["assassin"]?.hiddenNoblePhantasms[0]?.value.rank,
    "none",
  );
});
