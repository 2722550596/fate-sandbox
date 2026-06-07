import type { PrivateResolveEvent } from "../../engine/core/secrets";

import { privateResolve } from "../../engine/core/secrets";
import type { ToolResult } from "../runtime/tool-result";

import { runDomainEventTool } from "./domain-tool-runner";

export function privateResolveTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => privateResolve(assertPrivateResolveEvent(params)),
    details: (result) => ({ outcome: result.outcome }),
    message: formatResult,
  });
}

function formatResult(result: ReturnType<typeof privateResolve>): string {
  return [
    `私密结算结果：${result.outcome}`,
    "叙事约束：",
    ...result.narrativeConstraints.map((entry) => `- ${entry}`),
  ].join("\n");
}

function assertPrivateResolveEvent(params: unknown): PrivateResolveEvent {
  return params as PrivateResolveEvent; // safe: privateResolve validates actor existence and returns only player-safe constraints.
}
