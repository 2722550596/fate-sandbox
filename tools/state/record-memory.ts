import type { MemoryEvent, MemoryEventResult } from "../../engine/core/memory";

import { recordMemory } from "../../engine/core/memory";
import type { ToolResult } from "../runtime/tool-result";

import { runDomainEventTool } from "./domain-tool-runner";

export function recordMemoryTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => {
      const event = assertMemoryEvent(params);
      return { event, result: recordMemory(event) };
    },
    details: ({ result }) => ({ result }),
    message: ({ event, result }) => formatResult(event, result),
  });
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
  if (!isRecord(params)) {
    throw new Error("record_memory 参数必须是对象。");
  }
  if (params["kind"] !== "pin-fact") {
    return params as MemoryEvent; // safe: recordMemory narrows and validates required fields by event kind before mutation.
  }
  const rawSourceEventId = params["sourceEventId"];
  const sourceEventId =
    typeof rawSourceEventId === "string" && rawSourceEventId.trim().length > 0
      ? rawSourceEventId
      : null;
  return { ...params, sourceEventId } as MemoryEvent; // safe: normalized boundary value; engine validates remaining fields.
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
