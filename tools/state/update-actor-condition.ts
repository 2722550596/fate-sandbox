import type { ActorConditionEvent } from "../../engine/core/actor-condition";

import { updateActorCondition } from "../../engine/core/actor-condition";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function updateActorConditionTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = updateActorCondition(assertActorConditionEvent(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

function assertActorConditionEvent(params: unknown): ActorConditionEvent {
  return params as ActorConditionEvent; // safe: actor-condition engine validates actor/item existence and event fields before mutation.
}
