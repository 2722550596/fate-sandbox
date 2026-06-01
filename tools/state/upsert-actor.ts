import type {
  ActorRegistryInput,
  PublicNpcInput,
  PublicNpcSkeletonInput,
  ServantInput,
} from "../../engine/core/actor";

import { upsertActor } from "../../engine/core/actor";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { textResult, type ToolResult } from "../runtime/tool-result";

export function upsertActorTool(params: unknown, sessionManager: unknown): ToolResult {
  const result = upsertActor(assertActorRegistryInput(params));
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = { result };
  writeStateToDetails(details);
  return textResult(result.message, details);
}

function assertActorRegistryInput(params: unknown): ActorRegistryInput {
  if (!isRecord(params)) {
    throw new Error("upsert_actor 参数必须是对象。");
  }
  const kind = assertString(params["kind"], "kind");
  switch (kind) {
    case "setup-protagonist":
      return {
        kind,
        actor: assertRecord(params["actor"], "actor"),
        reason: assertString(params["reason"], "reason"),
      } as unknown as ActorRegistryInput; // safe: actor engine validates protagonist id and state schema before persistence.
    case "upsert-public-npc":
      return {
        kind,
        npc: assertRecord(params["npc"], "npc") as unknown as PublicNpcInput,
        reason: assertString(params["reason"], "reason"),
      };
    case "ensure-public-npc":
      return {
        kind,
        npc: assertRecord(params["npc"], "npc") as unknown as PublicNpcSkeletonInput,
        reason: assertString(params["reason"], "reason"),
      };
    case "upsert-servant":
      return {
        kind,
        servant: assertRecord(params["servant"], "servant") as unknown as ServantInput,
        reason: assertString(params["reason"], "reason"),
      };
    default:
      throw new Error(`非法 upsert_actor.kind: ${kind}。`);
  }
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
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
