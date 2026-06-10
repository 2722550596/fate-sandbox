import assert from "node:assert/strict";
import test from "node:test";

import type { FateParams, PublicActorState } from "../../engine/core/state";

import { cloneState, commitState, resetState } from "../../engine/core/state-store";
import { resolveCombatExchangeTool } from "./resolve-combat-exchange";

void test("resolveCombatExchangeTool returns player-safe constraints and state details", () => {
  resetState();
  insertActor(servantActor("saber", "Saber", params("B")));
  insertActor(servantActor("caster", "Caster", params("A")));

  const result = resolveCombatExchangeTool(
    {
      actorId: "saber",
      opponentId: "caster",
      intent: "护住御主从术式火线中撤出",
      tactic: "protect",
      actorParameter: "agility",
      opponentParameter: "mana",
      targetObjective: "护住御主撤离",
      committedResources: ["Saber 主动承受术式余波"],
      knownAdvantages: ["撤离目标明确"],
      knownDisadvantages: ["Caster 处于阵地内"],
      riskTolerance: "high",
    },
    createNoopSessionManager(),
  );

  const text = result.content[0]?.text ?? "";
  assert.match(text, /交锋裁决：/u);
  assert.match(text, /战场变数：/u);
  assert.match(text, /状态落点：/u);
  assert.match(text, /后果力度：/u);
  assert.match(text, /禁止输出 HP/u);
  assert.ok(result.details["fsn-state"] !== undefined);
});

function insertActor(actor: PublicActorState): void {
  const draft = cloneState();
  draft.public.actors[actor.id] = actor;
  commitState(draft);
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

function params(rank: FateParams["strength"]): FateParams {
  return {
    strength: rank,
    endurance: rank,
    agility: rank,
    mana: rank,
    luck: rank,
    noblePhantasm: rank,
  };
}

function createNoopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}
