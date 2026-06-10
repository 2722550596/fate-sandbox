import type { ToolResult } from "../runtime/tool-result";

import { progressSceneBeat } from "../../engine/core/scene-beat-lifecycle";
import { parseSceneBeatProgressInput } from "../../engine/core/scene-beat-schema";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

export function progressSceneBeatTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () =>
      progressSceneBeat(parseSceneBeatProgressInput(params, "progress_scene_beat 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}
