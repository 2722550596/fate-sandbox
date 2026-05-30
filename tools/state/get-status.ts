import { buildGmBrief } from "../../engine/core/gm-brief";
import { getPublicState } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function getStatusTool(): ToolResult {
  return textResult(buildGmBrief(getPublicState()));
}
