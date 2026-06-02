import { updateActorCondition } from "../../engine/core/actor-condition";
import { writeStateToDetails } from "../../engine/core/state";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { textResult, type ToolResult } from "../runtime/tool-result";
import { normalizeActorConditionEvent } from "./actor-condition-normalizer";

export function updateActorConditionTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = updateActorCondition(normalizeActorConditionEvent(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

