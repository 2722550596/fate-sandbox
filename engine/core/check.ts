import { advanceClock } from "./state";

export type CheckConsequence = "受伤" | "魔力负担";
export type RawCheckInput = Record<string, unknown>;

export interface CheckInput {
  checkType: string;
  difficulty: string;
  advantage: string;
  riskLevel: string;
  consequence: CheckConsequence;
  durationMinutes: number;
}

export interface CheckResult {
  outcome: "success" | "success-with-cost" | "failure";
  roll: { rolls: number[]; kept: number; modifier: number; total: number; dc: number };
  effects: Array<{
    reason: string;
    before: string;
    after: string;
    delta?: number;
    narrativeHint: string;
  }>;
  narrativeConstraints: string[];
}

export function assertCheckInput(raw: RawCheckInput): CheckInput {
  return {
    checkType: assertString(raw["checkType"], "checkType"),
    difficulty: assertString(raw["difficulty"], "difficulty"),
    advantage: assertString(raw["advantage"], "advantage"),
    riskLevel: assertString(raw["riskLevel"], "riskLevel"),
    consequence: assertConsequence(raw["consequence"]),
    durationMinutes: assertNonNegativeInteger(raw["durationMinutes"], "durationMinutes"),
  };
}

export function resolveCheck(input: CheckInput): CheckResult {
  advanceClock(input.durationMinutes, `${input.checkType}:${input.difficulty}`);
  const dc = difficultyDc(input.difficulty);
  const rolls = rollD20(input.advantage);
  const kept = input.advantage === "劣势" ? Math.min(...rolls) : Math.max(...rolls);
  const total = kept;
  const outcome = total >= dc ? "success" : total >= dc - 3 ? "success-with-cost" : "failure";
  return {
    outcome,
    roll: { rolls, kept, modifier: 0, total, dc },
    effects: [
      {
        reason: `${input.checkType}/${input.riskLevel}`,
        before: "未结算",
        after: outcome,
        narrativeHint: `${input.consequence} 作为叙事代价处理；不要使用旧 HP/压力数值。`,
      },
    ],
    narrativeConstraints: ["骰子只裁定不确定性；不能覆盖型月硬规则或锁定事实。"],
  };
}

function rollD20(advantage: string): number[] {
  const first = randomD20();
  if (advantage === "优势" || advantage === "劣势") {
    return [first, randomD20()];
  }
  return [first];
}

function randomD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function difficultyDc(difficulty: string): number {
  switch (difficulty) {
    case "简单":
      return 8;
    case "普通":
      return 12;
    case "困难":
      return 16;
    case "极难":
      return 20;
    case "不可能":
      return 25;
    default:
      throw new Error(`非法难度: ${difficulty}`);
  }
}

function assertConsequence(value: unknown): CheckConsequence {
  if (value === "受伤" || value === "魔力负担") return value;
  throw new Error("非法 consequence: 必须是 受伤 或 魔力负担。");
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`非法${fieldName}: 必须是非空字符串。`);
  }
  return value.trim();
}

function assertNonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  throw new Error(`非法${fieldName}: 必须是非负整数。`);
}
