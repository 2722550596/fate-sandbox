import type { FateParams, PublicActorState } from "./state";

import assert from "node:assert/strict";
import test from "node:test";

import { assertCombatExchangeInput, resolveCombatExchange } from "./combat-exchange";
import { resetState, updateState } from "./state";

void test("resolveCombatExchange gives a superior servant local advantage without HP math", () => {
  resetState();
  insertActor(servantActor("saber", "Saber", strongParams()));
  insertActor(servantActor("rider", "Rider", weakParams()));

  const result = resolveCombatExchange({
    actorId: "saber",
    opponentId: "rider",
    intent: "正面逼退 Rider，为御主创造撤离窗口",
    tactic: "direct-attack",
    actorParameter: "agility",
    opponentParameter: "agility",
    targetObjective: "护住御主撤离",
    committedResources: [],
    knownAdvantages: ["Saber 已经贴近到刀剑距离"],
    knownDisadvantages: [],
    riskTolerance: "medium",
  });

  assert.equal(result.outcome, "clean-advantage");
  assert.match(result.rankCheck, /两级以上参数压制/u);
  assert.match(result.forbiddenNarration.join("\n"), /禁止输出 HP/u);
});

void test("resolveCombatExchange blocks clean wins under servant-scale suppression", () => {
  resetState();
  insertActor(servantActor("saber", "Saber", weakParams()));
  insertActor(servantActor("berserker", "Berserker", strongParams()));

  const result = resolveCombatExchange({
    actorId: "saber",
    opponentId: "berserker",
    intent: "无资源投入地正面斩开 Berserker 的压制",
    tactic: "direct-attack",
    actorParameter: "strength",
    opponentParameter: "endurance",
    committedResources: [],
    knownAdvantages: [],
    knownDisadvantages: ["对方体格压制", "己方没有真名情报"],
    riskTolerance: "medium",
  });

  assert.equal(result.outcome, "overwhelmed");
  assert.match(result.forbiddenNarration.join("\n"), /正面反杀/u);
  assert.match(result.nextActionWindow, /撤退|地形相性/u);
});

void test("resolveCombatExchange lets resources turn a bad matchup into a costly contested exchange", () => {
  resetState();
  insertActor(servantActor("saber", "Saber", weakParams()));
  insertActor(servantActor("rider", "Rider", strongParams()));

  const result = resolveCombatExchange({
    actorId: "saber",
    opponentId: "rider",
    intent: "斩断拘束术式而不是直接击败 Rider",
    tactic: "break-restraint",
    actorParameter: "agility",
    opponentParameter: "mana",
    targetObjective: "打断束缚并创造出手机会",
    committedResources: ["御主 Code Cast 支援", "Saber 放弃闪避承受火线压力"],
    knownAdvantages: ["目标是术式拘束点，不是 Rider 本体", "拘束术式已经被终端接触到"],
    knownDisadvantages: ["舰炮火力正在压制场地"],
    riskTolerance: "high",
  });

  assert.equal(result.outcome, "exchange");
  assert.ok(result.stateLandings.some((landing) => landing.kind === "actor-condition"));
  assert.ok(result.stateLandings.some((landing) => landing.kind === "servant-form"));
});

void test("assertCombatExchangeInput rejects model-authored difficulty language", () => {
  assert.throws(
    () =>
      assertCombatExchangeInput({
        actorId: "saber",
        opponentId: "rider",
        intent: "攻击",
        tactic: "困难",
        actorParameter: "strength",
        opponentParameter: "endurance",
        riskTolerance: "medium",
      }),
    /非法 tactic/u,
  );
});

function insertActor(actor: PublicActorState): void {
  updateState((draft) => {
    draft.public.actors[actor.id] = actor;
  });
}

function servantActor(id: string, displayName: string, parameters: FateParams): PublicActorState {
  return {
    id,
    kind: "spirit",
    origin: "测试英灵",
    roles: [],
    magecraft: null,
    servantForm: {
      identity: {
        className: "Saber",
        trueName: { status: "hidden", display: "Saber" },
        locked: true,
      },
      condition: {
        spiritualCore: { value: 100 },
        mana: { value: 100 },
        spiritualCondition: "完好",
        permanentDefects: [],
      },
      contract: {
        masterActorId: null,
        masterName: null,
        status: "masterless",
        manaSupply: "sufficient",
      },
      parameters: { base: parameters, modifiers: [], baseLocked: true },
      skills: { classSkills: [], personalSkills: [] },
      noblePhantasms: [],
      currentOrder: "测试交锋",
    },
    identity: { publicIdentity: displayName, background: "测试 actor", lockedFacts: [] },
    presentation: {
      displayName,
      apparentAge: "未知",
      outfit: { label: "测试服装", details: "测试用。" },
      demeanor: "测试状态",
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: [], heldTrackedItemIds: [] },
    abilities: [],
    relationshipToProtagonist: { stance: "neutral", summary: "测试关系。" },
  };
}

function strongParams(): FateParams {
  return {
    strength: "A",
    endurance: "A",
    agility: "A",
    mana: "A",
    luck: "B",
    noblePhantasm: "A",
  };
}

function weakParams(): FateParams {
  return {
    strength: "C",
    endurance: "C",
    agility: "C",
    mana: "C",
    luck: "D",
    noblePhantasm: "C",
  };
}
