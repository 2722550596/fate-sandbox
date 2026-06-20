import type { State } from "./state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { retireActor, setScenePresence, upsertActor } from "./actor.ts";
import { buildGmBrief } from "./public-projection.ts";
import {
  configureActorSecrets,
  configureServantSecrets,
  privateResolve,
  revealSecret,
} from "./secrets.ts";
import { createInitialState } from "./state-store.ts";

void test("upsertActor adds an entered NPC from safe public projection", () => {
  const draft = createInitialState();

  const result = upsertActor(draft, {
    kind: "upsert-public-npc",
    npc: {
      id: "tohsaka-rin",
      kind: "human",
      internalName: "远坂凛",
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

  const publicState = draft.public;
  const actor = publicState.actors["tohsaka-rin"];
  assert.equal(result.message, "public npc 已写入：tohsaka-rin。");
  assert.equal(actor?.presentation.internalName, "远坂凛");
  assert.equal(actor?.magecraft, null);
  assert.deepEqual(actor?.abilities, []);
  assert.deepEqual(actor?.identity.lockedFacts, []);
  assert.equal(publicState.scene.presentActorIds.includes("tohsaka-rin"), false);
});

void test("ensurePublicNpc creates a minimal public skeleton", () => {
  const draft = createInitialState();

  const result = upsertActor(draft, {
    kind: "ensure-public-npc",
    npc: {
      actorId: "tohsaka-rin",
      internalName: "远坂凛",
      publicIdentity: "穗群原学园学生，当前与士郎同行调查的魔术师。",
    },
    reason: "确保同行 NPC 可被 scene presence 引用",
  });

  const publicState = draft.public;
  const actor = publicState.actors["tohsaka-rin"];
  assert.equal(result.message, "public npc skeleton 已写入：tohsaka-rin。");
  assert.equal(actor?.presentation.internalName, "远坂凛");
  assert.equal(actor?.presentation.apparentAge, "玩家可见年龄未确认");
  assert.deepEqual(actor?.inventory.ordinaryItems, []);
  assert.equal(actor?.relationshipToProtagonist.stance, "neutral");
  assert.equal(publicState.scene.presentActorIds.includes("tohsaka-rin"), false);
});

void test("ensurePublicNpc does not overwrite an existing actor", () => {
  const draft = createInitialState();

  upsertActor(draft, {
    kind: "upsert-public-npc",
    npc: {
      id: "tohsaka-rin",
      kind: "human",
      internalName: "远坂凛",
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

  const result = upsertActor(draft, {
    kind: "ensure-public-npc",
    npc: {
      actorId: "tohsaka-rin",
      internalName: "远坂",
      publicIdentity: "不完整 skeleton 不应覆盖既有 actor。",
    },
    reason: "重复确保 actor 存在",
  });

  const actor = draft.public.actors["tohsaka-rin"];
  assert.equal(result.message, "actor 已存在：tohsaka-rin。");
  assert.equal(actor?.presentation.internalName, "远坂凛");
  assert.equal(actor?.presentation.outfit.label, "穗群原学园制服");
  assert.deepEqual(actor?.inventory.ordinaryItems, ["红色发带"]);
});

void test("upsertActor rejects non-protagonist setup", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      upsertActor(draft, {
        kind: "setup-protagonist",
        actor: {
          id: "tohsaka-rin",
          kind: "human",
          roles: [{ kind: "social", label: "穗群原学园学生" }],
          magecraft: null,
          servantForm: null,
          identity: { publicIdentity: "远坂凛", background: "测试", lockedFacts: [] },
          presentation: {
            internalName: "远坂凛",
            renderName: "远坂凛",
            apparentAge: "17岁",
            outfit: { label: "制服", details: "测试" },
            demeanor: "测试",
          },
          condition: { wounds: [], afflictions: [], permanentEffects: [] },
          inventory: { ordinaryItems: [] },
          abilities: [],
          relationshipToProtagonist: { stance: "neutral", summary: "测试" },
        },
        reason: "测试",
      }),
    /setup-protagonist 只能写入 actor.id=protagonist/,
  );
});

void test("upsertActor can replace protagonist setup skeleton", () => {
  const draft = createInitialState();

  upsertShirouProtagonist(draft, 40);

  const publicState = draft.public;
  assert.equal(publicState.actors.protagonist?.identity.publicIdentity, "卫宫士郎");
  assert.match(buildGmBrief(publicState), /玩家角色：卫宫士郎 \/ human \/ 卫宫士郎/);
});

void test("GM brief separates human circuit aptitude from Od remaining percentage", () => {
  const draft = createInitialState();

  upsertShirouProtagonist(draft, 100);

  const brief = buildGmBrief(draft.public);
  assert.match(brief, /魔术回路27\/E；Od余量稳定（100%）/);
});

void test("GM brief separates servant mana parameter from mana remaining percentage", () => {
  const draft = createInitialState();

  upsertActor(draft, {
    kind: "upsert-servant",
    servant: {
      id: "protagonist",
      internalName: "Saber",
      publicIdentity: "玩家扮演的 Saber",
      apparentAge: "不明",
      outfit: { label: "蓝银甲胄", details: "灵装显现。" },
      demeanor: "克制而警惕。",
      className: "Saber",
      trueNameDisplay: "Saber",
      trueNameStatus: "hidden",
      parameters: {
        strength: "B",
        endurance: "C",
        agility: "C",
        mana: "A+",
        luck: "D",
        noblePhantasm: "A++",
      },
      classSkills: [],
      personalSkills: [],
      noblePhantasms: [],
      spiritualCore: 100,
      mana: 100,
      spiritualCondition: "灵基稳定",
      masterActorId: null,
      masterName: null,
      contractStatus: "masterless",
      manaSupply: "sufficient",
      currentOrder: "自主行动",
    },
    reason: "测试玩家从者魔力显示",
  });

  const brief = buildGmBrief(draft.public);
  assert.match(brief, /魔力余量稳定（100%；参数A\+）/);
});

function upsertShirouProtagonist(draft: State, od: number): void {
  upsertActor(draft, {
    kind: "setup-protagonist",
    actor: {
      id: "protagonist",
      kind: "human",
      roles: [{ kind: "social", label: "穗群原学园学生" }],
      magecraft: {
        circuits: { count: "27", quality: "E", od, status: "normal", traits: [] },
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
        internalName: "卫宫士郎",
        renderName: "卫宫士郎",
        apparentAge: "17岁",
        outfit: { label: "穗群原学园制服", details: "冬季制服。" },
        demeanor: "固执且容易主动帮忙。",
      },
      condition: { wounds: [], afflictions: [], permanentEffects: [] },
      inventory: { ordinaryItems: [] },
      abilities: [
        { id: "reinforcement", label: "强化魔术", summary: "强化物体结构。" },
        { id: "projection", label: "投影魔术", summary: "基础投影。" },
      ],
      relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
    },
    reason: "setup confirmed protagonist identity",
  });
}

void test("configureServantSecrets creates mergeable slots for runtime servants", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);

  configureServantSecrets(draft, {
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
  configureServantSecrets(draft, {
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

  const casterSecrets = draft.secrets.actorSecrets["caster"];
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
  const draft = createInitialState();
  upsertTestCaster(draft);
  configureServantSecrets(draft, {
    kind: "configure-servant-secrets",
    actorId: "caster",
    trueName: {
      value: "美狄亚",
      revealConditions: ["科尔基斯", "金羊皮"],
    },
    reason: "测试真名揭示槽位",
  });

  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: "caster",
    claim: "美狄亚",
    evidence: "她的神代魔术与科尔基斯传承、金羊皮逸话一致。",
  });

  const caster = draft.public.actors["caster"];
  assert.equal(result.outcome, "revealed");
  assert.equal(caster?.servantForm?.identity.trueName.status, "revealed");
  assert.equal(caster?.servantForm?.identity.trueName.display, "美狄亚");
});

void test("reveal_secret replaces placeholder hidden noble phantasm instead of duplicating", () => {
  const draft = createInitialState();
  upsertActor(draft, {
    kind: "upsert-servant",
    servant: {
      id: "caster",
      internalName: "Caster",
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
          name: "未确认宝具",
          rank: "none",
          kind: "对人宝具",
          status: "hidden",
          summary: "宝具真名与效果尚未确认",
        },
      ],
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

  configureServantSecrets(draft, {
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
        revealConditions: ["破除魔术", "短剑"],
      },
    ],
    reason: "测试宝具揭示",
  });

  const result = revealSecret(draft, {
    kind: "claim-reveal",
    actorId: "caster",
    claim: "Rule Breaker",
    evidence: "短剑形宝具切开了魔术契约。",
  });

  const caster = draft.public.actors["caster"];
  assert.equal(result.outcome, "revealed");
  assert.equal(caster?.servantForm?.noblePhantasms.length, 1);
  assert.equal(caster?.servantForm?.noblePhantasms[0]?.name, "Rule Breaker");
  assert.equal(caster?.servantForm?.noblePhantasms[0]?.status, "revealed");
});

function upsertTestCaster(draft: State): void {
  upsertTestCasterWithMaster(draft, null);
}

function upsertTestCasterWithMaster(draft: State, masterActorId: string | null): void {
  upsertActor(draft, {
    kind: "upsert-servant",
    servant: {
      id: "caster",
      internalName: "Caster",
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
      masterActorId,
      masterName: masterActorId === null ? "葛木宗一郎" : "御主",
      contractStatus: masterActorId === null ? "masterless" : "stable",
      manaSupply: "sufficient",
      currentOrder: "守卫柳洞寺山门",
    },
    reason: "测试从者入场",
  });
}

void test("upsert-servant writes servant form with full parameter block", () => {
  const draft = createInitialState();

  upsertActor(draft, {
    kind: "upsert-servant",
    servant: {
      id: "caster",
      internalName: "Caster",
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

  const state = draft;
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

void test("retireActor removes a non-referenced actor from registry and scene", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);
  setScenePresence(draft, {
    presentActorIds: ["protagonist", "caster"],
    allyActorIds: [],
    reason: "Caster enters before retiring",
  });

  const result = retireActor(draft, { actorId: "caster", reason: "测试敌人退场" });
  const state = draft;

  assert.match(result.message, /caster/);
  assert.equal(state.public.actors["caster"], undefined);
  assert.deepEqual(state.public.scene.presentActorIds, ["protagonist"]);
});

void test("retireActor rejects actors referenced by master contracts", () => {
  const draft = createInitialState();
  upsertActor(draft, {
    kind: "upsert-public-npc",
    npc: {
      id: "master",
      kind: "human",
      internalName: "御主",
      publicIdentity: "测试御主",
      apparentAge: "不明",
      outfit: { label: "便服", details: "测试" },
      demeanor: "谨慎",
      publicRoles: [{ kind: "social", label: "测试御主" }],
      relationshipToProtagonist: { stance: "neutral", summary: "测试" },
      ordinaryItems: [],
    },
    reason: "测试御主入场",
  });
  upsertTestCasterWithMaster(draft, "master");

  assert.throws(
    () => retireActor(draft, { actorId: "master", reason: "仍被从者契约引用" }),
    /masterActorId/,
  );
});

void test("retireActor refuses an actor who still owns funds or holds debt", () => {
  const draft = createInitialState();
  upsertActor(draft, {
    kind: "upsert-public-npc",
    npc: {
      id: "tohsaka-rin",
      kind: "human",
      internalName: "远坂凛",
      publicIdentity: "学生。",
      apparentAge: "十七",
      outfit: { label: "制服", details: "红外套。" },
      demeanor: "从容。",
      publicRoles: [{ kind: "social", label: "学生" }],
      relationshipToProtagonist: { stance: "friendly", summary: "同校。" },
      ordinaryItems: [],
    },
    reason: "seed fund owner",
  });
  draft.public.economy.accessibleFunds.push({
    id: "rin-wallet",
    ownerActorId: "tohsaka-rin",
    label: "凛的钱包",
    amount: 5000,
    access: "held",
  });

  assert.throws(
    () => retireActor(draft, { actorId: "tohsaka-rin", reason: "资金未结算" }),
    /资金|结算/,
  );
});

function countActorReferences(state: State, actorId: string): Record<string, number> {
  return {
    "public.actors": state.public.actors[actorId] === undefined ? 0 : 1,
    "public.actorImpressions": state.public.actorImpressions[actorId] === undefined ? 0 : 1,
    "public.relationshipSignals": state.public.relationshipSignals.filter(
      (row) => row.actorId === actorId || row.targetActorId === actorId,
    ).length,
    "public.scene.presentActorIds": state.public.scene.presentActorIds.filter(
      (id) => id === actorId,
    ).length,
    "public.allyActorIds": state.public.allyActorIds.filter((id) => id === actorId).length,
    "secrets.actorSecrets": state.secrets.actorSecrets[actorId] === undefined ? 0 : 1,
    "secrets.actorAgendas": state.secrets.actorAgendas[actorId] === undefined ? 0 : 1,
    "secrets.actorKnowledgeLenses":
      state.secrets.actorKnowledgeLenses[actorId] === undefined ? 0 : 1,
    "secrets.relationshipSignals": state.secrets.relationshipSignals.filter(
      (row) => row.actorId === actorId || row.targetActorId === actorId,
    ).length,
  };
}

// 退场必须清空一个 actor 在所有侧表里的痕迹。当前 retireActor 只清了
// public.actors / secrets.actorSecrets / presentActorIds / allyActorIds，
// 漏了 impressions / agendas / knowledgeLenses / 两层 relationshipSignals。
// 这个测试故意覆盖全部侧表，应当暴露孤儿行。
void test("retireActor leaves no orphan rows in any actor-keyed side table", () => {
  const draft = createInitialState();
  upsertActor(draft, {
    kind: "upsert-public-npc",
    npc: {
      id: "tohsaka-rin",
      kind: "human",
      internalName: "远坂凛",
      publicIdentity: "穗群原学园学生。",
      apparentAge: "十七岁左右",
      outfit: { label: "制服", details: "红色外套。" },
      demeanor: "从容。",
      publicRoles: [{ kind: "social", label: "学生" }],
      relationshipToProtagonist: { stance: "friendly", summary: "同校学生。" },
      ordinaryItems: [],
    },
    reason: "seed actor for orphan test",
  });
  setScenePresence(draft, {
    presentActorIds: ["protagonist", "tohsaka-rin"],
    allyActorIds: ["tohsaka-rin"],
    reason: "present before retire",
  });

  draft.public.actorImpressions["tohsaka-rin"] = {
    actorId: "tohsaka-rin",
    presence: "清冷优等生。",
    actionStyle: "言简意赅。",
    relationshipPosture: "保持距离。",
    voiceMaterial: "「哼。」",
    updatedAt: "2004-02-01T08:00:00+09:00",
  };
  draft.public.relationshipSignals.push({
    id: "sig-public-1",
    actorId: "tohsaka-rin",
    targetActorId: "protagonist",
    signal: "递出一枚宝石。",
    interpretation: "试探性的善意。",
    boundary: "公开",
    sourceEventId: null,
    visibility: "player-known",
  });
  configureActorSecrets(draft, {
    kind: "configure-actor-secrets",
    actorId: "tohsaka-rin",
    privateMotives: [{ value: "暗中保护主角。", revealConditions: [] }],
    reason: "seed secret slot",
  });
  draft.secrets.actorAgendas["tohsaka-rin"] = {
    actorId: "tohsaka-rin",
    goal: "赢得圣杯战争。",
    fear: "主角受伤。",
    currentOrder: null,
    lastIndependentActionAt: null,
  };
  draft.secrets.actorKnowledgeLenses["tohsaka-rin"] = {
    actorId: "tohsaka-rin",
    knows: ["主角是魔术师。"],
    suspects: [],
    falseBeliefs: [],
    forbiddenKnowledge: [],
  };
  draft.secrets.relationshipSignals.push({
    id: "sig-secret-1",
    actorId: "protagonist",
    targetActorId: "tohsaka-rin",
    signal: "主角私下提防她。",
    interpretation: "未公开的戒心。",
    boundary: "隐藏",
    sourceEventId: null,
    visibility: "secret",
  });

  retireActor(draft, { actorId: "tohsaka-rin", reason: "测试退场后无孤儿行" });

  const references = countActorReferences(draft, "tohsaka-rin");
  const leftover = Object.entries(references).filter(([, count]) => count > 0);
  assert.deepEqual(
    leftover,
    [],
    `退场后仍有侧表残留 tohsaka-rin：${leftover.map(([table, count]) => `${table}=${count}`).join(", ")}`,
  );
});

void test("setScenePresence updates current scene independently from actor registry", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);

  const result = setScenePresence(draft, {
    presentActorIds: ["protagonist", "caster"],
    allyActorIds: ["caster"],
    reason: "Caster enters the scene as temporary ally",
  });

  const publicState = draft.public;
  assert.equal(result.message, "场景在场 actor 已更新。");
  assert.deepEqual(publicState.scene.presentActorIds, ["protagonist", "caster"]);
  assert.deepEqual(publicState.allyActorIds, ["caster"]);
});

void test("setScenePresence rejects unknown actors", () => {
  const draft = createInitialState();

  assert.throws(
    () =>
      setScenePresence(draft, {
        presentActorIds: ["protagonist", "caster"],
        allyActorIds: [],
        reason: "unknown actor should fail",
      }),
    /presentActorIds 包含不存在的 actor: caster/,
  );
});

void test("configureActorSecrets enables hidden reactions for non-servant NPCs", () => {
  const draft = createInitialState();
  upsertActor(draft, {
    kind: "upsert-public-npc",
    npc: {
      id: "sakura",
      kind: "human",
      internalName: "间桐樱",
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

  configureActorSecrets(draft, {
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

  const result = privateResolve(draft, {
    kind: "hidden-reaction",
    actorId: "sakura",
    stimulus: "慎二",
    publicContext: "士郎询问弓道部训练时提到慎二。",
  });

  assert.equal(result.outcome, "subtle-reaction");
});

void test("configureServantSecrets accepts multi-plus Fate ranks", () => {
  const draft = createInitialState();
  upsertTestCaster(draft);

  configureServantSecrets(draft, {
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

  assert.equal(draft.secrets.actorSecrets["caster"]?.hiddenNoblePhantasms[0]?.value.rank, "A++");
});

void test("configureServantSecrets accepts non-noble-phantasm sword techniques", () => {
  const draft = createInitialState();
  upsertActor(draft, {
    kind: "upsert-servant",
    servant: {
      id: "assassin",
      internalName: "Assassin",
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
      masterActorId: "caster",
      masterName: "Caster",
      contractStatus: "stable",
      manaSupply: "sufficient",
      currentOrder: "守卫柳洞寺山门",
    },
    reason: "测试非宝具剑技隐藏槽位",
  });

  configureServantSecrets(draft, {
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

  assert.equal(draft.secrets.actorSecrets["assassin"]?.hiddenNoblePhantasms[0]?.value.rank, "none");
});
