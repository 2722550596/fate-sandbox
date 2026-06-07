import type { ScenePresenceInput } from "../../engine/core/actor";

import { setScenePresence } from "../../engine/core/actor";
import type { ToolResult } from "../runtime/tool-result";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

export function setScenePresenceTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => setScenePresence(assertScenePresenceInput(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function assertScenePresenceInput(params: unknown): ScenePresenceInput {
  if (!isRecord(params)) {
    throw new Error("set_scene_presence 参数必须是对象。");
  }
  return {
    presentActorIds: assertStringArray(params["presentActorIds"], "presentActorIds"),
    allyActorIds: assertStringArray(params["allyActorIds"], "allyActorIds"),
    reason: assertString(params["reason"], "reason"),
  };
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是字符串数组。`);
  }
  return value.map((entry, index) => assertString(entry, `${fieldName}[${index}]`));
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
