import type { State } from "../state/state.ts";
import type { ActingEvent } from "./actor-schema.ts";

export type { ActingEvent } from "./actor-schema.ts";

export interface ActingResult {
  message: string;
  cuesRecorded: number;
  totalCues: number;
}

/**
 * 记录扮演反馈 — 每条 cue 作为一条可审计的扮演行为追加到 actor 的日志。
 * 引擎不做百分比计算，只记录「什么时间、什么行为、为什么」。
 *
 * 消化进度由条数反映：
 *   6 条  ≈ 消化过半
 *   12 条 ≈ 完全消化
 *   10 条 ≈ 晋升门槛
 * （GM 根据叙事密度和扮演深度自行判断，引擎不强制执行）
 */
export function recordActing(draft: State, event: ActingEvent): ActingResult {
  const actor = draft.public.actors[event.actorId];
  if (actor === undefined) {
    throw new Error(`recordActing: actor ${event.actorId} 不存在。`);
  }
  if (actor.sequence === null) {
    throw new Error(`recordActing: actor ${event.actorId} 没有非凡序列。`);
  }

  const now = draft.public.clock.currentAt;
  let cuesRecorded = 0;

  for (const incoming of event.cues) {
    actor.sequence.actingCues.push({
      key: incoming.key,
      label: incoming.label,
      reason: event.reason,
      recordedAt: now,
    });
    cuesRecorded++;
  }

  const totalCues = actor.sequence.actingCues.length;

  return {
    message: `扮演反馈已记录：新增 ${cuesRecorded} 条，累计 ${totalCues} 条扮演记录。`,
    cuesRecorded,
    totalCues,
  };
}

/** 根据扮演记录条数推导晋升准备程度。 */
export function getActingReadiness(cueCount: number): "raw" | "partial" | "ready" | "overprepared" {
  if (cueCount >= 15) return "overprepared";
  if (cueCount >= 10) return "ready";
  if (cueCount >= 6) return "partial";
  return "raw";
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
