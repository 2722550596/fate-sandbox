// ---------------------------------------------------------------------------
// 战斗系统核心类型 — 数据模型
// ---------------------------------------------------------------------------

import type { DamageType, SequenceRank } from "../state/state-enum-schemas.ts";

// ===========================================================================
// 战斗单位快照
// ===========================================================================

/** 战斗时传入的单位属性快照 */
export interface CombatantSnapshot {
  id: string;
  name: string;
  sequenceRank: SequenceRank;
  stats: SixDimStats;
  divinity: number;
  effects: EffectInstance[];
  tags: TagEntry[];
}

/** 六维属性（均为当前值） */
export interface SixDimStats {
  vitality: number;
  agility: number;
  spirituality: number;
  sanity: number;
  humanity: number;
  luck: number;
}

// ===========================================================================
// 技能 / 能力定义
// ===========================================================================

/**
 * 能力定义，对应 data/pathways/<途径>/seq-?.json 中每个条目的结构。
 * power 是序列映射表或固定数值。
 */
export interface SkillDef {
  name: string;
  /** 固定数值，或序列等级→倍率的映射表 */
  power: number | PowerMap;
  damageType: DamageType;
  targetType: "single" | "all";
  cost: CostDef | null;
  isHeal: boolean;
  healAmt: number | PowerMap;
  healType: string;
  healValueType: "fixed" | "percentage";
  /** 自定义伤害计算器 */
  customDamageCalculator: string | null;
  /** 技能自有效果 */
  effects: EffectDef[];
  /** 条件参数集 */
  conditionalParams: ConditionalParamDef[];
}

/** 序列等级→数值映射，key 为 -2(支柱) ~ 9(序列9) 的数字字符串 */
export interface PowerMap {
  [key: string]: number;
}

// ===========================================================================
// 消耗
// ===========================================================================

export interface CostDef {
  type: CostType;
  amount: number;
}

export type CostType =
  | "currentVitality"
  | "currentAgility"
  | "currentSpirit"
  | "currentSanity"
  | "currentHumanity";

// ===========================================================================
// 效果
// ===========================================================================

/** 技能配置中的效果定义 */
export interface EffectDef {
  name: string;
  type: EffectType;
  stat: string | null;
  valueType: "fixed" | "percentage";
  power: number | PowerMap;
  duration: number;
  /** 效果施加目标 */
  effectTarget?: "self" | "target" | "all";
}

/** 运行时效果实例 */
export interface EffectInstance {
  name: string;
  type: EffectType;
  stat: string | null;
  valueType: "fixed" | "percentage";
  power: number; // 已解析为固定数值
  duration: number;
  priority: number;
}

export type EffectType = "buff" | "debuff" | "poison" | "regen";

/** effect.stat 中代表六维属性的值 */
export const SIX_DIM_STATS = [
  "vitality",
  "agility",
  "spirituality",
  "sanity",
  "humanity",
  "luck",
] as const;

/** effect.stat 中代表伤害修正系数的值 */
export const DAMAGE_MODIFIER_STATS = [
  "damageDealtIncrease",
  "damageDealtDecrease",
  "damageTakenIncrease",
  "damageTakenDecrease",
] as const;

// ===========================================================================
// 条件参数
// ===========================================================================

export interface ConditionalParamDef {
  condition: string;
  params: Partial<{
    power: number | PowerMap;
    damageType: DamageType;
    effects: EffectDef[];
  }>;
}

// ===========================================================================
// 标签
// ===========================================================================

export interface TagEntry {
  name: string;
  duration: number;
  stacks: number;
}

/** 标签克制关系：{ attackerTag: { defenderTag: modifier } } */
export type TagDamageRelations = Record<string, Record<string, number>>;
export type TagHealingRelations = Record<string, Record<string, number>>;

// ===========================================================================
// 外部依赖接口（替代原 window.tagManager 全局引用）
// ===========================================================================

export interface TagManagerAPI {
  getTags(combatant: CombatantSnapshot, skill?: SkillDef): TagEntry[];
  hasTag(combatant: CombatantSnapshot, tagName: string): boolean;
  getTagStacks(combatant: CombatantSnapshot, tagName: string): number;
  getTagDamageModifier(
    attacker: CombatantSnapshot,
    defender: CombatantSnapshot,
    skill: SkillDef,
    relations: TagDamageRelations,
  ): number;
  getTagHealingModifier(
    healer: CombatantSnapshot,
    target: CombatantSnapshot,
    relations: TagHealingRelations,
  ): number;
}

// ===========================================================================
// 管线输入/输出
// ===========================================================================

/** 执行一次技能攻击的完整输入 */
export interface CombatActionInput {
  attacker: CombatantSnapshot;
  defender: CombatantSnapshot;
  skill: SkillDef;
  tagDamageRelations?: TagDamageRelations;
  randomValue?: number;
}

/** 一次技能攻击的执行结果 */
export interface CombatActionResult {
  canAfford: boolean;
  costMessage: string;
  damage: number;
  targetAttribute: "vitality" | "sanity";
  appliedEffects: EffectInstance[];
  formula: string;
  details: string;
}

/** 伤害计算结果（内部用） */
export interface DamageCalcResult {
  damage: number;
  targetAttribute: "vitality" | "sanity";
  formula: string;
}
