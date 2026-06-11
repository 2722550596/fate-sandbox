import type { FateParams, NoblePhantasm, PublicActorState, State } from "./state.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { parseCombatExchangeInput } from "./combat-exchange-schema.ts";
import { resolveCombatExchange } from "./combat-exchange.ts";
import { createInitialState } from "./state-store.ts";

void test("resolveCombatExchange gives a superior servant local advantage without HP math", () => {
  const draft = createInitialState();
  insertActor(draft, servantActor("saber", "Saber", strongParams()));
  insertActor(draft, servantActor("rider", "Rider", weakParams()));

  const result = resolveCombatExchange(draft, {
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

void test("resolveCombatExchange uses concrete noble phantasm rank for true-name releases", () => {
  const draft = createInitialState();
  insertActor(
    draft,
    servantActor("saber", "Saber", weakParams(), [
      {
        name: "无垢识·空之境界 (Mukushiki Kara no Kyoukai)",
        rank: "EX",
        kind: "对人宝具",
        status: "revealed",
        summary: "切断对象死线的真名解放。",
      },
    ]),
  );
  insertActor(
    draft,
    servantActor("rider", "Rider", { ...strongParams(), noblePhantasm: "A+" }, [
      {
        name: "黄金鹿与暴风夜 (Golden Wild Hunt)",
        rank: "A+",
        kind: "对军宝具",
        status: "revealed",
        summary: "舰队级炮火压制。",
      },
    ]),
  );

  const result = resolveCombatExchange(draft, {
    actorId: "saber",
    opponentId: "rider",
    intent: "真名解放，以无垢识·空之境界切开 Rider 的舰队级炮火",
    tactic: "noble-phantasm",
    actorParameter: "noblePhantasm",
    opponentParameter: "noblePhantasm",
    targetObjective: "切开 Rider 的舰队级炮火",
    committedResources: ["真名解放「无垢识·空之境界」"],
    knownAdvantages: [],
    knownDisadvantages: [],
    riskTolerance: "high",
  });

  assert.match(result.rankCheck, /无垢识·空之境界.*EX/u);
  assert.doesNotMatch(result.rankCheck, /Saber\/Saber\.noblePhantasm C/u);
});

void test("resolveCombatExchange requires explicit public noble phantasm names for multi-NP releases", () => {
  const draft = createInitialState();
  insertActor(
    draft,
    servantActor("saber", "Saber", weakParams(), [
      {
        name: "第一宝具",
        rank: "EX",
        kind: "对界宝具",
        status: "revealed",
        summary: "测试用高阶宝具。",
      },
      {
        name: "第二宝具",
        rank: "B",
        kind: "对人宝具",
        status: "revealed",
        summary: "测试用指定宝具。",
      },
    ]),
  );
  insertActor(
    draft,
    servantActor("rider", "Rider", { ...strongParams(), noblePhantasm: "A+" }, [
      {
        name: "黄金鹿与暴风夜 (Golden Wild Hunt)",
        rank: "A+",
        kind: "对军宝具",
        status: "revealed",
        summary: "舰队级炮火压制。",
      },
    ]),
  );

  const input = {
    actorId: "saber",
    opponentId: "rider",
    intent: "指定第二宝具切开 Rider 的舰队级炮火",
    tactic: "noble-phantasm" as const,
    actorParameter: "noblePhantasm" as const,
    opponentParameter: "noblePhantasm" as const,
    committedResources: ["真名解放"],
    knownAdvantages: [],
    knownDisadvantages: [],
    riskTolerance: "high" as const,
  };

  assert.throws(() => resolveCombatExchange(draft, input), /actorNoblePhantasmName/u);

  const result = resolveCombatExchange(draft, { ...input, actorNoblePhantasmName: "第二宝具" });

  assert.match(result.rankCheck, /第二宝具.*B/u);
  assert.doesNotMatch(result.rankCheck, /第一宝具.*EX/u);
});

void test("resolveCombatExchange blocks clean wins under servant-scale suppression", () => {
  const draft = createInitialState();
  insertActor(draft, servantActor("saber", "Saber", weakParams()));
  insertActor(draft, servantActor("berserker", "Berserker", strongParams()));

  const result = resolveCombatExchange(draft, {
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
  const draft = createInitialState();
  insertActor(draft, servantActor("saber", "Saber", weakParams()));
  insertActor(draft, servantActor("rider", "Rider", strongParams()));

  const result = resolveCombatExchange(draft, {
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

void test("resolveCombatExchange lets battle swing soften rank suppression into a local exchange", () => {
  const draft = createInitialState();
  insertActor(draft, servantActor("saber", "Saber", weakParams()));
  insertActor(draft, servantActor("rider", "Rider", strongParams()));

  const baseInput = {
    actorId: "saber",
    opponentId: "rider",
    intent: "冒险切入 Rider 的压制火线，争取一个局部身位",
    tactic: "direct-attack" as const,
    actorParameter: "agility" as const,
    opponentParameter: "agility" as const,
    committedResources: ["放弃后撤强行切入"],
    knownAdvantages: ["目标只是争取局部身位，不是击败 Rider"],
    knownDisadvantages: [],
    riskTolerance: "medium" as const,
  };

  const neutral = resolveCombatExchange(draft, { ...baseInput, swing: "neutral" });
  const turnabout = resolveCombatExchange(draft, { ...baseInput, swing: "turnabout" });

  assert.equal(neutral.outcome, "forced-defense");
  assert.equal(turnabout.outcome, "exchange");
  assert.match(turnabout.consequenceGuidance.join("\n"), /局部窗口/u);
});

void test("resolveCombatExchange does not force wounds or hard stops for costly NP advantage", () => {
  const draft = createInitialState();
  insertActor(
    draft,
    servantActor("saber", "Saber", weakParams(), [
      {
        name: "无垢识·空之境界 (Mukushiki Kara no Kyoukai)",
        rank: "EX",
        kind: "对人宝具",
        status: "revealed",
        summary: "切断对象死线的真名解放。",
      },
    ]),
  );
  insertActor(
    draft,
    servantActor("rider", "Rider", { ...strongParams(), noblePhantasm: "A+" }, [
      {
        name: "黄金鹿与暴风夜 (Golden Wild Hunt)",
        rank: "A+",
        kind: "对军宝具",
        status: "revealed",
        summary: "舰队级炮火压制。",
      },
    ]),
  );

  const result = resolveCombatExchange(draft, {
    actorId: "saber",
    opponentId: "rider",
    intent: "真名解放，以无垢识·空之境界切开 Rider 的舰队级炮火",
    tactic: "noble-phantasm",
    actorParameter: "noblePhantasm",
    opponentParameter: "noblePhantasm",
    committedResources: ["真名解放「无垢识·空之境界」"],
    knownAdvantages: [],
    knownDisadvantages: [],
    riskTolerance: "high",
  });

  assert.equal(result.outcome, "advantage-with-cost");
  assert.ok(
    result.stateLandings.some((landing) => landing.kind === "servant-form" && landing.required),
  );
  assert.ok(
    result.stateLandings.every(
      (landing) => landing.kind !== "actor-condition" || !landing.required,
    ),
  );
  assert.doesNotMatch(result.nextActionWindow, /停在/u);
});

void test("parseCombatExchangeInput rejects model-authored difficulty language", () => {
  assert.throws(
    () =>
      parseCombatExchangeInput(
        {
          actorId: "saber",
          opponentId: "rider",
          intent: "攻击",
          tactic: "困难",
          actorParameter: "strength",
          opponentParameter: "endurance",
          riskTolerance: "medium",
        },
        "resolve_combat_exchange 参数",
      ),
    /tactic 必须是允许值之一: direct-attack/u,
  );
});

function insertActor(draft: State, actor: PublicActorState): void {
  draft.public.actors[actor.id] = actor;
}

function servantActor(
  id: string,
  displayName: string,
  parameters: FateParams,
  noblePhantasms: NoblePhantasm[] = [],
): PublicActorState {
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
      noblePhantasms,
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
