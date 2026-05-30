import type { MemoryEvent, MemoryEventResult } from "../../engine/core/memory";

import { recordMemory } from "../../engine/core/memory";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function recordMemoryTool(params: unknown, sessionManager: unknown): ToolResult {
  const event = assertMemoryEvent(params);
  const result = recordMemory(event);
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(formatResult(event, result), details);
}

function formatResult(params: MemoryEvent, result: MemoryEventResult): string {
  switch (params.kind) {
    case "pin-fact":
      return `长期事实已记录：${result.factId ?? "?"}\n- ${params.text}`;
    case "record-major-event":
      return `重大事件已记录：${result.eventId ?? "?"}\n- ${params.title}: ${params.summary}`;
    case "record-daily-summary":
      return `日常摘要已记录：${result.dailySummaryId ?? "?"}\n- ${params.summary}`;
  }
}

function assertMemoryEvent(params: unknown): MemoryEvent {
  return params as MemoryEvent; // safe: recordMemory narrows and validates required fields by event kind before mutation.
}
