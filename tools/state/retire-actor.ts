import { retireActor } from "../../engine/core/actor";
import { writeStateToDetails } from "../../engine/core/state";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function retireActorTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = retireActor(assertRetireActorInput(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
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
