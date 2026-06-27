// ---------------------------------------------------------------------------
// 条件参数求值 — 不用 new Function + with，用简单规则匹配
// ---------------------------------------------------------------------------

import type { CombatantSnapshot, SkillDef } from "./models.ts";

/**
 * 评估条件参数集，返回第一个匹配条件的参数合并结果。
 */
export function evaluateConditionalParams(
  skill: SkillDef,
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
  _randomValue?: number,
): Partial<SkillDef> {
  if (!skill.conditionalParams || skill.conditionalParams.length === 0) {
    return {};
  }

  for (const cp of skill.conditionalParams) {
    if (evaluateCondition(cp.condition, attacker, defender)) {
      return cp.params as unknown as Partial<SkillDef>; // oxlint-disable-line
    }
  }

  return {};
}

/**
 * 评估单条条件表达式。
 * 支持的表达式模式：
 *   1. target.当前理智 == 0 / != 0
 *   2. target.当前活力 < X / > X / <= X / >= X
 *   3. caster.当前活力 < X / > X ...
 *   4. target.hasTag('TAG')
 */
function evaluateCondition(
  expr: string,
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
): boolean {
  const trimmed = expr.trim();

  // hasTag 表达式
  const hasTagMatch = trimmed.match(/^(target|caster)\.hasTag\(['"](.+?)['"]\)$/);
  if (hasTagMatch) {
    const tagName = hasTagMatch[2];
    const target = hasTagMatch[1] === "caster" ? attacker : defender;
    return target.tags.some((t) => t.name === tagName);
  }

  // 数值比较表达式
  const compareResult = parseCompareExpression(trimmed, attacker, defender);
  if (compareResult !== null) {
    return compareResult;
  }

  return false;
}

/**
 * 解析数值比较表达式并求值。
 * 支持格式：
 *   target/caster.属性 运算符 数值
 *   target/caster.属性 运算符 caster/target.属性
 */
function parseCompareExpression(
  expr: string,
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
): boolean | null {
  const match = expr.match(
    /^(target|caster)\.(\S+?)\s*(==|!=|<=|>=|<|>)\s*(target\.(\S+?)|(\d+(?:\.\d+)?))$/,
  );
  if (!match) return null;

  const leftSubject = match[1] === "caster" ? attacker : defender;
  const leftAttr = match[2];
  const op = match[3];

  const rightAttrRef = match[5];
  const rightLiteral = match[6];

  let rightValue: number;
  if (rightAttrRef !== undefined) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- regex group 4 is always present when group 5 matches
    const rightSubject = (match[4] as string).startsWith("caster.") ? attacker : defender;
    rightValue = getNestedValue(rightSubject, rightAttrRef);
  } else if (rightLiteral !== undefined) {
    rightValue = Number.parseFloat(rightLiteral);
  } else {
    return null;
  }

  const leftValue = getNestedValue(leftSubject, leftAttr as string); // oxlint-disable-line
  if (typeof leftValue !== "number" || typeof rightValue !== "number") return null;

  switch (op) {
    case "==":
      return leftValue === rightValue;
    case "!=":
      return leftValue !== rightValue;
    case "<":
      return leftValue < rightValue;
    case ">":
      return leftValue > rightValue;
    case "<=":
      return leftValue <= rightValue;
    case ">=":
      return leftValue >= rightValue;
    default:
      return null;
  }
}

/** 从 CombatantSnapshot 中按路径取值 */
function getNestedValue(obj: CombatantSnapshot, path: string): number {
  const cleaned = path.replace(/^当前/, "").toLowerCase();
  const statsMap: Record<string, keyof CombatantSnapshot["stats"]> = {
    vitality: "vitality",
    agility: "agility",
    spirituality: "spirituality",
    sanity: "sanity",
    humanity: "humanity",
    luck: "luck",
    活力: "vitality",
    敏捷: "agility",
    灵性: "spirituality",
    理智: "sanity",
    人性: "humanity",
    运气: "luck",
  };

  const key = statsMap[cleaned] ?? statsMap[path];
  if (key !== undefined) return obj.stats[key];

  if (path === "sequenceRank") {
    const rankMap: Record<string, number> = {
      ordinary: 10,
      "seq-9": 9,
      "seq-8": 8,
      "seq-7": 7,
      "seq-6": 6,
      "seq-5": 5,
      "seq-4": 4,
      "seq-3": 3,
      "seq-2": 2,
      "seq-1": 1,
      "seq-0": 0,
      "old-one": -1,
      pillar: -2,
    };
    return rankMap[obj.sequenceRank] ?? 10;
  }

  return 0;
}
