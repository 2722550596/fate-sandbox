/**
 * update_actor_outfit 工具（从 actor-condition 拆分到 impression 领域）。
 *
 * 更换 actor 的外观/服装。outfit 是 presentation 的一部分，
 * 不属于 condition（affliction/wound）系统。
 */

import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { changeActorOutfit } from "../../core/actor/actor-impression.ts";
import { OUTFIT_STATE_SCHEMA } from "../../core/actor/actor-schema.ts";
import { hydrateStateFromSessionManager } from "../../core/state/session-persistence.ts";
import { commitState, getState } from "../../core/state/state-store.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult } from "../runtime/tool-result.ts";

export function updateActorOutfitTool(params: unknown, sessionManager: unknown): ToolResult {
  if (sessionManager !== undefined) {
    hydrateStateFromSessionManager(sessionManager);
  }
  const state = getState();
  const input = parseToolInput(params);
  const result = changeActorOutfit(state, input.actorId, input.outfit, input.reason);
  commitState(state);
  return textResult(result.message);
}

function parseToolInput(params: unknown): {
  actorId: string;
  outfit: { label: string; details: string };
  reason: string;
} {
  if (!isRecord(params)) {
    throw new Error("update_actor_outfit 参数必须是对象。");
  }
  return {
    actorId: requireString(params["actorId"], "actorId"),
    outfit: parseOutfit(params["outfit"]),
    reason: requireString(params["reason"], "reason"),
  };
}

function parseOutfit(value: unknown): { label: string; details: string } {
  if (!isRecord(value)) {
    throw new Error("outfit 必须是对象。");
  }
  return {
    label: requireString(value["label"], "outfit.label"),
    details: requireString(value["details"], "outfit.details"),
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} 必须是非空字符串。`);
  }
  return value.trim();
}

export const updateActorOutfitToolDefinition: DomainToolDefinition = {
  name: "update_actor_outfit",
  description:
    "更换 actor 的外观/服装（outfit）。\n\n" +
    "【何时调用】\n" +
    "- 换装、更换武器/装备、易容等外观变化\n\n" +
    "【不需要调用】\n" +
    "- 状态效果（buff/debuff/affliction）请用 update_actor_condition\n" +
    "- 纯 NPC 印象卡更新（不变更外观）请用 update_actor_impression",
  parameters: Type.Object({
    actorId: Type.String({
      description: "目标 actor id；必须已存在于 public actors",
    }),
    outfit: OUTFIT_STATE_SCHEMA,
    reason: Type.String({ description: "变更原因（GM 审计用）" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    updateActorOutfitTool(params, ctx.sessionManager),
};
