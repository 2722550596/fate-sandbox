import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import { patchState } from "../../engine/core/state-store.ts";
import { writeStateToDetails } from "../../engine/core/state-persistence.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

export function patchStateTool(params: unknown, _sessionManager: unknown): ToolResult {
  const opsRaw = isRecord(params) ? params["ops"] : undefined;
  patchState(Array.isArray(opsRaw) ? opsRaw : []);
  const details: Record<string, unknown> = {};
  writeStateToDetails(details);
  return textResult("patch_state 已禁用：常规玩法必须使用领域 update 工具。", details);
}

export const patchStateToolDefinition: FsnToolDefinition = {
  name: "patch_state",
  description: "【调试工具】裸 JSON Patch 已禁用；常规玩法必须使用领域 update 工具。",
  parameters: Type.Object({
    ops: Type.Array(
      Type.Object({
        op: Type.Literal("replace"),
        path: Type.String(),
        value: Type.Unknown(),
      }),
    ),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    patchStateTool(params, ctx.sessionManager),
};
