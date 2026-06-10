import assert from "node:assert/strict";
import test from "node:test";

import { upsertActorTool } from "./upsert-actor";
import { getState, resetState } from "../../engine/core/state-store";

void test("upsertActorTool accepts omitted master fields for masterless servants", () => {
  resetState();

  const result = upsertActorTool(
    {
      kind: "upsert-servant",
      servant: baseMasterlessServant(),
      reason: "测试无主从者工具输入",
    },
    createNoopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /从者已写入：masterless-caster/);
  const contract = getState().public.actors["masterless-caster"]?.servantForm?.contract;
  assert.equal(contract?.status, "masterless");
  assert.equal(contract?.masterActorId, null);
  assert.equal(contract?.masterName, null);
});

void test("upsertActorTool normalizes placeholder master fields for masterless servants", () => {
  resetState();

  upsertActorTool(
    {
      kind: "upsert-servant",
      servant: {
        ...baseMasterlessServant(),
        masterActorId: "none",
        masterName: "无",
      },
      reason: "测试无主从者占位输入",
    },
    createNoopSessionManager(),
  );

  const contract = getState().public.actors["masterless-caster"]?.servantForm?.contract;
  assert.equal(contract?.masterActorId, null);
  assert.equal(contract?.masterName, null);
});

void test("upsertActorTool defaults omitted public NPC master role fields", () => {
  resetState();

  upsertActorTool(
    {
      kind: "ensure-public-npc",
      npc: {
        actorId: "moon-master",
        displayName: "未知御主",
        publicIdentity: "月之圣杯战争参赛者",
        publicRoles: [{ kind: "master" }],
      },
      reason: "测试 NPC Master role 缺省字段。",
    },
    createNoopSessionManager(),
  );

  const role = getState().public.actors["moon-master"]?.roles[0];
  assert.equal(role?.kind, "master");
  if (role?.kind !== "master") throw new Error("expected master role");
  assert.deepEqual(role.commandSpells, { total: 3, remaining: 3 });
  assert.deepEqual(role.contractedServantIds, []);
});

void test("upsertActorTool reports invalid servant enums in domain language", () => {
  resetState();

  assert.throws(
    () =>
      upsertActorTool(
        {
          kind: "upsert-servant",
          servant: {
            ...baseMasterlessServant(),
            contractStatus: "free",
          },
          reason: "测试非法契约状态",
        },
        createNoopSessionManager(),
      ),
    /servant\.contractStatus 必须是允许值之一: stable, weak, cut, masterless/,
  );
});

void test("upsertActorTool reports invalid npc relationship stance in domain language", () => {
  resetState();

  assert.throws(
    () =>
      upsertActorTool(
        {
          kind: "ensure-public-npc",
          npc: {
            actorId: "tohsaka-rin",
            displayName: "远坂凛",
            publicIdentity: "穗群原学园学生",
            relationshipToProtagonist: { stance: "close", summary: "关系尚未明确。" },
          },
          reason: "测试非法关系 stance",
        },
        createNoopSessionManager(),
      ),
    /npc\.relationshipToProtagonist\.stance 必须是允许值之一: self, ally, friendly, neutral, wary, hostile, unknown/,
  );
});

void test("upsertActorTool rejects revealed true name for protagonist servant setup", () => {
  resetState();

  assert.throws(
    () =>
      upsertActorTool(
        {
          kind: "upsert-servant",
          servant: {
            ...baseMasterlessServant(),
            id: "protagonist",
            trueNameDisplay: "两仪式",
            trueNameStatus: "revealed",
          },
          reason: "测试玩家从者初始化真名泄露保护",
        },
        createNoopSessionManager(),
      ),
    /玩家从者初始化不得把 servant\.trueNameStatus 写成 revealed/,
  );
});

void test("upsertActorTool normalizes undefined protagonist setup optionals", () => {
  resetState();

  upsertActorTool(
    {
      kind: "setup-protagonist",
      actor: {
        ...baseProtagonistActor(),
        roles: [{ kind: "master", commandSpells: undefined, contractedServantIds: undefined }],
        magecraft: { circuits: undefined, disciplines: undefined, affiliation: undefined },
      },
      reason: "测试模型传入 undefined 可选字段。",
    },
    createNoopSessionManager(),
  );

  const protagonist = getState().public.actors["protagonist"];
  const masterRole = protagonist?.roles[0];
  assert.equal(masterRole?.kind, "master");
  if (masterRole?.kind !== "master") throw new Error("expected master role");
  assert.deepEqual(masterRole.commandSpells, { total: 3, remaining: 3 });
  assert.deepEqual(masterRole.contractedServantIds, []);
  assert.equal(protagonist?.magecraft, null);
});

void test("upsertActorTool fills omitted magecraft discipline array", () => {
  resetState();

  upsertActorTool(
    {
      kind: "setup-protagonist",
      actor: {
        ...baseProtagonistActor(),
        magecraft: {
          circuits: { count: "未确认", quality: "none", od: 100, status: "normal", traits: undefined },
          disciplines: undefined,
          affiliation: undefined,
        },
      },
      reason: "测试魔术字段缺省数组归一化。",
    },
    createNoopSessionManager(),
  );

  const magecraft = getState().public.actors["protagonist"]?.magecraft;
  assert.deepEqual(magecraft?.disciplines, []);
  assert.deepEqual(magecraft?.circuits.traits, []);
  assert.equal(magecraft?.affiliation, null);
});

function baseProtagonistActor(): Record<string, unknown> {
  return {
    id: "protagonist",
    kind: "human",
    roles: [],
    magecraft: null,
    servantForm: null,
    identity: {
      publicIdentity: "月之圣杯战争参赛者",
      background: "月之圣杯战争参赛者",
      lockedFacts: [],
    },
    presentation: {
      displayName: "主人公",
      apparentAge: "十几岁",
      outfit: { label: "旧校舍制服", details: "黑色学生制服。" },
      demeanor: "警惕但保持冷静",
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "self", summary: "玩家角色本人。" },
  };
}

function baseMasterlessServant(): Record<string, unknown> {
  return {
    id: "masterless-caster",
    displayName: "Caster",
    publicIdentity: "身份不明的无主从者",
    apparentAge: "二十岁后半",
    outfit: { label: "长袍", details: "深蓝色连帽长袍。" },
    demeanor: "沉静寡言",
    className: "Caster",
    trueNameDisplay: "Caster",
    trueNameStatus: "hidden",
    parameters: {
      strength: "E",
      endurance: "D",
      agility: "C",
      mana: "A",
      luck: "B",
      noblePhantasm: "A",
    },
    classSkills: [{ name: "阵地作成", rank: "A", summary: "可建造魔术阵地。" }],
    personalSkills: [{ name: "高速神言", rank: "A", summary: "无需咏唱发动大魔术。" }],
    noblePhantasms: [],
    spiritualCore: 100,
    mana: 100,
    spiritualCondition: "完好",
    contractStatus: "masterless",
    manaSupply: "starved",
    currentOrder: "自主行动——寻找魔力源维持现界",
  };
}

function createNoopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}
