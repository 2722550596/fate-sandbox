import { retireActor } from "../../engine/core/actor";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

export function retireActorTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => retireActor(assertRetireActorInput(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function assertRetireActorInput(params: unknown): { actorId: string; reason: string } {
  if (!isRecord(params)) {
    throw new Error("retire_actor 参数必须是对象。");
  }
  return {
    actorId: assertString(params["actorId"], "actorId"),
    reason: assertString(params["reason"], "reason"),
  };
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
