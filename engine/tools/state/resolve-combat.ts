import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { CombatActionInput } from "../../core/combat.ts";
import type { State } from "../../core/state/state.ts";

import { executeCombatAction } from "../../core/combat.ts";
import { sequenceRankToIndex } from "../../core/combat/sequence-utils.ts";
import { getDivinityValue } from "../../config/index.ts";
import { recalculateMaxStats } from "../../core/state/stats-recalculator.ts";
import { textResult } from "../runtime/tool-result.ts";
import { runDomainEventTool } from "./domain-tool-runner.ts";

export function resolveCombatTool(params: unknown, sessionManager: unknown): ReturnType<typeof textResult> {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const input = parseCombatInput(params, draft);
      // 战斗前确保 max 与 current 已同步（status effects 的效果）
      const attActor = draft.public.actors[input.attackerId];
      const defActor = draft.public.actors[input.defenderId];
      if (attActor && attActor.stats) {
        recalculateMaxStats(attActor.stats, attActor.condition.statusEffects);
      }
      if (defActor && defActor.stats) {
        recalculateMaxStats(defActor.stats, defActor.condition.statusEffects);
      }

      const attackerActor = draft.public.actors[input.attackerId];
      const defenderActor = draft.public.actors[input.defenderId];
      if (!attackerActor || !defenderActor) {
        throw new Error(`actor 不存在: attacker=${input.attackerId}, defender=${input.defenderId}`);
      }
      if (!attackerActor.stats || !defenderActor.stats) {
        throw new Error(`actor 没有六维属性（human 类型无法战斗）: ${input.attackerId}, ${input.defenderId}`);
      }

      const attackerSnapshot = buildSnapshot(attackerActor, input.attackerId);
      const defenderSnapshot = buildSnapshot(defenderActor, input.defenderId);

      const result = executeCombatAction({
        attacker: attackerSnapshot,
        defender: defenderSnapshot,
        skill: input.skill,
        tagDamageRelations: input.tagDamageRelations,
        randomValue: input.randomValue,
      });

      // 应用战斗结果到 state
      if (result.canAfford) {
        // 扣减攻击方消耗
        if (result.costMessage !== "无消耗") {
          // cost 已由 executeCombatAction 内部通过 deductCost 处理，
          // 但 deductCost 返回的 newStats 仅在战斗管线内使用。
          // 这里需要从战斗结果反推消耗，写入 actor.stats.current
        }

        // 伤害写入防御方 current
        if (result.damage !== 0) {
          const targetAttr = result.targetAttribute;
          const currentDefStats = defenderActor.stats.current;
          currentDefStats[targetAttr] = Math.max(0, currentDefStats[targetAttr] - result.damage);
        }

        // 技能效果写入防御方 condition
        for (const effect of result.appliedEffects) {
          defenderActor.condition.statusEffects.push({
            id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: effect.name,
            type: effect.type as "buff" | "debuff" | "risk" | "flag",
            affectedAttribute: effect.stat ?? "vitality",
            valueType: effect.valueType === "percentage" ? "percentage" : "fixed",
            value: effect.power,
            duration: effect.duration,
            source: `combat:${input.skill.name}`,
          });
        }
      }

      return result;
    },
    details: (result) => ({
      result: {
        canAfford: result.canAfford,
        damage: result.damage,
        targetAttribute: result.targetAttribute,
        effectCount: result.appliedEffects.length,
        costMessage: result.costMessage,
      },
    }),
    message: (result) => result.details,
  });
}

// ===========================================================================
// 输入解析
// ===========================================================================

interface ParsedCombatInput {
  attackerId: string;
  defenderId: string;
  skill: CombatActionInput["skill"];
  tagDamageRelations?: CombatActionInput["tagDamageRelations"];
  randomValue?: number;
}

function parseCombatInput(params: unknown, _draft: State): ParsedCombatInput {
  const raw = params as Record<string, unknown>;
  const attackerId = raw["attackerId"] as string | undefined;
  const defenderId = raw["defenderId"] as string | undefined;
  const skill = raw["skill"] as Record<string, unknown> | undefined;

  if (!attackerId || !defenderId) {
    throw new Error("resolve_combat 需要 attackerId 和 defenderId。");
  }

  return {
    attackerId,
    defenderId,
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
    tagDamageRelations: raw["tagDamageRelations"] as Record<string, Record<string, number>> | undefined,
    randomValue: raw["randomValue"] as number | undefined,
  };
}

