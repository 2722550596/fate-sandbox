import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { persistStateAfterCommit } from "../../core/state/session-persistence.ts";
import { resetState } from "../../core/state/state-store.ts";
import { assertNonEmptyString, isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

export function resetStateTool(params: unknown, sessionManager: unknown): ToolResult {
  const reason = assertNonEmptyString(isRecord(params) ? params["reason"] : undefined, "reason");
  resetState();
  const details: Record<string, unknown> = { reason };
  persistStateAfterCommit(sessionManager, details);
  return textResult(`状态已重置：${reason}`, details);
}

export const resetStateToolDefinition: DomainToolDefinition = {
  name: "reset_state",
  description: "【调试工具】重置为初始状态；不做旧 schema migration。必须写明 reason。",
  parameters: Type.Object({ reason: Type.String() }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    resetStateTool(params, ctx.sessionManager),
};
