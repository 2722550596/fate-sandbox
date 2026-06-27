/**
 * 阵营时钟与到期义务（backlog #3，BITD 进度钟）。
 *
 * 「世界不为玩家暂停」从 prompt 自觉变成机械载体：幕后势力的推进记在
 * secret state 的 factionClocks / scheduledEvents 里；canonical commit
 * 推进时间越过 dueAt 或时钟填满时，工具返回值直接催账——GM 不需要记得。
 */

import type { FactionClock, ScheduledEvent, State } from "../state/state.ts";

import { Temporal } from "@js-temporal/polyfill";

import { createId } from "./utils/ids.ts";
import {
  assertIsoDateString,
  assertNonEmptyString,
  assertNonNegativeInteger,
} from "./utils/typebox-validation.ts";

export interface UpsertFactionClockInput {
  clockId?: string;
  factionId: string;
  label: string;
  size: number;
  visibility: FactionClock["visibility"];
}

export function upsertFactionClock(draft: State, input: UpsertFactionClockInput): FactionClock {
  const size = assertNonNegativeInteger(input.size, "size");
  if (size < 2 || size > 12) {
    throw new Error(`非法 size: ${size}。faction clock 大小必须在 2-12 之间。`);
  }
  const factionId = assertNonEmptyString(input.factionId, "factionId");
  const label = assertNonEmptyString(input.label, "label");

  const existing =
    input.clockId === undefined
      ? undefined
      : draft.secrets.factionClocks.find((clock) => clock.id === input.clockId);
  if (existing !== undefined) {
    existing.factionId = factionId;
    existing.label = label;
    existing.size = size;
    existing.visibility = input.visibility;
    if (existing.filled > size) existing.filled = size;
    return existing;
  }
  const clock: FactionClock = {
    id: input.clockId ?? createId(draft, "faction-clock"),
    factionId,
    label,
    filled: 0,
    size,
    visibility: input.visibility,
  };
  draft.secrets.factionClocks.push(clock);
  return clock;
}

export interface AdvanceFactionClockResult {
  clock: FactionClock;
  becameFull: boolean;
}

export function advanceFactionClock(
  draft: State,
  clockId: string,
  ticks: number,
  reason: string,
): AdvanceFactionClockResult {
  assertNonEmptyString(reason, "reason");
  const ticksValue = assertNonNegativeInteger(ticks, "ticks");
  if (ticksValue === 0) {
    throw new Error("ticks 必须大于 0；不推进就不要调用 advance-clock。");
  }
  const clock = requireClock(draft, clockId);
  const wasFull = clock.filled >= clock.size;
  clock.filled = Math.min(clock.size, clock.filled + ticksValue);
  return { clock, becameFull: !wasFull && clock.filled >= clock.size };
}

/** 时钟填满兑现格局变化后归零；outcomeSummary 记入 secretEventLog 留痕。 */
export function resetFactionClock(
  draft: State,
  clockId: string,
  outcomeSummary: string,
): FactionClock {
  const summary = assertNonEmptyString(outcomeSummary, "outcomeSummary");
  const clock = requireClock(draft, clockId);
  draft.secrets.secretEventLog.push({
    id: createId(draft, "secret-event"),
    time: draft.public.clock.currentAt,
    summary: `[faction-clock:${clock.label}] ${summary}`,
    relatedActorIds: [],
  });
  clock.filled = 0;
  return clock;
}

export function retireFactionClock(draft: State, clockId: string, reason: string): FactionClock {
  assertNonEmptyString(reason, "reason");
  const clock = requireClock(draft, clockId);
  draft.secrets.factionClocks = draft.secrets.factionClocks.filter((entry) => entry.id !== clockId);
  return clock;
}

