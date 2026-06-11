import type { FsnToolDefinition } from "../runtime/tool-definition.ts";

import { Type } from "typebox";

import { exportState, writeDebugStateFile } from "../../engine/core/state-store.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

export function exportStateTool(): ToolResult {
  const path = writeDebugStateFile();
  return textResult(`已导出当前状态到 ${path}\n\n${JSON.stringify(exportState(), null, 2)}`);
}

export const exportStateToolDefinition: FsnToolDefinition = {
  name: "export_state",
  description: "【调试工具】将当前内存状态导出到 state/state.json。严禁把 secrets 泄露给玩家。",
  parameters: Type.Object({}),
  execute: async () => exportStateTool(),
};
