import type { FsnToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { persistCurrentState, writeStateToDetails } from "../../engine/core/state-persistence.ts";
import { resetState } from "../../engine/core/state-store.ts";
import { assertNonEmptyString, isRecord } from "../../engine/core/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

export function resetStateTool(params: unknown, sessionManager: unknown): ToolResult {
  const reason = assertNonEmptyString(isRecord(params) ? params["reason"] : undefined, "reason");
  resetState();
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { reason };
  writeStateToDetails(details);
  return textResult(`状态已重置：${reason}`, details);
}

export const resetStateToolDefinition: FsnToolDefinition = {
  name: "reset_state",
  description:
    "【调试工具】重置为新 Fate schema 初始状态；不做旧 schema migration。必须写明 reason。",
  parameters: Type.Object({ reason: Type.String() }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    resetStateTool(params, ctx.sessionManager),
};
