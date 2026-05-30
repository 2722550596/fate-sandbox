import type { EconomyEvent } from "../../engine/core/economy";

import { updateEconomy } from "../../engine/core/economy";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function updateEconomyTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = updateEconomy(assertEconomyEvent(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

function assertEconomyEvent(params: unknown): EconomyEvent {
  return params as EconomyEvent; // safe: economy engine validates purse/actor existence and money invariants before mutation.
}
