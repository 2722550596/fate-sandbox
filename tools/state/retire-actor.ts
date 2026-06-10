import type { ToolResult } from "../runtime/tool-result";

import { retireActor } from "../../engine/core/actor";
import { parseRetireActorInput } from "../../engine/core/actor-schema";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

export function retireActorTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => retireActor(parseRetireActorInput(params, "retire_actor 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}
