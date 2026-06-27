import type { DifficultyLevel, SequenceRank } from "../state/state-enum-schemas.ts";

/** 序列基准总值映射 */
export const SEQUENCE_BASE_VALUES: Readonly<Record<string, number>> = {
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
} as const;

/** DC 难度系数 */
export const DIFFICULTY_COEFFICIENTS: Readonly<Record<string, number>> = {
  trivial: 0.08,
  ordinary: 0.16,
  tricky: 0.35,
  "near-impossible": 0.36,
  blasphemous: 0.4,
} as const;

export interface JudgmentParams {
  sequenceRank: SequenceRank;
  difficulty: DifficultyLevel;
  attributes: number[];
  luck: number;
}

export type JudgmentOutcomeLabel =
  | "blessed"
  | "perfect"
  | "narrow-success"
  | "failure"
  | "loss-of-control";

export interface JudgmentResult {
  success: boolean;
  outcome: JudgmentOutcomeLabel;
  diceValue: number;
  threshold: number;
  dc: number;
  details: string;
}

/**
 * 获取序列基准总值。
 * @param rank - 序列等级
 * @returns 基准总值
 */
export function getSequenceBaseValue(rank: SequenceRank): number {
  return SEQUENCE_BASE_VALUES[rank] ?? 200;
}

/**
 * 计算 DC（难度等级）。
 * @param rank - 序列等级
 * @param difficulty - 难度等级
 * @returns DC 值
 */
export function calculateDC(rank: SequenceRank, difficulty: DifficultyLevel): number {
  const baseValue = getSequenceBaseValue(rank);
  const coefficient = DIFFICULTY_COEFFICIENTS[difficulty] ?? 0.16;
  return Math.floor(baseValue * coefficient);
}

/**
 * 计算成功阈值（0~100）。
 * @param attributes - 属性值数组
 * @param dc - DC 值
 * @param luck - 运气值
 * @returns 阈值 0-100
 */
export function calculateThreshold(attributes: number[], dc: number, luck: number): number {
  if (dc === 0) {
    return 100;
  }
  const attributeSum = attributes.reduce((sum, attr) => sum + attr, 0);
  const threshold = 40 + 40 * (attributeSum / dc - 1) + 20 * (1 - 1 / (1 + 0.005 * luck));
  return Math.max(0, Math.min(100, Math.round(threshold)));
}

/**
 * 解析骰子结果为判定标签。
 * @param diceValue - 骰子值 (1-100)
 * @param threshold - 成功阈值 (0-100)
 * @returns 判定结果标签
 */
export function parseDiceResult(diceValue: number, threshold: number): JudgmentOutcomeLabel {
  if (diceValue <= 5) {
    return "blessed";
  }
  if (diceValue >= 95) {
    return "loss-of-control";
  }
  if (diceValue <= threshold) {
    return threshold >= 80 ? "perfect" : "narrow-success";
  }
  return "failure";
}

/**
 * 执行一次 d100 判定。
 * @param params - 判定参数
 * @param rollD100 - 随机骰子函数，默认 Math.random 的 1-100
 * @returns 判定结果
 */
export function performJudgment(
  params: JudgmentParams,
  rollD100: () => number = () => Math.floor(Math.random() * 100) + 1,
): JudgmentResult {
  const sequence = params.sequenceRank;
  const difficulty = params.difficulty;
  const dc = calculateDC(sequence, difficulty);
  const threshold = calculateThreshold(params.attributes, dc, params.luck);
  const diceValue = rollD100();
  const outcome = parseDiceResult(diceValue, threshold);

  return {
    success: outcome !== "failure" && outcome !== "loss-of-control",
    outcome,
    diceValue,
    threshold,
    dc,
    details: `【判定】难度 DC=${dc}，阈值=${threshold}，骰值=[${diceValue}] → ${outcome}`,
  };
}
