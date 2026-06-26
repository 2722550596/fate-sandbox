import type { DamageType } from "./state-enum-schemas.ts";

/**
 * 六维属性名到当前值的映射接口。
 */
export interface AttributeSnapshot {
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
}

type CurrentKey = keyof AttributeSnapshot;

/**
 * 从六维属性快照获取当前值（回退到上限值）。
 */
function currentOf(
  stats: AttributeSnapshot,
  baseAttr: "vitality" | "spirituality" | "reason" | "humanity" | "agility",
): number {
  const base = stats[baseAttr];
  const currentKey: CurrentKey =
    baseAttr === "vitality"
      ? "currentVitality"
      : baseAttr === "spirituality"
        ? "currentSpirituality"
        : baseAttr === "reason"
          ? "currentReason"
          : baseAttr === "humanity"
            ? "currentHumanity"
            : "currentAgility";
  return typeof stats[currentKey] === "number" ? stats[currentKey] : base;
}

/**
 * 获取六维属性中的当前最大值。
 */
function maxCurrent(stats: AttributeSnapshot): number {
  return Math.max(
    currentOf(stats, "vitality"),
    currentOf(stats, "spirituality"),
    currentOf(stats, "reason"),
    currentOf(stats, "humanity"),
    currentOf(stats, "agility"),
    stats.luck,
  );
}

/**
 * 根据伤害类型计算攻击力。
 */
export function calculateAttack(
  stats: AttributeSnapshot,
  damageType: DamageType = "physical",
): number {
  const maxStat = maxCurrent(stats);
  const vit = currentOf(stats, "vitality");
  const agi = currentOf(stats, "agility");
  const spi = currentOf(stats, "spirituality");
  const rea = currentOf(stats, "reason");
  const hum = currentOf(stats, "humanity");

  let specific: number;
  switch (damageType) {
    case "physical":
      specific = (vit + agi) / 2;
      break;
    case "mystical":
      specific = spi;
      break;
    case "mental":
      specific = (rea + hum) / 2;
      break;
    case "mixed":
      specific = stats.luck;
      break;
    default:
      specific = (vit + agi) / 2;
  }
  return Math.floor(specific * 0.4 + maxStat * 0.6);
}

/**
 * 根据伤害类型计算防御力。
 */
export function calculateDefense(
  stats: AttributeSnapshot,
  damageType: DamageType = "physical",
): number {
  const maxStat = maxCurrent(stats);
  const vit = currentOf(stats, "vitality");
  const agi = currentOf(stats, "agility");
  const spi = currentOf(stats, "spirituality");
  const rea = currentOf(stats, "reason");
  const hum = currentOf(stats, "humanity");

  let specific: number;
  switch (damageType) {
    case "physical":
      specific = (vit + agi) / 2;
      break;
    case "mystical":
      specific = spi;
      break;
    case "mental":
      specific = (rea + hum) / 2;
      break;
    case "mixed":
      specific = stats.luck;
      break;
    default:
      specific = (vit + agi) / 2;
  }
  return Math.floor(specific * 0.4 + maxStat * 0.6);
}

/**
 * 获取伤害类型对应的目标属性。
 */
export function getTargetAttribute(damageType: DamageType): string {
  return damageType === "mental" ? "currentReason" : "currentVitality";
}
