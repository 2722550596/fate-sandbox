import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { patchState } from "../../core/state/state-store.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

export function patchStateTool(params: unknown, _sessionManager: unknown): ToolResult {
  const opsRaw = isRecord(params) ? params["ops"] : undefined;
  patchState(Array.isArray(opsRaw) ? opsRaw : []);
  // 已禁用的只读工具：不 commit state，不需要把全量 state 写进 details。
  return textResult("patch_state 已禁用：常规玩法必须使用领域 update 工具。");
}

export const patchStateToolDefinition: DomainToolDefinition = {
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
