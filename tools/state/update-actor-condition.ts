import { updateActorCondition } from "../../engine/core/actor-condition";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import { normalizeActorConditionEvent } from "./actor-condition-normalizer";

export function updateActorConditionTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => updateActorCondition(normalizeActorConditionEvent(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

