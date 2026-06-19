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
      kind: "upsert-servant",
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
  draft.secrets.actorSecrets["saber_shiki"] = {
    actorId: "saber_shiki",
    trueName: { id: "tn-1", value: trueName, revealState: "hidden", revealConditions: [] },
    hiddenNoblePhantasms: [],
    privateMotives: [],
    unrevealedAffiliations: [],
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
