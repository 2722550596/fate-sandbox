// ---------------------------------------------------------------------------
// 效果管理 — buff/debuff/poison/regen 的创建、应用、处理和生命周期
// ---------------------------------------------------------------------------

import type {
  CombatantSnapshot,
  EffectDef,
  EffectInstance,
  SkillDef,
  TagHealingRelations,
} from "./models.ts";

import { resolvePowerMap } from "./sequence-utils.ts";

// ===========================================================================
// 效果创建
// ===========================================================================

/**
 * 从 EffectDef 创建运行时 EffectInstance。
 * power 序列映射在此解析为固定数值。
 */
export function createEffect(def: EffectDef, caster: CombatantSnapshot): EffectInstance {
  const power = resolvePowerMap(
    typeof def.power === "object" ? def.power : undefined,
    caster.sequenceRank,
    typeof def.power === "number" ? def.power : 0,
  );

  return {
    name: def.name,
    type: def.type,
    stat: def.stat,
    valueType: def.valueType,
    power,
    duration: def.duration ?? 3,
    priority: 0,
  };
}

// ===========================================================================
// 效果应用（同名替换规则）
// ===========================================================================

export type ApplyEffectResult =
  | { kind: "applied"; instance: EffectInstance }
  | { kind: "replaced"; old: EffectInstance; new_: EffectInstance }
  | { kind: "refreshed"; instance: EffectInstance }
  | { kind: "rejected"; existing: EffectInstance };

/**
 * 向战斗单位的 effects 列表应用一个效果。
 *
 * 同名替换规则：
 * - 新 power > 旧 power → 完全替换
 * - power 相等且新 duration > 旧 duration → 刷新持续时间
 * - 新 power < 旧 power → 拒绝
 *
 * 函数式风格：不修改原数组，返回新数组和结果。
 */
export function applyEffect(
  effects: EffectInstance[],
  newEffect: EffectInstance,
): { effects: EffectInstance[]; result: ApplyEffectResult } {
  const existingIndex = effects.findIndex((e) => e.name === newEffect.name && e.duration > 0);

  if (existingIndex === -1) {
    return {
      effects: [...effects, newEffect],
      result: { kind: "applied", instance: newEffect },
    };
  }

  const existing = effects[existingIndex];
  if (existing === undefined) {
    return {
      effects: [...effects, newEffect],
      result: { kind: "applied", instance: newEffect },
    };
  }

  if (newEffect.power > existing.power) {
    const newEffects = [...effects];
    newEffects[existingIndex] = newEffect;
    return {
      effects: newEffects,
      result: { kind: "replaced", old: existing, new_: newEffect },
    };
  }

  if (newEffect.power === existing.power && newEffect.duration > existing.duration) {
    const refreshed: EffectInstance = { ...existing, duration: newEffect.duration };
    const newEffects = [...effects];
    newEffects[existingIndex] = refreshed;
    return {
      effects: newEffects,
      result: { kind: "refreshed", instance: refreshed },
    };
  }

  return {
    effects,
    result: { kind: "rejected", existing },
  };
}

// ===========================================================================
// 效果处理（每回合/每轮）
// ===========================================================================

export interface ProcessEffectOutput {
  hero: CombatantSnapshot;
  type: "damage" | "heal" | "none";
  amount: number;
  targetStat: string;
  message: string;
}

/**
 * 处理单个效果的一次触发。
 * poison → 扣减，regen → 恢复，buff/debuff → 无运行时副作用（被动生效于攻防计算）。
 */
export function processEffect(
  hero: CombatantSnapshot,
  effect: EffectInstance,
  _tagHealingRelations?: TagHealingRelations,
): ProcessEffectOutput {
  switch (effect.type) {
    case "poison":
      return processPoison(hero, effect);
    case "regen":
      return processRegen(hero, effect);
    case "buff":
    case "debuff":
      return {
        hero,
        type: "none",
        amount: 0,
        targetStat: "",
        message: `${effect.name}: 被动生效中`,
      };
    default:
      return {
        hero,
        type: "none",
        amount: 0,
        targetStat: "",
        message: `${effect.name}: 未知效果类型`,
      };
  }
}
function processPoison(hero: CombatantSnapshot, effect: EffectInstance): ProcessEffectOutput {
  const statName = effect.stat ?? "vitality";
  const currentValue = getStatValue(hero, statName);
  const maxValue = getStatMax(hero, statName);

  let damage: number;
  if (effect.valueType === "percentage") {
    damage = Math.floor((maxValue ?? 100) * (effect.power / 100));
  } else {
    damage = effect.power;
  }

  const newValue = Math.max(0, currentValue - damage);
  const newStats = setStatValue(hero.stats, statName, newValue);

  return {
    hero: { ...hero, stats: newStats },
    type: "damage",
    amount: damage,
    targetStat: statName,
    message: `${effect.name}: ${currentValue} → ${newValue}（-${damage}）`,
  };
}

