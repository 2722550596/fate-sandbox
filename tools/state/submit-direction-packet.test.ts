import assert from "node:assert/strict";
import test from "node:test";

import { cloneState, commitState, resetState } from "../../engine/core/state-store.ts";
import { submitDirectionPacketTool } from "./submit-direction-packet.ts";
import { upsertActorTool } from "./upsert-actor.ts";

const RENDER_PACKET = {
  needsRender: true,
  playerAction: "下达突进指令",
  resolvedChanges: ["Saber 突进受阻，转为阵地防守", "消耗一成魔力"],
  npcStances: [
    {
      actorId: "saber_shiki",
      stance: "平静但手腕绷紧",
      wants: "护住御主",
      move: "上前半步拦在御主身前，冷声要对方报上来意",
      refusesToSay: "自己还藏着底牌",
    },
  ],
  sensoryAnchors: ["灼热气浪"],
  endWindow: "玩家必须创造让 Saber 近身的破绽",
  eventWeight: "normal",
  canonFacts: [],
};

function seedHiddenTrueName(trueName: string): void {
  resetState();
  upsertActorTool(
    {
      kind: "upsert-sequence",
      servant: {
        id: "saber_shiki",
        internalName: "Saber",
        publicIdentity: "和服装束的女性剑士",
        apparentAge: "二十岁前后",
        outfit: { label: "和服", details: "白色和服配皮夹克。" },
        demeanor: "態懒",
        className: "Saber",
        trueNameDisplay: "Saber",
        trueNameStatus: "hidden",
        parameters: {
          strength: "C",
          endurance: "C",
          agility: "A",
          mana: "C",
          luck: "B",
          noblePhantasm: "EX",
        },
        classSkills: [{ name: "对魔力", rank: "C", summary: "无效化低阶魔术。" }],
        personalSkills: [{ name: "直死之魔眼", rank: "EX", summary: "看见死之线。" }],
        noblePhantasms: [],
        spiritualCore: 100,
        mana: 100,
        spiritualCondition: "完好",
        contractStatus: "masterless",
        manaSupply: "starved",
        currentOrder: "随行护卫御主",
      },
      reason: "测试种子 actor",
    },
    null,
  );
  const draft = cloneState();
  // stance 引用 saber_shiki：它必须在场才能通过 direction packet 语义校验。
  draft.public.scene.presentActorIds = ["protagonist", "saber_shiki"];
  draft.secrets.actorStates["saber_shiki"] = {
    actorId: "saber_shiki",
    secrets: {
      actorId: "saber_shiki",
      pathwaySecret: { id: "tn-1", value: trueName, revealState: "hidden", revealConditions: [] },
      privateMotives: [],
      unrevealedAffiliations: [],
    },
  };
  commitState(draft);
}

void test("submitDirectionPacketTool accepts a clean packet and terminates", () => {
  seedHiddenTrueName("两仪式");
  const result = submitDirectionPacketTool(RENDER_PACKET);

  assert.equal(result.terminate, true);
  assert.match(result.content[0]?.text ?? "", /已接收并通过 secret 防火墙/);
  assert.ok(result.details["packet"]);
});

void test("submitDirectionPacketTool accepts a direct reply packet", () => {
  seedHiddenTrueName("两仪式");
  const result = submitDirectionPacketTool({ needsRender: false, directReply: "OOC 解答。" });

  assert.equal(result.terminate, true);
  assert.match(result.content[0]?.text ?? "", /直答轮/);
});

void test("submitDirectionPacketTool blocks packets leaking unrevealed secrets", () => {
  seedHiddenTrueName("两仪式");
  assert.throws(
    () =>
      submitDirectionPacketTool({
        ...RENDER_PACKET,
        canonFacts: ["Saber 的真名是两仪式"],
      }),
    /secret 防火墙拦截.*canonFacts\[0\]/u,
  );
});

void test("submitDirectionPacketTool rejects malformed packets", () => {
  seedHiddenTrueName("两仪式");
  assert.throws(
    () => submitDirectionPacketTool({ needsRender: true, playerAction: "x" }),
    /resolvedChanges/,
  );
});

void test("submitDirectionPacketTool rejects a stance for a non-existent actor", () => {
  seedHiddenTrueName("两仪式");
  assert.throws(
    () =>
      submitDirectionPacketTool({
        ...RENDER_PACKET,
        npcStances: [{ ...RENDER_PACKET.npcStances[0], actorId: "ghost_unknown" }],
      }),
    /指向不存在的 actor：ghost_unknown/u,
  );
});

void test("submitDirectionPacketTool rejects a stance for an off-scene actor", () => {
  seedHiddenTrueName("两仪式");
  const draft = cloneState();
  draft.public.scene.presentActorIds = ["protagonist"];
  commitState(draft);
  assert.throws(
    () => submitDirectionPacketTool(RENDER_PACKET),
    /指向不在场的 actor：saber_shiki/u,
  );
});

void test("submitDirectionPacketTool requires important present NPCs to be covered", () => {
  seedHiddenTrueName("两仪式");
  const draft = cloneState();
  // 给 saber 加 agenda → 成为重要在场 NPC，必须被 stance 或 omission 覆盖。
  const saberForCoverage = draft.secrets.actorStates["saber_shiki"];
  assert.ok(saberForCoverage);
  saberForCoverage.agenda = {
    actorId: "saber_shiki",
    goal: "护住御主",
    fear: "御主死亡",
    currentOrder: null,
    lastIndependentActionAt: null,
  };
  commitState(draft);
  assert.throws(
    () => submitDirectionPacketTool({ ...RENDER_PACKET, npcStances: [] }),
    /重要在场 NPC 未被覆盖：saber_shiki/u,
  );
});

void test("submitDirectionPacketTool accepts an important NPC covered by an omission", () => {
  seedHiddenTrueName("两仪式");
  const draft = cloneState();
  const saberForOmission = draft.secrets.actorStates["saber_shiki"];
  assert.ok(saberForOmission);
  saberForOmission.agenda = {
    actorId: "saber_shiki",
    goal: "护住御主",
    fear: "御主死亡",
    currentOrder: null,
    lastIndependentActionAt: null,
  };
  commitState(draft);
  const result = submitDirectionPacketTool({
    ...RENDER_PACKET,
    npcStances: [],
    npcOmissions: [
      {
        actorId: "saber_shiki",
        reasonCode: "watching-silently",
        playerSafeNote: "站在半步之外冷眼旁观，未出手",
      },
    ],
  });
  assert.equal(result.terminate, true);
});

void test("submitDirectionPacketTool rejects an actor in both stance and omission", () => {
  seedHiddenTrueName("两仪式");
  assert.throws(
    () =>
      submitDirectionPacketTool({
        ...RENDER_PACKET,
        npcOmissions: [
          {
            actorId: "saber_shiki",
            reasonCode: "watching-silently",
            playerSafeNote: "旁观",
          },
        ],
      }),
    /同时出现在 npcStances 和 npcOmissions：saber_shiki/u,
  );
});

void test("submitDirectionPacketTool runs the secret firewall over omission notes", () => {
  seedHiddenTrueName("两仪式");
  assert.throws(
    () =>
      submitDirectionPacketTool({
        ...RENDER_PACKET,
        npcStances: [],
        npcOmissions: [
          {
            actorId: "saber_shiki",
            reasonCode: "watching-silently",
            playerSafeNote: "两仪式静静旁观",
          },
        ],
      }),
    /secret 防火墙拦截.*npcOmissions\[0\]\.playerSafeNote/u,
  );
});
