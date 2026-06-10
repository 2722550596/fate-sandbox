import type { ToolResult } from "../runtime/tool-result";

import { setScenePresence } from "../../engine/core/actor";
import { parseScenePresenceInput } from "../../engine/core/actor-schema";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

export function setScenePresenceTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      setScenePresence(draft, parseScenePresenceInput(params, "set_scene_presence 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}
