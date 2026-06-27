import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { ToolResult } from "../runtime/tool-result.ts";
import type { CombatActionInput } from "../../core/combat.ts";

import { executeCombatAction } from "../../core/combat.ts";
import { textResult } from "../runtime/tool-result.ts";
import { cloneState, commitState } from "../../core/state/state-store.ts";
import { persistStateAfterCommit } from "../../core/state/state-persistence.ts";

export function resolveCombatTool(params: unknown, sessionManager: unknown): ToolResult {
  const input = parseCombatInput(params);
  const draft = cloneState();
  const result = executeCombatAction(input);

  commitState(draft);
  persistStateAfterCommit(sessionManager, { result });
  return textResult(result.details, {
    result: {
      canAfford: result.canAfford,
      damage: result.damage,
      targetAttribute: result.targetAttribute,
      effectCount: result.appliedEffects.length,
    },
  });
}

interface ParsedCombatant {
  id: string;
  name: string;
  sequenceRank: string;
  vitality: number;
  agility: number;
  spirituality: number;
  sanity: number;
  humanity: number;
  luck: number;
  divinity: number;
  tags: { name: string; duration: number; stacks: number }[];
  effects: {
    name: string;
    type: string;
    stat: string | null;
    valueType: string;
    power: number;
    duration: number;
    priority: number;
  }[];
}

function parseCombatInput(params: unknown): CombatActionInput {
  const raw = params as Record<string, unknown>;
  const attacker = parseCombatant(raw.attacker, "attacker");
  const defender = parseCombatant(raw.defender, "defender");
  const skill = raw.skill as Record<string, unknown>;
  const tagDamageRelations = raw.tagDamageRelations as Record<string, Record<string, number>> | undefined;

  const makeSnapshot = (p: ParsedCombatant): CombatActionInput["attacker"] => ({
    id: p.id,
    name: p.name,
    sequenceRank: p.sequenceRank as CombatActionInput["attacker"]["sequenceRank"],
    divinity: p.divinity,
    stats: {
      vitality: p.vitality,
      agility: p.agility,
      spirituality: p.spirituality,
      sanity: p.sanity,
      humanity: p.humanity,
      luck: p.luck,
    },
    effects: p.effects.map((e) => ({
      name: e.name,
      type: e.type as "buff" | "debuff" | "poison" | "regen",
      stat: e.stat,
      valueType: e.valueType as "fixed" | "percentage",
      power: e.power,
      duration: e.duration,
      priority: e.priority,
    })),
    tags: p.tags,
  });


  return {
    attacker: makeSnapshot(attacker),
    defender: makeSnapshot(defender),
    skill: {
      name: typeof skill?.["name"] === "string" ? skill["name"] : "攻击",
      power: (skill?.["power"] as number | Record<string, number> | undefined) ?? 1,
      damageType: (skill?.["damageType"] as CombatActionInput["skill"]["damageType"]) ?? "physical",
      targetType: (skill?.["targetType"] as CombatActionInput["skill"]["targetType"]) ?? "single",
      cost: (skill?.["cost"] as CombatActionInput["skill"]["cost"]) ?? null,
      isHeal: skill?.["isHeal"] === true,
      healAmt: (skill?.["healAmt"] as number | Record<string, number> | undefined) ?? 0,
      healType: typeof skill?.["healType"] === "string" ? skill["healType"] : "vitality",
      healValueType: (skill?.["healValueType"] as "fixed" | "percentage") ?? "percentage",
      customDamageCalculator: (skill?.["customDamageCalculator"] as string | null) ?? null,
      effects: (skill?.["effects"] as CombatActionInput["skill"]["effects"]) ?? [],
      conditionalParams: (skill?.["conditionalParams"] as CombatActionInput["skill"]["conditionalParams"]) ?? [],
    },
    tagDamageRelations,
  };
}

