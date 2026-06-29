/**
 * Backstage world-motion obligation ledger（backlog #5 runtime 闭环）。
 *
 * 问题：parallel-line 触发条件命中很多次，实际调用 0 次——后台世界运动只靠
 * prompt/audit 自觉，无人看守。
 *
 * 方案（纯账本 + 延迟硬阻断，全在 engine/tool 层，不依赖子代理同步调用）：
 * - canonical turn 收尾时按可检测核心集评估触发器，命中即生成一条 backstage
 *   obligation（独立于 public obligations，落在 secrets）。
 * - 下一 canonical turn 开始前若仍有未清账的 obligation，硬拒绝提交。
 * - 清账只能由显式动作完成：record_offscreen_event 落地候选（outcome=landed），
 *   或 resolve_backstage_line 记录经审查的 no-change / blocked。子代理失败不清账。
 */

import type {
  BackstageObligation,
  BackstageResolutionOutcome,
  BackstageTrigger,
  State,
} from "../state/state.ts";

import { createId } from "../utils/ids.ts";
import { assertNonEmptyString } from "../utils/typebox-validation.ts";

/** 单轮时间推进达到此分钟数即触发后台推进义务。沿用 audit 阈值。 */
export const BACKSTAGE_BIG_TIME_ADVANCE_MINUTES = 30;
/** 连续无代价 canonical turn 达到此数即触发。 */
export const BACKSTAGE_NO_COST_STREAK_LIMIT = 2;

export interface CanonicalTurnBackstageInput {
  /** 本轮推进的游戏内分钟数 */
  elapsedMinutes: number;
  /** 本轮是否产生机械代价（伤势/资源/威胁/记忆等），用于打断 no-cost 连击 */
  hasCost: boolean;
  /** 本轮是否是 beat 收口（progress_scene_beat complete） */
  beatBoundary: boolean;
}

/**
 * canonical commit 开始前的硬阻断：账未清则拒绝整次提交。
 * 清账路径写进错误文案，引导 GM 先推进后台世界线。
 */
export function assertNoOpenBackstageObligation(draft: State): void {
  const open = draft.secrets.backstageObligations;
  if (open.length > 0) {
    throw new Error(formatOpenBackstageObligations(open));
  }
}

/**
 * canonical turn 收尾记账：更新 no-cost 连击计数，命中触发器则生成一条义务。
 * 已有未清账义务时不再叠加（同一时刻至多一条待办）。
 */
export function recordCanonicalTurnForBackstage(
  draft: State,
  input: CanonicalTurnBackstageInput,
): BackstageObligation | null {
  const pressure = draft.secrets.backstagePressure;
  if (input.hasCost || input.beatBoundary) {
    pressure.consecutiveNoCostTurns = 0;
  } else {
    pressure.consecutiveNoCostTurns += 1;
  }

  const bigTimeAdvance = input.elapsedMinutes >= BACKSTAGE_BIG_TIME_ADVANCE_MINUTES;
  const noCostStreak = pressure.consecutiveNoCostTurns >= BACKSTAGE_NO_COST_STREAK_LIMIT;
  const trigger: BackstageTrigger | null = input.beatBoundary
    ? "beat-complete"
    : bigTimeAdvance
      ? "time-advance"
      : noCostStreak
        ? "no-cost-streak"
        : null;
  if (trigger === null) {
    return null;
  }
  // 已有未清账义务：不叠加，等它先被清掉。
  if (draft.secrets.backstageObligations.length > 0) {
    return null;
  }
  const obligation: BackstageObligation = {
    id: createId(draft, "backstage-obligation"),
    trigger,
    summary: formatTriggerSummary(trigger, input),
    createdAt: draft.public.clock.currentAt,
  };
  draft.secrets.backstageObligations.push(obligation);
  // 生成后立即清零连击，避免下一轮还没清账就再次命中 no-cost-streak。
  pressure.consecutiveNoCostTurns = 0;
  return obligation;
}

export interface BackstageResolutionInput {
  outcome: BackstageResolutionOutcome;
  reasonCode: string;
  note: string;
}

/**
 * 清掉最旧的一条未清账义务（FIFO），写入审查记录，并重置 no-cost 连击。
 * 没有未清账义务时返回 undefined（调用方决定是否报错）。
 */
export function settleOldestBackstageObligation(
  draft: State,
  input: BackstageResolutionInput,
): BackstageObligation | undefined {
  const settled = draft.secrets.backstageObligations.shift();
  if (settled === undefined) {
    return undefined;
  }
  draft.secrets.backstageReviewLog.push({
    id: createId(draft, "backstage-review"),
    obligationId: settled.id,
    outcome: input.outcome,
    reasonCode: assertNonEmptyString(input.reasonCode, "reasonCode"),
    note: assertNonEmptyString(input.note, "note"),
    reviewedAt: draft.public.clock.currentAt,
  });
  draft.secrets.backstagePressure.consecutiveNoCostTurns = 0;
  return settled;
}

/** 后台进展打断 no-cost 连击（落地任何 offscreen 事件时调用）。 */
export function resetBackstagePressure(draft: State): void {
  draft.secrets.backstagePressure.consecutiveNoCostTurns = 0;
}

function formatTriggerSummary(
  trigger: BackstageTrigger,
  input: CanonicalTurnBackstageInput,
): string {
  switch (trigger) {
    case "beat-complete":
      return "Scene Beat 收口：后台世界线应同步推进一次。";
    case "time-advance":
      return `本轮推进 ${input.elapsedMinutes} 分钟（≥${BACKSTAGE_BIG_TIME_ADVANCE_MINUTES}）：后台世界线应同步推进一次。`;
    case "no-cost-streak":
      return `连续 ${BACKSTAGE_NO_COST_STREAK_LIMIT} 轮无机械代价：后台敌对进展应介入一次。`;
    default:
      return "后台世界线应推进一次。";
  }
}

function formatOpenBackstageObligations(obligations: readonly BackstageObligation[]): string {
  return [
    "存在未清账的后台世界推进义务，拒绝开始新的 canonical turn。先推进后台世界线：",
    ...obligations.map((entry) => `- [${entry.trigger}] ${entry.summary}`),
    "清账方式（任选其一）：",
    "1. run_parallel_line（引擎直接 fork 后台导演，不用手动 spawn）→ 隔轮用返回的 run_id 调 harvest_backstage_candidate（引擎自动取回+验收）→ record_offscreen_event 落地；",
    "2. 经审查确无可推进时，用 resolve_backstage_line 记录 no-change / blocked（窄结构化理由）。",
    "导演失败/未调用不算清账。",
  ].join("\n");
}
