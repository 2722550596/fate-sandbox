import type { RecordOffscreenEventInput } from "../../engine/core/offscreen-event";
import type { OffscreenEventSource, OffscreenEventVisibility } from "../../engine/core/state";

import { recordOffscreenEvent } from "../../engine/core/offscreen-event";
import { assertOneOfString } from "../../engine/core/string-enum";
import type { ToolResult } from "../runtime/tool-result";

import { runDomainEventTool } from "./domain-tool-runner";

const TOOL_OFFSCREEN_EVENT_VISIBILITIES = [
  "secret",
  "foreshadowed",
] as const satisfies readonly OffscreenEventVisibility[];
const OFFSCREEN_EVENT_SOURCES = [
  "parallel-line-subagent",
  "gm",
  "debug",
] as const satisfies readonly OffscreenEventSource[];

export function recordOffscreenEventTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => {
      const event = assertRecordOffscreenEventInput(params);
      return { event, result: recordOffscreenEvent(event) };
    },
    details: ({ result }) => ({ result }),
    message: ({ event, result }) => `幕后事件已记录：${result.eventId}\n- ${event.summary}`,
  });
}

function assertRecordOffscreenEventInput(params: unknown): RecordOffscreenEventInput {
  if (!isRecord(params)) {
    throw new Error("record_offscreen_event 参数必须是对象。");
  }
  const visibility = params["visibility"];
  if (visibility === "player-known") {
    throw new Error("record_offscreen_event 禁止写入 player-known；请改用 record_memory。");
  }
  return {
    lineId: assertString(params["lineId"], "lineId"),
    actorIds: assertStringArray(params["actorIds"], "actorIds"),
    timeRange: assertTimeRange(params["timeRange"]),
    visibility: assertVisibility(visibility),
    summary: assertString(params["summary"], "summary"),
    consequences: assertStringArray(params["consequences"], "consequences"),
    futureHooks: assertStringArray(params["futureHooks"], "futureHooks"),
    createdFrom: assertSource(params["createdFrom"]),
  };
}

function assertTimeRange(value: unknown): RecordOffscreenEventInput["timeRange"] {
  if (!isRecord(value)) {
    throw new Error("timeRange 必须是对象。");
  }
  return { start: assertString(value["start"], "timeRange.start"), end: assertString(value["end"], "timeRange.end") };
}

function assertVisibility(value: unknown): OffscreenEventVisibility {
  return assertOneOfString(value, TOOL_OFFSCREEN_EVENT_VISIBILITIES, "visibility", {
    style: "must-be",
  });
}

function assertSource(value: unknown): OffscreenEventSource {
  return assertOneOfString(value, OFFSCREEN_EVENT_SOURCES, "createdFrom", {
    style: "must-be",
  });
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value;
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是字符串数组。`);
  }
  return value.map((entry) => assertString(entry, `${fieldName}[]`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
