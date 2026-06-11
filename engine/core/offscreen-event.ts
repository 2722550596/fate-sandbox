import type {
  OffscreenEvent,
  OffscreenEventSource,
  OffscreenEventVisibility,
  State,
} from "./state.ts";

import { Temporal } from "@js-temporal/polyfill";

import { createId } from "./ids.ts";
import { OFFSCREEN_EVENT_SOURCES, OFFSCREEN_EVENT_VISIBILITIES } from "./state-enum-schemas.ts";
import { assertOneOfString } from "./string-enum.ts";
import { assertIsoDateString, assertNonEmptyString } from "./typebox-validation.ts";

export type { OffscreenEventSource, OffscreenEventVisibility } from "./state.ts";

export type RecordOffscreenEventInput = Omit<OffscreenEvent, "id">;

export interface RecordOffscreenEventResult {
  eventId: string;
}

export function recordOffscreenEvent(
  draft: State,
  input: RecordOffscreenEventInput,
): RecordOffscreenEventResult {
  const eventId = createId(draft, "offscreen-event");
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
  assertClosedTimeRange(draft, timeRange);
  const summary = assertNonEmptyString(input.summary, "summary");
  const consequences = input.consequences.map((consequence) =>
    assertNonEmptyString(consequence, "consequences[]"),
  );
  const futureHooks = input.futureHooks.map((futureHook) =>
    assertNonEmptyString(futureHook, "futureHooks[]"),
  );
  const createdFrom = assertOffscreenEventSource(input.createdFrom);

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

  return { eventId };
}

function assertClosedTimeRange(draft: State, timeRange: OffscreenEvent["timeRange"]): void {
  if (Temporal.Instant.compare(timeRange.end, timeRange.start) < 0) {
    throw new Error("record_offscreen_event timeRange.end 不能早于 timeRange.start。");
  }
  const currentAt = draft.public.clock.currentAt;
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
