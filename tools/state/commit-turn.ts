import { commitTurn } from "../../engine/core/turn-commit";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import { normalizeTurnCommitInput } from "./commit-turn-normalizer";

export function commitTurnTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => commitTurn(normalizeTurnCommitInput(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}
