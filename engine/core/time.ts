import { formatHumanTime } from "./date-time";
import { advanceClock, type State } from "./state";

export interface TimeState {
  开局时间: string;
  当前时间: string;
  当天休息分钟: number;
  当天高压分钟: number;
  当天低压分钟: number;
}

export interface AdvanceTimeOptions {
  durationMinutes: number;
  pressure: "rest" | "low" | "high";
  reason: string;
}

export interface AdvanceTimeResult {
  before: string;
  after: string;
  display: string;
}

export function advanceTime(_state: State, options: AdvanceTimeOptions): AdvanceTimeResult {
  const afterState = advanceClock(options.durationMinutes, options.reason);
  const after = afterState.public.clock.currentAt;
  return { before: after, after, display: formatHumanTime(after).display };
}

export function sameTokyoDate(leftIso: string, rightIso: string): boolean {
  return formatHumanTime(leftIso).date === formatHumanTime(rightIso).date;
}
