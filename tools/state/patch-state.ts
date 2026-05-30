import { patchState, writeStateToDetails, type PatchOp } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export interface PatchStateParams {
  ops: ReadonlyArray<PatchOp>;
}

export function patchStateTool(params: PatchStateParams, _sessionManager: unknown): ToolResult {
  patchState(params.ops);
  const details: Record<string, unknown> = {};
  writeStateToDetails(details);
  return textResult("patch_state 已禁用：常规玩法必须使用领域 update 工具。", details);
}
