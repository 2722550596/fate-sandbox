import type { State } from "./state";

export type TimeActivityKind =
  | "高压行动"
  | "低压行动"
  | "休息"
  | "睡眠"
  | "治疗"
  | "魔术治疗"
  | "安全屋整备"
  | "补魔";

export interface TimeState {
  开局时间: string;
  当前时间: string;
  当天休息分钟: number;
  当天高压分钟: number;
  当天低压分钟: number;
}

export interface TimeSegmentInput {
  minutes: number;
  activityKind: TimeActivityKind;
}

export interface TimeSegmentResult {
  beforeTime: string;
  afterTime: string;
  elapsedMinutes: number;
  crossedMidnight: boolean;
}

export function advanceTimeSegment(state: State, input: TimeSegmentInput): TimeSegmentResult {
  const beforeTime = state.时间.当前时间;
  const afterTime = advanceIsoTime(beforeTime, input.minutes);
  const crossedMidnight = crossesUtcMidnight(beforeTime, afterTime);

  state.时间.当前时间 = afterTime;
  if (crossedMidnight) {
    state.时间.当天休息分钟 = 0;
    state.时间.当天高压分钟 = 0;
    state.时间.当天低压分钟 = 0;
  }
  addActivityMinutes(state.时间, input.activityKind, input.minutes);

  return {
    beforeTime,
    afterTime,
    elapsedMinutes: elapsedGameMinutes(state),
    crossedMidnight,
  };
}

export function elapsedGameMinutes(state: State): number {
  return diffMinutes(state.时间.开局时间, state.时间.当前时间);
}

export function advanceIsoTime(isoTime: string, minutes: number): string {
  const timestamp = Date.parse(isoTime);
  if (Number.isNaN(timestamp)) {
    throw new Error(`无法推进非法时间: ${isoTime}`);
  }
  return new Date(timestamp + minutes * 60_000).toISOString();
}

export function diffMinutes(fromIso: string, toIso: string): number {
  const fromTimestamp = Date.parse(fromIso);
  const toTimestamp = Date.parse(toIso);
  if (Number.isNaN(fromTimestamp) || Number.isNaN(toTimestamp)) {
    throw new Error(`无法计算非法时间差: ${fromIso} → ${toIso}`);
  }
  return Math.floor((toTimestamp - fromTimestamp) / 60_000);
}

function addActivityMinutes(time: TimeState, kind: TimeActivityKind, minutes: number): void {
  switch (kind) {
    case "高压行动":
      time.当天高压分钟 += minutes;
      break;
    case "低压行动":
      time.当天低压分钟 += minutes;
      break;
    case "休息":
    case "睡眠":
    case "治疗":
    case "魔术治疗":
    case "安全屋整备":
    case "补魔":
      time.当天休息分钟 += minutes;
      break;
    default: {
      const exhaustive: never = kind;
      throw new Error(`未处理的时间段类型: ${String(exhaustive)}`);
    }
  }
}

function crossesUtcMidnight(beforeIso: string, afterIso: string): boolean {
  const before = new Date(beforeIso);
  const after = new Date(afterIso);
  return (
    before.getUTCFullYear() !== after.getUTCFullYear() ||
    before.getUTCMonth() !== after.getUTCMonth() ||
    before.getUTCDate() !== after.getUTCDate()
  );
}
