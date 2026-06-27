/**
 * update_actor_impression 领域工具（backlog #6a）。
 *
 * GM 在 beat complete、compaction、或角色态度重大变化时蒸馏更新 NPC 印象卡。
 * 印象卡由 pre-response 按 scene presence 路由自动注入。
 */

import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import {
  upsertActorImpression,
  type UpsertActorImpressionInput,
} from "../../engine/core/actor/actor-impression.ts";
import { hydrateStateFromSessionManager } from "../../engine/core/utils/session-hydration.ts";
import { commitState, getState } from "../../engine/core/state/state-store.ts";
import { textResult } from "../runtime/tool-result.ts";
import { isRecord } from "../../engine/core/utils/typebox-validation.ts";

export function updateActorImpressionTool(params: unknown, sessionManager: unknown): ToolResult {
  if (sessionManager !== undefined) {
    hydrateStateFromSessionManager(sessionManager);
  }
  const state = getState();
  const input = parseToolInput(params);
  const card = upsertActorImpression(state, input);
  commitState(state);
  const name = state.public.actors[card.actorId]?.presentation.renderName ?? card.actorId;
  return textResult(
    `${name} 印象卡已更新。卡片将在该 actor 在场时自动注入 pre-response。`,
    { updatedImpression: card },
  );
}

function parseToolInput(params: unknown): UpsertActorImpressionInput {
  if (!isRecord(params)) {
    throw new Error("update_actor_impression 参数必须是对象。");
  }
  return {
    actorId: requireString(params["actorId"], "actorId"),
    presence: requireString(params["presence"], "presence"),
    actionStyle: requireString(params["actionStyle"], "actionStyle"),
    relationshipPosture: requireString(params["relationshipPosture"], "relationshipPosture"),
    voiceMaterial: requireString(params["voiceMaterial"], "voiceMaterial"),
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} 必须是非空字符串。`);
  }
  return value.trim();
}

export const updateActorImpressionToolDefinition: FateToolDefinition = {
  name: "update_actor_impression",
  description:
    "蒸馏或更新一个 NPC 的印象卡（voice/posture/texture 快照）。印象卡在该 actor 在场时自动注入 pre-response，保证 compaction 后 NPC 声音一致性。\n\n" +
    "【何时调用】\n" +
    "- Beat 结束或 arc 转换时，为重要在场 NPC 写/更新印象卡\n" +
    "- NPC 态度、关系、情绪发生重大变化时\n" +
    "- Compaction 前，为活跃 NPC 保存声音快照\n\n" +
    "【不需要调用】\n" +
    "- 纯路人、无台词配角\n" +
    "- 已有印象卡且无变化的 NPC",
  parameters: Type.Object({
    actorId: Type.String({ description: "目标 actor id；必须已存在于 public actors" }),
    presence: Type.String({ description: "外在气场：给人的第一印象、体格/气质/压迫感（1 行）" }),
    actionStyle: Type.String({ description: "行动风格：说话习惯、决策偏好、典型行为模式（1 行）" }),
    relationshipPosture: Type.String({ description: "当前对主角的姿态（1 行）" }),
    voiceMaterial: Type.String({
      description:
        "语癖/对话范例（必填）：2-3 句该角色口吻的具体示例台词 + 用词/断句/语气特征 + 典型闪避或调侪方式；" +
        "要具体到「只有这个角色会这么说」，禁止写抽象中性描述（如「说话直接/语气冷淡」）。从 canon 语感蒸馏，随情绪变化更新",
    }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    updateActorImpressionTool(params, ctx.sessionManager),
};
