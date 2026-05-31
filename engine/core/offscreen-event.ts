import type { OffscreenEvent, OffscreenEventSource, OffscreenEventVisibility } from "./state";

import { assertIsoDateString, assertNonEmptyString, createId, updateState } from "./state";

export type { OffscreenEventSource, OffscreenEventVisibility } from "./state";

export type RecordOffscreenEventInput = Omit<OffscreenEvent, "id">;

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

function assertOffscreenEventVisibility(value: unknown): OffscreenEventVisibility {
  switch (value) {
    case "secret":
    case "foreshadowed":
      return value;
    case "player-known":
      return "player-known";
    default:
      throw new Error("visibility 必须是 secret、foreshadowed 或 player-known。");
  }
}

function assertOffscreenEventSource(value: unknown): OffscreenEventSource {
  switch (value) {
    case "parallel-line-subagent":
    case "gm":
    case "debug":
      return value;
    default:
      throw new Error("createdFrom 必须是 parallel-line-subagent、gm 或 debug。");
  }
}
