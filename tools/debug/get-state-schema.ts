import { CURRENT_STATE_SCHEMA_VERSION } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function getStateSchemaTool(): ToolResult {
  const schema = {
    version: CURRENT_STATE_SCHEMA_VERSION,
    root: "GameState { meta, public, secrets }",
    publicAggregates: ["campaign", "clock", "scene", "actors", "trackedItems", "economy", "memory"],
    secretBoundary: "普通工具只读写 public；secrets 仅供 private/reveal/debug 路径使用。",
    regularTools: ["get_status", "update_scene", "record_memory"],
    debugOnly: ["export_state", "get_state_schema", "patch_state"],
    forbidden: "常规玩法禁止 raw JSON Patch；必须使用领域事件工具。",
  };
  return textResult(JSON.stringify(schema, null, 2));
}