function parseCombatant(raw: unknown, _label: string): ParsedCombatant {
  const obj = (raw as Record<string, unknown>) ?? {};
  return {
    id: typeof obj.id === "string" ? obj.id : "",
    name: typeof obj.name === "string" ? obj.name : "未知",
    sequenceRank: typeof obj.sequenceRank === "string" ? obj.sequenceRank : "ordinary",
    vitality: typeof obj.vitality === "number" ? obj.vitality : 50,
    agility: typeof obj.agility === "number" ? obj.agility : 50,
    spirituality: typeof obj.spirituality === "number" ? obj.spirituality : 50,
    sanity: typeof obj.sanity === "number" ? obj.sanity : 50,
    humanity: typeof obj.humanity === "number" ? obj.humanity : 50,
    luck: typeof obj.luck === "number" ? obj.luck : 10,
    divinity: typeof obj.divinity === "number" ? obj.divinity : 0,
    tags: Array.isArray(obj.tags) ? obj.tags : [],
    effects: Array.isArray(obj.effects) ? obj.effects : [],
  };
}

export const resolveCombatToolDefinition: FateToolDefinition = {
  name: "resolve_combat",
  description:
    "执行一次 LOTM 战斗对抗结算。基于攻防双方属性快照 + 技能 + 伤害类型计算胜负与伤害。\n\n" +
    "使用边界：战斗轮次的对抗判定；提供双方 CombatantSnapshot（序列等级、六维当前值、神性）。\n" +
    "禁区：非战斗场景的判定走 roll_dice 或 perform_judgment；伤害结果需另行调用 update_actor_condition 持久化到 actor 属性。",
  parameters: Type.Object({
    attacker: Type.Object({
      id: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
      sequenceRank: Type.String({
        description: "序列等级: ordinary / seq-9 ~ seq-0 / old-one / pillar",
      }),
      vitality: Type.Number({ description: "当前活力值" }),
      agility: Type.Number({ description: "当前敏捷值" }),
      spirituality: Type.Number({ description: "当前灵性值" }),
      sanity: Type.Number({ description: "当前理智值" }),
      humanity: Type.Number({ description: "当前人性值" }),
      luck: Type.Number({ description: "运气值" }),
      divinity: Type.Number({ description: "神性值（默认 0）" }),
      tags: Type.Optional(Type.Array(Type.Any())),
      effects: Type.Optional(Type.Array(Type.Any())),
    }),
    defender: Type.Object({
      id: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
      sequenceRank: Type.String({
        description: "序列等级: ordinary / seq-9 ~ seq-0 / old-one / pillar",
      }),
      vitality: Type.Number({ description: "当前活力值" }),
      agility: Type.Number({ description: "当前敏捷值" }),
      spirituality: Type.Number({ description: "当前灵性值" }),
      sanity: Type.Number({ description: "当前理智值" }),
      humanity: Type.Number({ description: "当前人性值" }),
      luck: Type.Number({ description: "运气值" }),
      divinity: Type.Number({ description: "神性值（默认 0）" }),
      tags: Type.Optional(Type.Array(Type.Any())),
      effects: Type.Optional(Type.Array(Type.Any())),
    }),
    skill: Type.Object({
      name: Type.String({ description: "技能名称" }),
      power: Type.Optional(Type.Any({ description: "固定数值或序列映射表 { '-2': 185000, '0': 44400 }" })),
      damageType: Type.Optional(Type.String({ description: "伤害类型: physical / mystical / mental / mixed（默认 physical）" })),
      targetType: Type.Optional(Type.String({ description: "目标类型: single / all（默认 single）" })),
      cost: Type.Optional(Type.Any({ description: "消耗配置: { type: string, amount: number }" })),
      isHeal: Type.Optional(Type.Boolean({ description: "是否为治疗技能" })),
      healAmt: Type.Optional(Type.Any({ description: "治疗量" })),
      healType: Type.Optional(Type.String({ description: "目标属性" })),
      healValueType: Type.Optional(Type.String({ description: "fixed / percentage" })),
      customDamageCalculator: Type.Optional(Type.String({ description: "fixedDamage / percentDamage / trueDamage" })),
      effects: Type.Optional(Type.Array(Type.Any())),
      conditionalParams: Type.Optional(Type.Array(Type.Any())),
    }),
    tagDamageRelations: Type.Optional(Type.Any({ description: "标签克制关系映射" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    resolveCombatTool(params, ctx.sessionManager),
};