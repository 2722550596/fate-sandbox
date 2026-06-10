import { exportState, writeDebugStateFile } from "../../engine/core/state-store";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function exportStateTool(): ToolResult {
  const path = writeDebugStateFile();
  return textResult(`已导出当前状态到 ${path}\n\n${JSON.stringify(exportState(), null, 2)}`);
}
