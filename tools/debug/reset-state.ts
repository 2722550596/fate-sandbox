import { resetState, writeStateToDetails } from "../../engine/core/state";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function resetStateTool(params: { reason: string }, sessionManager: unknown): ToolResult {
  if (params.reason.trim().length === 0) {
    throw new Error("reset_state 必须提供 reason。");
  }
  resetState();
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { reason: params.reason };
  writeStateToDetails(details);
  return textResult(`状态已重置：${params.reason}`, details);
}
