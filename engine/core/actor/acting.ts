import type { IntensityLevel, NarrativeWeightLevel } from "../state/state-enum-schemas.ts";
import type { State, ActingCueProgress } from "../state/state.ts";
import type { ActingEvent } from "./actor-schema.ts";

export type { ActingEvent } from "./actor-schema.ts";

// ---------------------------------------------------------------------------
// 数值权重表（仅引擎内部使用，不暴露给 GM）
// ---------------------------------------------------------------------------

const INTENSITY_SCORE: Record<IntensityLevel, number> = {
  cursory: 1,
  moderate: 3,
  deep: 5,
  pivotal: 8,
};

const NARRATIVE_WEIGHT_SCORE: Record<NarrativeWeightLevel, number> = {
  casual: 1,
  witnessed: 2,
  significant: 4,
  fateful: 6,
};

// ---------------------------------------------------------------------------
// 消化完成度类型
// ---------------------------------------------------------------------------

export interface ActingReadinessResult {
  /** 基于加权总分的准备程度 */
  status: "raw" | "partial" | "ready" | "overprepared";
  /** 每条 cue 的 (intensity + narrativeWeight) 求和 */
  weightedScore: number;
  /** 累计扮演条数 */
  cueCount: number;
  /** 时间闸：最早一条记录距今是否 ≥1 个月 */
  timeConditionMet: boolean;
  /** 最早扮演记录日期，无记录时为 null */
  earliestCueDate: string | null;
}

export interface ActingResult {
  message: string;
  cuesRecorded: number;
  totalCues: number;
  readiness: ActingReadinessResult;
}

// ---------------------------------------------------------------------------
// 加权总分计算
// ---------------------------------------------------------------------------

export function computeActingWeightedScore(cues: ActingCueProgress[]): number {
  let total = 0;
  for (const cue of cues) {
    total += INTENSITY_SCORE[cue.intensity] + NARRATIVE_WEIGHT_SCORE[cue.narrativeWeight];
  }
  return total;
}

// ---------------------------------------------------------------------------
// 时间闸检查：最早一条记录距今是否 ≥ 1 个月
// ---------------------------------------------------------------------------

export function checkDigestionTimeCondition(
  cues: ActingCueProgress[],
  currentTime: string,
): { met: boolean; earliestCueDate: string | null } {
  if (cues.length === 0) {
    return { met: false, earliestCueDate: null };
  }

  // 找到最早的 recordedAt
  let earliest = cues[0]!.recordedAt;
  for (let i = 1; i < cues.length; i++) {
    const cueAt = cues[i]!.recordedAt;
    if (cueAt < earliest) {
      earliest = cueAt;
    }
  }

  const earliestDate = new Date(earliest);
  const currentDate = new Date(currentTime);

  // 加 1 个月
  const oneMonthLater = new Date(earliestDate);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

  return { met: currentDate >= oneMonthLater, earliestCueDate: earliest };
}

// ---------------------------------------------------------------------------
// 扮演准备程度（基于加权总分）
// ---------------------------------------------------------------------------

const RAW_THRESHOLD = 20;
const PARTIAL_THRESHOLD = 50;
const OVERPREPARED_THRESHOLD = 100;

export function getActingReadiness(
  weightedScore: number,
): "raw" | "partial" | "ready" | "overprepared" {
  if (weightedScore >= OVERPREPARED_THRESHOLD) return "overprepared";
  if (weightedScore >= PARTIAL_THRESHOLD) return "ready";
  if (weightedScore >= RAW_THRESHOLD) return "partial";
  return "raw";
}

// ---------------------------------------------------------------------------
// 完整消化状态
// ---------------------------------------------------------------------------

export function computeDigestionState(
  cues: ActingCueProgress[],
  currentTime: string,
): ActingReadinessResult {
  const weightedScore = computeActingWeightedScore(cues);
  const status = getActingReadiness(weightedScore);
  const { met: timeConditionMet, earliestCueDate } = checkDigestionTimeCondition(cues, currentTime);

  return {
    status,
    weightedScore,
    cueCount: cues.length,
    timeConditionMet,
    earliestCueDate,
  };
}

// ---------------------------------------------------------------------------
// 记录扮演反馈
// ---------------------------------------------------------------------------

export function recordActing(draft: State, event: ActingEvent): ActingResult {
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`recordActing: actor ${event.actorId} 不存在。`);
  }
  if (actor.sequence === null) {
    throw new Error(
      `recordActing: actor ${event.actorId} 没有非凡序列。普通人不需要扮演或消化就能在喝魔药后直接晋升。`,
    );
  }

  const now = draft.public.clock.currentAt;
  let cuesRecorded = 0;

  for (const incoming of event.cues) {
    actor.sequence.actingCues.push({
      key: incoming.key,
      label: incoming.label,
      reason: event.reason,
      recordedAt: now,
      intensity: incoming.intensity,
      narrativeWeight: incoming.narrativeWeight,
    });
    cuesRecorded++;
  }

  const digestState = computeDigestionState(actor.sequence.actingCues, now);

  let message: string;
  if (digestState.status === "ready" || digestState.status === "overprepared") {
    if (digestState.timeConditionMet) {
      message = `扮演累计已达 ${digestState.weightedScore} 分（${digestState.cueCount} 条）。消化完毕，可以尝试晋升了。`;
    } else {
      message =
        `扮演累计已达 ${digestState.weightedScore} 分（${digestState.cueCount} 条），` +
        `但最早的扮演记录（${digestState.earliestCueDate}）距今不足一个月，魔药仍在消化中。`;
    }
  } else {
    message = `扮演反馈已记录：新增 ${cuesRecorded} 条，累计 ${digestState.weightedScore} 分（${digestState.cueCount} 条，${digestState.status}）。`;
  }

  return {
    message,
    cuesRecorded,
    totalCues: digestState.cueCount,
    readiness: digestState,
  };
}

/**
 * 晋升成功后重置消化状态：清空 actingCues。
 */
export function resetDigestionAfterPromotion(draft: State, actorId: string): void {
  const actor = draft.public.actors[actorId];
  if (actor?.sequence) {
    actor.sequence.actingCues = [];
  }
}
