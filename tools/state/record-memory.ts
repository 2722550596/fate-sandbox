import type { MemoryEvent, MemoryEventResult } from "../../engine/core/memory";
import type { ToolResult } from "../runtime/tool-result";

import { recordMemory } from "../../engine/core/memory";
import { parseMemoryEvent } from "../../engine/core/memory-schema";

import { runDomainEventTool } from "./domain-tool-runner";
import { isRecord } from "../../engine/core/typebox-validation";

export function recordMemoryTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => {
      const event = parseMemoryEvent(normalizeSourceEventId(params), "record_memory 参数");
      return { event, result: recordMemory(draft, event) };
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

/** pin-fact 的 sourceEventId 容错：缺失/空白一律归一为 null——领域归一化，不是校验。 */
function normalizeSourceEventId(params: unknown): unknown {
  if (!isRecord(params) || params["kind"] !== "pin-fact") {
    return params;
  }
  const raw = params["sourceEventId"];
  const sourceEventId = typeof raw === "string" && raw.trim().length > 0 ? raw : null;
  return { ...params, sourceEventId };
}
