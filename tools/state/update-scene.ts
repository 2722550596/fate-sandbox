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
  if (!isRecord(params)) {
    throw new Error("update_scene 参数必须是对象。");
  }
  if (params["kind"] !== "resolve-objective") {
    return params as Parameters<typeof updateScene>[0]; // safe: engine validates discriminated event shape before mutation.
  }
  return {
    ...params,
    objectiveId: normalizeOptionalString(params["objectiveId"]),
    objectiveSummary: normalizeOptionalString(params["objectiveSummary"]),
  } as Parameters<typeof updateScene>[0]; // safe: normalization only drops blank optional selectors; engine validates the event.
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
