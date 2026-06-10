import type { ToolResult } from "../runtime/tool-result";

import { recordOffscreenEvent } from "../../engine/core/offscreen-event";
import { parseRecordOffscreenEventInput } from "../../engine/core/offscreen-event-schema";

import { runDomainEventTool } from "./domain-tool-runner";
import { isRecord } from "../../engine/core/typebox-validation";

export function recordOffscreenEventTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      assertNotPlayerKnown(params);
      const event = parseRecordOffscreenEventInput(params, "record_offscreen_event 参数");
      return { event, result: recordOffscreenEvent(draft, event) };
    },
    details: ({ result }) => ({ result }),
    message: ({ event, result }) => `幕后事件已记录：${result.eventId}\n- ${event.summary}`,
  });
}

/** player-known 有专属指引（改用 record_memory），必须先于 schema 枚举报错。 */
function assertNotPlayerKnown(params: unknown): void {
  if (isRecord(params) && params["visibility"] === "player-known") {
    throw new Error("record_offscreen_event 禁止写入 player-known；请改用 record_memory。");
  }
}