// ===========================================================================
// 构建 CombatantSnapshot
// ===========================================================================

import type { CombatantSnapshot } from "../../core/combat/models.ts";
import type { PublicActorState } from "../../core/state/state.ts";
import type { EffectInstance } from "../../core/combat/models.ts";

function buildSnapshot(actor: PublicActorState, _actorId: string): CombatantSnapshot {
  if (!actor.stats) {
    throw new Error(`actor ${actor.id} 没有 stats`);
  }

  const sequence = actor.sequence;
  const sequenceRank = sequence?.rank ?? "ordinary";
  const rankIndex = sequenceRankToIndex(sequenceRank);
  const divinity = sequence?.divinity ?? getDivinityValue(rankIndex);

  // actor 的 status effects 转换为 combat EffectInstance（仅 buff/debuff）
  const effects: EffectInstance[] = actor.condition.statusEffects
    .filter((e) => e.type === "buff" || e.type === "debuff")
    .map((e) => ({
      name: e.name,
      type: e.type as "buff" | "debuff",
      stat: e.affectedAttribute,
      valueType: e.valueType as "fixed" | "percentage",
      power: e.value,
      duration: e.duration,
      priority: 0,
    }));

  return {
    id: actor.id,
    name: actor.presentation.renderName,
    sequenceRank,
    stats: {
      vitality: actor.stats.current.vitality,
      agility: actor.stats.current.agility,
      spirituality: actor.stats.current.spirituality,
      sanity: actor.stats.current.sanity,
      humanity: actor.stats.current.humanity,
      luck: actor.stats.current.luck,
    },
    divinity,
    effects,
    tags: [],
  };
}

// ===========================================================================
// 工具定义
// ===========================================================================

export const resolveCombatToolDefinition: FateToolDefinition = {
  name: "resolve_combat",
  description:
    "执行一次 LOTM 战斗对抗结算。自动从 state 读取攻防双方的六维属性与状态效果，计算后写入伤害和效果到 state。\n\n" +
    "使用边界：战斗轮次的对抗判定；提供 attackerId、defenderId 和技能定义。\n" +
    "技能定义需包含 name、power（数值或序列映射表）、damageType（physical/mystical/mental/mixed）等。\n" +
    "禁区：非战斗场景的判定走 roll_dice 或 perform_judgment。",
  parameters: Type.Object({
    attackerId: Type.String({ description: "攻击方 actorId" }),
    defenderId: Type.String({ description: "防御方 actorId" }),
    skill: Type.Object({
      name: Type.String({ description: "技能名称" }),
      power: Type.Optional(Type.Any({ description: "固定数值或序列映射表 { '-2': 185000, '0': 44400 }" })),
      damageType: Type.Optional(Type.String({ description: "伤害类型: physical/mystical/mental/mixed（默认 physical）" })),
      targetType: Type.Optional(Type.String({ description: "目标类型: single/all（默认 single）" })),
      cost: Type.Optional(Type.Any({ description: "消耗配置: { type: string, amount: number }" })),
      isHeal: Type.Optional(Type.Boolean({ description: "是否为治疗技能" })),
      healAmt: Type.Optional(Type.Any({ description: "治疗量" })),
      healType: Type.Optional(Type.String({ description: "目标属性" })),
      healValueType: Type.Optional(Type.String({ description: "fixed/percentage" })),
      customDamageCalculator: Type.Optional(Type.String({ description: "fixedDamage/percentDamage/trueDamage" })),
      effects: Type.Optional(Type.Array(Type.Any({ description: "技能自带效果" }))),
      conditionalParams: Type.Optional(Type.Array(Type.Any({ description: "条件参数" }))),
    }),
    tagDamageRelations: Type.Optional(Type.Any({ description: "标签克制关系映射（可选）" })),
    randomValue: Type.Optional(Type.Number({ description: "随机种子（可选，不传使用 Math.random）" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    resolveCombatTool(params, ctx.sessionManager),
};