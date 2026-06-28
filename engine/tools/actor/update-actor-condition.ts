import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { updateActorCondition } from "../../core/actor/actor-condition.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";
import { normalizeActorConditionEvent } from "./actor-condition-normalizer.ts";

export function updateActorConditionTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => updateActorCondition(draft, normalizeActorConditionEvent(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const updateActorConditionToolDefinition: DomainToolDefinition = {
  name: "update_actor_condition",
  description:
    "更新 actor 的非凡者状态效果（affliction）。\n\n" +
    "【使用边界】\n" +
    "- 添加/移除状态效果（buff/debuff/risk/flag），对应 add-status-effect / remove-status-effect\n" +
    "- 更改外观/服装请使用 update_actor_outfit 工具\n\n" +
    "禁区：\n" +
    "- 改写锁定身份事实、序列秘密或基础参数\n" +
    "- 用通用 HP 百分比代替离散状态效果",
  parameters: Type.Object({
    kind: Type.String({
      description: "add-affliction / resolve-condition / update-wound",
    }),
    actorId: Type.Optional(
      Type.String({ description: "目标 actor id；必须已存在于 public actors" }),
    ),
    name: Type.Optional(Type.String({ description: "add-status-effect 必填：效果名称" })),
    type: Type.Optional(
      Type.String({ description: "add-status-effect：buff / debuff / risk / flag" }),
    ),
    affectedAttribute: Type.Optional(
      Type.String({
        description:
          "add-status-effect：vitality / spirituality / reason / humanity / agility / luck",
      }),
    ),
    valueType: Type.Optional(Type.String({ description: "add-status-effect：percentage / fixed" })),
    value: Type.Optional(Type.Number({ description: "add-status-effect：效果数值" })),
    duration: Type.Optional(Type.Integer({ description: "add-status-effect：持续轮数" })),
    source: Type.Optional(Type.String({ description: "add-status-effect：效果来源" })),
    conditionId: Type.Optional(
      Type.String({ description: "remove-status-effect 必填：要移除的效果 id" }),
    ),
    outcome: Type.Optional(
      Type.String({
        description: "remove-status-effect：recovered / expired / removed",
      }),
    ),
    reason: Type.Optional(Type.String()),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    updateActorConditionTool(params, ctx.sessionManager),
};
