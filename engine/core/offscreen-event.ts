import type { OffscreenEvent, OffscreenEventSource, OffscreenEventVisibility } from "./state";

import { Temporal } from "@js-temporal/polyfill";

import {
  assertIsoDateString,
  assertNonEmptyString,
  cloneState,
  createId,
  updateState,
} from "./state";
import { assertOneOfString } from "./string-enum";

export type { OffscreenEventSource, OffscreenEventVisibility } from "./state";

export type RecordOffscreenEventInput = Omit<OffscreenEvent, "id">;

const OFFSCREEN_EVENT_VISIBILITIES = [
  "secret",
  "foreshadowed",
  "player-known",
] as const satisfies readonly OffscreenEventVisibility[];
const OFFSCREEN_EVENT_SOURCES = [
  "parallel-line-subagent",
  "gm",
  "debug",
] as const satisfies readonly OffscreenEventSource[];

export interface RecordOffscreenEventResult {
  eventId: string;
}

export function recordOffscreenEvent(input: RecordOffscreenEventInput): RecordOffscreenEventResult {
  const eventId = createId("offscreen-event");
  const visibility = assertOffscreenEventVisibility(input.visibility);
  if (visibility === "player-known") {
    throw new Error("record_offscreen_event 不能直接写入 player-known；请改用 record_memory。");
  }
  const lineId = assertNonEmptyString(input.lineId, "lineId");
  const actorIds = input.actorIds.map((actorId) => assertNonEmptyString(actorId, "actorIds[]"));
  const timeRange = {
    start: assertIsoDateString(input.timeRange.start, "timeRange.start"),
    end: assertIsoDateString(input.timeRange.end, "timeRange.end"),
  };
  assertClosedTimeRange(timeRange);
  const summary = assertNonEmptyString(input.summary, "summary");
  const consequences = input.consequences.map((consequence) =>
    assertNonEmptyString(consequence, "consequences[]"),
  );
  const futureHooks = input.futureHooks.map((futureHook) =>
    assertNonEmptyString(futureHook, "futureHooks[]"),
  );
  const createdFrom = assertOffscreenEventSource(input.createdFrom);

  updateState((draft) => {
    draft.secrets.offscreenEventLog.push({
      id: eventId,
      lineId,
      actorIds,
      timeRange,
      visibility,
      summary,
      consequences,
      futureHooks,
      createdFrom,
    });
  });

  return { eventId };
}

function assertClosedTimeRange(timeRange: OffscreenEvent["timeRange"]): void {
  if (Temporal.Instant.compare(timeRange.end, timeRange.start) < 0) {
    throw new Error("record_offscreen_event timeRange.end 不能早于 timeRange.start。");
  }
  const currentAt = cloneState().public.clock.currentAt;
  if (Temporal.Instant.compare(timeRange.end, currentAt) > 0) {
    throw new Error(
      `record_offscreen_event 只能记录已完成的幕后事件；timeRange.end ${timeRange.end} 晚于当前时间 ${currentAt}。未来候选请保留为 futureHooks，不要写入 offscreenEventLog。`,
    );
  }
}

function assertOffscreenEventVisibility(value: unknown): OffscreenEventVisibility {
  return assertOneOfString(value, OFFSCREEN_EVENT_VISIBILITIES, "visibility", {
    style: "must-be",
  });
}

function assertOffscreenEventSource(value: unknown): OffscreenEventSource {
  return assertOneOfString(value, OFFSCREEN_EVENT_SOURCES, "createdFrom", {
    style: "must-be",
  });
}
