import type { ToolResult } from "../runtime/tool-result";

import { initializeNewGame } from "../../engine/core/new-game-initialization";
import { parseNewGameInitializationInput } from "../../engine/core/new-game-schema";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

export function initializeNewGameTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      initializeNewGame(draft, parseNewGameInitializationInput(params, "initialize_new_game 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}
