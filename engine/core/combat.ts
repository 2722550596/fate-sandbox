import type { AttributeSnapshot } from "./attribute-calculator.ts";
import type { DamageType, SequenceRank } from "./state-enum-schemas.ts";

import { calculateAttack, calculateDefense, getTargetAttribute } from "./attribute-calculator.ts";

/**
 * LOTM 战斗结算参数。
 */
export interface CombatParams {
  attacker: CombatantSnapshot;
  defender: CombatantSnapshot;
  skillPower: number;
  damageType: DamageType;
}

export interface CombatantSnapshot {
  sequenceRank: SequenceRank;
  stats: AttributeSnapshot;
  divinity: number;
}

export interface CombatResult {
  attackRoll: number;
  defenseRoll: number;
  attackSuccess: boolean;
  damage: number;
  targetAttribute: "currentVitality" | "currentReason";
  details: string;
}

/**
 * 执行一次 LOTM 战斗结算。
 *
 * 流程：
 * 1. 对抗判定（攻击方 vs 防御方，基于敏捷 + 骰子）
 * 2. 攻方成功 → 计算伤害
 * 3. 防方成功 → 减免伤害至 0
 */
export function resolveCombatAction(params: CombatParams): CombatResult {
  const atkAgility = params.attacker.stats.currentAgility;
  const defAgility = params.defender.stats.currentAgility;
  const atkSeqBase = getSequenceBase(params.attacker.sequenceRank);
  const defSeqBase = getSequenceBase(params.defender.sequenceRank);
  const k = Math.max(atkSeqBase, defSeqBase) * 0.01;

  const atkRoll = (atkAgility * 0.7) / k + (100 - d100()) * 0.3;
  const defRoll = (defAgility * 0.7) / k + (100 - d100()) * 0.3;
  const attackSuccess = atkRoll > defRoll;

  if (!attackSuccess) {
    return {
      attackRoll: Math.round(atkRoll),
      defenseRoll: Math.round(defRoll),
      attackSuccess: false,
      damage: 0,
      targetAttribute:
        getTargetAttribute(params.damageType) === "currentReason"
          ? "currentReason"
          : "currentVitality",
      details: `攻击对抗失败: 攻方${Math.round(atkRoll)} < 防方${Math.round(defRoll)}`,
    };
  }

  const attack = calculateAttack(params.attacker.stats, params.damageType);
  const defense = calculateDefense(params.defender.stats, params.damageType);
  const ratio = defense > 0 ? attack / defense : 1;
  const baseDamage = params.attacker.divinity * params.skillPower * ratio;
  const damage = Math.max(0, Math.floor(baseDamage * (0.9 + Math.random() * 0.2)));
  const targetAttr = getTargetAttribute(params.damageType);
  const attrKey: "currentVitality" | "currentReason" =
    targetAttr === "currentReason" ? "currentReason" : "currentVitality";

  return {
    attackRoll: Math.round(atkRoll),
    defenseRoll: Math.round(defRoll),
    attackSuccess: true,
    damage,
    targetAttribute: attrKey,
    details: `攻击对抗成功: 攻方${Math.round(atkRoll)} > 防方${Math.round(defRoll)} | 伤害=${damage} (${params.damageType})`,
  };
}

function getSequenceBase(rank: SequenceRank): number {
  const bases: Record<string, number> = {
    ordinary: 200,
    "seq-9": 300,
    "seq-8": 450,
    "seq-7": 1000,
    "seq-6": 2500,
    "seq-5": 6000,
    "seq-4": 15000,
    "seq-3": 40000,
    "seq-2": 120000,
    "seq-1": 300000,
    "seq-0": 1200000,
    "old-one": 3000000,
    pillar: 5000000,
  };
  return bases[rank] ?? 200;
}

function d100(): number {
  return Math.floor(Math.random() * 100) + 1;
}
