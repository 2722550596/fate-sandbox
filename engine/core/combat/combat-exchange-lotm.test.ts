import type { LOTMCombatExchangeInput } from "./combat-exchange-lotm.ts";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import { resolveLOTMCombatExchange } from "./combat-exchange-lotm.ts";

function makeInput(
  overrides: Partial<LOTMCombatExchangeInput> & {
    actorRank: LOTMCombatExchangeInput["actorRank"];
    opponentRank: LOTMCombatExchangeInput["opponentRank"];
  },
): LOTMCombatExchangeInput {
  return {
    actorId: "protagonist",
    opponentId: "opponent",
    intent: "攻击",
    tactic: "direct-attack",
    committedResources: [],
    knownAdvantages: [],
    knownDisadvantages: [],
    riskTolerance: "medium",
    ...overrides,
  };
}

// ===========================================================================
// 常规战斗裁决
// ===========================================================================

void describe("resolveLOTMCombatExchange", () => {
  void test("同级中等风险 → exchange", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-9",
        opponentRank: "seq-9",
      }),
    );
    assert.equal(result.outcome, "exchange");
  });

  void test("actor 高半级 → advantage-with-cost", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-8",
        opponentRank: "seq-9",
      }),
    );
    assert.equal(result.outcome, "advantage-with-cost");
  });

  void test("actor 跨层压制 → clean-advantage", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-7",
        opponentRank: "seq-8",
      }),
    );
    assert.equal(result.outcome, "clean-advantage");
  });

  void test("actor 低半级 → exchange", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-9",
        opponentRank: "seq-8",
      }),
    );
    assert.equal(result.outcome, "exchange");
  });

  void test("actor 过低 → overwhelmed", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-9",
        opponentRank: "seq-6",
      }),
    );
    assert.equal(result.outcome, "overwhelmed");
  });
});

// ===========================================================================
// 秒杀（off-scale）
// ===========================================================================

void describe("off-scale 秒杀", () => {
  void test("actor 碾压对方 → narrative 含逃跑约束", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-0",
        opponentRank: "seq-9",
      }),
    );
    assert.equal(result.outcome, "clean-advantage");
    assert.ok(
      result.narrativeConstraints.some((c) => c.includes("逃跑")),
      "off-scale 叙事约束应含「逃跑」",
    );
    assert.ok(
      result.narrativeConstraints.some((c) => c.includes("秒杀")),
      "off-scale 叙事约束应含「秒杀」",
    );
  });

  void test("actor 被碾压 → forbidden 含不可正面抵抗", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-9",
        opponentRank: "seq-0",
      }),
    );
    assert.ok(
      result.forbiddenNarration.some((c) => c.includes("逃跑")),
      "off-scale forbidden 应含「逃跑」",
    );
    assert.ok(
      result.forbiddenNarration.some((c) => c.includes("正面对抗")),
      "off-scale forbidden 应禁止正面对抗",
    );
  });

  void test("off-scale 状态落点不含强制代价", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-0",
        opponentRank: "seq-9",
      }),
    );
    const costLandings = result.stateLandings.filter(
      (l) => l.kind === "actor-condition" && l.required,
    );
    assert.equal(costLandings.length, 0, "off-scale 不应有强制代价落点");
  });
});

// ===========================================================================
// 装备加成
// ===========================================================================

void describe("装备加成", () => {
  void test("装备等级可扳平半级差距", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-9",
        opponentRank: "seq-8",
        actorEquipmentRank: "seq-8",
      }),
    );
    // delta base = -0.5, equip = +0.5 (has seq-8 equip vs none), combined = 0 → exchange
    assert.equal(result.outcome, "exchange");
  });

  void test("同层装备优势 → advantage-with-cost", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-9",
        opponentRank: "seq-9",
        actorEquipmentRank: "seq-8",
      }),
    );
    // delta base = 0, equip = +0.5 (has seq-8 equip vs none), combined = 0.5 → advantage-with-cost
    assert.equal(result.outcome, "advantage-with-cost");
  });
});

// ===========================================================================
// 策略影响状态落点
// ===========================================================================

void describe("use-ability 策略", () => {
  void test("use-ability 含 equipment 和 memory 落点", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-8",
        opponentRank: "seq-9",
        tactic: "use-ability",
      }),
    );
    const kinds = result.stateLandings.map((l) => l.kind);
    assert.ok(kinds.includes("equipment"), "use-ability 应含 equipment");
    assert.ok(kinds.includes("memory"), "use-ability 应含 memory");
  });
});

// ===========================================================================
// 风险容忍度
// ===========================================================================

void describe("风险容忍度", () => {
  void test("高风险 + 跨层 → advantage-with-cost", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-7",
        opponentRank: "seq-8",
        riskTolerance: "desperate",
      }),
    );
    // delta=3 ≥ 2, riskTolerance=desperate → advantage-with-cost
    assert.equal(result.outcome, "advantage-with-cost");
  });

  void test("低风险 + 跨层 → clean-advantage", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-7",
        opponentRank: "seq-8",
        riskTolerance: "low",
      }),
    );
    // delta=3 ≥ 2, riskTolerance=low → clean-advantage
    assert.equal(result.outcome, "clean-advantage");
  });
});

// ===========================================================================
// 综合 rankCheck 输出
// ===========================================================================

void describe("rankCheck 输出", () => {
  void test("rankCheck 包含双方等级", () => {
    const result = resolveLOTMCombatExchange(
      createInitialState(),
      makeInput({
        actorRank: "seq-5",
        opponentRank: "seq-9",
      }),
    );
    assert.ok(result.rankCheck.includes("seq-5"));
    assert.ok(result.rankCheck.includes("seq-9"));
  });
});