function processRegen(hero: CombatantSnapshot, effect: EffectInstance): ProcessEffectOutput {
  const statName = effect.stat ?? "vitality";
  const currentValue = getStatValue(hero, statName);
  const maxValue = getStatMax(hero, statName) ?? 100;

  let healing: number;
  if (effect.valueType === "percentage") {
    healing = Math.floor(maxValue * (effect.power / 100));
  } else {
    healing = effect.power;
  }

  const newValue = Math.min(maxValue, currentValue + healing);
  const newStats = setStatValue(hero.stats, statName, newValue);

  return {
    hero: { ...hero, stats: newStats },
    type: "heal",
    amount: healing,
    targetStat: statName,
    message: `${effect.name}: ${currentValue} → ${newValue}（+${healing}）`,
  };
}

/**
 * 批量处理所有英雄的效果（每回合结束调用）。
 * 递减 duration，清理过期效果。
 */
export function processAllEffects(
  heroes: CombatantSnapshot[],
  _tagHealingRelations?: TagHealingRelations,
): CombatantSnapshot[] {
  return heroes.map((hero) => {
    let currentHero = hero;

    for (const effect of currentHero.effects) {
      const result = processEffect(currentHero, effect);
      currentHero = result.hero;
    }

    const newEffects = currentHero.effects
      .map((e) => ({ ...e, duration: e.duration - 1 }))
      .filter((e) => e.duration > 0);

    return { ...currentHero, effects: newEffects };
  });
}

// ===========================================================================
// 技能效果批量应用
// ===========================================================================

/**
 * 从技能的 effectDefs 批量创建 EffectInstance 并应用到目标。
 * 返回新的 effects 数组和变更日志。
 */
export function applySkillEffects(
  target: CombatantSnapshot,
  skill: SkillDef,
  caster: CombatantSnapshot,
): { effects: EffectInstance[]; logs: string[] } {
  let currentEffects = [...target.effects];
  const logs: string[] = [];

  for (const def of skill.effects ?? []) {
    if (def.effectTarget === "self") continue;
    const instance = createEffect(def, caster);
    const result = applyEffect(currentEffects, instance);
    currentEffects = result.effects;

    switch (result.result.kind) {
      case "applied":
        logs.push(`[效果] ${target.name} 获得 ${instance.name}（${instance.duration}回合）`);
        break;
      case "replaced":
        logs.push(`[效果] ${target.name} ${instance.name} 替换为更强效果`);
        break;
      case "refreshed":
        logs.push(`[效果] ${target.name} ${instance.name} 持续时间刷新`);
        break;
      case "rejected":
        logs.push(`[效果] ${target.name} ${instance.name} 被拒绝（已有更强效果）`);
        break;
    }
  }

  return { effects: currentEffects, logs };
}

// ===========================================================================
// 属性读写工具
// ===========================================================================

const STAT_MAP: Record<string, keyof CombatantSnapshot["stats"]> = {
  vitality: "vitality",
  agility: "agility",
  spirituality: "spirituality",
  sanity: "sanity",
  humanity: "humanity",
  luck: "luck",
};

function getStatValue(hero: CombatantSnapshot, statName: string): number {
  const key = STAT_MAP[statName];
  if (key === undefined) return 0;
  return hero.stats[key];
}

function getStatMax(_hero: CombatantSnapshot, _statName: string): number | undefined {
  return undefined;
}

function setStatValue(
  stats: CombatantSnapshot["stats"],
  statName: string,
  value: number,
): CombatantSnapshot["stats"] {
  const key = STAT_MAP[statName];
  if (key === undefined) return stats;
  return { ...stats, [key]: value };
}
