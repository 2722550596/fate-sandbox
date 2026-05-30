import type { ServantFormEvent } from "../../engine/core/servant";

import { updateServantForm } from "../../engine/core/servant";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function updateServantFormTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = updateServantForm(assertServantFormEvent(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

function assertServantFormEvent(params: unknown): ServantFormEvent {
  return params as ServantFormEvent; // safe: servant engine validates actor existence, resources, and locked-field invariants before mutation.
}
