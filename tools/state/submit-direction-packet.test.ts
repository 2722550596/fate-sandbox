import assert from "node:assert/strict";
import test from "node:test";

import { cloneState, commitState, resetState } from "../../engine/core/state-store.ts";
import { submitDirectionPacketTool } from "./submit-direction-packet.ts";
import { upsertActorTool } from "./upsert-actor.ts";

const RENDER_PACKET = {
  needsRender: true,
  playerAction: "下达探查指令",
  resolvedChanges: [
    "克劳斯 沿壁潜行探查地下室入口",
    "当前灵性消耗约 15%",
  ],
  npcStances: [
    {
      actorId: "mysterious_woman",
      stance: "倚墙而立，目光冷漠",
      wants: "保持距离观察",
      move: "缓缓跟上半步，手指藏在大衣口袋里",
      refusesToSay: "自己的身份和目的",
    },
  ],
  sensoryAnchors: ["湿润的霉味", "远处钟声"],
  endWindow: "玩家必须设法看清对方的真面目",
  eventWeight: "normal",
  canonFacts: [],
};

/**
 * 在 state 中创建 actor 并灌入 hidden pathway secret。
 * 两步：先 upsert-public-npc 创建 actor，再手动在 secrets 中写入秘密。
 */
function seedHiddenSecret(secretValue: string): void {
  resetState();
  // Step 1: create the actor
  upsertActorTool(
    {
      kind: "upsert-public-npc",
      npc: {
        id: "mysterious_woman",
        kind: "human",
        internalName: "神秘女子",
        publicIdentity: "穿着大衣的不明女性",
        apparentAge: "二十岁前后",
        outfit: { label: "大衣", details: "深棕色呢绒大衣，领口竖起。" },
        demeanor: "警惕而疏离",
        publicRoles: [],
        relationshipToProtagonist: { stance: "wary", summary: "敌友不明" },
        ordinaryItems: [],
      },
      reason: "测试种子 actor",
    },
    null,
  );
  const draft = cloneState();
  // Step 2: set present and seed the pathway secret
  draft.public.scene.presentActorIds = ["protagonist", "mysterious_woman"];
  draft.secrets.actorStates["mysterious_woman"] = {
    actorId: "mysterious_woman",
    secrets: {
      actorId: "mysterious_woman",
      pathwaySecret: {
        id: "pw-1",
        value: secretValue,
        revealState: "hidden",
        revealConditions: [],
      },
      privateMotives: [],
      unrevealedAffiliations: [],
    },
  };
  commitState(draft);
}

void test("submitDirectionPacketTool accepts a clean packet and terminates", () => {
  seedHiddenSecret("观众途径·序列6");
  const result = submitDirectionPacketTool(RENDER_PACKET);

  assert.equal(result.terminate, true);
  assert.match(result.content[0]?.text ?? "", /已接收并通过 secret 防火墙/);
  assert.ok(result.details["packet"]);
});

void test("submitDirectionPacketTool accepts a direct reply packet", () => {
  seedHiddenSecret("观众途径·序列6");
  const result = submitDirectionPacketTool({ needsRender: false, directReply: "OOC 解答。" });

  assert.equal(result.terminate, true);
  assert.match(result.content[0]?.text ?? "", /直答轮/);
});

void test("submitDirectionPacketTool blocks packets leaking unrevealed secrets", () => {
  seedHiddenSecret("观众途径·序列6");
  assert.throws(
    () =>
      submitDirectionPacketTool({
        ...RENDER_PACKET,
        canonFacts: ["神秘女子的真实身份是观众途径序列6非凡者"],
      }),
    /secret 防火墙拦截.*canonFacts\[0\]/u,
  );
});

void test("submitDirectionPacketTool rejects malformed packets", () => {
  seedHiddenSecret("观众途径·序列6");
  assert.throws(
    () => submitDirectionPacketTool({ needsRender: true, playerAction: "x" }),
    /resolvedChanges/,
  );
});

void test("submitDirectionPacketTool rejects a stance for a non-existent actor", () => {
  seedHiddenSecret("观众途径·序列6");
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
  seedHiddenSecret("观众途径·序列6");
  const draft = cloneState();
  draft.public.scene.presentActorIds = ["protagonist"];
  commitState(draft);
  assert.throws(
    () => submitDirectionPacketTool(RENDER_PACKET),
    /指向不在场的 actor：mysterious_woman/u,
  );
});

void test("submitDirectionPacketTool requires important present NPCs to be covered", () => {
  seedHiddenSecret("观众途径·序列6");
  const draft = cloneState();
  // agenda → becomes important, must be covered by stance or omission
  const actorForCoverage = draft.secrets.actorStates["mysterious_woman"];
  assert.ok(actorForCoverage);
  actorForCoverage.agenda = {
    actorId: "mysterious_woman",
    goal: "监视周围动向",
    fear: "身份暴露",
    currentOrder: null,
    lastIndependentActionAt: null,
  };
  commitState(draft);
  assert.throws(
    () => submitDirectionPacketTool({ ...RENDER_PACKET, npcStances: [] }),
    /重要在场 NPC 未被覆盖：mysterious_woman/u,
  );
});

void test("submitDirectionPacketTool accepts an important NPC covered by an omission", () => {
  seedHiddenSecret("观众途径·序列6");
  const draft = cloneState();
  const actorForOmission = draft.secrets.actorStates["mysterious_woman"];
  assert.ok(actorForOmission);
  actorForOmission.agenda = {
    actorId: "mysterious_woman",
    goal: "监视周围动向",
    fear: "身份暴露",
    currentOrder: null,
    lastIndependentActionAt: null,
  };
  commitState(draft);
  const result = submitDirectionPacketTool({
    ...RENDER_PACKET,
    npcStances: [],
    npcOmissions: [
      {
        actorId: "mysterious_woman",
        reasonCode: "watching-silently",
        playerSafeNote: "倚在角落里没动，只是目光一直落在主角身上",
      },
    ],
  });
  assert.equal(result.terminate, true);
});

void test("submitDirectionPacketTool rejects an actor in both stance and omission", () => {
  seedHiddenSecret("观众途径·序列6");
  assert.throws(
    () =>
      submitDirectionPacketTool({
        ...RENDER_PACKET,
        npcOmissions: [
          {
            actorId: "mysterious_woman",
            reasonCode: "watching-silently",
            playerSafeNote: "旁观",
          },
        ],
      }),
    /同时出现在 npcStances 和 npcOmissions：mysterious_woman/u,
  );
});

void test("submitDirectionPacketTool runs the secret firewall over omission notes", () => {
  seedHiddenSecret("观众途径·序列6");
  assert.throws(
    () =>
      submitDirectionPacketTool({
        ...RENDER_PACKET,
        npcStances: [],
        npcOmissions: [
          {
            actorId: "mysterious_woman",
            reasonCode: "watching-silently",
            playerSafeNote: "观众途径序列6静静打量着主角",
          },
        ],
      }),
    /secret 防火墙拦截.*npcOmissions\[0\]\.playerSafeNote/u,
  );
});