import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { ToolResult } from "../runtime/tool-result.ts";
import type { CombatParams } from "../../engine/core/combat.ts";

import { resolveCombatAction } from "../../engine/core/combat.ts";
import { textResult } from "../runtime/tool-result.ts";
import { cloneState, commitState } from "../../engine/core/state-store.ts";
import { persistStateAfterCommit } from "../../engine/core/state-persistence.ts";

export function resolveCombatTool(params: unknown, sessionManager: unknown): ToolResult {
  const combatParams = parseCombatParams(params);
  const draft = cloneState();
  const result = resolveCombatAction(combatParams);

  // 战斗结果写入 state（当前只记录事件，属性变化由 GM 另行调 update_actor_condition）
  commitState(draft);
  persistStateAfterCommit(sessionManager, { result });
  return textResult(result.details, {
    result: {
      attackRoll: result.attackRoll,
      defenseRoll: result.defenseRoll,
      attackSuccess: result.attackSuccess,
      damage: result.damage,
      targetAttribute: result.targetAttribute,
    },
  });
}

interface ParsedCombatant {
  sequenceRank: string;
  vitality: number;
  currentVitality: number;
  spirituality: number;
  currentSpirituality: number;
  reason: number;
  currentReason: number;
  humanity: number;
  currentHumanity: number;
  agility: number;
  currentAgility: number;
  luck: number;
  divinity: number;
}

function parseCombatParams(params: unknown): CombatParams {
  const raw = params as Record<string, unknown>;
  const attacker = parseCombatant(raw.attacker);
  const defender = parseCombatant(raw.defender);
  const skillPower = typeof raw.skillPower === "number" ? raw.skillPower : 1;
  const damageType = typeof raw.damageType === "string" ? raw.damageType : "physical";

  const allowedDamageTypes = ["physical", "mystical", "mental", "mixed"];
  const normalizedDamageType = allowedDamageTypes.includes(damageType) ? damageType : "physical";

  return {
    attacker: {
      sequenceRank: attacker.sequenceRank as CombatParams["attacker"]["sequenceRank"],
      stats: {
        vitality: attacker.vitality,
        currentVitality: attacker.currentVitality,
        spirituality: attacker.spirituality,
        currentSpirituality: attacker.currentSpirituality,
        reason: attacker.reason,
        currentReason: attacker.currentReason,
        humanity: attacker.humanity,
        currentHumanity: attacker.currentHumanity,
        agility: attacker.agility,
        currentAgility: attacker.currentAgility,
        luck: attacker.luck,
      },
      divinity: attacker.divinity,
    },
    defender: {
      sequenceRank: defender.sequenceRank as CombatParams["defender"]["sequenceRank"],
      stats: {
        vitality: defender.vitality,
        currentVitality: defender.currentVitality,
        spirituality: defender.spirituality,
        currentSpirituality: defender.currentSpirituality,
        reason: defender.reason,
        currentReason: defender.currentReason,
        humanity: defender.humanity,
        currentHumanity: defender.currentHumanity,
        agility: defender.agility,
        currentAgility: defender.currentAgility,
        luck: defender.luck,
      },
      divinity: defender.divinity,
    },
    skillPower,
    damageType: normalizedDamageType as CombatParams["damageType"],
  };
}

function parseCombatant(raw: unknown): ParsedCombatant {
  const obj = (raw as Record<string, unknown>) ?? {};
  return {
    sequenceRank: typeof obj.sequenceRank === "string" ? obj.sequenceRank : "ordinary",
    vitality: typeof obj.vitality === "number" ? obj.vitality : 50,
    currentVitality: typeof obj.currentVitality === "number" ? obj.currentVitality : 50,
    spirituality: typeof obj.spirituality === "number" ? obj.spirituality : 50,
    currentSpirituality: typeof obj.currentSpirituality === "number" ? obj.currentSpirituality : 50,
    reason: typeof obj.reason === "number" ? obj.reason : 50,
    currentReason: typeof obj.currentReason === "number" ? obj.currentReason : 50,
    humanity: typeof obj.humanity === "number" ? obj.humanity : 50,
    currentHumanity: typeof obj.currentHumanity === "number" ? obj.currentHumanity : 50,
    agility: typeof obj.agility === "number" ? obj.agility : 50,
    currentAgility: typeof obj.currentAgility === "number" ? obj.currentAgility : 50,
    luck: typeof obj.luck === "number" ? obj.luck : 10,
    divinity: typeof obj.divinity === "number" ? obj.divinity : 0,
  };
}

export const resolveCombatToolDefinition: FateToolDefinition = {
  name: "resolve_combat",
  description:
    "执行一次 LOTM 战斗对抗结算。基于攻防双方属性快照 + 技能强度 + 伤害类型计算胜负与伤害。\n\n" +
    "使用边界：战斗轮次的对抗判定；提供双方 CombatantSnapshot（序列等级、六维当前值、神性）。\n" +
    "禁区：非战斗场景的判定走 roll_dice 或 perform_judgment；伤害结果需另行调用 update_actor_condition 持久化到 actor 属性。",
  parameters: Type.Object({
    attacker: Type.Object({
      sequenceRank: Type.String({
        description: "序列等级: ordinary / seq-9 / seq-8 / seq-7 / seq-6 / seq-5 / seq-4 / seq-3 / seq-2 / seq-1 / seq-0 / old-one / pillar",
      }),
      vitality: Type.Number({ description: "活力上限" }),
      currentVitality: Type.Number({ description: "当前活力值" }),
      spirituality: Type.Number({ description: "灵性上限" }),
      currentSpirituality: Type.Number({ description: "当前灵性值" }),
      reason: Type.Number({ description: "理智上限" }),
      currentReason: Type.Number({ description: "当前理智值" }),
      humanity: Type.Number({ description: "人性上限" }),
      currentHumanity: Type.Number({ description: "当前人性值" }),
      agility: Type.Number({ description: "敏捷上限" }),
      currentAgility: Type.Number({ description: "当前敏捷值" }),
      luck: Type.Number({ description: "运气值" }),
      divinity: Type.Number({ description: "神性值（默认 0）" }),
    }),
    defender: Type.Object({
      sequenceRank: Type.String({
        description: "序列等级: ordinary / seq-9 / seq-8 / seq-7 / seq-6 / seq-5 / seq-4 / seq-3 / seq-2 / seq-1 / seq-0 / old-one / pillar",
      }),
      vitality: Type.Number({ description: "活力上限" }),
      currentVitality: Type.Number({ description: "当前活力值" }),
      spirituality: Type.Number({ description: "灵性上限" }),
      currentSpirituality: Type.Number({ description: "当前灵性值" }),
      reason: Type.Number({ description: "理智上限" }),
      currentReason: Type.Number({ description: "当前理智值" }),
      humanity: Type.Number({ description: "人性上限" }),
      currentHumanity: Type.Number({ description: "当前人性值" }),
      agility: Type.Number({ description: "敏捷上限" }),
      currentAgility: Type.Number({ description: "当前敏捷值" }),
      luck: Type.Number({ description: "运气值" }),
      divinity: Type.Number({ description: "神性值（默认 0）" }),
    }),
    skillPower: Type.Number({ description: "技能强度倍率（默认 1.0）" }),
    damageType: Type.String({
      description: "伤害类型: physical / mystical / mental / mixed（默认 physical）",
    }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    resolveCombatTool(params, ctx.sessionManager),
};