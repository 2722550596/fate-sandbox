import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parsePrivateResolveEvent } from "../../core/knowledge/secrets-schema.ts";
import { privateResolve } from "../../core/knowledge/secrets.ts";
import { persistStateAfterCommit } from "../../core/state/session-persistence.ts";
import { cloneState, commitState } from "../../core/state/state-store.ts";
import { textResult } from "../runtime/tool-result.ts";

function formatResult(
  result: import("../../core/knowledge/secrets.ts").PrivateResolveResult,
): string {
  return [
    `私密结算结果：${result.outcome}`,
    "叙事约束：",
    ...result.narrativeConstraints.map((entry) => `- ${entry}`),
  ].join("\n");
}

export async function privateResolveTool(
  params: unknown,
  sessionManager: unknown,
): Promise<ToolResult> {
  const draft = cloneState();
  const event = parsePrivateResolveEvent(params, "private_resolve 参数");
  const result = await privateResolve(draft, event);
  commitState(draft);
  const details: Record<string, unknown> = { outcome: result.outcome };
  persistStateAfterCommit(sessionManager, details);
  return textResult(formatResult(result), details);
}

export const privateResolveToolDefinition: DomainToolDefinition = {
  name: "private_resolve",
  description:
    "窄口私密结算：隐藏反应或隐藏相性；只返回玩家安全叙事约束。\n\n" +
    "使用边界：隐藏事实参与 NPC 反应但不能公开真相，或判断两个 actor 互动是否触发隐藏相性。\n" +
    "禁区：询问完整隐藏真相/幕后动机，或替代 reveal_secret。",
  parameters: Type.Object({
    kind: Type.String({ description: "允许: hidden-reaction / secret-compatibility" }),
    actorId: Type.String({ description: "主体 actor id；必须已存在于 public actors" }),
    targetActorId: Type.Optional(
      Type.String({ description: "对象 actor id；必须已存在于 public actors" }),
    ),
    stimulus: Type.Optional(Type.String()),
    publicContext: Type.Optional(Type.String()),
    interaction: Type.Optional(Type.String()),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    privateResolveTool(params, ctx.sessionManager),
};
