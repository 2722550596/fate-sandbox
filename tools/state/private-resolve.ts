import type { ToolResult } from "../runtime/tool-result";

import { privateResolve } from "../../engine/core/secrets";
import { parsePrivateResolveEvent } from "../../engine/core/secrets-schema";

import { runDomainEventTool } from "./domain-tool-runner";

export function privateResolveTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => privateResolve(parsePrivateResolveEvent(params, "private_resolve 参数")),
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