export function scheduleEvent(draft: State, dueAt: string, summary: string): ScheduledEvent {
  const due = assertIsoDateString(dueAt, "dueAt");
  if (Temporal.Instant.compare(Temporal.Instant.from(due), currentInstant(draft)) <= 0) {
    throw new Error(`非法 dueAt: ${due} 不晚于当前游戏时间 ${draft.public.clock.currentAt}。`);
  }
  const event: ScheduledEvent = {
    id: createId(draft, "scheduled-event"),
    dueAt: due,
    summary: assertNonEmptyString(summary, "summary"),
  };
  draft.secrets.scheduledEvents.push(event);
  return event;
}

/** 到期处理：兑现（记入 secretEventLog）后移除。 */
export function resolveScheduledEvent(
  draft: State,
  eventId: string,
  outcomeSummary: string,
): ScheduledEvent {
  const summary = assertNonEmptyString(outcomeSummary, "outcomeSummary");
  const event = requireScheduledEvent(draft, eventId);
  draft.secrets.secretEventLog.push({
    id: createId(draft, "secret-event"),
    time: draft.public.clock.currentAt,
    summary: `[scheduled:${event.summary}] ${summary}`,
    relatedActorIds: [],
  });
  draft.secrets.scheduledEvents = draft.secrets.scheduledEvents.filter(
    (entry) => entry.id !== eventId,
  );
  return event;
}

/** 显式展期：到期但本轮不便兑现时的合法出口。 */
export function extendScheduledEvent(
  draft: State,
  eventId: string,
  newDueAt: string,
  reason: string,
): ScheduledEvent {
  assertNonEmptyString(reason, "reason");
  const due = assertIsoDateString(newDueAt, "newDueAt");
  const event = requireScheduledEvent(draft, eventId);
  if (Temporal.Instant.compare(Temporal.Instant.from(due), currentInstant(draft)) <= 0) {
    throw new Error(`非法 newDueAt: ${due} 不晚于当前游戏时间，展期无意义。`);
  }
  event.dueAt = due;
  return event;
}

/**
 * canonical commit 的催账清单：已到期的 scheduledEvents + 已填满的时钟。
 * 只生成提醒文本，不改 state——到期处理必须走 manage_faction_clock 显式动作。
 */
export function collectBackstageDueNotices(draft: State): string[] {
  const now = currentInstant(draft);
  const notices: string[] = [];
  for (const event of draft.secrets.scheduledEvents) {
    if (Temporal.Instant.compare(Temporal.Instant.from(event.dueAt), now) <= 0) {
      notices.push(
        `⏰ 幕后倒计时已到期（${event.id}）：${event.summary}——本轮必须处理（resolve-due）或显式展期（extend-due）。`,
      );
    }
  }
  for (const clock of draft.secrets.factionClocks) {
    if (clock.filled >= clock.size) {
      notices.push(
        `⏰ 阵营时钟已填满（${clock.id}｜${clock.label}）：必须兑现一次格局变化，然后 reset-clock 或 retire-clock。`,
      );
    }
  }
  return notices;
}

function requireClock(draft: State, clockId: string): FactionClock {
  const id = assertNonEmptyString(clockId, "clockId");
  const clock = draft.secrets.factionClocks.find((entry) => entry.id === id);
  if (clock === undefined) {
    const known = draft.secrets.factionClocks.map((entry) => entry.id).join(", ") || "（无）";
    throw new Error(`faction clock 不存在: ${id}。已有时钟: ${known}。`);
  }
  return clock;
}

function requireScheduledEvent(draft: State, eventId: string): ScheduledEvent {
  const id = assertNonEmptyString(eventId, "eventId");
  const event = draft.secrets.scheduledEvents.find((entry) => entry.id === id);
  if (event === undefined) {
    const known = draft.secrets.scheduledEvents.map((entry) => entry.id).join(", ") || "（无）";
    throw new Error(`scheduled event 不存在: ${id}。待办事件: ${known}。`);
  }
  return event;
}

function currentInstant(draft: State): Temporal.Instant {
  return Temporal.Instant.from(draft.public.clock.currentAt);
}
