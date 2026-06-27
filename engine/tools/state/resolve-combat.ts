import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { CombatActionInput } from "../../core/combat.ts";
import type { CostType } from "../../core/combat/models.ts";
import type { SequenceAbilityEntry } from "../../config/pathway.ts";
import type { State } from "../../core/state/state.ts";

import { executeCombatAction } from "../../core/combat.ts";
import { sequenceRankToIndex } from "../../core/combat/sequence-utils.ts";
import { getDivinityValue } from "../../config/index.ts";
import { getPathwayAbilities } from "../../config/pathway.ts";
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
        for (const deduction of result.costDeductions) {
          attackerActor.stats.current[deduction.attribute] = Math.max(
            0,
            attackerActor.stats.current[deduction.attribute] - deduction.deductedAmount,
          );
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

function parseCombatInput(params: unknown, draft: State): ParsedCombatInput {
  const raw = params as Record<string, unknown>;
  const attackerId = raw["attackerId"] as string | undefined;
  const defenderId = raw["defenderId"] as string | undefined;
  const skillName = raw["skillName"] as string | undefined;

  if (!attackerId || !defenderId) {
    throw new Error("resolve_combat 需要 attackerId 和 defenderId。");
  }
  if (!skillName) {
    throw new Error("resolve_combat 需要 skillName（技能名称）。");
  }

  // 从 state 读取攻击方 actor，用于查 pathway 技能配置
  const attackerActor = draft.public.actors[attackerId];
  if (!attackerActor) {
    throw new Error(`actor 不存在: ${attackerId}`);
  }

  // 从 pathway 配置解析技能定义
  const skill = resolveSkillFromPathway(attackerActor, skillName);

  return {
    attackerId,
    defenderId,
    skill,
    tagDamageRelations: raw["tagDamageRelations"] as Record<string, Record<string, number>> | undefined,
    randomValue: raw["randomValue"] as number | undefined,
  };
}

/**
 * 从 actor 的 pathway + sequence rank 查找技能定义。
 * 只返回 type="非凡能力" 的技能。找不到时 fallback 到基础物理攻击。
 */
function resolveSkillFromPathway(
  actor: import("../../core/state/state.ts").PublicActorState,
  skillName: string,
): CombatActionInput["skill"] {
  const pathwayName = actor.sequence?.pathway;
  const rank = actor.sequence?.rank;

  if (pathwayName && rank) {
    // rank 如 "seq-9"，直接当文件名后缀用
    const abilities = getPathwayAbilities(pathwayName, rank);
    if (abilities) {
      const found = abilities.find(
        (a) => a.name === skillName && a.type === "非凡能力",
      );
      if (found) {
        return abilityEntryToSkill(found);
      }
    }
  }

  // fallback: 基础物理攻击
  return {
    name: skillName,
    power: 1,
    damageType: "physical",
    targetType: "single",
    cost: null,
    isHeal: false,
    healAmt: 0,
    healType: "vitality",
    healValueType: "percentage",
    customDamageCalculator: null,
    effects: [],
    conditionalParams: [],
  };
}

/** 将 pathway 配置中的能力条目转为战斗引擎的 SkillDef */
function abilityEntryToSkill(entry: SequenceAbilityEntry): CombatActionInput["skill"] {
  const power = entry["power"] as number | Record<string, number> | undefined;
  const damageType = entry["damageType"] as string | undefined;
  const targetType = entry["targetType"] as string | undefined;
  const cost = entry["cost"] as Record<string, unknown> | undefined;
  const isHeal = entry["isHeal"] === true;
  const healAmt = entry["healAmt"] as number | Record<string, number> | undefined;
  const healType = entry["healType"] as string | undefined;
  const healValueType = entry["healValueType"] as string | undefined;
  const customDamageCalculator = entry["customDamageCalculator"] as string | undefined;
  const effects = entry["effects"] as Array<Record<string, unknown>> | undefined;
  const conditionalParams = entry["conditionalParams"] as Array<Record<string, unknown>> | undefined;

  return {
    name: entry["name"] as string ?? "技能",
    power: power ?? 1,
    damageType: (damageType as CombatActionInput["skill"]["damageType"]) ?? "physical",
    targetType: (targetType as CombatActionInput["skill"]["targetType"]) ?? "single",
    cost: cost ? { type: cost["type"] as CostType, amount: cost["amount"] as number } : null,
    isHeal,
    healAmt: healAmt ?? 0,
    healType: healType ?? "vitality",
    healValueType: (healValueType as "fixed" | "percentage") ?? "fixed",
    customDamageCalculator: customDamageCalculator ?? null,
    effects: (effects ?? []) as unknown as CombatActionInput["skill"]["effects"],
    conditionalParams: (conditionalParams ?? []) as unknown as CombatActionInput["skill"]["conditionalParams"],
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
    "执行一次 LOTM 战斗对抗结算。自动从 state 读取攻防双方的六维属性与状态效果，\n" +
    "从 pathway 配置自动获取技能定义（power / damageType / effects 等），\n" +
    "计算后自动将伤害和效果写入 state。\n\n" +
    "使用边界：战斗轮次的对抗判定；提供 attackerId、defenderId 和 skillName。\n" +
    "skillName 必须与 data/pathways/<途径>/seq-<等级>.json 中的技能名称完全一致。\n" +
    "禁区：非战斗场景的判定走 roll_dice 或 perform_judgment。",
  parameters: Type.Object({
    attackerId: Type.String({ description: "攻击方 actorId" }),
    defenderId: Type.String({ description: "防御方 actorId" }),
    skillName: Type.String({ description: "技能名称（必须与 pathway 配置中的 name 完全一致）" }),
    tagDamageRelations: Type.Optional(Type.Any({ description: "标签克制关系映射（可选）" })),
    randomValue: Type.Optional(Type.Number({ description: "随机种子（可选，不传使用 Math.random）" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    resolveCombatTool(params, ctx.sessionManager),
};