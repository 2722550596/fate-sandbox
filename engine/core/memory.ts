import {
  assertIsoDateString,
  assertNonEmptyString,
  createId,
  updateState,
  type DailySummaryMemoryId,
  type MajorEventMemoryId,
  type MemoryFact,
  type MemoryFactId,
} from "./state";

export type MemoryEvent =
  | {
      kind: "pin-fact";
      scope: MemoryFact["scope"];
      subject: string;
      text: string;
      sourceEventId: string | null;
    }
  | {
      kind: "record-major-event";
      title: string;
      summary: string;
      consequences: string[];
    }
  | {
      kind: "record-daily-summary";
      startDate: string;
      endDate: string;
      summary: string;
    };

export interface MemoryEventResult {
  factId?: MemoryFactId;
  eventId?: MajorEventMemoryId;
  dailySummaryId?: DailySummaryMemoryId;
}

export function recordMemory(event: MemoryEvent): MemoryEventResult {
  switch (event.kind) {
    case "pin-fact":
      return recordPinnedFact(event);
    case "record-major-event":
      return recordMajorEvent(event);
    case "record-daily-summary":
      return recordDailySummary(event);
    default:
      throw new Error("unreachable memory event kind");
  }
}

function recordPinnedFact(event: Extract<MemoryEvent, { kind: "pin-fact" }>): MemoryEventResult {
  const id = createId("fact");
  updateState((draft) => {
    draft.public.memory.pinnedFacts.push({
      id,
      scope: event.scope,
      subject: assertNonEmptyString(event.subject, "subject"),
      text: assertNonEmptyString(event.text, "text"),
      since: draft.public.clock.currentAt,
      sourceEventId:
        event.sourceEventId === null
          ? null
          : assertNonEmptyString(event.sourceEventId, "sourceEventId"),
    });
  });
  return { factId: id };
}

function recordMajorEvent(
  event: Extract<MemoryEvent, { kind: "record-major-event" }>,
): MemoryEventResult {
  const id = createId("event");
  updateState((draft) => {
    draft.public.memory.eventLog.push({
      id,
      time: draft.public.clock.currentAt,
      title: assertNonEmptyString(event.title, "title"),
      summary: assertNonEmptyString(event.summary, "summary"),
      consequences: event.consequences.map((consequence) =>
        assertNonEmptyString(consequence, "consequences[]"),
      ),
    });
  });
  return { eventId: id };
}

function recordDailySummary(
  event: Extract<MemoryEvent, { kind: "record-daily-summary" }>,
): MemoryEventResult {
  const id = createId("daily");
  updateState((draft) => {
    draft.public.memory.dailySummaries.push({
      id,
      startDate: assertIsoDateString(event.startDate, "startDate"),
      endDate: assertIsoDateString(event.endDate, "endDate"),
      summary: assertNonEmptyString(event.summary, "summary"),
    });
  });
  return { dailySummaryId: id };
}
