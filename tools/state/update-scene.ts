import { updateScene } from "../../engine/core/scene";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function updateSceneTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = updateScene(assertSceneEvent(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

function assertSceneEvent(params: unknown): Parameters<typeof updateScene>[0] {
  return params as Parameters<typeof updateScene>[0]; // safe: engine validates discriminated event shape before mutation.
}
